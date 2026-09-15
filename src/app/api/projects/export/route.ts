/**
 * Projects and their work as CSV, for the analysis nobody anticipated.
 *
 *   GET /api/projects/export?report=projects|open|overdue|tasks|overdue-tasks
 *
 * A report page answers the questions it was designed around; a spreadsheet
 * answers the rest.
 *
 * Two rules matter more here than on the page, because **a spreadsheet leaves
 * the building**:
 *
 *   1. **No financial columns.** Not `contract_value`, not `actual_cost`, not a
 *      milestone. The project report deliberately carries no money, and an
 *      export is the obvious way round a decision like that - so the columns are
 *      not selected, let alone written.
 *   2. **The same scope as the report.** `projectAccess` narrows a
 *      `projects.view_own` holder to their own projects, and the tasks report is
 *      narrowed to those same projects rather than to the tenant.
 *
 * Gated on `projects.export` (Admin, Owner, Project Manager) - `projects.reports`
 * is enough to read the page but not to take the data away, which is why Design
 * Manager sees the report and no download links.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";
import { projectAccess } from "@/lib/projects/access";

/** RFC 4180: quote the field, and double any quote inside it. */
const csvCell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const SETTLED = ["completed", "cancelled", "skipped"];
const CLOSED = ["completed", "cancelled"];

const STATUS_LABEL: Record<string, string> = {
  new: "Not started",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Every row, not the first thousand. `.limit()` does not raise PostgREST's cap. */
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
  created_at: string;
  client: { name: string | null } | { name: string | null }[] | null;
}

interface TaskRow {
  id: string;
  title: string | null;
  status: string;
  priority: string | null;
  due_date: string | null;
  assigned_to: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  completed_at: string | null;
  related_id: string | null;
}

const daysBetweenNowAnd = (date: string) =>
  Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);

export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["projects.export"],
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

    const report = request.nextUrl.searchParams.get("report") || "projects";
    const today = new Date().toISOString().slice(0, 10);

    const projects = await pageAll<ProjectRow>((a, b) => {
      let q = supabase
        .from("projects")
        .select(
          // No contract_value, no actual_cost. See the note at the top.
          "id, project_number, name, status, overall_progress, expected_start_date, expected_end_date, actual_start_date, actual_end_date, project_manager_id, created_at, client:clients(name)"
        )
        .eq("tenant_id", user.tenantId)
        .order("created_at", { ascending: false })
        .range(a, b);
      if (!access.readAll) {
        q = q.or(`project_manager_id.eq.${user.id},created_by.eq.${user.id}`);
      }
      return q;
    });

    /*
     * Names come from `tenant_directory`, not `users` - the policies on that
     * table are own-row-only, so a spreadsheet built from it would name the
     * person who downloaded it and leave every colleague blank.
     */
    const directory = await pageAll<{ id: string; name: string | null }>((a, b) =>
      supabase.from("tenant_directory").select("id, name").range(a, b)
    );
    const personName = new Map(directory.map((d) => [d.id, d.name || ""]));
    const clientName = (p: ProjectRow) =>
      (p.client as { name?: string } | null)?.name || "";

    let headers: string[];
    let rows: string[];

    if (report === "tasks" || report === "overdue-tasks") {
      const ids = projects.map((p) => p.id);
      const tasks = ids.length
        ? await pageAll<TaskRow>((a, b) =>
            supabase
              .from("tasks")
              .select(
                "id, title, status, priority, due_date, assigned_to, estimated_hours, actual_hours, completed_at, related_id"
              )
              .eq("tenant_id", user.tenantId)
              .eq("related_type", "project")
              .in("related_id", ids)
              .order("due_date", { ascending: true })
              .range(a, b)
          )
        : [];

      const numberOf = new Map(projects.map((p) => [p.id, p.project_number]));
      const nameOf = new Map(projects.map((p) => [p.id, p.name]));

      const selected = tasks.filter((t) => {
        const open = !SETTLED.includes(t.status);
        if (report === "overdue-tasks") {
          return open && t.due_date && t.due_date < today;
        }
        return open;
      });

      headers = [
        "Project number",
        "Project",
        "Task",
        "Status",
        "Priority",
        "Assigned to",
        "Due date",
        "Days late",
        "Estimated hours",
        "Logged hours",
      ];
      rows = selected.map((t) =>
        [
          numberOf.get(t.related_id || "") ?? "",
          nameOf.get(t.related_id || "") ?? "",
          t.title ?? "",
          t.status,
          t.priority ?? "",
          t.assigned_to ? personName.get(t.assigned_to) ?? "" : "Unassigned",
          t.due_date ?? "",
          t.due_date && t.due_date < today
            ? daysBetweenNowAnd(t.due_date)
            : "",
          t.estimated_hours ?? "",
          t.actual_hours ?? "",
        ]
          .map(csvCell)
          .join(",")
      );
    } else {
      const selected = projects.filter((p) => {
        if (report === "open") return !CLOSED.includes(p.status ?? "");
        if (report === "overdue") {
          return (
            !CLOSED.includes(p.status ?? "") &&
            !!p.expected_end_date &&
            p.expected_end_date < today
          );
        }
        return true;
      });

      headers = [
        "Project number",
        "Project",
        "Client",
        "Status",
        "Progress %",
        "Project manager",
        "Expected start",
        "Expected end",
        "Actual start",
        "Actual end",
        "Days late",
        "Created",
      ];
      rows = selected.map((p) =>
        [
          p.project_number ?? "",
          p.name ?? "",
          clientName(p),
          STATUS_LABEL[p.status ?? ""] ?? p.status ?? "",
          p.overall_progress ?? 0,
          p.project_manager_id
            ? personName.get(p.project_manager_id) ?? ""
            : "Unassigned",
          p.expected_start_date ?? "",
          p.expected_end_date ?? "",
          p.actual_start_date ?? "",
          p.actual_end_date ?? "",
          !CLOSED.includes(p.status ?? "") &&
          p.expected_end_date &&
          p.expected_end_date < today
            ? daysBetweenNowAnd(p.expected_end_date)
            : "",
          p.created_at.slice(0, 10),
        ]
          .map(csvCell)
          .join(",")
      );
    }

    // Excel reads a UTF-8 CSV as Latin-1 unless it starts with a byte order
    // mark, which turns every accented name into mojibake.
    const csv = "\uFEFF" + [headers.map(csvCell).join(","), ...rows].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    const name = report === "projects" ? "projects" : `projects-${report}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"`,
      },
    });
  } catch (error) {
    log.error("Project export error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
