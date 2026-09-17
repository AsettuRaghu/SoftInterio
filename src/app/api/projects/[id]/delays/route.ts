/**
 * The delay log of a project: every hold, whose it was, and the days.
 *
 *   GET /api/projects/:id/delays
 *
 * Reads what the holds already recorded - task_status_history rows written
 * when a plan step went on hold, carrying hold_owner / hold_reason_code /
 * hold_expected_until in the same write as the status - and pairs each with
 * the row that lifted it. Nothing here is a second record; if a delay is not
 * in this list, nobody pressed Pause for it.
 *
 * Days are calendar days between the day the hold began and the day it was
 * lifted (today, for one still running), which is the arithmetic a person
 * does: paused on the 17th, resumed on the 24th, seven days on the client.
 *
 * Alongside: the agreed end (latest baseline) against the current end, so
 * the slip the holds explain sits beside the slip the plan shows.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";

export interface DelayEntry {
  task_id: string;
  step: string;
  stage: string | null;
  owner: string;
  reason_code: string | null;
  reason_label: string | null;
  counterpart: string | null;
  note: string | null;
  started_at: string;
  ended_at: string | null;
  expected_until: string | null;
  /** Calendar days from the start to the end, or to today while open. */
  days: number;
  /** Calendar days the hold was expected to take, where an until date was set. */
  expected_days: number | null;
  recorded_by: string | null;
}

const dayOf = (iso: string) => iso.slice(0, 10);
const signedDays = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const daysBetween = (a: string, b: string) => Math.max(0, signedDays(a, b));

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await protectApiRoute(request, { loadPermissions: true });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();

  const gate = await requireProjectAccess(supabase, {
    projectId: id,
    user: guard.user,
    permissions: guard.permissions,
    mode: "read",
  });
  if (!gate.ok) return gate.response;

  // The plan's tasks, with their stage.
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, parent_task_id, status")
    .eq("related_type", "project")
    .eq("related_id", id)
    .not("procedure_run_id", "is", null);
  const byId = new Map((tasks ?? []).map((t) => [t.id, t]));
  const taskIds = [...byId.keys()];

  const [{ data: history }, { data: reasons }, { data: project }, { data: baseline }] = await Promise.all([
    taskIds.length
      ? supabase
          .from("task_status_history")
          .select("task_id, from_status, to_status, hold_owner, hold_reason_code, hold_expected_until, hold_counterpart, reason, changed_at, changed_by")
          .in("task_id", taskIds)
          .order("changed_at")
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("delay_reasons").select("code, label"),
    supabase.from("projects").select("expected_end_date, status, hold_owner, held_at").eq("id", id).single(),
    supabase.from("plan_baselines").select("id, version").eq("project_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const label = new Map((reasons ?? []).map((r) => [r.code, r.label]));

  // Pair each hold with the row that lifted it: the next status change of
  // the same task after the hold began.
  const today = new Date().toISOString().slice(0, 10);
  const rows = (history ?? []) as any[];
  const entries: DelayEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const h = rows[i];
    if (!["on_hold", "blocked"].includes(h.to_status) || !h.hold_owner) continue;
    const lift = rows.slice(i + 1).find((r) => r.task_id === h.task_id && r.changed_at > h.changed_at);
    const task = byId.get(h.task_id);
    const stage = task?.parent_task_id ? byId.get(task.parent_task_id) : null;
    const start = dayOf(h.changed_at);
    const end = lift ? dayOf(lift.changed_at) : null;
    entries.push({
      task_id: h.task_id,
      step: task?.title ?? "Step",
      stage: stage?.title ?? null,
      owner: h.hold_owner,
      reason_code: h.hold_reason_code ?? null,
      reason_label: h.hold_reason_code ? (label.get(h.hold_reason_code) ?? h.hold_reason_code) : null,
      counterpart: h.hold_counterpart ?? null,
      note: h.reason ?? null,
      started_at: h.changed_at,
      ended_at: lift?.changed_at ?? null,
      expected_until: h.hold_expected_until ?? null,
      days: daysBetween(start, end ?? today),
      expected_days: h.hold_expected_until ? daysBetween(start, h.hold_expected_until) : null,
      recorded_by: h.changed_by ?? null,
    });
  }
  entries.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));

  // Days so far, and days once every open hold runs to its expected date -
  // the second is what "7 days on the client" means on the day the hold is
  // recorded, before a single one of them has passed.
  const totals: Record<string, number> = {};
  const expectedTotals: Record<string, number> = {};
  for (const e of entries) {
    totals[e.owner] = (totals[e.owner] ?? 0) + e.days;
    expectedTotals[e.owner] =
      (expectedTotals[e.owner] ?? 0) + (e.ended_at ? e.days : Math.max(e.days, e.expected_days ?? 0));
  }

  // Names for who recorded each hold, through the directory.
  const who = [...new Set(entries.map((e) => e.recorded_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (who.length) {
    const { data: people } = await supabase.from("tenant_directory").select("id, name").in("id", who);
    for (const p of people ?? []) names.set(p.id, p.name);
  }

  let agreedEnd: string | null = null;
  if (baseline) {
    const { data: span } = await supabase
      .from("plan_baseline_tasks")
      .select("due_date, task:tasks!task_id(parent_task_id)")
      .eq("baseline_id", baseline.id);
    for (const r of span ?? []) {
      const t = r.task as unknown as { parent_task_id: string | null } | null;
      if (t?.parent_task_id || !r.due_date) continue;
      if (!agreedEnd || r.due_date > agreedEnd) agreedEnd = r.due_date;
    }
  }
  const currentEnd = project?.expected_end_date ?? null;

  return NextResponse.json({
    success: true,
    data: {
      agreed_end: agreedEnd,
      agreed_version: baseline?.version ?? null,
      current_end: currentEnd,
      // Positive when the plan now ends later than agreed; negative when earlier.
      slip_days: agreedEnd && currentEnd ? signedDays(agreedEnd, currentEnd) : null,
      project_hold:
        project?.status === "on_hold" && project.hold_owner
          ? { owner: project.hold_owner, since: project.held_at }
          : null,
      totals,
      expected_totals: expectedTotals,
      entries: entries.map((e) => ({ ...e, recorded_by: e.recorded_by ? (names.get(e.recorded_by) ?? null) : null })),
    },
  });
}
