import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";
import {
  playbookRunToPhases,
  type PlaybookUser,
} from "@/lib/projects/playbook-adapter";

/**
 * The playbook attached to this project, shaped as a phase tree.
 *
 * This is the evidence for collapsing the two workflow engines into one. The
 * project page can draw a playbook run using the tree it already has, which
 * means that tree is a view rather than an engine, and the second engine -
 * phase templates, sub-phases and their own statuses - is not carrying its
 * weight.
 *
 * Read-only. Nothing here writes, and the phase tables are untouched.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "read",
    });
    if (!gate.ok) return gate.response;

    const { data: run } = await supabase
      .from("procedure_runs")
      .select(
        "id, definition_id, definition_name, definition_version, status, started_at"
      )
      .eq("related_type", "project")
      .eq("related_id", id)
      .eq("tenant_id", user.tenantId)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!run) {
      return NextResponse.json({ playbook: null, phases: [] });
    }

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(
        "id, title, status, parent_task_id, procedure_step_id, start_date, due_date, assigned_to, started_at, completed_at, estimated_hours, actual_hours, created_at, updated_at"
      )
      .eq("procedure_run_id", run.id);

    if (tasksError) {
      log.error("Failed to load playbook tasks", tasksError, { projectId: id });
      return NextResponse.json(
        { error: "Failed to load the playbook" },
        { status: 500 }
      );
    }

    // The playbook's own ordering wins over task creation order.
    const { data: steps } = await supabase
      .from("procedure_step_definitions")
      .select("id, display_order")
      .eq("definition_id", run.definition_id);

    const { data: runStepKeys } = await supabase
      .from("procedure_step_definitions")
      .select("step_key")
      .in(
        "id",
        (tasks ?? []).map((t) => t.procedure_step_id).filter(Boolean) as string[]
      );

    const stepOrder = new Map<string, number>(
      (steps ?? []).map((s) => [s.id as string, s.display_order as number])
    );

    const assigneeIds = [
      ...new Set((tasks ?? []).map((t) => t.assigned_to).filter(Boolean)),
    ] as string[];
    const users = new Map<string, PlaybookUser>();
    if (assigneeIds.length > 0) {
      const { data: people } = await supabase
        .from("users")
        .select("id, name, email, avatar_url")
        .in("id", assigneeIds);
      (people ?? []).forEach((p) =>
        users.set(p.id, {
          id: p.id,
          name: p.name,
          email: p.email,
          avatar_url: p.avatar_url ?? undefined,
        })
      );
    }

    const phases = playbookRunToPhases({
      projectId: id,
      tasks: tasks ?? [],
      stepOrder,
      users,
    });

    /**
     * Whether the playbook has moved on since this plan adopted it.
     *
     * A run pins its version deliberately, so a plan under way is never
     * rewritten. But saying nothing about it leaves people wondering why an
     * edit had no effect - so the plan says which version it follows, and how
     * many steps it would gain by taking the current one.
     *
     * Only additions are counted. A step whose rules changed is not offered,
     * because rewriting the rules of work already begun is the thing the
     * version pinning exists to prevent.
     */
    const { data: definition } = await supabase
      .from("procedure_definitions")
      .select("version, status")
      .eq("id", run.definition_id)
      .maybeSingle();

    let drift: {
      currentVersion: number;
      behind: boolean;
      newSteps: number;
    } | null = null;

    if (definition && definition.version > run.definition_version) {
      const { data: currentSteps } = await supabase
        .from("procedure_step_definitions")
        .select("step_key")
        .eq("definition_id", run.definition_id)
        .eq("is_current", true);

      const runKeys = new Set(
        (runStepKeys ?? []).map((s) => s.step_key as string)
      );
      const added = (currentSteps ?? []).filter(
        (s) => !runKeys.has(s.step_key as string)
      ).length;

      drift = {
        currentVersion: definition.version,
        behind: true,
        newSteps: added,
      };
    }

    return NextResponse.json({
      playbook: {
        runId: run.id,
        name: run.definition_name,
        version: run.definition_version,
        startedAt: run.started_at,
        stepCount: tasks?.length ?? 0,
      },
      drift,
      phases,
    });
  } catch (error) {
    log.error("Unhandled error loading the project playbook", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
