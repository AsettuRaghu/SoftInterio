import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

/**
 * Bring a plan's missing steps in, without disturbing what is under way.
 *
 * Deliberately additive and nothing else. Steps the playbook has gained since
 * this plan adopted it are created as tasks; every existing step is left
 * exactly as it is, whatever its state and whatever the playbook now says
 * about it. Rewriting the rules of work already begun is the thing version
 * pinning exists to prevent, and a sync that quietly did it would be worse
 * than no sync at all.
 *
 * So this answers the common case - "we forgot a step" - and refuses to be the
 * answer to "we got the whole process wrong", which is a replacement.
 */
export async function POST(
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
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const { data: run } = await supabase
      .from("procedure_runs")
      .select("id, definition_id, definition_name, definition_version")
      .eq("related_type", "project")
      .eq("related_id", id)
      .eq("tenant_id", user.tenantId)
      .eq("status", "active")
      .maybeSingle();

    if (!run) {
      return NextResponse.json(
        { error: "This project is not following a playbook." },
        { status: 404 }
      );
    }

    // What the plan already has, by stable key.
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, procedure_step_id")
      .eq("procedure_run_id", run.id);

    const stepIds = (tasks ?? [])
      .map((t) => t.procedure_step_id)
      .filter(Boolean) as string[];

    const { data: haveSteps } = await supabase
      .from("procedure_step_definitions")
      .select("id, step_key")
      .in("id", stepIds.length ? stepIds : ["00000000-0000-0000-0000-000000000000"]);

    const have = new Set((haveSteps ?? []).map((s) => s.step_key as string));
    const taskByStepId = new Map(
      (tasks ?? []).map((t) => [t.procedure_step_id as string, t.id as string])
    );
    const stepIdByKey = new Map(
      (haveSteps ?? []).map((s) => [s.step_key as string, s.id as string])
    );

    const { data: currentSteps } = await supabase
      .from("procedure_step_definitions")
      .select("*")
      .eq("definition_id", run.definition_id)
      .eq("is_current", true)
      .order("display_order");

    const missing = (currentSteps ?? []).filter(
      (s) => !have.has(s.step_key as string)
    );

    if (missing.length === 0) {
      return NextResponse.json({ added: 0, message: "Nothing to bring in." });
    }

    // Parents before children, so a new child can find its parent - which may
    // be a task the plan already had, or one created moments ago.
    const ordered = [
      ...missing.filter((s) => !s.parent_step_id),
      ...missing.filter((s) => s.parent_step_id),
    ];
    const newTaskByStepId = new Map<string, string>();
    let added = 0;

    for (const step of ordered) {
      let parentTaskId: string | null = null;
      if (step.parent_step_id) {
        const parentKey = (currentSteps ?? []).find(
          (s) => s.id === step.parent_step_id
        )?.step_key as string | undefined;
        const existingParentStepId = parentKey
          ? stepIdByKey.get(parentKey)
          : undefined;
        parentTaskId =
          newTaskByStepId.get(step.parent_step_id as string) ??
          (existingParentStepId
            ? (taskByStepId.get(existingParentStepId) ?? null)
            : null);
      }

      const { data: made, error } = await supabase
        .from("tasks")
        .insert({
          tenant_id: user.tenantId,
          title: step.title,
          description: step.instructions ?? step.description ?? null,
          priority: step.priority || "medium",
          status: "todo",
          parent_task_id: parentTaskId,
          procedure_run_id: run.id,
          procedure_step_id: step.id,
          related_type: "project",
          related_id: id,
          estimated_hours: step.estimated_hours ?? null,
          assigned_to: step.assign_to_user ?? null,
          created_by: user.id,
          updated_by: user.id,
        })
        .select("id")
        .single();

      if (error || !made) {
        log.error("Could not add a step while syncing", error, {
          projectId: id,
          stepId: step.id,
        });
        continue;
      }

      // The same gates the step would have had if the plan had started with
      // it. Shared with start_procedure_run so the two cannot drift.
      await supabase.rpc("create_step_requirements", {
        p_task_id: made.id,
        p_step_id: step.id,
      });

      newTaskByStepId.set(step.id as string, made.id);
      added += 1;
    }

    log.info("Playbook steps brought in", {
      projectId: id,
      runId: run.id,
      added,
    });

    return NextResponse.json({ added });
  } catch (error) {
    log.error("Unhandled error syncing a playbook", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
