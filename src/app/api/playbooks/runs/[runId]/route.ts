/**
 * GET    /api/playbooks/runs/[runId] - run with its step tasks and gates
 * PATCH  /api/playbooks/runs/[runId] - cancel a run
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { runId } = await params;
    const supabase = await createClient();

    const { data: run } = await supabase
      .from("procedure_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const { data: tasks } = await supabase
      .from("tasks")
      .select(
        `id, task_number, title, status, parent_task_id, assigned_to,
         due_date, procedure_step_id, hold_reason, skip_reason,
         assigned_user:users!tasks_assigned_to_fkey(id, name, avatar_url)`
      )
      .eq("procedure_run_id", runId)
      .order("created_at");

    const stepIds = (tasks || [])
      .map((t) => t.procedure_step_id)
      .filter(Boolean);

    const { data: stepDefs } = stepIds.length
      ? await supabase
          .from("procedure_step_definitions")
          .select("id, action_type, display_order, can_skip, instructions")
          .in("id", stepIds)
      : { data: [] };

    const { data: requirements } = await supabase
      .from("task_completion_requirements")
      .select("*")
      .in("task_id", (tasks || []).map((t) => t.id));

    const stepMap = new Map((stepDefs || []).map((s) => [s.id, s]));

    const steps = (tasks || [])
      .map((t) => {
        const def = t.procedure_step_id ? stepMap.get(t.procedure_step_id) : null;
        const gates = (requirements || []).filter((r) => r.task_id === t.id);
        return {
          ...t,
          action_type: def?.action_type ?? "manual",
          instructions: def?.instructions ?? null,
          can_skip: def?.can_skip ?? false,
          display_order: def?.display_order ?? 0,
          requirements: gates,
          unmet_requirements: gates.filter(
            (g) => g.is_required && !g.is_satisfied
          ).length,
        };
      })
      .sort((a, b) => a.display_order - b.display_order);

    const settled = new Set(["completed", "cancelled", "skipped"]);
    const done = steps.filter((s) => settled.has(s.status)).length;

    return NextResponse.json({
      run: {
        ...run,
        total_steps: steps.length,
        settled_steps: done,
        progress_percent:
          steps.length > 0 ? Math.round((done / steps.length) * 100) : 0,
      },
      steps,
    });
  } catch (error) {
    console.error("Playbook run GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { runId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    if (body.status !== "cancelled") {
      return NextResponse.json(
        { error: "Only cancelling a run is supported" },
        { status: 400 }
      );
    }

    const { data: run } = await supabase
      .from("procedure_runs")
      .select("id, status")
      .eq("id", runId)
      .maybeSingle();

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (run.status !== "active") {
      return NextResponse.json(
        { error: `This run is already ${run.status}` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("procedure_runs")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: body.reason?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    if (error) {
      console.error("Error cancelling run:", error);
      return NextResponse.json(
        { error: "Failed to cancel the run" },
        { status: 500 }
      );
    }

    // Outstanding steps are cancelled with the run. Settled ones keep their
    // outcome - work that was genuinely done should not be rewritten.
    const { data: openTasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("procedure_run_id", runId)
      .not("status", "in", "(completed,cancelled,skipped)");

    for (const t of openTasks || []) {
      await supabase.rpc("task_transition", {
        p_task_id: t.id,
        p_user_id: user.id,
        p_to: "cancelled",
        p_reason: body.reason?.trim() || "Playbook cancelled",
      });
    }

    return NextResponse.json({
      success: true,
      cancelled_steps: (openTasks || []).length,
    });
  } catch (error) {
    console.error("Playbook run PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
