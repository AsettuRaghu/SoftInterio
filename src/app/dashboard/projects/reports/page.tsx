"use client";

/**
 * Project reports.
 *
 * Deliberately the same furniture as Sales Reports - `Section`, `Panel`,
 * `Metric`, `StatBar` and the tints all come from `components/reports`, so the
 * two pages cannot drift into looking like different products again. Colour
 * means the same thing on both: blue is work in play, emerald is finished, amber
 * is slipping, red is wrong.
 *
 * **No financial figures.** Not gated per role - the API does not gather them,
 * and does not even select `contract_value`. Contracted value, milestones and
 * what has been received belong to a finance module; a report must not become
 * the way to read figures the product has decided not to show here.
 *
 * What this answers is delivery: what is late, what nobody owns, who is carrying
 * it and where the hours went. On real data it opens on the things worth acting
 * on - twenty overdue tasks, twenty with no owner, and neither project having a
 * manager.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { uiLogger } from "@/lib/logger";
import {
  Section,
  Panel,
  Metric,
  StatBar,
  Icon,
  ICONS,
  ageTint,
  humanise,
} from "@/components/reports";

interface Report {
  scope: "tenant" | "own";
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
}

const STATUS_LABEL: Record<string, string> = {
  new: "Not started",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** One colour per project status, used wherever the mix is drawn. */
const STATUS_TINT: Record<string, string> = {
  new: "bg-slate-400",
  in_progress: "bg-blue-400",
  on_hold: "bg-amber-400",
  completed: "bg-emerald-500",
  cancelled: "bg-red-400",
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
      <div className="p-5 space-y-7">
        <div className="h-6 w-56 bg-slate-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-lg animate-pulse" />
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

  const { portfolio, delivery, work } = report;
  const own = report.scope === "own";
  const h = work.hours;

  const statusRows = Object.entries(portfolio.byStatus);
  const maxStatus = Math.max(1, ...statusRows.map(([, n]) => n));
  const maxLate = Math.max(1, ...work.overdueByProject.map((r) => r.count));
  const maxLoad = Math.max(1, ...work.byAssignee.map((r) => r.open));

  return (
    <div className="p-5 space-y-7">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Project reports
        </h1>
        <p className="text-sm text-slate-500">
          {portfolio.total} project{portfolio.total === 1 ? "" : "s"}
          {own && " you manage"} · {portfolio.open} still open · delivery only,
          no financial figures
        </p>
      </div>

      {/* The band a delivery team came for. First, and the widest. */}
      <Section
        title="What needs attention"
        note={own ? "Your projects" : "Every project on record"}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Metric
            label="Open tasks"
            value={String(work.openTasks)}
            hint={`across ${portfolio.open} open project${
              portfolio.open === 1 ? "" : "s"
            }`}
            tone="blue"
            icon={<Icon d={ICONS.list} />}
          />
          <Metric
            label="Overdue"
            value={String(work.overdueTasks)}
            hint={work.overdueTasks ? "past their due date" : "nothing late"}
            hintTone={work.overdueTasks ? "bad" : "good"}
            tone={work.overdueTasks ? "red" : "emerald"}
            icon={<Icon d={ICONS.warning} />}
          />
          <Metric
            label="Nobody assigned"
            value={String(work.unassignedTasks)}
            hint="open work with no owner"
            hintTone={work.unassignedTasks ? "warn" : "muted"}
            tone="amber"
            icon={<Icon d={ICONS.people} />}
          />
          <Metric
            label="No due date"
            value={String(work.undatedTasks)}
            hint="cannot be late, or planned"
            hintTone={work.undatedTasks ? "warn" : "muted"}
            tone="amber"
            icon={<Icon d={ICONS.calendar} />}
          />
          <Metric
            label="Average progress"
            value={`${portfolio.averageProgress}%`}
            hint="across every project"
            tone="violet"
            icon={<Icon d={ICONS.target} />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="Where work is late" hint="Worst delay first">
            {work.overdueByProject.length ? (
              <div className="space-y-3.5">
                {work.overdueByProject.map((row) => (
                  <StatBar
                    key={row.projectId}
                    label={
                      <Link
                        href={`/dashboard/projects/${row.projectId}`}
                        className="hover:text-blue-600"
                      >
                        {row.name}
                      </Link>
                    }
                    value={row.count}
                    max={maxLate}
                    bar="bg-red-400"
                    right={`${row.count} late`}
                    aside={
                      <span className="block truncate text-slate-400">
                        Worst: {row.worstTitle}{" "}
                        <span className={ageTint(row.worstDays)}>
                          · {row.worstDays}d
                        </span>
                      </span>
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Nothing is past its due date.
              </p>
            )}
          </Panel>

          <Panel title="Who is carrying what" hint="Open tasks per person">
            {work.byAssignee.length ? (
              <div className="space-y-3.5">
                {work.byAssignee.map((row) => (
                  <StatBar
                    key={row.userId}
                    label={
                      row.userId === "unassigned" ? (
                        <span className="text-amber-700">Unassigned</span>
                      ) : (
                        row.name
                      )
                    }
                    value={row.open}
                    max={maxLoad}
                    bar={
                      row.userId === "unassigned" ? "bg-amber-400" : "bg-blue-400"
                    }
                    aside={
                      row.overdue ? (
                        <span className="text-red-600">
                          {row.overdue} already overdue
                        </span>
                      ) : (
                        <span className="text-slate-400">nothing late</span>
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No open tasks to carry.</p>
            )}
          </Panel>

          <Panel title="Projects by status" hint="Every project in scope">
            {statusRows.length ? (
              <div className="space-y-3.5">
                {statusRows.map(([status, count]) => (
                  <StatBar
                    key={status}
                    label={STATUS_LABEL[status] ?? humanise(status)}
                    value={count}
                    max={maxStatus}
                    bar={STATUS_TINT[status] ?? "bg-slate-400"}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No projects yet.</p>
            )}
          </Panel>
        </div>
      </Section>

      {/* Delivery against the plan. */}
      <Section title="Delivery" note="Against each project's expected end date">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Metric
            label="On track"
            value={String(delivery.onTrack)}
            hint="still inside their dates"
            hintTone="good"
            tone="emerald"
            icon={<Icon d={ICONS.check} />}
          />
          <Metric
            label="Past their end date"
            value={String(delivery.overdue)}
            hint={delivery.overdue ? "need a new date, or a push" : "none"}
            hintTone={delivery.overdue ? "bad" : "good"}
            tone={delivery.overdue ? "red" : "slate"}
            icon={<Icon d={ICONS.clock} />}
          />
          <Metric
            label="No project manager"
            value={String(delivery.unassigned)}
            hint="nobody accountable"
            hintTone={delivery.unassigned ? "warn" : "muted"}
            tone="amber"
            icon={<Icon d={ICONS.building} />}
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
                        className={`py-2 px-2 text-right tabular-nums font-medium ${ageTint(
                          p.daysLate
                        )}`}
                      >
                        {p.daysLate} days
                      </td>
                      <td className="py-2 pr-4 pl-2 text-right">
                        {/* Progress beside the delay is the pair that matters:
                            late and nearly done is a different problem from late
                            and barely started. */}
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded overflow-hidden">
                            <div
                              className={`h-1.5 rounded ${
                                p.progress >= 75
                                  ? "bg-emerald-500"
                                  : p.progress >= 25
                                    ? "bg-amber-400"
                                    : "bg-red-400"
                              }`}
                              style={{ width: `${Math.max(p.progress, 2)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-slate-600 w-9 text-right">
                            {p.progress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </Section>

      {/* Where the time goes. */}
      <Section title="Time" note="Hours a playbook expected, against hours logged">
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

              {/* The honest reading: an estimate nobody logs against cannot say
                  whether the work is costing more than planned. */}
              {h.tracked < h.estimated / 2 && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Only {h.tracked} of {h.estimated} estimated tasks have any time
                  logged, so the comparison above says little yet. Logging time
                  on a task is what makes this answer anything.
                </p>
              )}

              {h.overBudget.length > 0 && (
                <div className="mt-3.5 border-t border-slate-100 pt-3.5 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Over their estimate
                  </p>
                  {h.overBudget.map((t) => (
                    <StatBar
                      key={t.id}
                      label={
                        <>
                          {t.title}
                          <span className="text-slate-400"> · {t.project}</span>
                        </>
                      }
                      value={t.logged}
                      max={Math.max(
                        ...h.overBudget.map((x) => Math.max(x.logged, x.expected))
                      )}
                      bar="bg-amber-400"
                      right={`${t.logged}h / ${t.expected}h`}
                      thin
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>
      </Section>
    </div>
  );
}
