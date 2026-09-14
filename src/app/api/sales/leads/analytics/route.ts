import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";

/**
 * Everything the sales report needs, computed in one place.
 *
 * One endpoint rather than several because most of these figures are different
 * questions about the same set of leads, and fetching that set repeatedly would
 * let the funnel and the source table disagree with each other about which
 * leads exist.
 *
 * Two date fields matter and they are not interchangeable. "New leads" counts
 * created_at; "won" counts won_at. A lead created in March and won in June
 * belongs to March's intake and June's revenue, and reporting both against one
 * date is how a pipeline appears to convert in reverse.
 */

/** Midpoint of each band, for valuing a lead that has no quotation yet. */
const BUDGET_MIDPOINT: Record<string, number> = {
  below_10l: 500000,
  around_10l: 1000000,
  around_20l: 2000000,
  around_30l: 3000000,
  around_40l: 4000000,
  around_50l: 5000000,
  above_50l: 6500000,
  not_disclosed: 0,
};

/** The shapes the paged fetches return, so `pageAll` has something to be. */
interface LeadRow {
  id: string;
  lead_number: string | null;
  stage: string;
  lead_source: string | null;
  service_type: string | null;
  priority: string | null;
  budget_range: string | null;
  won_amount: number | null;
  assigned_to: string | null;
  created_at: string;
  won_at: string | null;
  stage_changed_at: string | null;
  last_activity_at: string | null;
  next_follow_up_at: string | null;
  lost_reason: string | null;
  disqualification_reason: string | null;
  client: { name: string | null } | { name: string | null }[] | null;
}

interface HistoryRow {
  lead_id: string;
  from_stage: string | null;
  to_stage: string;
  created_at: string;
}

interface QuotationRow {
  lead_id: string | null;
  grand_total: number | null;
  status: string | null;
}

interface TaskRow {
  id: string;
  title: string | null;
  due_date: string | null;
  status: string;
  assigned_to: string | null;
  related_type: string | null;
  related_id: string | null;
}

/** The order a lead is meant to travel in. Drives the funnel. */
const FUNNEL_STAGES = [
  "new",
  "qualified",
  "requirement_discussion",
  "proposal_discussion",
  "won",
] as const;

const CLOSED_STAGES = ["won", "lost", "disqualified"];

const daysBetween = (a: string, b: string) =>
  Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Every row, not the first thousand.
 *
 * PostgREST caps a plain select at 1000 rows and says nothing about it, and
 * `.limit()` does not raise that cap. Every figure on this page is computed in
 * TypeScript from these sets, so a truncated fetch would not fail - it would
 * quietly report a smaller pipeline, a shorter funnel and a better win rate
 * than the tenant actually has. The stage history is the nearest: 71 rows for
 * 15 leads, so roughly 200 leads reaches the cap.
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

/**
 * One segment table - by source, by owner, by service - computed once.
 *
 * These were three near-identical forty-line reducers differing only in which
 * column they grouped on. Win rate is won over closed in all three, and three
 * copies of that is three chances for the page to disagree with itself about
 * what a win rate is.
 */
interface SegmentRow {
  key: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  won_value: number;
  pipeline_value: number;
  win_rate: number;
}

function segment<L extends { stage: string; won_amount: unknown }>(
  leads: L[],
  keyOf: (lead: L) => string,
  openValue: (lead: L) => number,
  closedStages: readonly string[]
): SegmentRow[] {
  const rows: Record<string, SegmentRow> = {};
  for (const lead of leads) {
    const key = keyOf(lead);
    const row = (rows[key] ??= {
      key,
      total: 0,
      won: 0,
      lost: 0,
      open: 0,
      won_value: 0,
      pipeline_value: 0,
      win_rate: 0,
    });
    row.total += 1;
    if (lead.stage === "won") {
      row.won += 1;
      row.won_value += Number(lead.won_amount) || 0;
    } else if (closedStages.includes(lead.stage)) {
      row.lost += 1;
    } else {
      row.open += 1;
      row.pipeline_value += openValue(lead);
    }
  }
  return Object.values(rows).map((r) => ({
    ...r,
    win_rate: r.won + r.lost ? (r.won / (r.won + r.lost)) * 100 : 0,
  }));
}

export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["leads.reports"],
    });
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);

    const supabase = await createClient();
    const params = request.nextUrl.searchParams;

    // Default to the last 90 days. An all-time report flatters a young
    // pipeline and hides whether anything is happening now.
    const to = params.get("to") ? new Date(params.get("to")!) : new Date();
    const from = params.get("from")
      ? new Date(params.get("from")!)
      : new Date(to.getTime() - 90 * 86400000);
    to.setHours(23, 59, 59, 999);
    from.setHours(0, 0, 0, 0);
    const inRange = (iso?: string | null) =>
      !!iso && new Date(iso) >= from && new Date(iso) <= to;

    // The week ahead, for the coverage panel. Bounded here rather than
    // fetched wholesale: a calendar grows without limit and only the next
    // seven days are ever shown.
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // RLS scopes these to the caller's tenant. The four sets that grow without
    // bound are paged; the calendar is already bounded to seven days.
    const [leads, history, quotations, { data: users }, tasks, { data: events }] =
      await Promise.all([
        pageAll<LeadRow>((a, b) =>
          supabase
            .from("leads")
            .select(
              "id, lead_number, stage, lead_source, service_type, priority, budget_range, won_amount, assigned_to, created_at, won_at, stage_changed_at, last_activity_at, next_follow_up_at, lost_reason, disqualification_reason, client:clients(name)"
            )
            .order("created_at", { ascending: true })
            .range(a, b)
        ),
        pageAll<HistoryRow>((a, b) =>
          supabase
            .from("lead_stage_history")
            .select("lead_id, from_stage, to_stage, created_at")
            .order("created_at", { ascending: true })
            .range(a, b)
        ),
        pageAll<QuotationRow>((a, b) =>
          supabase
            .from("quotations")
            .select("lead_id, grand_total, status")
            .not("lead_id", "is", null)
            .order("lead_id", { ascending: true })
            .range(a, b)
        ),
        supabase.from("users").select("id, name"),
        pageAll<TaskRow>((a, b) =>
          supabase
            .from("tasks")
            .select("id, title, due_date, status, assigned_to, related_type, related_id")
            .eq("related_type", "lead")
            .in("status", ["todo", "in_progress", "on_hold"])
            .order("id", { ascending: true })
            .range(a, b)
        ),
        supabase
          .from("calendar_events")
          .select("id, title, event_type, scheduled_at, linked_type, linked_id, created_by")
          .eq("is_completed", false)
          .gte("scheduled_at", todayStart.toISOString())
          .lte("scheduled_at", weekEnd.toISOString())
          .order("scheduled_at", { ascending: true }),
      ]);

    const allLeads = leads;
    const userName = Object.fromEntries((users || []).map((u) => [u.id, u.name]));

    // Best quotation per lead, for valuing open pipeline.
    const bestQuote: Record<string, number> = {};
    quotations.forEach((q) => {
      const value = Number(q.grand_total) || 0;
      if (!q.lead_id || value <= 0) return;
      bestQuote[q.lead_id] = Math.max(bestQuote[q.lead_id] || 0, value);
    });

    /**
     * What an open lead is worth. A real quotation beats a budget band - the
     * client has been shown a number - and a band beats nothing. Leads with
     * neither contribute zero rather than a guess, and the response says how
     * many those are so the figure can be read honestly.
     */
    const openValue = (lead: (typeof allLeads)[number]) =>
      bestQuote[lead.id] || BUDGET_MIDPOINT[lead.budget_range || ""] || 0;

    const createdInRange = allLeads.filter((l) => inRange(l.created_at));
    const wonInRange = allLeads.filter(
      (l) => l.stage === "won" && inRange(l.won_at)
    );
    const closedInRange = allLeads.filter(
      (l) =>
        CLOSED_STAGES.includes(l.stage) &&
        inRange(l.stage === "won" ? l.won_at : l.stage_changed_at)
    );
    const openLeads = allLeads.filter((l) => !CLOSED_STAGES.includes(l.stage));

    // One clock for the whole report. Ageing, staleness and overdue follow-ups
    // are all "how long since", and reading the time twice would let two
    // panels disagree by however long the computation took.
    const now = Date.now();

    const wonValue = wonInRange.reduce(
      (sum, l) => sum + (Number(l.won_amount) || 0),
      0
    );
    const pipelineValue = openLeads.reduce((sum, l) => sum + openValue(l), 0);
    const unvaluedOpen = openLeads.filter((l) => openValue(l) === 0).length;

    // Win rate is won over everything that closed, not over everything that
    // exists - open leads have not lost, they simply have not finished.
    const lostInRange = closedInRange.filter((l) => l.stage !== "won").length;
    const winRate = closedInRange.length
      ? (wonInRange.length / closedInRange.length) * 100
      : 0;

    // --- Funnel -------------------------------------------------------------
    // From history, not the current stage. A won lead passed through qualified,
    // and counting only where leads sit today shows every earlier stage as
    // emptier than it ever was.
    const everReached: Record<string, Set<string>> = {};
    FUNNEL_STAGES.forEach((s) => (everReached[s] = new Set()));
    allLeads.forEach((l) => everReached["new"].add(l.id));
    history.forEach((h) => {
      if (everReached[h.to_stage]) everReached[h.to_stage].add(h.lead_id);
    });

    const funnel = FUNNEL_STAGES.map((stage, i) => {
      const reached = everReached[stage].size;
      const previous = i === 0 ? reached : everReached[FUNNEL_STAGES[i - 1]].size;
      return {
        stage,
        reached,
        conversion_from_previous: previous ? (reached / previous) * 100 : 0,
        conversion_from_start: everReached["new"].size
          ? (reached / everReached["new"].size) * 100
          : 0,
      };
    });

    // --- Where the pipeline is sitting -------------------------------------
    /**
     * Open leads by the stage they are in now, with how long they have been
     * there. The funnel above says how many leads ever reached a stage and the
     * velocity panel says how long a stage usually takes; neither answers the
     * question a sales review actually opens with - what is stuck, and what is
     * it worth.
     *
     * Ageing is measured from `stage_changed_at`, falling back to creation for
     * a lead that has never moved, which is itself the finding: a lead sitting
     * in New since it arrived has not been worked.
     */
    const clientName = (l: LeadRow) =>
      (l.client as { name?: string } | null)?.name || null;

    const daysInStage = (l: LeadRow) =>
      Math.floor(
        (now - new Date(l.stage_changed_at || l.created_at).getTime()) / 86400000
      );

    const pipelineByStage = FUNNEL_STAGES.filter((stage) => stage !== "won")
      .map((stage) => {
        const inStage = openLeads.filter((l) => l.stage === stage);
        if (!inStage.length) return null;
        const ages = inStage.map(daysInStage);
        const oldest = inStage.reduce((worst, l) =>
          daysInStage(l) > daysInStage(worst) ? l : worst
        );
        return {
          stage,
          count: inStage.length,
          value: inStage.reduce((sum, l) => sum + openValue(l), 0),
          unvalued: inStage.filter((l) => openValue(l) === 0).length,
          avg_days_in_stage: ages.reduce((a, b) => a + b, 0) / ages.length,
          oldest_days: Math.max(...ages),
          oldest: {
            id: oldest.id,
            label: clientName(oldest) || oldest.lead_number || "Lead",
            owner: userName[oldest.assigned_to || ""] || "Unassigned",
            days: daysInStage(oldest),
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    // --- Segments: where leads come from, who closes them, what we sell ----
    // All three are the same reduction over a different column, so they share
    // one implementation and cannot disagree about what a win rate is.
    const bySource = segment(
      allLeads,
      (l) => l.lead_source || "unspecified",
      openValue,
      CLOSED_STAGES
    )
      .map(({ key, ...r }) => ({ source: key, ...r }))
      .sort((a, b) => b.total - a.total);

    const byOwner = segment(
      allLeads,
      (l) => l.assigned_to || "unassigned",
      openValue,
      CLOSED_STAGES
    )
      .map(({ key, ...r }) => ({
        user_id: key,
        name: userName[key] || "Unassigned",
        ...r,
      }))
      .sort((a, b) => b.won_value - a.won_value);

    // What the business actually sells. `service_type` has been fetched and
    // discarded since this endpoint was written; for an interior practice the
    // turnkey-against-modular split is a different decision from the source
    // one - it says which kind of work to chase, not where to advertise.
    const byService = segment(
      allLeads,
      (l) => l.service_type || "unspecified",
      openValue,
      CLOSED_STAGES
    )
      .map(({ key, ...r }) => ({ service: key, ...r }))
      .sort((a, b) => b.total - a.total);

    // --- How long it takes -------------------------------------------------
    const daysToWin = allLeads
      .filter((l) => l.stage === "won" && l.won_at)
      .map((l) => daysBetween(l.created_at, l.won_at!));

    // Time spent in each stage, from consecutive history entries. The last
    // stage a lead entered has no successor, so it is left out rather than
    // measured against today - that would make current stages look slowest.
    const byLead: Record<string, Array<{ stage: string; at: string }>> = {};
    history.forEach((h) => {
      (byLead[h.lead_id] ??= []).push({ stage: h.to_stage, at: h.created_at });
    });
    const stageDurations: Record<string, number[]> = {};
    Object.values(byLead).forEach((entries) => {
      for (let i = 0; i < entries.length - 1; i++) {
        (stageDurations[entries[i].stage] ??= []).push(
          daysBetween(entries[i].at, entries[i + 1].at)
        );
      }
    });

    const velocity = {
      avg_days_to_win: daysToWin.length
        ? daysToWin.reduce((a, b) => a + b, 0) / daysToWin.length
        : 0,
      median_days_to_win: median(daysToWin),
      won_sample: daysToWin.length,
      stages: FUNNEL_STAGES.filter((s) => stageDurations[s]?.length).map((s) => ({
        stage: s,
        avg_days:
          stageDurations[s].reduce((a, b) => a + b, 0) / stageDurations[s].length,
        sample: stageDurations[s].length,
      })),
    };

    // --- Why we lose -------------------------------------------------------
    const lossReasons = Object.entries(
      allLeads
        .filter((l) => CLOSED_STAGES.includes(l.stage) && l.stage !== "won")
        .reduce((acc, l) => {
          const key = l.lost_reason || l.disqualification_reason || "unspecified";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
    )
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // --- What needs attention today ----------------------------------------
    const stale = openLeads
      .filter((l) => {
        const last = l.last_activity_at || l.created_at;
        return (now - new Date(last).getTime()) / 86400000 > 14;
      })
      .map((l) => ({
        id: l.id,
        lead_number: l.lead_number,
        client: (l.client as { name?: string } | null)?.name || null,
        stage: l.stage,
        owner: userName[l.assigned_to || ""] || "Unassigned",
        days_quiet: Math.floor(
          (now - new Date(l.last_activity_at || l.created_at).getTime()) / 86400000
        ),
        value: openValue(l),
      }))
      .sort((a, b) => b.days_quiet - a.days_quiet);

    const overdueFollowUps = openLeads
      .filter((l) => l.next_follow_up_at && new Date(l.next_follow_up_at) < new Date())
      .map((l) => ({
        id: l.id,
        lead_number: l.lead_number,
        client: (l.client as { name?: string } | null)?.name || null,
        owner: userName[l.assigned_to || ""] || "Unassigned",
        due: l.next_follow_up_at,
      }))
      .sort((a, b) => (a.due! < b.due! ? -1 : 1));

    // --- The week ahead -----------------------------------------------------
    // Reported as coverage, not as a task list. The dashboard already owns the
    // to-do list and the calendar owns the detail; a third copy of the same
    // queue is worse than one. What a manager cannot get elsewhere is whether
    // the week is covered and who is carrying it.
    const leadOwner = Object.fromEntries(
      allLeads.map((l) => [l.id, l.assigned_to || ""])
    );
    const nameOf = (id?: string | null) => userName[id || ""] || "Unassigned";
    const tally = (rows: Array<string | null | undefined>) =>
      Object.entries(
        rows.reduce((acc, id) => {
          const key = nameOf(id);
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      )
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    const openTasks = tasks;
    const dueThisWeek = openTasks.filter(
      (t) =>
        t.due_date &&
        new Date(t.due_date) >= todayStart &&
        new Date(t.due_date) <= weekEnd
    );
    const overdueTasks = openTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < todayStart
    );
    // The finding that matters more than the counts: a "due this week" figure
    // means nothing while most open work carries no date at all.
    const undatedTasks = openTasks.filter((t) => !t.due_date);

    const followUpsThisWeek = openLeads.filter(
      (l) =>
        l.next_follow_up_at &&
        new Date(l.next_follow_up_at) >= todayStart &&
        new Date(l.next_follow_up_at) <= weekEnd
    );

    // Only events attached to a lead - an unlinked calendar entry is somebody's
    // personal reminder, not sales activity, and counting it would overstate
    // the week.
    const salesEvents = (events || []).filter((e) => e.linked_type === "lead");

    const weekAhead = {
      from: todayStart.toISOString(),
      to: weekEnd.toISOString(),
      events: {
        count: salesEvents.length,
        by_owner: tally(
          salesEvents.map((e) => leadOwner[e.linked_id || ""] || e.created_by)
        ),
        items: salesEvents.slice(0, 6).map((e) => ({
          id: e.id,
          title: e.title,
          type: e.event_type,
          at: e.scheduled_at,
          lead_id: e.linked_id,
        })),
      },
      follow_ups: {
        count: followUpsThisWeek.length,
        by_owner: tally(followUpsThisWeek.map((l) => l.assigned_to)),
      },
      tasks: {
        count: dueThisWeek.length,
        by_owner: tally(dueThisWeek.map((t) => t.assigned_to)),
      },
      warnings: {
        overdue_tasks: overdueTasks.length,
        undated_tasks: undatedTasks.length,
        open_tasks: openTasks.length,
        unlinked_events: (events || []).length - salesEvents.length,
      },
    };

    // --- Trend -------------------------------------------------------------
    const months: Record<string, { created: number; won: number; won_value: number }> = {};
    const monthKey = (iso: string) => iso.slice(0, 7);
    allLeads.forEach((l) => {
      const created = (months[monthKey(l.created_at)] ??= {
        created: 0, won: 0, won_value: 0,
      });
      created.created += 1;
      if (l.stage === "won" && l.won_at) {
        const won = (months[monthKey(l.won_at)] ??= {
          created: 0, won: 0, won_value: 0,
        });
        won.won += 1;
        won.won_value += Number(l.won_amount) || 0;
      }
    });
    const trend = Object.entries(months)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      headline: {
        new_leads: createdInRange.length,
        won_leads: wonInRange.length,
        lost_leads: lostInRange,
        open_leads: openLeads.length,
        won_value: wonValue,
        pipeline_value: pipelineValue,
        // Named so the caller can say "of 7 open leads, 2 have no value yet"
        // rather than presenting a total that quietly excludes them.
        unvalued_open_leads: unvaluedOpen,
        avg_deal_size: wonInRange.length ? wonValue / wonInRange.length : 0,
        win_rate: winRate,
        closed_in_range: closedInRange.length,
        // So an empty range can say "nothing in these 90 days" rather than
        // showing a page of zeros that reads as a broken report.
        total_leads: allLeads.length,
      },
      funnel,
      by_source: bySource,
      by_owner: byOwner,
      by_service: byService,
      pipeline_by_stage: pipelineByStage,
      velocity,
      loss_reasons: lossReasons,
      attention: { stale, overdue_follow_ups: overdueFollowUps },
      week_ahead: weekAhead,
      trend,
    });
  } catch (error) {
    log.error("Lead analytics error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
