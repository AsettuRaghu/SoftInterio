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
