"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProjectSummary, ProjectStatus } from "@/types/projects";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatBadge,
} from "@/components/ui/PageLayout";
import {
  useAppTableSort,
  useAppTablePagination,
  useAppTableSearch,
  type FilterOption,
} from "@/components/ui/AppTable";
import { BuildingOffice2Icon, PlusIcon } from "@heroicons/react/24/outline";
import {
  ProjectsFilterBar,
  ProjectsTable,
} from "@/modules/projects/components";
import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_OPTIONS,
  ACTIVE_STATUSES,
} from "@/modules/projects/constants";
import { formatCurrency } from "@/modules/projects/utils";

const PROJECT_STATUS_TABS: FilterOption[] = PROJECT_STATUS_OPTIONS.map(
  (option) => ({
    ...option,
    count: 0,
  })
);

export default function ProjectsPage() {
  const router = useRouter();
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<ProjectStatus[]>([
    "new",
    "in_progress",
    "on_hold",
  ]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(
    []
  );
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<ProjectSummary>();
  const { searchValue, setSearchValue } = useAppTableSearch<ProjectSummary>([]);

  // Custom filter function for searching
  const filterData = useCallback(
    (data: ProjectSummary[], searchTerm: string) => {
      if (!searchTerm) return data;
      const term = searchTerm.toLowerCase();
      return data.filter((project) => {
        const searchableText = [
          project.project_number,
          project.name,
          project.client_name,
          project.property_name,
          project.service_type,
          project.status,
          project.expected_start_date,
          project.expected_end_date,
          project.created_at,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(term);
      });
    },
    []
  );

  // Custom filter function for status
  const filterByStatus = useCallback(
    (data: ProjectSummary[]) => {
      if (selectedStatuses.length === 0) return data;
      return data.filter((project) =>
        selectedStatuses.includes(project.status as ProjectStatus)
      );
    },
    [selectedStatuses]
  );

  // Custom filter function for priority
  const filterByPriority = useCallback(
    (data: ProjectSummary[]) => {
      if (selectedPriorities.length === 0) return data;
      return data.filter((project) =>
        selectedPriorities.includes(project.priority || "Medium")
      );
    },
    [selectedPriorities]
  );

  // Custom filter function for property type
  const filterByPropertyType = useCallback(
    (data: ProjectSummary[]) => {
      if (selectedPropertyTypes.length === 0) return data;
      return data.filter((project) =>
        selectedPropertyTypes.some((type) =>
          project.property_type?.toLowerCase().includes(type.toLowerCase())
        )
      );
    },
    [selectedPropertyTypes]
  );

  // Custom filter function for phase
  const filterByPhase = useCallback(
    (data: ProjectSummary[]) => {
      if (selectedPhases.length === 0) return data;
      return data.filter((project) =>
        selectedPhases.includes(project.current_phase || "")
      );
    },
    [selectedPhases]
  );

  // Fetch ALL projects
  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/projects?limit=1000");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch projects");
      }

      setAllProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setAllProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Process projects: filter by search, status, and sort

  const processedProjects = useMemo(() => {
    let result = [...allProjects];

    // Apply status filter
    result = filterByStatus(result);

    // Apply priority filter
    result = filterByPriority(result);

    // Apply property type filter
    result = filterByPropertyType(result);

    // Apply phase filter
    result = filterByPhase(result);

    // Apply search
    result = filterData(result, searchValue);

    // Apply sort
    if (sortState.column) {
      result = sortData(result, (item, col) => {
        switch (col) {
          case "project_number":
            return item.project_number || "";
          case "name":
            return item.name?.toLowerCase() || "";
          case "client_name":
            return item.client_name?.toLowerCase() || "";
          case "property_name":
            return item.property_name?.toLowerCase() || "";
          case "priority":
            return item.priority || "Medium";
          case "current_phase":
            return item.current_phase?.toLowerCase() || "";
          case "status":
            return item.status;
          case "overall_progress":
            return item.overall_progress || 0;
          case "quoted_amount":
            return item.quoted_amount || 0;
          case "timeline":
            return item.expected_end_date
              ? new Date(item.expected_end_date).getTime()
              : 0;
          case "created_at":
            return item.created_at ? new Date(item.created_at).getTime() : 0;
          default:
            return "";
        }
      });
    }

    return result;
  }, [
    allProjects,
    searchValue,
    selectedStatuses,
    selectedPriorities,
    selectedPropertyTypes,
    selectedPhases,
    filterData,
    filterByStatus,
    filterByPriority,
    filterByPropertyType,
    filterByPhase,
    sortData,
    sortState.column,
  ]);

  // Pagination
  const { paginatedData, pagination, setPage, setPageSize } =
    useAppTablePagination(processedProjects, 25);

  // Calculate tab counts
  const tabsWithCounts: FilterOption[] = useMemo(() => {
    return PROJECT_STATUS_TABS.map((tab) => ({
      ...tab,
      count:
        tab.value === "active"
          ? allProjects.filter((p) =>
              ACTIVE_STATUSES.includes(p.status as ProjectStatus)
            ).length
          : allProjects.filter((p) => p.status === tab.value).length,
    }));
  }, [allProjects]);

  // Calculate Stats
  const stats = useMemo(() => {
    const total = allProjects.length;
    const active = allProjects.filter((p) =>
      ACTIVE_STATUSES.includes(p.status as ProjectStatus)
    ).length;
    const completed = allProjects.filter(
      (p) => p.status === "completed"
    ).length;
    const totalValue = allProjects.reduce(
      (sum, p) => sum + (p.quoted_amount || 0),
      0
    );

    return { total, active, completed, totalValue };
  }, [allProjects]);

  return (
    <PageLayout isLoading={isLoading} loadingText="Loading projects...">
      <PageHeader
        title="Projects Management"
        subtitle="Track and manage your projects"
        breadcrumbs={[{ label: "Projects" }]}
        basePath={{ label: "Projects", href: "/dashboard/projects" }}
        icon={<BuildingOffice2Icon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <Link
            href="/dashboard/projects/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-medium flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            New Project
          </Link>
        }
        stats={
          <>
            <StatBadge
              label="Total Projects"
              value={stats.total}
              color="slate"
            />
            <StatBadge label="Active" value={stats.active} color="blue" />
            <StatBadge
              label="Completed"
              value={stats.completed}
              color="green"
            />
            <StatBadge
              label="Total Value"
              value={formatCurrency(stats.totalValue)}
              color="green"
            />
          </>
        }
      />

      <PageContent noPadding>
        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center px-4">
            <svg
              className="w-12 h-12 mb-3 text-red-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm font-medium text-red-600 mb-1">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchProjects();
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Filter Bar Component */}
            <ProjectsFilterBar
              searchValue={searchValue}
              onSearchChange={(value) => {
                setSearchValue(value);
                setPage(1);
              }}
              selectedStatuses={selectedStatuses}
              onStatusChange={setSelectedStatuses}
              selectedPriorities={selectedPriorities}
              onPriorityChange={(priorities) => {
                setSelectedPriorities(priorities);
                setPage(1);
              }}
              selectedPropertyTypes={selectedPropertyTypes}
              onPropertyTypeChange={(types) => {
                setSelectedPropertyTypes(types);
                setPage(1);
              }}
              selectedPhases={selectedPhases}
              onPhaseChange={(phases) => {
                setSelectedPhases(phases);
                setPage(1);
              }}
              availablePhases={Array.from(
                new Set(
                  allProjects
                    .filter((p) => p.current_phase)
                    .map((p) => p.current_phase || "")
                )
              )}
              availablePropertyTypes={Array.from(
                new Set(
                  allProjects
                    .filter((p) => p.property_type)
                    .map((p) => p.property_type || "")
                )
              )}
            />

            {/* Projects Table Component */}
            <ProjectsTable
              data={paginatedData}
              sortState={sortState}
              onSort={handleSort}
              pagination={pagination}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onRowClick={(project) =>
                router.push(`/dashboard/projects/${project.id}`)
              }
              emptyState={{
                icon: (
                  <BuildingOffice2Icon className="w-6 h-6 text-slate-400" />
                ),
                title: "No projects found",
                description: searchValue
                  ? "Try adjusting your search"
                  : "Create your first project to get started",
                action: !searchValue ? (
                  <Link
                    href="/dashboard/projects/new"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors inline-block"
                  >
                    + Create Your First Project
                  </Link>
                ) : undefined,
              }}
              stickyHeader={true}
            />
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}
