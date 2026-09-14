/**
 * The numbers behind the project reports page.
 *
 *   GET /api/projects/reports
 *
 * Two audiences read this and they are not entitled to the same thing.
 *
 * A delivery team needs to know what is late, what nobody owns and where the
 * hours are going. Management needs that too, plus what the portfolio is worth
 * and what has been invoiced. So the report is built in bands, and the money
 * band is **omitted from the response entirely** for anyone without
 * `finance.payments.view` - not sent and hidden in the browser, which is not a
 * control. Owner and Admin hold everything and so see everything.
 *
 * Scope is separate from that: `projectAccess` decides *which* projects are in
 * the report at all, so a `projects.view_own` holder gets a report about their
 * own projects rather than a summary of the business.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";
import { projectAccess } from "@/lib/projects/access";

const SETTLED = ["completed", "cancelled", "skipped"];

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

/**
 * Every row, not the first thousand. A plain PostgREST select stops at 1000 and
 * says nothing, and `.limit()` does not raise it - which for a report computed
 * in TypeScript means quietly fewer overdue tasks than the team actually has.
 */
async function pageAll<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const size = 1000;
  const all: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await makeQuery(page * size, page * size + size - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < size) return all;
  }
}

interface ProjectRow {
  id: string;
  project_number: string | null;
  name: string | null;
  status: string | null;
  contract_value: number | null;
  actual_cost: number | null;
  overall_progress: number | null;
  expected_start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  project_manager_id: string | null;
  created_by: string | null;
  created_at: string;
}

interface TaskRow {
  id: string;
  title: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  related_id: string | null;
  parent_task_id: string | null;
}

export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["projects.reports"],
      loadPermissions: true,
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

    /*
     * Who may see money. Deliberately the same key that gates the payments
     * screen, so one answer governs both - a report is a different shape of the
     * same figures and must not become the way around a control.
     */
    const canSeeMoney =
      user.isSuperAdmin ||
      !!guard.permissions?.has("finance.payments.view") ||
      !!guard.permissions?.has("finance.reports");

    const projects = await pageAll<ProjectRow>((a, b) => {
      let q = supabase
        .from("projects")
        .select(
          "id, project_number, name, status, contract_value, actual_cost, overall_progress, expected_start_date, expected_end_date, actual_end_date, project_manager_id, created_by, created_at"
        )
        .eq("tenant_id", user.tenantId)
        .order("created_at", { ascending: true })
        .range(a, b);
      // Someone limited to their own projects gets a report about their own.
      if (!access.readAll) {
        q = q.or(`project_manager_id.eq.${user.id},created_by.eq.${user.id}`);
      }
      return q;
    });

    const today = new Date().toISOString().slice(0, 10);
    const ids = projects.map((p) => p.id);
    const nameOf = new Map(
      projects.map((p) => [p.id, p.name || p.project_number || "Project"])
    );
    const numberOf = new Map(projects.map((p) => [p.id, p.project_number]));

    const byStatus: Record<string, number> = {};
    for (const p of projects) {
      byStatus[p.status ?? "unknown"] = (byStatus[p.status ?? "unknown"] ?? 0) + 1;
    }

    const open = projects.filter(
      (p) => p.status !== "completed" && p.status !== "cancelled"
    );

    // Overdue means the date has passed and the work has not finished. A
    // completed project that ran late is history, not something to chase.
    const overdue = open.filter(
      (p) => p.expected_end_date && p.expected_end_date < today
    );

    const contractTotal = projects.reduce(
      (n, p) => n + Number(p.contract_value ?? 0),
      0
    );

    // --- The work itself ----------------------------------------------------
    /*
     * This band is why a delivery team would open the page. The old report
     * answered portfolio questions - value, progress, conversion - and said
     * nothing about the work, so there was nothing on it a project manager
     * could act on this morning.
     */
    const tasks = ids.length
      ? await pageAll<TaskRow>((a, b) =>
          supabase
            .from("tasks")
            .select(
              "id, title, status, due_date, assigned_to, estimated_hours, actual_hours, related_id, parent_task_id"
            )
            .eq("tenant_id", user.tenantId)
            .eq("related_type", "project")
            .in("related_id", ids)
            .order("id", { ascending: true })
            .range(a, b)
        )
      : [];

    const openTasks = tasks.filter((t) => !SETTLED.includes(t.status));
    const overdueTasks = openTasks.filter(
      (t) => t.due_date && t.due_date < today
    );
    const undatedTasks = openTasks.filter((t) => !t.due_date);
    const unassignedTasks = openTasks.filter((t) => !t.assigned_to);

    const daysLate = (due: string) =>
      Math.floor((Date.now() - new Date(due).getTime()) / 86_400_000);

    /** Late work, gathered by the project it belongs to and worst first. */
    const overdueByProject = Object.values(
      overdueTasks.reduce((acc, t) => {
        const key = t.related_id || "unknown";
        const row = (acc[key] ??= {
          projectId: key,
          projectNumber: numberOf.get(key) ?? null,
          name: nameOf.get(key) ?? "Project",
          count: 0,
          worstDays: 0,
          worstTitle: "",
        });
        row.count += 1;
        const late = daysLate(t.due_date!);
        if (late > row.worstDays) {
          row.worstDays = late;
          row.worstTitle = t.title || "Untitled task";
        }
        return acc;
      }, {} as Record<string, {
        projectId: string; projectNumber: string | null; name: string;
        count: number; worstDays: number; worstTitle: string;
      }>)
    ).sort((a, b) => b.worstDays - a.worstDays);

    /*
     * Who is carrying what. Names come from `tenant_directory`, not `users` -
     * the policies on that table are own-row-only, so selecting it here would
     * have named one person and labelled every colleague "Unassigned".
     */
    const directory = await pageAll<{ id: string; name: string | null }>((a, b) =>
      supabase.from("tenant_directory").select("id, name").range(a, b)
    );
    const personName = new Map(directory.map((d) => [d.id, d.name || "—"]));

    const byAssignee = Object.values(
      openTasks.reduce((acc, t) => {
        const key = t.assigned_to || "unassigned";
        const row = (acc[key] ??= {
          userId: key,
          name: t.assigned_to ? personName.get(key) || "Unknown" : "Unassigned",
          open: 0,
          overdue: 0,
        });
        row.open += 1;
        if (t.due_date && t.due_date < today) row.overdue += 1;
        return acc;
      }, {} as Record<string, { userId: string; name: string; open: number; overdue: number }>)
    ).sort((a, b) => b.overdue - a.overdue || b.open - a.open);

    /*
     * Hours expected against hours logged. A playbook writes an estimate onto
     * every step, so this is where a process quietly costs more than anyone
     * planned - and it reads honestly when nobody is tracking, which is worth
     * seeing too.
     */
    const hoursExpected = tasks.reduce(
      (n, t) => n + Number(t.estimated_hours ?? 0),
      0
    );
    const hoursLogged = tasks.reduce(
      (n, t) => n + Number(t.actual_hours ?? 0),
      0
    );
    const overBudget = tasks
      .filter(
        (t) =>
          Number(t.estimated_hours ?? 0) > 0 &&
          Number(t.actual_hours ?? 0) > Number(t.estimated_hours ?? 0)
      )
      .map((t) => ({
        id: t.id,
        title: t.title || "Untitled task",
        project: nameOf.get(t.related_id || "") ?? "Project",
        expected: Number(t.estimated_hours ?? 0),
        logged: Number(t.actual_hours ?? 0),
      }))
      .sort((a, b) => b.logged - a.logged - (b.expected - a.expected))
      .slice(0, 8);

    const response: Record<string, unknown> = {
      scope: access.readAll ? "tenant" : "own",
      canSeeMoney,
      portfolio: {
        total: projects.length,
        open: open.length,
        byStatus,
        averageProgress: projects.length
          ? Math.round(
              projects.reduce((n, p) => n + Number(p.overall_progress ?? 0), 0) /
                projects.length
            )
          : 0,
      },
      delivery: {
        onTrack: open.length - overdue.length,
        overdue: overdue.length,
        overdueProjects: overdue
          .map((p) => ({
            id: p.id,
            projectNumber: p.project_number,
            name: p.name,
            expectedEnd: p.expected_end_date,
            progress: Number(p.overall_progress ?? 0),
            daysLate: daysLate(p.expected_end_date!),
          }))
          .sort((a, b) => b.daysLate - a.daysLate),
        unassigned: open.filter((p) => !p.project_manager_id).length,
      },
      work: {
        openTasks: openTasks.length,
        overdueTasks: overdueTasks.length,
        undatedTasks: undatedTasks.length,
        unassignedTasks: unassignedTasks.length,
        overdueByProject,
        byAssignee,
        hours: {
          expected: Math.round(hoursExpected * 10) / 10,
          logged: Math.round(hoursLogged * 10) / 10,
          tracked: tasks.filter((t) => Number(t.actual_hours ?? 0) > 0).length,
          estimated: tasks.filter((t) => Number(t.estimated_hours ?? 0) > 0).length,
          overBudget,
        },
      },
    };

    // --- Money, only for those entitled to it -------------------------------
    if (canSeeMoney) {
      const milestones = ids.length
        ? await pageAll<{
            project_id: string;
            amount: number | null;
            percentage: number | null;
            status: string | null;
            paid_amount: number | null;
          }>((a, b) =>
            supabase
              .from("project_payment_milestones")
              .select("project_id, amount, percentage, status, paid_amount")
              .in("project_id", ids)
              .order("project_id", { ascending: true })
              .range(a, b)
          )
        : [];

      const contractById = new Map(
        projects.map((p) => [p.id, Number(p.contract_value ?? 0)])
      );

      let scheduled = 0;
      let received = 0;
      for (const m of milestones) {
        if (m.status === "waived") continue;
        const value = milestoneValue(m, contractById.get(m.project_id) ?? 0);
        scheduled += value;
        if (m.status === "paid") received += Number(m.paid_amount ?? value);
      }

      response.money = {
        contractTotal,
        costRecorded: projects.reduce(
          (n, p) => n + Number(p.actual_cost ?? 0),
          0
        ),
        scheduled,
        received,
        outstanding: scheduled - received,
        unscheduled: contractTotal - scheduled,
        milestoneCount: milestones.length,
      };
    }

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    log.error("Project reports API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
