/**
 * What the Plan tab may offer on each row.
 *
 *   GET /api/projects/:id/plan-gates
 *
 * The quick actions used to be drawn unconditionally: Start was offered on a
 * step whose predecessor had not finished, the transition refused it, and the
 * tooltip had said only "Start". Phases had no actions at all, so the row that
 * decides when a stage begins could not be started from the screen that shows
 * it.
 *
 * This answers, for every task in the active run, which transitions the server
 * would actually accept and why not. It is a view of `can_start_task` and
 * `can_complete_task` - the same functions `task_transition` consults - never a
 * second copy of the rules. A screen that disagrees with the server about what
 * is allowed is worse than one that offers nothing.
 *
 * One round trip for the whole plan: asking per task would be 33 on this
 * project alone.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export interface PlanGate {
  status: string;
  isPhase: boolean;
  canStart: boolean;
  startReason: string | null;
  canComplete: boolean;
  completeReason: string | null;
  canSkip: boolean;
  skipReason: string | null;
  skipNeedsReason: boolean;
  canHold: boolean;
  canResume: boolean;
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

    const { data, error } = await supabase.rpc("project_plan_gates", {
      p_project_id: id,
    });

    if (error) {
      // A project with no active run has no gates, which is not a failure -
      // the phase engine has its own rules and the tab still renders.
      log.warn("Could not load plan gates", { projectId: id, error: error.message });
      return NextResponse.json({ success: true, data: { gates: {} } });
    }

    const gates: Record<string, PlanGate> = {};
    for (const row of (data ?? []) as any[]) {
      gates[row.task_id] = {
        status: row.status,
        isPhase: row.is_phase,
        canStart: row.can_start,
        startReason: row.start_reason,
        canComplete: row.can_complete,
        completeReason: row.complete_reason,
        canSkip: row.can_skip,
        skipReason: row.skip_reason,
        skipNeedsReason: row.skip_needs_reason,
        canHold: row.can_hold,
        canResume: row.can_resume,
      };
    }

    // Whether this person may act at all. The gates above are about the work;
    // this is about the caller, and the UI needs both to decide what to draw.
    const mayEdit =
      user.isSuperAdmin ||
      guard.permissions?.has("tasks.edit") ||
      guard.permissions?.has("tasks.edit_all") ||
      guard.permissions?.has("projects.edit") ||
      guard.permissions?.has("projects.update");

    return NextResponse.json({
      success: true,
      data: { gates, mayEdit: !!mayEdit },
    });
  } catch (error) {
    log.error("Plan gates API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
