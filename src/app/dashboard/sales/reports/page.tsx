"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LeadStageLabels } from "@/types/leads";
import { PageLayout, PageHeader } from "@/components/ui/PageLayout";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { uiLogger } from "@/lib/logger";
import {
  Section,
  Panel,
  Metric,
  Icon,
  ICONS,
  rankTint,
  ageTint,
  money,
  humanise,
  RangePresets,
  PERIOD_LABEL,
  rangeFor,
  rangeNote,
  type Preset,
} from "@/components/reports";

/**
 * Sales reporting.
 *
 * Built around the questions a sales review actually asks - where do good leads
 * come from, who is closing, how long it takes, why we lose - rather than a
 * count of leads per stage, which says what the list page already shows.
 *
 * Everything is computed by /api/sales/leads/analytics so the figures on this
 * page cannot disagree with each other.
 */

interface Analytics {
  range: { from: string; to: string };
  /** "tenant" for a leads.view holder, "own" for leads.view_own. */
  scope: "tenant" | "own";
  headline: {
    new_leads: number;
    won_leads: number;
    lost_leads: number;
    open_leads: number;
    won_value: number;
    pipeline_value: number;
    unvalued_open_leads: number;
    avg_deal_size: number;
    win_rate: number;
    closed_in_range: number;
    total_leads: number;
  };
  funnel: Array<{
    stage: string;
    reached: number;
    conversion_from_previous: number;
    conversion_from_start: number;
  }>;
  by_source: Array<{
    source: string; total: number; won: number; lost: number; open: number;
    won_value: number; pipeline_value: number; win_rate: number;
  }>;
  by_owner: Array<{
    user_id: string; name: string; total: number; won: number; lost: number;
    open: number; won_value: number; pipeline_value: number; win_rate: number;
  }>;
  by_service: Array<{
    service: string; total: number; won: number; lost: number; open: number;
    won_value: number; pipeline_value: number; win_rate: number;
  }>;
  pipeline_by_stage: Array<{
    stage: string; count: number; value: number; unvalued: number;
    avg_days_in_stage: number; oldest_days: number;
    oldest: { id: string; label: string; owner: string; days: number };
  }>;
  velocity: {
    avg_days_to_win: number;
    median_days_to_win: number;
    won_sample: number;
    stages: Array<{ stage: string; avg_days: number; sample: number }>;
  };
  loss_reasons: Array<{ reason: string; count: number }>;
  attention: {
    stale: Array<{
      id: string; lead_number: string | null; client: string | null;
      stage: string; owner: string; days_quiet: number; value: number;
    }>;
    overdue_follow_ups: Array<{
      id: string; lead_number: string | null; client: string | null;
      owner: string; due: string | null;
    }>;
  };
  trend: Array<{ month: string; created: number; won: number; won_value: number }>;
  week_ahead: {
    from: string;
    to: string;
    events: {
      count: number;
      by_owner: Array<{ name: string; count: number }>;
      items: Array<{
        id: string; title: string; type: string; at: string; lead_id: string | null;
      }>;
    };
    follow_ups: { count: number; by_owner: Array<{ name: string; count: number }> };
    tasks: { count: number; by_owner: Array<{ name: string; count: number }> };
    warnings: {
      overdue_tasks: number; undated_tasks: number;
      open_tasks: number; unlinked_events: number;
    };
  };
}

/**
 * One palette for the whole page.
 *
 * Colour carries meaning here rather than decoration: blue is pipeline and
 * potential, green is money already won, amber is something slipping, red is
 * something lost. A reader who learns that once can scan the page without
 * reading labels.
 */
const STAGE_TINT: Record<string, { bar: string; text: string }> = {
  new: { bar: "bg-violet-400", text: "text-violet-700" },
  qualified: { bar: "bg-sky-400", text: "text-sky-700" },
  requirement_discussion: { bar: "bg-indigo-400", text: "text-indigo-700" },
  proposal_discussion: { bar: "bg-amber-400", text: "text-amber-700" },
  won: { bar: "bg-emerald-500", text: "text-emerald-700" },
};

function CoverageRow({
  label,
  count,
  byOwner,
  tone,
}: {
  label: string;
  count: number;
  byOwner: Array<{ name: string; count: number }>;
  tone: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-700 shrink-0">{label}</span>
      <span className="flex-1 text-right text-[11px] text-slate-400 truncate">
        {byOwner.map((o) => `${o.name.split(" ")[0]} ${o.count}`).join(" · ")}
      </span>
      <span className={`w-8 text-right text-lg font-bold tabular-nums ${tone}`}>
        {count}
      </span>
    </div>
  );
}

/**
 * Turns rows already on the page into a CSV.
 *
 * The aggregate tables are exported from what the browser is showing rather
 * than recomputed on the server: two implementations of "win rate by source"
 * would eventually disagree, and the number someone downloads has to be the
 * number they were looking at.
 */
function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  const cell = (v: string | number) => {
    const text = String(v ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv =
    "\uFEFF" +
    [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DownloadRow({
  label,
  hint,
  onClick,
  href,
}: {
  label: string;
  hint: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span className="min-w-0">
        <span className="block text-sm text-slate-800">{label}</span>
        <span className="block text-[11px] text-slate-400">{hint}</span>
      </span>
      <span className="shrink-0 text-slate-300 group-hover:text-blue-600">
        <Icon d={ICONS.download} />
      </span>
    </>
  );
  // Full width of the panel, because the panel is flush. The old rule pulled
  // itself out of the padding with -mx-2 and stopped six pixels short of the
  // border, so a hovered row looked like it was leaking out of its panel.
  const cls =
    "group w-full flex items-center justify-between gap-3 py-2 px-4 hover:bg-blue-50 text-left transition-colors";
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/**
 * A panel.
 *
 * `flush` is for panels whose content is a list of rows: the rows carry their
 * own `px-4` and run the full width, so a hover highlight meets the border
 * instead of stopping just short of it. Padded panels are for everything that
 * is a block rather than a list.
 */
function SegmentTable({
  nameHeader,
  rows,
  wide = false,
  empty,
}: {
  nameHeader: string;
  rows: Array<{
    key: string; label: string; total: number; open: number; won: number;
    lost: number; win_rate: number; won_value: number; pipeline_value: number;
  }>;
  wide?: boolean;
  empty: string;
}) {
  const columns = wide ? 7 : 5;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${wide ? "" : "min-w-[320px]"}`}>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
            <th className="py-2 pl-4 font-medium">{nameHeader}</th>
            {wide && <th className="py-2 px-2 font-medium text-right">Leads</th>}
            <th className="py-2 px-2 font-medium text-right">Open</th>
            <th className="py-2 px-2 font-medium text-right">Won</th>
            <th className="py-2 px-2 font-medium text-right">
              {wide ? "Win rate" : "Rate"}
            </th>
            <th className="py-2 px-2 font-medium text-right">
              {wide ? "Won value" : "Value"}
            </th>
            {wide && (
              <th className="py-2 pr-4 pl-2 font-medium text-right">In pipeline</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {!rows.length && (
            <tr>
              <td
                colSpan={columns}
                className="py-8 text-center text-sm text-slate-400"
              >
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-slate-50/70">
              <td className="py-2 pl-4 text-slate-800 truncate max-w-[180px]">
                {row.label}
              </td>
              {wide && (
                <td className="py-2 px-2 text-right tabular-nums">{row.total}</td>
              )}
              <td className="py-2 px-2 text-right tabular-nums text-slate-500">
                {row.open}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">{row.won}</td>
              <td className="py-2 px-2 text-right">
                {row.won + row.lost ? (
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium tabular-nums ${rankTint(
                      row.win_rate
                    )}`}
                  >
                    {row.win_rate.toFixed(0)}%
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="py-2 px-2 text-right tabular-nums font-medium text-emerald-700">
                {row.won_value ? money(row.won_value) : "—"}
              </td>
              {wide && (
                <td className="py-2 pr-4 pl-2 text-right tabular-nums text-blue-700">
                  {row.pipeline_value ? money(row.pipeline_value) : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SalesReportsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("90d");

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { from, to } = rangeFor(preset);
      const response = await fetch(
        `/api/sales/leads/analytics?from=${from}&to=${to}`
      );
      if (!response.ok) throw new Error("Failed to load analytics");
      setData(await response.json());
    } catch (err) {
      // Logging alone left a failed load looking like a tenant with no data -
      // empty panels, no explanation, nothing to click.
      uiLogger.error("Error loading sales analytics", err);
      setError(
        err instanceof Error ? err.message : "Could not load the report"
      );
    } finally {
      setIsLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const h = data?.headline;
  const maxFunnel = data?.funnel?.[0]?.reached || 1;

  /**
   * The date range drives the summary figures and nothing else.
   *
   * Every other panel is computed over every lead on record - the funnel needs
   * the whole history to be a funnel, the source table would turn to noise on
   * a fortnight's leads, and what needs chasing is a question about today. That
   * was true before and the page did not say so, which left a reader assuming
   * the whole report moved when they changed the range.
   */
  const periodLabel = PERIOD_LABEL[preset];

  // Someone limited to their own leads gets a report about their own leads, and
  // the page has to say so - otherwise a one-person funnel reads as the whole
  // business having almost no pipeline.
  const own = data?.scope === "own";
  const allTime = own
    ? `Your ${h?.total_leads ?? 0} leads`
    : `All ${h?.total_leads ?? 0} leads on record`;

  // A period with no intake and nothing closed is not a broken report, but a
  // page of zeroes reads like one. This tenant's leads all arrived in one
  // month, so the ninety-day default lands on exactly this case.
  const emptyPeriod =
    !!h && preset !== "all" && h.total_leads > 0 && !h.new_leads && !h.closed_in_range;

  const stageRows = data?.pipeline_by_stage ?? [];
  const maxStageValue = Math.max(1, ...stageRows.map((r) => r.value));
  const trend = data?.trend ?? [];
  const maxCreated = Math.max(1, ...trend.map((t) => t.created));

  return (
    <PageLayout isLoading={isLoading && !data} loadingText="Loading reports...">
      <PageHeader
        title="Sales Reports"
        subtitle="Pipeline, sources, and what needs attention"
        breadcrumbs={[{ label: "Reports" }]}
        basePath={{ label: "Sales", href: "/dashboard/sales" }}
        actions={
          <a
            href="/api/sales/leads/export"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export
          </a>
        }
      />

      <div className="p-5 space-y-7">
        {error && (
          <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => void load()}
              className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-md hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        <div className={isLoading && data ? "opacity-50 transition-opacity" : ""}>
          <div className="space-y-7">
            <Section
              title={periodLabel}
              note={data ? rangeNote(data.range.from, data.range.to) : undefined}
              action={
                <RangePresets
                  preset={preset}
                  onChange={setPreset}
                  disabled={isLoading}
                />
              }
            >
              {emptyPeriod && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm text-blue-900">
                    No leads were created or closed in this period. The figures
                    below the summary cover every lead on record, so they are
                    still worth reading.
                  </p>
                  <button
                    onClick={() => setPreset("all")}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-100"
                  >
                    Show all time
                  </button>
                </div>
              )}

              {h && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <Metric
                    label="Open pipeline"
                    value={money(h.pipeline_value)}
                    hint={
                      h.unvalued_open_leads
                        ? `${h.open_leads} open · ${h.unvalued_open_leads} unvalued`
                        : `${h.open_leads} open leads`
                    }
                    hintTone={h.unvalued_open_leads ? "warn" : "muted"}
                    tone="blue"
                    icon={<Icon d={ICONS.pipeline} />}
                  />
                  <Metric
                    label="Won in period"
                    value={money(h.won_value)}
                    hint={`${h.won_leads} deal${h.won_leads === 1 ? "" : "s"} closed`}
                    hintTone="good"
                    tone="emerald"
                    icon={<Icon d={ICONS.money} />}
                  />
                  <Metric
                    label="Win rate"
                    value={`${h.win_rate.toFixed(0)}%`}
                    hint={`${h.won_leads} of ${h.closed_in_range} closed`}
                    tone="violet"
                    icon={<Icon d={ICONS.target} />}
                  />
                  <Metric
                    label="Average deal"
                    value={money(h.avg_deal_size)}
                    hint="Won in period"
                    tone="amber"
                    icon={<Icon d={ICONS.deal} />}
                  />
                  <Metric
                    label="New leads"
                    value={String(h.new_leads)}
                    hint="Created in period"
                    tone="slate"
                    icon={<Icon d={ICONS.people} />}
                  />
                </div>
              )}
            </Section>

            <Section
              title="The pipeline"
              note={`Open work and full history${
                own ? ", yours only" : ""
              } — not limited to the period above`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* The question a sales review opens with, and the one this
                    page could not answer: not how many leads reached a stage,
                    but which ones are sitting in one now, for how long, and
                    what they are worth. */}
                <Panel
                  title="Where the pipeline is sitting"
                  hint="Open leads, by current stage"
                >
                  {stageRows.length ? (
                    <div className="space-y-3.5">
                      {stageRows.map((row) => (
                        <div key={row.stage}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm text-slate-700">
                              {LeadStageLabels[
                                row.stage as keyof typeof LeadStageLabels
                              ] || humanise(row.stage)}
                            </span>
                            <span className="text-sm font-semibold tabular-nums text-slate-900">
                              {row.value ? money(row.value) : "—"}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                              <div
                                className={`h-2 rounded ${
                                  STAGE_TINT[row.stage]?.bar || "bg-slate-400"
                                }`}
                                style={{
                                  width: `${Math.max(
                                    (row.value / maxStageValue) * 100,
                                    2
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                              {row.count} lead{row.count === 1 ? "" : "s"}
                            </span>
                          </div>
                          <Link
                            href={`/dashboard/sales/leads/${row.oldest.id}`}
                            className="mt-1 flex items-baseline justify-between gap-2 text-[11px] hover:bg-slate-50 rounded px-1 -mx-1 py-0.5"
                          >
                            <span className="truncate text-slate-500">
                              Longest here: {row.oldest.label}
                              <span className="text-slate-400">
                                {" "}
                                · {row.oldest.owner}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 tabular-nums font-medium ${ageTint(
                                row.oldest.days
                              )}`}
                            >
                              {row.oldest.days}d
                            </span>
                          </Link>
                          {row.unvalued > 0 && (
                            <p className="mt-0.5 text-[11px] text-amber-600">
                              {row.unvalued} with no quotation or budget yet
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Nothing open — every lead has closed.
                    </p>
                  )}
                </Panel>

                {/* Funnel from stage history: a won lead passed through
                    qualified, so counting where leads sit today understates
                    every earlier stage. */}
                <Panel title="Funnel" hint="Leads that ever reached each stage">
                  <div className="space-y-2.5">
                    {data?.funnel.map((step, i) => (
                      <div key={step.stage}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-slate-700">
                            {LeadStageLabels[
                              step.stage as keyof typeof LeadStageLabels
                            ] || humanise(step.stage)}
                          </span>
                          <span className="tabular-nums text-slate-900 font-medium">
                            {step.reached}
                            {i > 0 && (
                              <span
                                className={`ml-2 text-xs font-normal ${
                                  step.conversion_from_previous >= 60
                                    ? "text-emerald-600"
                                    : step.conversion_from_previous >= 30
                                    ? "text-amber-600"
                                    : "text-orange-600"
                                }`}
                              >
                                {step.conversion_from_previous.toFixed(0)}%
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 h-2 bg-slate-100 rounded overflow-hidden">
                          <div
                            className={`h-2 rounded ${
                              STAGE_TINT[step.stage]?.bar || "bg-slate-400"
                            }`}
                            style={{
                              width: `${Math.max(
                                (step.reached / maxFunnel) * 100,
                                2
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel
                  title="How long it takes"
                  hint={`${data?.velocity.won_sample || 0} won`}
                >
                  <div className="flex gap-8 mb-3.5">
                    <div>
                      <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                        {Math.round(data?.velocity.median_days_to_win || 0)}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        median days to win
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-slate-400 tabular-nums">
                        {Math.round(data?.velocity.avg_days_to_win || 0)}
                      </p>
                      <p className="text-[11px] text-slate-400">average</p>
                    </div>
                  </div>
                  {data?.velocity.stages.length ? (
                    <div className="space-y-2 pt-3.5 border-t border-slate-100">
                      {data.velocity.stages.map((s) => (
                        <div
                          key={s.stage}
                          className="flex items-baseline justify-between text-sm"
                        >
                          <span className="text-slate-600">
                            {LeadStageLabels[
                              s.stage as keyof typeof LeadStageLabels
                            ] || humanise(s.stage)}
                          </span>
                          <span className="tabular-nums text-slate-700">
                            {s.avg_days.toFixed(1)} days
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Not enough stage history yet.
                    </p>
                  )}
                </Panel>
              </div>
            </Section>

            <Section title="What works" note={allTime}>
              {/* The most consequential table on the page: it decides where the
                  next marketing rupee goes. */}
              <Panel
                title="Where leads come from"
                hint="Win rate is won ÷ closed"
                flush
              >
                <SegmentTable
                  nameHeader="Source"
                  wide
                  empty="No leads recorded yet."
                  rows={(data?.by_source ?? []).map((r) => ({
                    ...r,
                    key: r.source,
                    label: humanise(r.source),
                  }))}
                />
              </Panel>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* service_type has been collected on every lead since the
                    module was built and reported nowhere. Source says where to
                    advertise; this says which kind of work to chase. */}
                <Panel
                  title="What we sell"
                  hint="Win rate is won ÷ closed"
                  flush
                >
                  <SegmentTable
                    nameHeader="Service"
                    empty="No service type recorded yet."
                    rows={(data?.by_service ?? []).map((r) => ({
                      ...r,
                      key: r.service,
                      label: humanise(r.service),
                    }))}
                  />
                </Panel>

                <Panel title="By owner" hint="Win rate is won ÷ closed" flush>
                  <SegmentTable
                    nameHeader="Owner"
                    empty="No leads assigned yet."
                    rows={(data?.by_owner ?? []).map((r) => ({
                      ...r,
                      key: r.user_id,
                      label: r.name,
                    }))}
                  />
                </Panel>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Computed by the API since it was written and never drawn.
                    Two months is a thin series, which is why it is a strip of
                    bars rather than a chart pretending to a trend. */}
                <Panel title="Month by month" hint="Created, and won">
                  {trend.length ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="w-16" />
                        <span className="flex-1">Leads created</span>
                        <span className="w-8 text-right">New</span>
                        <span className="w-24 text-right">Won</span>
                      </div>
                      {trend.map((m) => (
                        <div key={m.month} className="flex items-center gap-3">
                          <span className="w-16 shrink-0 text-[11px] text-slate-500">
                            {new Date(`${m.month}-01`).toLocaleDateString(
                              undefined,
                              { month: "short", year: "2-digit" }
                            )}
                          </span>
                          <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                            <div
                              className="h-2 rounded bg-blue-400"
                              style={{
                                width: `${Math.max(
                                  (m.created / maxCreated) * 100,
                                  2
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-700">
                            {m.created}
                          </span>
                          <span className="w-24 shrink-0 text-right text-xs tabular-nums text-emerald-700">
                            {m.won
                              ? `${m.won} · ${money(m.won_value)}`
                              : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      No leads recorded yet.
                    </p>
                  )}
                </Panel>

                <Panel title="Why we lose" hint="Lost and disqualified">
                  {data?.loss_reasons.length ? (
                    <div className="space-y-2.5">
                      {data.loss_reasons.map((r) => {
                        const top = data.loss_reasons[0].count || 1;
                        return (
                          <div key={r.reason}>
                            <div className="flex items-baseline justify-between text-sm">
                              <span className="text-slate-700">
                                {humanise(r.reason)}
                              </span>
                              <span className="tabular-nums text-slate-900">
                                {r.count}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                              <div
                                className="h-1.5 bg-red-400 rounded"
                                style={{ width: `${(r.count / top) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Nothing lost yet.</p>
                  )}
                </Panel>
              </div>
            </Section>

            {/* Forward-looking, and deliberately counts rather than a list. */}
            {data?.week_ahead && (
              <Section
                title="The week ahead"
                note={`${new Date(data.week_ahead.from).toLocaleDateString(
                  undefined,
                  { day: "numeric", month: "short" }
                )} – ${new Date(data.week_ahead.to).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}`}
              >
                <Panel title="Coverage" hint="Who is booked, and what has no date">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                    <div className="divide-y divide-slate-100">
                      <CoverageRow
                        label="Meetings & visits"
                        count={data.week_ahead.events.count}
                        byOwner={data.week_ahead.events.by_owner}
                        tone="text-blue-700"
                      />
                      <CoverageRow
                        label="Follow-ups due"
                        count={data.week_ahead.follow_ups.count}
                        byOwner={data.week_ahead.follow_ups.by_owner}
                        tone="text-violet-700"
                      />
                      <CoverageRow
                        label="Tasks due"
                        count={data.week_ahead.tasks.count}
                        byOwner={data.week_ahead.tasks.by_owner}
                        tone="text-slate-800"
                      />
                    </div>

                    <div className="space-y-2">
                      {data.week_ahead.warnings.overdue_tasks > 0 && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 border border-red-100 rounded text-xs text-red-700">
                          <span className="font-semibold tabular-nums">
                            {data.week_ahead.warnings.overdue_tasks}
                          </span>
                          <span>task(s) already overdue</span>
                        </div>
                      )}
                      {/* The real finding: a "due this week" count means little
                          while most open work carries no date at all. */}
                      {data.week_ahead.warnings.undated_tasks > 0 && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800">
                          <span className="font-semibold tabular-nums">
                            {data.week_ahead.warnings.undated_tasks}
                          </span>
                          <span>
                            of {data.week_ahead.warnings.open_tasks} open tasks
                            have no due date, so they cannot appear beside
                          </span>
                        </div>
                      )}
                      {data.week_ahead.warnings.unlinked_events > 0 && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-600">
                          <span className="font-semibold tabular-nums">
                            {data.week_ahead.warnings.unlinked_events}
                          </span>
                          <span>calendar event(s) not linked to a lead</span>
                        </div>
                      )}
                      {data.week_ahead.events.items.length > 0 && (
                        <div className="pt-1">
                          {data.week_ahead.events.items.map((e) => (
                            <div
                              key={e.id}
                              className="flex items-baseline justify-between gap-3 py-1 text-xs"
                            >
                              <span className="truncate text-slate-600">
                                {e.title}
                              </span>
                              <span className="shrink-0 text-slate-400">
                                {new Date(e.at).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>
              </Section>
            )}

            {/* Deliberately last and deliberately clickable - this is the part
                somebody is meant to act on today. */}
            <Section title="Act on today" note="Open leads only">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Gone quiet" hint="Open, no activity for 14 days" flush>
                  {data?.attention.stale.length ? (
                    <div className="divide-y divide-slate-100">
                      {data.attention.stale.slice(0, 10).map((l) => (
                        <Link
                          key={l.id}
                          href={`/dashboard/sales/leads/${l.id}`}
                          className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm hover:bg-slate-50"
                        >
                          <span className="truncate text-slate-800">
                            {l.client || l.lead_number || "Lead"}
                            <span className="ml-2 text-xs text-slate-400">
                              {l.owner}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-amber-600 tabular-nums">
                            {l.days_quiet}d
                          </span>
                        </Link>
                      ))}
                      {data.attention.stale.length > 10 && (
                        <p className="px-4 py-2 text-xs text-slate-400">
                          and {data.attention.stale.length - 10} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="px-4 pb-2 text-sm text-slate-400">
                      Every open lead has been touched recently.
                    </p>
                  )}
                </Panel>

                <Panel title="Follow-ups overdue" hint="Scheduled, not yet done" flush>
                  {data?.attention.overdue_follow_ups.length ? (
                    <div className="divide-y divide-slate-100">
                      {data.attention.overdue_follow_ups.slice(0, 10).map((l) => (
                        <Link
                          key={l.id}
                          href={`/dashboard/sales/leads/${l.id}`}
                          className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm hover:bg-slate-50"
                        >
                          <span className="truncate text-slate-800">
                            {l.client || l.lead_number || "Lead"}
                            <span className="ml-2 text-xs text-slate-400">
                              {l.owner}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-red-600">
                            {l.due ? new Date(l.due).toLocaleDateString() : ""}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 pb-2 text-sm text-slate-400">
                      Nothing overdue.
                    </p>
                  )}
                </Panel>
              </div>
            </Section>

            <Section title="Download" note="Opens in Excel or Sheets">
              <Panel title="Spreadsheets" hint="Aggregates export as shown" flush>
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <div>
                    <DownloadRow
                      label="All leads"
                      hint="Every lead with source, owner, age and value"
                      href="/api/sales/leads/export"
                    />
                    <DownloadRow
                      label="Open pipeline"
                      hint="Leads still in play"
                      href="/api/sales/leads/export?report=pipeline"
                    />
                    <DownloadRow
                      label="Won deals"
                      hint="Closed won, with amounts"
                      href="/api/sales/leads/export?report=won"
                    />
                  </div>
                  <div>
                    <DownloadRow
                      label="Lost and disqualified"
                      hint="With the reason recorded"
                      href="/api/sales/leads/export?report=lost"
                    />
                    <DownloadRow
                      label="Source performance"
                      hint="The source table, as shown"
                      onClick={() =>
                        data &&
                        downloadCsv(
                          "sales-by-source",
                          ["Source", "Leads", "Open", "Won", "Lost", "Win rate %", "Won value", "Pipeline value"],
                          data.by_source.map((r) => [
                            humanise(r.source), r.total, r.open, r.won, r.lost,
                            r.win_rate.toFixed(1), r.won_value, r.pipeline_value,
                          ])
                        )
                      }
                    />
                    <DownloadRow
                      label="Owner performance"
                      hint="The owner table, as shown"
                      onClick={() =>
                        data &&
                        downloadCsv(
                          "sales-by-owner",
                          ["Owner", "Leads", "Open", "Won", "Lost", "Win rate %", "Won value", "Pipeline value"],
                          data.by_owner.map((r) => [
                            r.name, r.total, r.open, r.won, r.lost,
                            r.win_rate.toFixed(1), r.won_value, r.pipeline_value,
                          ])
                        )
                      }
                    />
                  </div>
                </div>
              </Panel>
            </Section>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
