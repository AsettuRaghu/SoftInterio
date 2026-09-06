"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LeadStageLabels } from "@/types/leads";
import { PageLayout, PageHeader } from "@/components/ui/PageLayout";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { uiLogger } from "@/lib/logger";

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

type Preset = "30d" | "90d" | "ytd" | "all";

interface Analytics {
  range: { from: string; to: string };
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

/** Ranked colour for a table: strongest performer reads strongest. */
const rankTint = (rate: number) =>
  rate >= 60
    ? "text-emerald-700 bg-emerald-50"
    : rate >= 30
    ? "text-amber-700 bg-amber-50"
    : rate > 0
    ? "text-orange-700 bg-orange-50"
    : "text-slate-400 bg-slate-50";

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "ytd", label: "Year to date" },
  { key: "all", label: "All time" },
];

const rangeFor = (preset: Preset) => {
  const to = new Date();
  if (preset === "all") return { from: "2000-01-01", to: to.toISOString().slice(0, 10) };
  if (preset === "ytd")
    return { from: `${to.getFullYear()}-01-01`, to: to.toISOString().slice(0, 10) };
  const days = preset === "30d" ? 30 : 90;
  return {
    from: new Date(to.getTime() - days * 86400000).toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
};

/** Lakhs and crores - a rupee figure in millions reads as a foreign currency. */
const money = (amount: number) => {
  if (!amount) return "₹0";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
};

const humanise = (value: string) =>
  value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

function Metric({
  label,
  value,
  hint,
  hintTone = "muted",
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "muted" | "good" | "warn";
  tone: "blue" | "emerald" | "violet" | "amber" | "slate";
  icon: React.ReactNode;
}) {
  const tones = {
    blue: { chip: "bg-blue-100 text-blue-600", value: "text-slate-900" },
    emerald: { chip: "bg-emerald-100 text-emerald-600", value: "text-emerald-700" },
    violet: { chip: "bg-violet-100 text-violet-600", value: "text-slate-900" },
    amber: { chip: "bg-amber-100 text-amber-600", value: "text-slate-900" },
    slate: { chip: "bg-slate-100 text-slate-600", value: "text-slate-900" },
  }[tone];
  const hints = {
    muted: "text-slate-400",
    good: "text-emerald-600",
    warn: "text-amber-600",
  }[hintTone];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500">{label}</span>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tones.chip}`}
        >
          {icon}
        </div>
      </div>
      <p className={`text-xl font-bold tabular-nums ${tones.value}`}>{value}</p>
      {hint && <p className={`text-[11px] ${hints}`}>{hint}</p>}
    </div>
  );
}

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

const Icon = ({ d }: { d: string }) => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const ICONS = {
  pipeline: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  money: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  target: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  deal: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  people: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
};

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
  const cls =
    "group w-full flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded hover:bg-blue-50 text-left transition-colors";
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

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
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

      <div className="p-4 space-y-3">
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

        {/* The range applies to intake and revenue, not to the whole page -
            pipeline and what needs attention are always "right now". */}
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-60 ${
                preset === p.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* A refetch keeps the previous figures on screen, which is better than
            a blank page - but they belong to the old range until the new ones
            land, so they are dimmed rather than presented as current. */}
        <div className={isLoading && data ? "opacity-50 transition-opacity" : ""}>
        {h && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Funnel from stage history: a won lead passed through qualified, so
              counting where leads sit today understates every earlier stage. */}
          <Panel title="Funnel" hint="Leads that ever reached each stage">
            <div className="space-y-2">
              {data?.funnel.map((step, i) => (
                <div key={step.stage}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-700">
                      {LeadStageLabels[step.stage as keyof typeof LeadStageLabels] ||
                        humanise(step.stage)}
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
                        width: `${Math.max((step.reached / maxFunnel) * 100, 2)}%`,
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
            <div className="flex gap-6 mb-3">
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
              <div className="space-y-1.5 pt-3 border-t border-slate-100">
                {data.velocity.stages.map((s) => (
                  <div
                    key={s.stage}
                    className="flex items-baseline justify-between text-sm"
                  >
                    <span className="text-slate-600">
                      {LeadStageLabels[s.stage as keyof typeof LeadStageLabels] ||
                        humanise(s.stage)}
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

          <Panel title="Why we lose" hint="Lost and disqualified">
            {data?.loss_reasons.length ? (
              <div className="space-y-1.5">
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
                      <div className="mt-1 h-1.5 bg-slate-100 rounded">
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

        {/* The most consequential table on the page: it decides where the next
            marketing rupee goes. */}
        <Panel title="Where leads come from" hint="Win rate is won ÷ closed">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-1.5 font-medium">Source</th>
                  <th className="py-1.5 font-medium text-right">Leads</th>
                  <th className="py-1.5 font-medium text-right">Open</th>
                  <th className="py-1.5 font-medium text-right">Won</th>
                  <th className="py-1.5 font-medium text-right">Win rate</th>
                  <th className="py-1.5 font-medium text-right">Won value</th>
                  <th className="py-1.5 font-medium text-right">In pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!data?.by_source.length && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                      No leads in this period yet.
                    </td>
                  </tr>
                )}
                {data?.by_source.map((row) => (
                  <tr key={row.source}>
                    <td className="py-1.5 text-slate-800">{humanise(row.source)}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.total}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500">
                      {row.open}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{row.won}</td>
                    <td className="py-1.5 text-right">
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
                    <td className="py-1.5 text-right tabular-nums font-medium text-emerald-700">
                      {row.won_value ? money(row.won_value) : "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-blue-700">
                      {row.pipeline_value ? money(row.pipeline_value) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="By owner" hint="Win rate is won ÷ closed">
            {/* Five columns in half a row: narrow enough on a laptop, tight on
                a phone, so it scrolls rather than squashing the numbers. */}
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-1.5 font-medium">Owner</th>
                  <th className="py-1.5 font-medium text-right">Open</th>
                  <th className="py-1.5 font-medium text-right">Won</th>
                  <th className="py-1.5 font-medium text-right">Rate</th>
                  <th className="py-1.5 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!data?.by_owner.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                      No leads assigned yet.
                    </td>
                  </tr>
                )}
                {data?.by_owner.map((row) => (
                  <tr key={row.user_id}>
                    <td className="py-1.5 text-slate-800 truncate max-w-[140px]">
                      {row.name}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500">
                      {row.open}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{row.won}</td>
                    <td className="py-1.5 text-right">
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
                    <td className="py-1.5 text-right tabular-nums font-medium text-emerald-700">
                      {row.won_value ? money(row.won_value) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Panel>

        <Panel title="Download" hint="Opens in Excel or Sheets">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
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
                  hint="The table above, as shown"
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
                  hint="The table above, as shown"
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
        </div>


        {/* Forward-looking, and deliberately counts rather than a list. */}
        {data?.week_ahead && (
          <Panel
            title="Week ahead"
            hint={`${new Date(data.week_ahead.from).toLocaleDateString(undefined, {
              day: "numeric", month: "short",
            })} – ${new Date(data.week_ahead.to).toLocaleDateString(undefined, {
              day: "numeric", month: "short",
            })}`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
              <div className="divide-y divide-slate-50">
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

              <div className="mt-3 lg:mt-0 space-y-1.5">
                {data.week_ahead.warnings.overdue_tasks > 0 && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 border border-red-100 rounded text-xs text-red-700">
                    <span className="font-semibold tabular-nums">
                      {data.week_ahead.warnings.overdue_tasks}
                    </span>
                    <span>task(s) already overdue</span>
                  </div>
                )}
                {/* The real finding: a "due this week" count means little while
                    most open work carries no date at all. */}
                {data.week_ahead.warnings.undated_tasks > 0 && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800">
                    <span className="font-semibold tabular-nums">
                      {data.week_ahead.warnings.undated_tasks}
                    </span>
                    <span>
                      of {data.week_ahead.warnings.open_tasks} open tasks have no
                      due date, so they cannot appear above
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
                        <span className="truncate text-slate-600">{e.title}</span>
                        <span className="shrink-0 text-slate-400">
                          {new Date(e.at).toLocaleDateString(undefined, {
                            weekday: "short", day: "numeric",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Panel>
        )}

        {/* Deliberately last and deliberately clickable - this is the part
            somebody is meant to act on today. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel
            title="Gone quiet"
            hint="Open, no activity for 14 days"
          >
            {data?.attention.stale.length ? (
              <div className="divide-y divide-slate-50">
                {data.attention.stale.slice(0, 10).map((l) => (
                  <Link
                    key={l.id}
                    href={`/dashboard/sales/leads/${l.id}`}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-sm hover:bg-slate-50 -mx-2 px-2 rounded"
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
                  <p className="pt-2 text-xs text-slate-400">
                    and {data.attention.stale.length - 10} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Every open lead has been touched recently.
              </p>
            )}
          </Panel>

          <Panel title="Follow-ups overdue" hint="Scheduled, not yet done">
            {data?.attention.overdue_follow_ups.length ? (
              <div className="divide-y divide-slate-50">
                {data.attention.overdue_follow_ups.slice(0, 10).map((l) => (
                  <Link
                    key={l.id}
                    href={`/dashboard/sales/leads/${l.id}`}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-sm hover:bg-slate-50 -mx-2 px-2 rounded"
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
              <p className="text-sm text-slate-400">Nothing overdue.</p>
            )}
          </Panel>
        </div>
        </div>
      </div>
    </PageLayout>
  );
}
