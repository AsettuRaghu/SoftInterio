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
}

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
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "green" | "blue" | "amber";
}) {
  const tones = {
    slate: "text-slate-900",
    green: "text-green-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
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
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
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
  const [preset, setPreset] = useState<Preset>("90d");

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const { from, to } = rangeFor(preset);
      const response = await fetch(
        `/api/sales/leads/analytics?from=${from}&to=${to}`
      );
      if (!response.ok) throw new Error("Failed to load analytics");
      setData(await response.json());
    } catch (error) {
      uiLogger.error("Error loading sales analytics", error);
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
            Export CSV
          </a>
        }
      />

      <div className="p-4 space-y-4">
        {/* The range applies to intake and revenue, not to the whole page -
            pipeline and what needs attention are always "right now". */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg w-fit">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                preset === p.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {h && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Metric
              label="Open pipeline"
              value={money(h.pipeline_value)}
              hint={
                h.unvalued_open_leads
                  ? `${h.open_leads} leads · ${h.unvalued_open_leads} not yet valued`
                  : `${h.open_leads} open leads`
              }
              tone="blue"
            />
            <Metric
              label="Won in period"
              value={money(h.won_value)}
              hint={`${h.won_leads} deal${h.won_leads === 1 ? "" : "s"}`}
              tone="green"
            />
            <Metric
              label="Win rate"
              value={`${h.win_rate.toFixed(0)}%`}
              hint={`${h.won_leads} of ${h.closed_in_range} closed`}
            />
            <Metric
              label="Average deal"
              value={money(h.avg_deal_size)}
              hint="Won in period"
            />
            <Metric
              label="New leads"
              value={String(h.new_leads)}
              hint="Created in period"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {step.conversion_from_previous.toFixed(0)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2 bg-slate-100 rounded">
                    <div
                      className="h-2 bg-blue-500 rounded"
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
            hint={`${data?.velocity.won_sample || 0} won deals`}
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
        </div>

        {/* The most consequential table on the page: it decides where the next
            marketing rupee goes. */}
        <Panel title="Where leads come from" hint="Win rate is won ÷ closed">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-2 font-medium">Source</th>
                  <th className="py-2 font-medium text-right">Leads</th>
                  <th className="py-2 font-medium text-right">Open</th>
                  <th className="py-2 font-medium text-right">Won</th>
                  <th className="py-2 font-medium text-right">Win rate</th>
                  <th className="py-2 font-medium text-right">Won value</th>
                  <th className="py-2 font-medium text-right">In pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data?.by_source.map((row) => (
                  <tr key={row.source}>
                    <td className="py-2 text-slate-800">{humanise(row.source)}</td>
                    <td className="py-2 text-right tabular-nums">{row.total}</td>
                    <td className="py-2 text-right tabular-nums text-slate-500">
                      {row.open}
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.won}</td>
                    <td className="py-2 text-right tabular-nums">
                      {row.won + row.lost ? `${row.win_rate.toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.won_value ? money(row.won_value) : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-500">
                      {row.pipeline_value ? money(row.pipeline_value) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="By owner" hint="Win rate is won ÷ closed">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-2 font-medium">Owner</th>
                  <th className="py-2 font-medium text-right">Open</th>
                  <th className="py-2 font-medium text-right">Won</th>
                  <th className="py-2 font-medium text-right">Rate</th>
                  <th className="py-2 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data?.by_owner.map((row) => (
                  <tr key={row.user_id}>
                    <td className="py-2 text-slate-800 truncate max-w-[140px]">
                      {row.name}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-500">
                      {row.open}
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.won}</td>
                    <td className="py-2 text-right tabular-nums">
                      {row.won + row.lost ? `${row.win_rate.toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.won_value ? money(row.won_value) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

        {/* Deliberately last and deliberately clickable - this is the part
            somebody is meant to act on today. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel
            title="Gone quiet"
            hint="Open, no activity for 14 days"
          >
            {data?.attention.stale.length ? (
              <div className="divide-y divide-slate-50">
                {data.attention.stale.slice(0, 8).map((l) => (
                  <Link
                    key={l.id}
                    href={`/dashboard/sales/leads/${l.id}`}
                    className="flex items-baseline justify-between gap-3 py-2 text-sm hover:bg-slate-50 -mx-2 px-2 rounded"
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
                {data.attention.stale.length > 8 && (
                  <p className="pt-2 text-xs text-slate-400">
                    and {data.attention.stale.length - 8} more
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
                {data.attention.overdue_follow_ups.slice(0, 8).map((l) => (
                  <Link
                    key={l.id}
                    href={`/dashboard/sales/leads/${l.id}`}
                    className="flex items-baseline justify-between gap-3 py-2 text-sm hover:bg-slate-50 -mx-2 px-2 rounded"
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
    </PageLayout>
  );
}
