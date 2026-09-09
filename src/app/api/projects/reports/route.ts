/**
 * The numbers behind the project reports page.
 *
 *   GET /api/projects/reports
 *
 * That page was six cards reading "Coming Soon", linking to six routes that
 * did not exist. Six stubs would have been six more of the same, so this is one
 * endpoint answering the questions those cards promised, from data the app
 * already holds.
 *
 * Scoped to the caller's tenant and, where they hold only projects.view_own,
 * to their own projects - a report is a different shape of the same data, and
 * must not become the way to read a project somebody may not open.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";
import { projectAccess } from "@/lib/projects/access";

/** Milestone value: an explicit amount wins, else a percentage of the contract. */
function milestoneValue(
  m: { amount: number | null; percentage: number | null },
  contractValue: number
): number {
  if (m.amount != null) return Number(m.amount);
  if (m.percentage != null && contractValue) {
    return (Number(m.percentage) / 100) * contractValue;
  }
  return 0;
}

export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["projects.reports"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const access = projectAccess(guard.permissions, user.isSuperAdmin);

    if (access.denied) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let query = supabase
      .from("projects")
      .select(
        "id, project_number, name, status, contract_value, actual_cost, overall_progress, expected_end_date, actual_end_date, project_manager_id, created_by, created_at"
      )
      .eq("tenant_id", user.tenantId);

    // Someone limited to their own projects gets a report about their own
    // projects, not a summary of everybody's.
    if (!access.readAll) {
      query = query.or(
        `project_manager_id.eq.${user.id},created_by.eq.${user.id}`
      );
    }

    const { data: projects, error } = await query;

    if (error) {
      log.error("Failed to load projects for reports", error);
      return NextResponse.json(
        { error: "Failed to build the report" },
        { status: 500 }
      );
    }

    const list = projects ?? [];
    const today = new Date().toISOString().slice(0, 10);

    const byStatus: Record<string, number> = {};
    for (const p of list) {
      byStatus[p.status ?? "unknown"] = (byStatus[p.status ?? "unknown"] ?? 0) + 1;
    }

    const open = list.filter(
      (p) => p.status !== "completed" && p.status !== "cancelled"
    );

    // Overdue means the date has passed and the work has not finished. A
    // completed project that ran late is history, not a problem to chase.
    const overdue = open.filter(
      (p) => p.expected_end_date && p.expected_end_date < today
    );

    const contractTotal = list.reduce(
      (n, p) => n + Number(p.contract_value ?? 0),
      0
    );

    // Payments across the portfolio, so the money section is not two numbers
    // that never meet.
    const { data: milestones } = await supabase
      .from("project_payment_milestones")
      .select("project_id, amount, percentage, status, paid_amount")
      .in(
        "project_id",
        list.length ? list.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"]
      );

    const contractById = new Map(
      list.map((p) => [p.id, Number(p.contract_value ?? 0)])
    );

    let scheduled = 0;
    let received = 0;
    for (const m of milestones ?? []) {
      if (m.status === "waived") continue;
      const value = milestoneValue(m as any, contractById.get(m.project_id) ?? 0);
      scheduled += value;
      if (m.status === "paid") received += Number(m.paid_amount ?? value);
    }

    // Conversion: leads that were won, against projects that exist. Both are
    // tenant-scoped by RLS; won_at is the honest marker rather than the stage,
    // since a stage can move on afterwards.
    const { data: leads } = await supabase
      .from("leads")
      .select("id, stage, won_at, won_amount");

    const leadStages: Record<string, number> = {};
    for (const l of leads ?? []) {
      leadStages[l.stage ?? "unknown"] = (leadStages[l.stage ?? "unknown"] ?? 0) + 1;
    }
    const wonLeads = (leads ?? []).filter((l) => l.won_at);
    const wonValue = wonLeads.reduce((n, l) => n + Number(l.won_amount ?? 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        scope: access.readAll ? "tenant" : "own",
        portfolio: {
          total: list.length,
          open: open.length,
          byStatus,
          contractTotal,
          actualCostTotal: list.reduce((n, p) => n + Number(p.actual_cost ?? 0), 0),
          averageProgress: list.length
            ? Math.round(
                list.reduce((n, p) => n + Number(p.overall_progress ?? 0), 0) /
                  list.length
              )
            : 0,
        },
        delivery: {
          onTrack: open.length - overdue.length,
          overdue: overdue.length,
          overdueProjects: overdue.map((p) => ({
            id: p.id,
            projectNumber: p.project_number,
            name: p.name,
            expectedEnd: p.expected_end_date,
            progress: Number(p.overall_progress ?? 0),
            daysLate: Math.floor(
              (Date.now() - new Date(p.expected_end_date!).getTime()) / 86_400_000
            ),
          })),
          unassigned: open.filter((p) => !p.project_manager_id).length,
        },
        money: {
          contractTotal,
          scheduled,
          received,
          outstanding: scheduled - received,
          unscheduled: contractTotal - scheduled,
        },
        conversion: {
          leadStages,
          wonLeads: wonLeads.length,
          wonValue,
          projectsCreated: list.length,
        },
      },
    });
  } catch (error) {
    log.error("Project reports API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
