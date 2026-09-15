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
      key: "name",
      header: "Project",
      width: "22%",
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
        // Client, service, property and its type - the four facts that say
        // what this project actually is, under the name that says which one.
        const facts = [
          project.client_name,
          service,
          project.property_name,
          propertyType,
        ].filter((f): f is string => !!f && f !== "Unknown Client" && f !== "Unknown Property");
        return (
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {project.name}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              {project.project_number}
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
      key: "current_stage",
      header: "Stage",
      width: "13%",
      sortable: false,
      render: (project) => {
        /*
         * Where the work has got to, as opposed to Status, which is where the
         * record is. "In progress" covers everything between the first
         * drawing and the last snag; the stage says which of those it is on.
         * Derived by the API from the playbook's top-level steps, falling
         * back to native phases - so the names are the tenant's own.
         */
        const stage = project.current_stage;
        if (!stage) {
          return <span className="text-sm text-slate-300">—</span>;
        }
        const tone =
          stage.status === "in_progress"
            ? "text-blue-700"
            : stage.status === "completed"
              ? "text-emerald-700"
              : "text-slate-700";
        return (
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${tone}`} title={stage.name}>
              {stage.name}
            </p>
            <p className="text-[11px] text-slate-400 tabular-nums">
              {stage.index + 1} of {stage.total}
              {stage.status === "not_started" && " · not started"}
              {stage.source === "phases" && " · phases"}
            </p>
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
      key: "overall_progress",
      header: "Progress",
      width: "8%",
      sortable: true,
      render: (project) => (
        <div className="w-full">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700">
              {project.overall_progress}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                project.overall_progress >= 100 ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${project.overall_progress}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "last_activity_at",
      header: "Last Activity",
      width: "15%",
      sortable: true,
      render: (project) => (
        <LastActivityCell
          at={project.last_activity_at}
          type={project.last_activity_type}
          detail={project.last_activity_detail}
          recent={project.recent_activities}
          labels={ProjectActivityTypeLabels}
        />
      ),
    },
    {
      key: "next_follow_up_at",
      header: "Follow-up",
      width: "13%",
      sortable: false,
      render: (project) => (
        <FollowUpCell
          items={project.upcoming_items}
          fallbackAt={project.next_follow_up_at}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      width: "2%",
      render: (project) => (
        <div className="flex items-center justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRowClick(project);
            }}
            className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            View
          </button>
        </div>
      ),
    },
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
