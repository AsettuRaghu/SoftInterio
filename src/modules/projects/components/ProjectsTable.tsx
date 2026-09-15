"use client";

import React from "react";
import {
  AppTable,
  type ColumnDef,
  type SortState,
  type PaginationState,
} from "@/components/ui/AppTable";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import type { ProjectSummary } from "@/types/projects";
import {
  LastActivityCell,
  FollowUpCell,
} from "@/components/leads/activity-cells";
import {
  ProjectStatusLabels,
  ProjectCategoryLabels,
  ProjectPropertyTypeLabels,
  ProjectActivityTypeLabels,
} from "@/types/projects";
import { ServiceTypeLabels } from "@/types/leads";
import {
  PROJECT_STATUS_COLORS,
  PROJECT_PRIORITY_COLORS,
  PROJECT_PHASE_COLORS,
} from "@/modules/projects/constants";

/**
 * Where a project's dates are heading, from how far it has got.
 *
 * The planned dates are a promise made at handover. What a manager scanning the
 * list needs is whether that promise still holds, and the honest way to answer
 * from a list is to extrapolate: if 30% of the work took 60 days, the whole
 * will take about 200, so it ends around start + 200. A straight line through
 * the progress so far - crude, and stated as such in the hover, but it is the
 * same arithmetic anyone does in their head and it is right far more often than
 * the planned end date is once the work is under way.
 *
 * It refuses to guess where guessing would mislead:
 *
 *   - No start recorded and the planned start still ahead: there is no elapsed
 *     time to extrapolate from, so it says when the project starts. If it
 *     already shows progress, that is flagged - work is happening against a
 *     record that says it has not begun.
 *   - Nothing done yet: the pace is zero and a projection would be infinite,
 *     so it says whether the planned end has already gone by.
 *   - Finished: the actual end is the answer, against the planned one.
 */
type Timeline = {
  headline: string;
  tone: string;
  /** A second line under the headline, when there is something to add. */
  note?: string;
  noteTone?: string;
  /** For the hover - how the headline was arrived at. */
  explain?: string;
};

const DAY = 86_400_000;
const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const dayMonthYear = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
const daysBetween = (a: string | Date, b: string | Date) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);

export function projectTimeline(p: {
  status: string;
  overall_progress?: number;
  expected_start_date?: string | null;
  expected_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
}): Timeline | null {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const progress = Math.max(0, Math.min(100, p.overall_progress ?? 0));
  const plannedEnd = p.expected_end_date ?? null;

  // Finished: the fact, against the promise.
  if (p.status === "completed" && p.actual_end_date) {
    const delta = plannedEnd ? daysBetween(plannedEnd, p.actual_end_date) : null;
    return {
      headline: `Done ${dayMonth(p.actual_end_date)}`,
      tone: "text-emerald-700",
      note:
        delta === null
          ? undefined
          : delta <= 0
            ? delta === 0
              ? "on the planned day"
              : `${-delta}d early`
            : `${delta}d after plan`,
      noteTone:
        delta === null ? undefined : delta <= 0 ? "text-emerald-600" : "text-red-600",
    };
  }
  if (p.status === "cancelled") {
    return { headline: "Cancelled", tone: "text-slate-400" };
  }

  const start =
    p.actual_start_date ??
    (p.expected_start_date && p.expected_start_date <= todayIso
      ? p.expected_start_date
      : null);

  // Not begun, by the record.
  if (!start) {
    if (p.expected_start_date) {
      const inDays = daysBetween(todayIso, p.expected_start_date);
      return {
        headline: `Starts ${dayMonth(p.expected_start_date)}`,
        tone: "text-slate-600",
        note:
          progress > 0
            ? `${progress}% done with no start recorded`
            : `in ${inDays}d`,
        noteTone: progress > 0 ? "text-amber-600" : "text-slate-400",
        explain:
          progress > 0
            ? "Work is being logged against a project whose start date is still ahead. Set the actual start date on the project to get a projection."
            : undefined,
      };
    }
    return { headline: "No dates set", tone: "text-slate-400" };
  }

  // Started but nothing done: no pace to extrapolate from.
  if (progress <= 0) {
    if (plannedEnd && plannedEnd < todayIso) {
      return {
        headline: `${daysBetween(plannedEnd, todayIso)}d past planned end`,
        tone: "text-red-600",
        note: "nothing completed yet",
        noteTone: "text-red-500",
      };
    }
    return {
      headline: plannedEnd ? `Ends ${dayMonth(plannedEnd)} (plan)` : "Not started",
      tone: "text-slate-600",
      note: "nothing completed yet",
      noteTone: "text-slate-400",
    };
  }

  // Under way: a straight line through progress to date.
  const elapsed = Math.max(1, daysBetween(start, todayIso));
  const projectedTotal = Math.round(elapsed / (progress / 100));
  const projectedEnd = new Date(new Date(start).getTime() + projectedTotal * DAY);
  const projectedIso = projectedEnd.toISOString().slice(0, 10);
  const delta = plannedEnd ? daysBetween(plannedEnd, projectedIso) : null;

  const tone =
    delta === null
      ? "text-slate-700"
      : delta <= 0
        ? "text-emerald-700"
        : delta <= 14
          ? "text-amber-600"
          : "text-red-600";

  return {
    headline: `Ends ~${dayMonth(projectedIso)}`,
    tone,
    note:
      delta === null
        ? `at the current pace`
        : delta <= 0
          ? delta === 0
            ? "on plan"
            : `${-delta}d ahead of plan`
          : `${delta}d behind plan`,
    noteTone: tone,
    explain: `Projected from ${progress}% done in ${elapsed} days since ${dayMonthYear(start)}, assuming the same pace continues. Planned end ${plannedEnd ? dayMonthYear(plannedEnd) : "not set"}.`,
  };
}

interface ProjectsTableProps {
  data: ProjectSummary[];
  sortState: SortState;
  onSort: (column: string) => void;
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRowClick: (project: ProjectSummary) => void;
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
  };
  stickyHeader?: boolean;
}

export default function ProjectsTable({
  data,
  sortState,
  onSort,
  pagination,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  emptyState,
  stickyHeader = true,
}: ProjectsTableProps) {
  // Helper function to capitalize property type
  const getPropertyTypeLabel = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  /*
   * The same shape as the leads list, on purpose.
   *
   * A seller and a project manager both walk past a list asking the same three
   * things - what is it, where has it got to, what is owed next - and the two
   * lists answered them differently. This one now mirrors the lead columns
   * one for one: the record and what it is about, its stage, its status and
   * priority, who owns it, then Last Activity and Follow-up drawn by the very
   * same cells the leads list draws.
   */
  const columns: ColumnDef<ProjectSummary>[] = [
    {
      key: "client_name",
      header: "Client",
      width: "18%",
      sortable: true,
      render: (project) => {
        const service = project.project_category
          ? ProjectCategoryLabels[project.project_category] ||
            project.project_category
          : project.service_type
            ? ServiceTypeLabels[project.service_type as keyof typeof ServiceTypeLabels] ||
              project.service_type
            : null;
        const propertyType = project.property_type
          ? getPropertyTypeLabel(project.property_type)
          : null;
        /*
         * The client is the headline. A project is known by who it is for -
         * "the Raju job" - and the generated name repeats the client anyway
         * ("Dileepnath Raju - Modular Project"). So the client leads, and the
         * project name sits beneath with the four facts that say what it is:
         * service, property, property type and where.
         */
        const facts = [
          project.name,
          service,
          project.property_name,
          propertyType,
          project.city,
        ].filter(
          (f): f is string =>
            !!f && f !== "Unknown Client" && f !== "Unknown Property"
        );
        return (
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {project.client_name && project.client_name !== "Unknown Client"
                ? project.client_name
                : project.name}
            </p>
            {facts.length > 0 && (
              <p
                className="mt-0.5 text-xs text-slate-500 break-words whitespace-normal leading-snug"
                title={facts.join(" · ")}
              >
                {facts.join(" · ")}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "overall_progress",
      header: "Stage & Progress",
      width: "16%",
      sortable: true,
      render: (project) => {
        /*
         * Where the work is and how far along, in one place, because they are
         * one fact seen two ways. The stage names are the tenant's own - a
         * playbook's top-level steps, or native phases for a project without a
         * run - and there can be more than one under way at once when the
         * playbook allows it. Hovering the bar lists every stage's progress;
         * that is a plain title attribute, so it adds nothing to the page.
         */
        const summary = project.stage_summary;
        const pct = project.overall_progress || 0;

        const headline = !summary
          ? null
          : summary.active.length
            ? summary.active.map((st) => st.name).join(" + ")
            : summary.next
              ? `Next: ${summary.next}`
              : summary.done === summary.total
                ? "All stages done"
                : null;

        const breakdown = summary
          ? summary.breakdown
              .map((st) => `${st.name}: ${st.progress}%`)
              .join("\n")
          : undefined;

        return (
          <div className="min-w-0">
            {headline ? (
              <p
                className={`text-sm font-medium truncate ${
                  summary!.active.length ? "text-blue-700" : "text-slate-600"
                }`}
                title={headline}
              >
                {headline}
              </p>
            ) : (
              <p className="text-sm text-slate-300">—</p>
            )}
            <div
              className="mt-1 flex items-center gap-2"
              title={breakdown}
            >
              <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct >= 100 ? "bg-green-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-700 tabular-nums w-9 text-right">
                {pct}%
              </span>
            </div>
            {summary && (
              <p className="text-[11px] text-slate-400 tabular-nums">
                {summary.done} of {summary.total} stages done
                {summary.source === "phases" && " · phases"}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "9%",
      sortable: true,
      render: (project) => {
        const colors = PROJECT_STATUS_COLORS[project.status];
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colors?.bg} ${colors?.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${colors?.dot}`}></span>
            {ProjectStatusLabels[project.status]}
          </span>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      width: "8%",
      sortable: true,
      render: (project) => {
        const priority = project.priority || "Medium";
        const colors =
          PROJECT_PRIORITY_COLORS[
            priority as keyof typeof PROJECT_PRIORITY_COLORS
          ];
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colors?.bg} ${colors?.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${colors?.dot}`}></span>
            {priority}
          </span>
        );
      },
    },
    {
      key: "project_manager",
      header: "Assigned To",
      width: "10%",
      sortable: false,
      render: (project) => {
        const pm = project.project_manager;
        if (!pm) {
          // Amber, not grey: on a project this is a gap, not a neutral fact.
          return <span className="text-xs text-amber-600">Unassigned</span>;
        }
        return (
          <div className="flex items-center gap-2 min-w-0">
            {pm.avatar_url ? (
              <img
                src={pm.avatar_url}
                alt=""
                className="w-6 h-6 rounded-full shrink-0 object-cover"
              />
            ) : (
              <span className="w-6 h-6 rounded-full shrink-0 bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center">
                {pm.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
            )}
            <span className="text-sm text-slate-700 truncate">{pm.name}</span>
          </div>
        );
      },
    },
    {
      key: "timeline",
      header: "Timelines",
      width: "150px",
      minWidth: "150px",
      sortable: true,
      render: (project) => {
        const t = projectTimeline(project);
        const planned =
          project.expected_start_date || project.expected_end_date
            ? `${
                project.expected_start_date
                  ? dayMonth(project.expected_start_date)
                  : "?"
              } → ${
                project.expected_end_date
                  ? dayMonth(project.expected_end_date)
                  : "?"
              }`
            : null;
        return (
          <div className="min-w-0" title={t?.explain}>
            {/* The projection leads: it is the answer to "will this land on
                time", which is what the column is for. The plan sits beneath
                as the reference it is measured against. */}
            {t ? (
              <p className={`text-sm font-medium ${t.tone}`}>{t.headline}</p>
            ) : (
              <p className="text-sm text-slate-300">—</p>
            )}
            {t?.note && (
              <p className={`text-[11px] ${t.noteTone ?? "text-slate-400"}`}>
                {t.note}
              </p>
            )}
            {planned && (
              <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                Planned {planned}
              </p>
            )}
          </div>
        );
      },
    },
    /*
     * Fixed widths on the two prose columns. The table is not table-fixed, so
     * a percentage is only a suggestion and a long note would widen its column
     * at the expense of the others. A pixel width plus a matching max-width on
     * the cell means long text wraps inside the column and makes the row
     * taller, never the column wider - which is what "shown in full, never
     * cropped" needs to hold without the rest of the row moving.
     */
    {
      key: "last_activity_at",
      header: "Last Activity",
      width: "220px",
      minWidth: "220px",
      sortable: true,
      render: (project) => (
        <div className="max-w-[220px]">
          <LastActivityCell
            at={project.last_activity_at}
            type={project.last_activity_type}
            detail={project.last_activity_detail}
            recent={project.recent_activities}
            labels={ProjectActivityTypeLabels}
          />
        </div>
      ),
    },
    {
      key: "next_follow_up_at",
      header: "Follow-up",
      width: "200px",
      minWidth: "200px",
      sortable: false,
      render: (project) => (
        <div className="max-w-[200px]">
          <FollowUpCell
            items={project.upcoming_items}
            fallbackAt={project.next_follow_up_at}
          />
        </div>
      ),
    },
    // No trailing View column: the row itself opens the project, so a button
    // saying so was a second way of doing the one thing the row does.
  ];

  return (
    <AppTable
      data={data}
      columns={columns}
      keyExtractor={(p) => p.id}
      sortable={true}
      sortState={sortState}
      onSort={onSort}
      onRowClick={onRowClick}
      pagination={pagination}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      emptyState={
        emptyState || {
          title: "No projects found",
          description: "Get started by creating your first project",
          icon: <BuildingOffice2Icon className="w-10 h-10 text-slate-300" />,
        }
      }
      stickyHeader={stickyHeader}
    />
  );
}
