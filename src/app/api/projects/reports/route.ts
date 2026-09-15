/**
 * The numbers behind the project reports page.
 *
 *   GET /api/projects/reports
 *
 * This answers delivery questions only: what is late, what nobody owns, where
 * the hours are going and which projects have slipped.
 *
 * **It carries no financial figures at all.** Not gated, not omitted per role -
 * simply not gathered. Contract values, milestones, invoiced and received belong
 * to a finance module that does not exist yet, and a report is a different shape
 * of the same data, so it must not become the way to read figures the product
 * has decided not to show here. The payment milestones are not even queried.
 *
 * `projectAccess` decides *which* projects are in the report, so a
 * `projects.view_own` holder gets a report about their own projects rather than
 * a summary of the business.
 *
 * **The date range covers the summary band and nothing else**, exactly as it
 * does on the sales report: what started, finished and got done in a period is
 * a question about that period, while what is late or unowned is a question
 * about today and a status mix is a question about now. The page's headings say
 * which is which, and if that ever changes the headings have to change with it.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";
import { projectAccess } from "@/lib/projects/access";

const SETTLED = ["completed", "cancelled", "skipped"];

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
  overall_progress: number | null;
  expected_start_date: string | null;
  expected_end_date: string | null;
  actual_start_date: string | null;
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
  completed_at: string | null;
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

    const projects = await pageAll<ProjectRow>((a, b) => {
      let q = supabase
        .from("projects")
        .select(
          // Deliberately no contract_value or actual_cost: this report shows
          // no money, and the cheapest way to keep it that way is not to ask
          // for it.
          "id, project_number, name, status, overall_progress, expected_start_date, expected_end_date, actual_start_date, actual_end_date, project_manager_id, created_by, created_at"
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

    /*
     * Range for the summary band. Defaults to ninety days, like the sales
     * report - an all-time default flatters a young portfolio and hides whether
     * anything is moving now.
     */
    const params = request.nextUrl.searchParams;
    const rangeTo = params.get("to") ?? new Date().toISOString().slice(0, 10);
    const rangeFrom =
      params.get("from") ??
      new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const inRange = (date?: string | null) =>
      !!date && date >= rangeFrom && date <= rangeTo;

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
              "id, title, status, due_date, assigned_to, estimated_hours, actual_hours, completed_at, related_id, parent_task_id"
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

    /*
     * What moved in the period. Tasks are counted on `completed_at` where the
     * transition stamped one - a task completed last March is not this month's
     * output, and reading `updated_at` instead would make any edit look like
     * progress.
     */
    const startedInRange = projects.filter(
      (p) => inRange(p.actual_start_date) || inRange(p.created_at.slice(0, 10))
    ).length;
    const finishedInRange = projects.filter((p) =>
      inRange(p.actual_end_date)
    ).length;
    const tasksDoneInRange = tasks.filter(
      (t) => t.status === "completed" && inRange(t.completed_at?.slice(0, 10))
    ).length;

    const response: Record<string, unknown> = {
      scope: access.readAll ? "tenant" : "own",
      range: { from: rangeFrom, to: rangeTo },
      period: {
        projectsStarted: startedInRange,
        projectsFinished: finishedInRange,
        tasksCompleted: tasksDoneInRange,
        // Said plainly so an empty period reads as an empty period rather than
        // as a broken report.
        totalProjects: projects.length,
      },
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

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    log.error("Project reports API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
