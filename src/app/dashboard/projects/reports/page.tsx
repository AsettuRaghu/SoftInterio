"use client";

/**
 * Project reports.
 *
 * This page was six cards reading "Coming Soon", linking to six routes that
 * did not exist. Building six stubs would have been six more of the same, so
 * it is one page answering what those cards promised - status, progress,
 * timeline, money and conversion - from data the app already holds.
 *
 * Deliberately no charts. With a portfolio this size a bar chart of two
 * projects is decoration; what a person needs is which projects are late and
 * by how long, named, so they can go and deal with them. Charts earn their
 * place when there is a shape to see.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { uiLogger } from "@/lib/logger";
import { formatCurrency } from "@/modules/projects/utils";
import {
  ExclamationTriangleIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

interface Report {
  scope: "tenant" | "own";
  portfolio: {
    total: number;
    open: number;
    byStatus: Record<string, number>;
    contractTotal: number;
    actualCostTotal: number;
    averageProgress: number;
  };
  delivery: {
    onTrack: number;
    overdue: number;
    overdueProjects: {
      id: string;
      projectNumber: string;
      name: string;
      expectedEnd: string;
      progress: number;
      daysLate: number;
    }[];
    unassigned: number;
  };
  money: {
    contractTotal: number;
    scheduled: number;
    received: number;
    outstanding: number;
    unscheduled: number;
  };
  conversion: {
    leadStages: Record<string, number>;
    wonLeads: number;
    wonValue: number;
    projectsCreated: number;
  };
}

const STATUS_LABEL: Record<string, string> = {
  new: "Not started",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STAGE_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_discussion: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  disqualified: "Disqualified",
};

export default function ProjectReportsPage() {
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/reports");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not build the report");
      setReport(json.data);
      setError(null);
    } catch (err: any) {
      uiLogger.error("Failed to load project reports", err);
      setError(err.message || "Could not build the report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (permsLoading || loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-56 bg-slate-100 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasPermission("projects.reports")) {
    return (
      <div className="p-4">
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          You do not have permission to view project reports.
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Could not build the report"}
        </div>
      </div>
    );
  }

  const { portfolio, delivery, money, conversion } = report;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Project reports</h1>
        <p className="text-sm text-slate-500">
          {portfolio.total} project{portfolio.total === 1 ? "" : "s"}
          {report.scope === "own" && " you manage"} · {portfolio.open} still open
        </p>
      </div>

      {/* Portfolio */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Portfolio
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile label="Projects" value={String(portfolio.total)} />
          <Tile label="Contract value" value={formatCurrency(portfolio.contractTotal)} />
          <Tile label="Cost recorded" value={formatCurrency(portfolio.actualCostTotal)} />
          <Tile label="Average progress" value={`${portfolio.averageProgress}%`} />
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            By status
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {Object.entries(portfolio.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-slate-800 tabular-nums">
                  {count}
                </span>
                <span className="text-sm text-slate-500">
                  {STATUS_LABEL[status] ?? status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Delivery */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Delivery
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Tile label="On track" value={String(delivery.onTrack)} tone="good" />
          <Tile
            label="Past their end date"
            value={String(delivery.overdue)}
            tone={delivery.overdue ? "bad" : undefined}
          />
          <Tile
            label="No project manager"
            value={String(delivery.unassigned)}
            tone={delivery.unassigned ? "warn" : undefined}
          />
        </div>

        {delivery.overdueProjects.length > 0 && (
          <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-200">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
              <p className="text-sm font-semibold text-red-800">
                Past their expected end date
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-2 font-semibold">Project</th>
                    <th className="px-4 py-2 font-semibold">Expected</th>
                    <th className="px-4 py-2 font-semibold text-right">Late by</th>
                    <th className="px-4 py-2 font-semibold text-right">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {delivery.overdueProjects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/dashboard/projects/${p.id}`}
                          className="text-slate-800 hover:text-blue-600"
                        >
                          {p.name}
                        </Link>
                        <span className="block text-xs text-slate-400 font-mono">
                          {p.projectNumber}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {new Date(p.expectedEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-700 font-medium">
                        {p.daysLate} days
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                        {p.progress}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Money */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Money
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile label="Contracted" value={formatCurrency(money.contractTotal)} />
          <Tile label="Scheduled" value={formatCurrency(money.scheduled)} />
          <Tile label="Received" value={formatCurrency(money.received)} tone="good" />
          <Tile
            label="Outstanding"
            value={formatCurrency(money.outstanding)}
            tone={money.outstanding > 0 ? "warn" : undefined}
          />
        </div>
        {money.unscheduled > 1 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <strong>{formatCurrency(money.unscheduled)}</strong> of contracted
            work has no payment milestone against it. Until it does, there is
            nothing to invoice from.
          </p>
        )}
      </section>

      {/* Conversion */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Where projects come from
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Tile label="Leads won" value={String(conversion.wonLeads)} />
          <Tile label="Value won" value={formatCurrency(conversion.wonValue)} />
          <Tile label="Projects created" value={String(conversion.projectsCreated)} />
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            Leads by stage
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {Object.entries(conversion.leadStages).map(([stage, count]) => (
              <div key={stage} className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-slate-800 tabular-nums">
                  {count}
                </span>
                <span className="text-sm text-slate-500">
                  {STAGE_LABEL[stage] ?? stage}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <ChartBarIcon className="w-3.5 h-3.5" />
        Figures are live, computed when this page loads.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const colour =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : "text-slate-900";
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200">
      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${colour}`}>{value}</p>
    </div>
  );
}
