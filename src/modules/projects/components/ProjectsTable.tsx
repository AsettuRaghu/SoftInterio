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
  ProjectStatusLabels,
  ProjectCategoryLabels,
  ProjectPropertyTypeLabels,
} from "@/types/projects";
import { ServiceTypeLabels } from "@/types/leads";
import {
  PROJECT_STATUS_COLORS,
  PROJECT_PRIORITY_COLORS,
  PROJECT_PHASE_COLORS,
} from "@/modules/projects/constants";
import { formatCurrency, formatDate } from "@/modules/projects/utils";

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

  // Define columns
  const columns: ColumnDef<ProjectSummary>[] = [
    {
      key: "client_name",
      header: "Client",
      width: "16%",
      sortable: true,
      render: (project) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {project.client_name || "Unknown Client"}
          </p>
          {project.service_type && (
            <p className="text-xs text-slate-500 mt-1">
              {ServiceTypeLabels[
                project.service_type as keyof typeof ServiceTypeLabels
              ] || project.service_type}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "property_name",
      header: "Property",
      width: "20%",
      sortable: true,
      render: (project) => (
        <div className="text-sm space-y-1">
          <p className="font-semibold text-slate-900">
            {project.property_name || "N/A"}
          </p>
          <div className="flex flex-col gap-0.5 text-xs text-slate-600">
            {project.property_type && (
              <span>Type: {getPropertyTypeLabel(project.property_type)}</span>
            )}
            {project.carpet_area && (
              <span>Area: {project.carpet_area} sqft</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      width: "10%",
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
      key: "current_phase",
      header: "Phase",
      width: "12%",
      sortable: true,
      render: (project) => {
        const phase = project.current_phase;
        const colors = phase
          ? PROJECT_PHASE_COLORS[phase as keyof typeof PROJECT_PHASE_COLORS]
          : null;
        return (
          <div>
            {phase ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colors?.bg} ${colors?.text}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${colors?.dot}`}
                ></span>
                {phase}
              </span>
            ) : (
              <span className="text-xs text-slate-500">Not Started</span>
            )}
          </div>
        );
      },
    },
    {
      key: "project_manager",
      header: "Assigned To",
      width: "12%",
      sortable: false,
      render: (project) => (
        <div className="flex items-center gap-2">
          {project.project_manager && (
            <>
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-xs font-semibold text-slate-600">
                {project.project_manager.name?.charAt(0).toUpperCase() || "?"}
              </div>
              <span className="text-sm font-medium text-slate-900 truncate">
                {project.project_manager.name}
              </span>
            </>
          )}
          {!project.project_manager && (
            <span className="text-xs text-slate-500">Unassigned</span>
          )}
        </div>
      ),
    },
    {
      key: "timeline",
      header: "Timeline",
      width: "14%",
      sortable: true,
      render: (project) => (
        <div className="text-xs text-slate-600 space-y-1">
          <div>
            <span
              className={`font-semibold ${
                project.expected_end_date &&
                new Date(project.expected_end_date) < new Date() &&
                project.status !== "completed"
                  ? "text-red-600"
                  : "text-slate-900"
              }`}
            >
              {formatDate(project.expected_end_date) || "N/A"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Start: </span>
            <span className="font-medium">
              {formatDate(project.expected_start_date) || "N/A"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Created: </span>
            <span className="font-medium">
              {formatDate(project.created_at) || "N/A"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
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
      key: "overall_progress",
      header: "Progress",
      width: "10%",
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
