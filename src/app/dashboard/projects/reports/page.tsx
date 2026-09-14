"use client";

/**
 * Project reports.
 *
 * Built for two audiences with different entitlements.
 *
 * A delivery team opens this to find what is late, what nobody owns and where
 * the hours are going - so that band comes first and is the largest. Management
 * gets the portfolio and the money. The **money band is absent from the API
 * response** for anyone without `finance.payments.view`, so there is nothing to
 * hide in the browser; `canSeeMoney` only decides whether to draw a heading for
 * data that arrived. Owner and Admin hold everything.
 *
 * This replaced a page of four tile rows that answered portfolio questions -
 * value, progress, lead conversion - and said nothing about the work, so there
 * was nothing on it a project manager could act on that morning. Conversion is
 * deliberately gone: Sales Reports answers it properly and two pages disagreeing
 * about a win rate is worse than one page answering it.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { uiLogger } from "@/lib/logger";
import { formatCurrency } from "@/modules/projects/utils";

interface Report {
  scope: "tenant" | "own";
  canSeeMoney: boolean;
  portfolio: {
    total: number;
    open: number;
    byStatus: Record<string, number>;
    averageProgress: number;
  };
  delivery: {
    onTrack: number;
    overdue: number;
    unassigned: number;
    overdueProjects: {
      id: string; projectNumber: string | null; name: string | null;
      expectedEnd: string; progress: number; daysLate: number;
    }[];
  };
  work: {
    openTasks: number;
    overdueTasks: number;
    undatedTasks: number;
    unassignedTasks: number;
    overdueByProject: {
      projectId: string; projectNumber: string | null; name: string;
      count: number; worstDays: number; worstTitle: string;
    }[];
    byAssignee: { userId: string; name: string; open: number; overdue: number }[];
    hours: {
      expected: number; logged: number; tracked: number; estimated: number;
      overBudget: {
        id: string; title: string; project: string;
        expected: number; logged: number;
      }[];
    };
  };
  money?: {
    contractTotal: number;
    costRecorded: number;
    scheduled: number;
    received: number;
    outstanding: number;
    unscheduled: number;
    milestoneCount: number;
  };
}

const STATUS_LABEL: Record<string, string> = {
  new: "Not started",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** How worried to look about something that has slipped. */
const lateTint = (days: number) =>
  days >= 30 ? "text-red-600" : days >= 7 ? "text-amber-600" : "text-slate-500";

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h2>
        {note && <span className="text-[11px] text-slate-400">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Panel({
  title,
  hint,
  flush = false,
  children,
}: {
  title: string;
  hint?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div
        className={`flex items-baseline justify-between gap-3 px-4 pt-3.5 ${
          flush ? "pb-2" : "pb-3"
        }`}
      >
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint && (
          <span className="text-[11px] text-slate-400 text-right shrink-0">
            {hint}
          </span>
        )}
      </div>
      <div className={flush ? "pb-2" : "px-4 pb-4"}>{children}</div>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
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
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${colour}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

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
    } catch (err) {
      uiLogger.error("Failed to load project reports", err);
      setError(
        err instanceof Error ? err.message : "Could not build the report"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (permsLoading || loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-6 w-56 bg-slate-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasPermission("projects.reports")) {
    return (
      <div className="p-5">
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          You do not have permission to view project reports.
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">
            {error ?? "Could not build the report"}
          </p>
          <button
            onClick={() => void load()}
            className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-md hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { portfolio, delivery, work, money } = report;
  const own = report.scope === "own";
  const h = work.hours;

  return (
    <div className="p-5 space-y-7">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Project reports
        </h1>
        <p className="text-sm text-slate-500">
          {portfolio.total} project{portfolio.total === 1 ? "" : "s"}
          {own && " you manage"} · {portfolio.open} still open
          {!report.canSeeMoney && (
            <span className="text-slate-400">
              {" "}
              · financial figures are not shown for your role
            </span>
          )}
        </p>
      </div>

      {/* The band a delivery team came for. First, and the biggest. */}
      <Section
        title="What needs attention"
        note={own ? "Your projects" : "Every project on record"}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile
            label="Open tasks"
            value={String(work.openTasks)}
            hint={`across ${portfolio.open} open project${
              portfolio.open === 1 ? "" : "s"
            }`}
          />
          <Tile
            label="Overdue tasks"
            value={String(work.overdueTasks)}
            tone={work.overdueTasks ? "bad" : "good"}
            hint={work.overdueTasks ? "past their due date" : "nothing late"}
          />
          <Tile
            label="Nobody assigned"
            value={String(work.unassignedTasks)}
            tone={work.unassignedTasks ? "warn" : undefined}
            hint="open work with no owner"
          />
          <Tile
            label="No due date"
            value={String(work.undatedTasks)}
            tone={work.undatedTasks ? "warn" : undefined}
            hint="cannot be late, or planned"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel
            title="Late work, by project"
            hint="Worst delay first"
            flush
          >
            {work.overdueByProject.length ? (
              <div className="divide-y divide-slate-100">
                {work.overdueByProject.map((row) => (
                  <Link
                    key={row.projectId}
                    href={`/dashboard/projects/${row.projectId}`}
                    className="block px-4 py-2 hover:bg-slate-50"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-slate-800">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                        {row.count} late
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      Worst: {row.worstTitle}{" "}
                      <span className={lateTint(row.worstDays)}>
                        · {row.worstDays}d
                      </span>
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-4 pb-2 text-sm text-slate-400">
                Nothing is past its due date.
              </p>
            )}
          </Panel>

          <Panel title="Who is carrying what" hint="Open tasks per person" flush>
            {work.byAssignee.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                      <th className="py-2 pl-4 font-medium">Person</th>
                      <th className="py-2 px-2 font-medium text-right">Open</th>
                      <th className="py-2 pr-4 pl-2 font-medium text-right">
                        Overdue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {work.byAssignee.map((row) => (
                      <tr key={row.userId} className="hover:bg-slate-50/70">
                        <td className="py-2 pl-4 text-slate-800 truncate max-w-[200px]">
                          {row.name}
                          {row.userId === "unassigned" && (
                            <span className="ml-2 text-[11px] text-amber-600">
                              needs an owner
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-700">
                          {row.open}
                        </td>
                        <td className="py-2 pr-4 pl-2 text-right tabular-nums">
                          {row.overdue ? (
                            <span className="font-medium text-red-600">
                              {row.overdue}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 pb-2 text-sm text-slate-400">
                No open tasks to carry.
              </p>
            )}
          </Panel>
        </div>
      </Section>

      {/* Delivery against the plan. */}
      <Section title="Delivery" note="Against each project's expected end date">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            hint="nobody accountable"
          />
          <Tile
            label="Average progress"
            value={`${portfolio.averageProgress}%`}
          />
        </div>

        {delivery.overdueProjects.length > 0 && (
          <Panel title="Projects past their expected end date" flush>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="py-2 pl-4 font-medium">Project</th>
                    <th className="py-2 px-2 font-medium">Expected</th>
                    <th className="py-2 px-2 font-medium text-right">Late by</th>
                    <th className="py-2 pr-4 pl-2 font-medium text-right">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {delivery.overdueProjects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-2 pl-4">
                        <Link
                          href={`/dashboard/projects/${p.id}`}
                          className="text-slate-800 hover:text-blue-600"
                        >
                          {p.name}
                        </Link>
                        <span className="block text-[11px] text-slate-400 font-mono">
                          {p.projectNumber}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                        {new Date(p.expectedEnd).toLocaleDateString()}
                      </td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums font-medium ${lateTint(
                          p.daysLate
                        )}`}
                      >
                        {p.daysLate} days
                      </td>
                      <td className="py-2 pr-4 pl-2 text-right tabular-nums text-slate-600">
                        {p.progress}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <Panel title="By status" hint="Every project in scope">
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
        </Panel>
      </Section>

      {/* Where the time goes. */}
      <Section
        title="Time"
        note="Hours a playbook expected, against hours logged"
      >
        <Panel
          title="Hours"
          hint={`${h.tracked} of ${h.estimated} estimated tasks have time logged`}
        >
          {h.estimated === 0 ? (
            <p className="text-sm text-slate-400">
              No task carries an estimate yet, so there is nothing to compare.
            </p>
          ) : (
            <>
              <div className="flex gap-8">
                <div>
                  <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                    {h.expected}
                  </p>
                  <p className="text-[11px] text-slate-400">hours expected</p>
                </div>
                <div>
                  <p
                    className={`text-2xl font-semibold tabular-nums ${
                      h.logged > h.expected ? "text-amber-700" : "text-slate-400"
                    }`}
                  >
                    {h.logged}
                  </p>
                  <p className="text-[11px] text-slate-400">hours logged</p>
                </div>
              </div>

              {/* The honest reading: an estimate nobody logs against cannot
                  tell you whether the work is costing more than planned. */}
              {h.tracked < h.estimated / 2 && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Only {h.tracked} of {h.estimated} estimated tasks have any time
                  logged, so the comparison above says little yet. Logging time
                  on a task is what makes this answer anything.
                </p>
              )}

              {h.overBudget.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Over their estimate
                  </p>
                  {h.overBudget.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-slate-700">
                        {t.title}
                        <span className="text-slate-400"> · {t.project}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-amber-700">
                        {t.logged}h / {t.expected}h
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>
      </Section>

      {/*
       * Money arrives only for those entitled to it - the API omits the whole
       * band otherwise, so this is not a hidden section but an absent one.
       */}
      {money && (
        <Section
          title="Money"
          note="Contracted value, and what has been scheduled and received"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile
              label="Contracted"
              value={formatCurrency(money.contractTotal)}
            />
            <Tile label="Scheduled" value={formatCurrency(money.scheduled)} />
            <Tile
              label="Received"
              value={formatCurrency(money.received)}
              tone="good"
            />
            <Tile
              label="Outstanding"
              value={formatCurrency(money.outstanding)}
              tone={money.outstanding > 0 ? "warn" : undefined}
            />
          </div>

          {money.milestoneCount === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>{formatCurrency(money.contractTotal)}</strong> of contracted
              work has no payment milestone against it — not one has been set up.
              Until there is a schedule, there is nothing to invoice from.
            </p>
          ) : (
            money.unscheduled > 1 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <strong>{formatCurrency(money.unscheduled)}</strong> of contracted
                work has no payment milestone against it.
              </p>
            )
          )}

          <Panel title="Cost recorded" hint="Money spent, not money owed">
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {formatCurrency(money.costRecorded)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              This is <code>actual_cost</code>, which is spend. A project&apos;s
              value is its contract, shown above.
            </p>
          </Panel>
        </Section>
      )}
    </div>
  );
}
