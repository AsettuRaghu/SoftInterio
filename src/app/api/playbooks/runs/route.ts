/**
 * GET /api/playbooks/runs?related_type=&related_id=
 *
 * Runs attached to one entity, each with a progress rollup so a caller can
 * render "4 of 25 done" without pulling every step task.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";

export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["tasks.view"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const supabase = await createClient();
    const relatedType = request.nextUrl.searchParams.get("related_type");
    const relatedId = request.nextUrl.searchParams.get("related_id");

    let query = supabase
      .from("procedure_runs")
      .select("*")
      .order("started_at", { ascending: false });

    if (relatedType) query = query.eq("related_type", relatedType);
    if (relatedId) query = query.eq("related_id", relatedId);

    const { data: runs, error } = await query;

    if (error) {
      log.error("Error listing playbook runs", error);
      return NextResponse.json(
        { error: "Failed to load playbook runs" },
        { status: 500 }
      );
    }

    if (!runs || runs.length === 0) {
      return NextResponse.json({ runs: [] });
    }

    // One query for every step task, then rolled up per run - avoids an N+1
    // when an entity carries several playbooks.
    const { data: stepTasks } = await supabase
      .from("tasks")
      .select("id, procedure_run_id, status")
      .in(
        "procedure_run_id",
        runs.map((r) => r.id)
      );

    const settled = new Set(["completed", "cancelled", "skipped"]);
    const withProgress = runs.map((run) => {
      const steps = (stepTasks || []).filter(
        (t) => t.procedure_run_id === run.id
      );
      const done = steps.filter((t) => settled.has(t.status)).length;
      return {
        ...run,
        total_steps: steps.length,
        settled_steps: done,
        completed_steps: steps.filter((t) => t.status === "completed").length,
        skipped_steps: steps.filter((t) => t.status === "skipped").length,
        progress_percent:
          steps.length > 0 ? Math.round((done / steps.length) * 100) : 0,
      };
    });

    return NextResponse.json({ runs: withProgress });
  } catch (error) {
    log.error("Playbook runs GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
