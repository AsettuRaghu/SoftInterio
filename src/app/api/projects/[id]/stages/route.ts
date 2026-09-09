/**
 * Where the project has got to.
 *
 *   GET /api/projects/:id/stages
 *
 * Derived on every read from the active playbook run's top-level steps, or
 * from native phases when the project has no playbook. Never stored: a
 * `current_phase_id` column is a second copy of a fact the tasks already hold,
 * and it is always the copy that drifts.
 *
 * Answers `source` alongside the stages so the UI can say which engine spoke.
 * A project silently falling back to phases is what once looked like "it shows
 * a completely different playbook I'm not aware of".
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";
import {
  deriveStagesFromPlaybook,
  deriveStagesFromPhases,
  EMPTY_STAGES,
} from "@/lib/projects/stages";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // The playbook comes first. A converted project can carry both a run and
    // leftover phase rows, and the Plan tab already prefers the run - reading
    // phases first here would put two different answers for the same project
    // on one screen.
    const { data: run } = await supabase
      .from("procedure_runs")
      .select("id, definition_id, definition_name, definition_version")
      .eq("related_type", "project")
      .eq("related_id", id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (run) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, parent_task_id, procedure_step_id")
        .eq("procedure_run_id", run.id);

      // The playbook's own order, not the order tasks happened to be created.
      const { data: steps } = await supabase
        .from("procedure_step_definitions")
        .select("id, display_order")
        .eq("definition_id", run.definition_id);

      const stepOrder = new Map(
        (steps ?? []).map((s: any) => [s.id, s.display_order ?? 0])
      );

      const derived = deriveStagesFromPlaybook({
        tasks: (tasks ?? []) as any,
        stepOrder,
        playbook: {
          name: run.definition_name,
          version: run.definition_version,
        },
      });

      return NextResponse.json({ success: true, data: derived });
    }

    const { data: phases } = await supabase
      .from("project_phases")
      .select("id, name, status, display_order, progress_percentage")
      .eq("project_id", id);

    if (!phases?.length) {
      return NextResponse.json({ success: true, data: EMPTY_STAGES });
    }

    return NextResponse.json({
      success: true,
      data: deriveStagesFromPhases(phases as any),
    });
  } catch (error) {
    log.error("Project stages API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
