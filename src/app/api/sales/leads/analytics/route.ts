import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

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

export async function GET(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
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

    // RLS scopes these to the caller's tenant.
    const [{ data: leads }, { data: history }, { data: quotations }, { data: users }] =
      await Promise.all([
        supabase
          .from("leads")
          .select(
            "id, lead_number, stage, lead_source, service_type, priority, budget_range, won_amount, assigned_to, created_at, won_at, stage_changed_at, last_activity_at, next_follow_up_at, lost_reason, disqualification_reason, client:clients(name)"
          ),
        supabase
          .from("lead_stage_history")
          .select("lead_id, from_stage, to_stage, created_at")
          .order("created_at", { ascending: true }),
        supabase
          .from("quotations")
          .select("lead_id, grand_total, status")
          .not("lead_id", "is", null),
        supabase.from("users").select("id, name"),
      ]);

    const allLeads = leads || [];
    const userName = Object.fromEntries((users || []).map((u) => [u.id, u.name]));

    // Best quotation per lead, for valuing open pipeline.
    const bestQuote: Record<string, number> = {};
    (quotations || []).forEach((q) => {
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
    (history || []).forEach((h) => {
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

    // --- Where the good leads come from ------------------------------------
    const bySource = Object.values(
      allLeads.reduce((acc, l) => {
        const key = l.lead_source || "unspecified";
        const row = (acc[key] ??= {
          source: key,
          total: 0,
          won: 0,
          lost: 0,
          open: 0,
          won_value: 0,
          pipeline_value: 0,
        });
        row.total += 1;
        if (l.stage === "won") {
          row.won += 1;
          row.won_value += Number(l.won_amount) || 0;
        } else if (CLOSED_STAGES.includes(l.stage)) {
          row.lost += 1;
        } else {
          row.open += 1;
          row.pipeline_value += openValue(l);
        }
        return acc;
      }, {} as Record<string, {
        source: string; total: number; won: number; lost: number;
        open: number; won_value: number; pipeline_value: number;
      }>)
    )
      .map((r) => ({
        ...r,
        win_rate: r.won + r.lost ? (r.won / (r.won + r.lost)) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // --- Who is closing ----------------------------------------------------
    const byOwner = Object.values(
      allLeads.reduce((acc, l) => {
        const key = l.assigned_to || "unassigned";
        const row = (acc[key] ??= {
          user_id: key,
          name: userName[key] || "Unassigned",
          total: 0,
          won: 0,
          lost: 0,
          open: 0,
          won_value: 0,
          pipeline_value: 0,
        });
        row.total += 1;
        if (l.stage === "won") {
          row.won += 1;
          row.won_value += Number(l.won_amount) || 0;
        } else if (CLOSED_STAGES.includes(l.stage)) {
          row.lost += 1;
        } else {
          row.open += 1;
          row.pipeline_value += openValue(l);
        }
        return acc;
      }, {} as Record<string, {
        user_id: string; name: string; total: number; won: number;
        lost: number; open: number; won_value: number; pipeline_value: number;
      }>)
    )
      .map((r) => ({
        ...r,
        win_rate: r.won + r.lost ? (r.won / (r.won + r.lost)) * 100 : 0,
      }))
      .sort((a, b) => b.won_value - a.won_value);

    // --- How long it takes -------------------------------------------------
    const daysToWin = allLeads
      .filter((l) => l.stage === "won" && l.won_at)
      .map((l) => daysBetween(l.created_at, l.won_at!));

    // Time spent in each stage, from consecutive history entries. The last
    // stage a lead entered has no successor, so it is left out rather than
    // measured against today - that would make current stages look slowest.
    const byLead: Record<string, Array<{ stage: string; at: string }>> = {};
    (history || []).forEach((h) => {
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
    const now = Date.now();
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
      },
      funnel,
      by_source: bySource,
      by_owner: byOwner,
      velocity,
      loss_reasons: lossReasons,
      attention: { stale, overdue_follow_ups: overdueFollowUps },
      trend,
    });
  } catch (error) {
    console.error("Lead analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
