/**
 * GET /api/sales/leads/follow-ups
 *
 * The morning queue: which leads need chasing, and why.
 *
 * Three buckets, because they need different responses:
 *   overdue    — a date was set and has passed
 *   today      — a date was set and it is today
 *   gone_quiet — no date set, and nothing has happened for auto_followup_days.
 *                This one matters most: it catches the seller who never sets
 *                follow-ups, which is exactly the person whose leads rot.
 *
 * Two kinds of item share those buckets: leads that need chasing, and tasks
 * assigned to the caller that are due. A task with a due date already is a
 * reminder - it has a date, an owner and a done state - it simply had nowhere
 * to show up. Rather than inventing a separate reminder field, they are
 * surfaced here alongside leads. Every item carries a `kind` discriminator.
 *
 * gone_quiet stays lead-only: a task is either due or it is not.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";

export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Default to the caller's own leads - a follow-up queue is personal.
    const mineOnly = request.nextUrl.searchParams.get("all") !== "true";
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "50"),
      200
    );

    const { data: settings } = await supabase
      .from("tenant_lead_settings")
      .select("auto_followup_days")
      .eq("tenant_id", user.tenantId)
      .maybeSingle();

    const quietDays = settings?.auto_followup_days ?? 3;

    let query = supabase
      .from("leads")
      .select(
        `id, lead_number, stage, next_follow_up_at, last_activity_at,
         assigned_to, priority,
         client:clients!leads_client_id_fkey(id, name, phone),
         property:properties!leads_property_id_fkey(property_name)`
      )
      // A closed lead never needs chasing.
      .not("stage", "in", "(won,lost,disqualified)")
      .limit(limit);

    if (mineOnly) query = query.eq("assigned_to", user.id);

    const { data: leads, error } = await query;

    // Tasks the caller owns and still has to do. Statuses that mean "finished
    // with" are excluded, as is anything with no date - an undated task is a
    // backlog item, not a reminder.
    let taskQuery = supabase
      .from("tasks")
      .select(
        `id, title, due_date, priority, status, assigned_to,
         related_type, related_id`
      )
      .not("due_date", "is", null)
      .not("status", "in", "(completed,cancelled,skipped)")
      .eq("tenant_id", user.tenantId)
      .limit(limit);

    if (mineOnly) taskQuery = taskQuery.eq("assigned_to", user.id);

    const { data: tasks, error: taskError } = await taskQuery;

    if (taskError) {
      // A failure here should not blank the lead queue, which is the more
      // important half of this widget.
      log.error("Error loading task reminders", taskError);
    }

    if (error) {
      log.error("Error loading follow-ups", error);
      return NextResponse.json(
        { error: "Failed to load follow-ups" },
        { status: 500 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const quietBefore = new Date();
    quietBefore.setDate(quietBefore.getDate() - quietDays);

    const buckets = { overdue: [] as any[], today: [] as any[], gone_quiet: [] as any[] };

    for (const lead of leads || []) {
      const item = { ...lead, kind: "lead" as const };
      if (lead.next_follow_up_at) {
        if (lead.next_follow_up_at < today) buckets.overdue.push(item);
        else if (lead.next_follow_up_at === today) buckets.today.push(item);
        // A future date is not due yet - deliberately excluded.
      } else if (
        !lead.last_activity_at ||
        new Date(lead.last_activity_at) < quietBefore
      ) {
        buckets.gone_quiet.push(item);
      }
    }

    for (const task of tasks || []) {
      // due_date is a date column, but may arrive as a timestamp - compare on
      // the date part only, or a task due today reads as overdue.
      const due = (task.due_date || "").slice(0, 10);
      const item = { ...task, kind: "task" as const, due_date: due };
      if (due < today) buckets.overdue.push(item);
      else if (due === today) buckets.today.push(item);
    }

    // Oldest first in every bucket - the most neglected deserves attention.
    // Leads sort on their follow-up date, tasks on their due date.
    const dueOf = (item: any) =>
      item.kind === "task" ? item.due_date || "" : item.next_follow_up_at || "";
    buckets.overdue.sort((a, b) => dueOf(a).localeCompare(dueOf(b)));
    buckets.today.sort((a, b) => dueOf(a).localeCompare(dueOf(b)));
    buckets.gone_quiet.sort((a, b) =>
      (a.last_activity_at || "").localeCompare(b.last_activity_at || "")
    );

    return NextResponse.json({
      quiet_days: quietDays,
      counts: {
        overdue: buckets.overdue.length,
        today: buckets.today.length,
        gone_quiet: buckets.gone_quiet.length,
        total:
          buckets.overdue.length +
          buckets.today.length +
          buckets.gone_quiet.length,
      },
      ...buckets,
    });
  } catch (error) {
    log.error("Follow-ups GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
