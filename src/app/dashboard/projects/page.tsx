"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ProjectSummary,
  ProjectStatus,
  ProjectCategory,
  ProjectStatusLabels,
  ProjectCategoryLabels,
  PROJECT_STATUS_OPTIONS,
  PROJECT_CATEGORY_OPTIONS,
} from "@/types/projects";

// Shared UI Components
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatBadge,
} from "@/components/ui/PageLayout";
import {
  AppTable,
  useAppTableSort,
  useAppTableSearch,
  type ColumnDef,
} from "@/components/ui/AppTable";

// Icons
import {
  PlusIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CurrencyRupeeIcon,
  BriefcaseIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";

// Status color mapping
const statusColors: Record<
  ProjectStatus,
  { bg: string; text: string; dot: string }
> = {
  planning: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  design: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  procurement: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  execution: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  finishing: { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-500" },
  handover: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  completed: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  on_hold: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  cancelled: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

// Format currency
const formatCurrency = (amount: number | undefined) => {
  if (!amount) return "—";
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)}Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<ProjectSummary>();
  const { searchValue, setSearchValue } = useAppTableSearch<ProjectSummary>([]);

  // Fetch projects
  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects?limit=500`);
      if (!response.ok) throw new Error("Failed to fetch projects");

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Filter Data
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Status filter
    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter((p) => p.project_category === categoryFilter);
    }

    // Search Filter (Handled by AppTable usually, but we need custom logic for joined fields if AppTable's basic search isn't enough.
    // However, AppTable's simple search might not look into nested objects deep enough or we might want specific fields.
    // Let's rely on filterData callback if we needed advanced search.
    // For now, let's implement the search explicitly to match previous logic or pass to AppTable if it supports custom search fn.
    // The hook `useAppTableSearch` returns `searchValue`. We need to filter based on it.)
    if (searchValue) {
      const query = searchValue.toLowerCase();
      result = result.filter(
        (p) =>
          p.project_number?.toLowerCase().includes(query) ||
          p.name?.toLowerCase().includes(query) ||
          p.client_name?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [projects, statusFilter, categoryFilter, searchValue]);

  // Sort Data
  const getSortValue = useCallback((item: ProjectSummary, column: string) => {
    switch (column) {
      case "project_number":
        return item.project_number || "";
      case "name":
        return item.name?.toLowerCase() || "";
      case "client_name":
        return item.client_name?.toLowerCase() || "";
      case "status":
        return item.status;
      case "quoted_amount":
        return item.quoted_amount || 0;
      case "overall_progress":
        return item.overall_progress || 0;
      case "expected_end_date":
        return item.expected_end_date
          ? new Date(item.expected_end_date).getTime()
          : 0;
      case "created_at":
        return item.created_at ? new Date(item.created_at).getTime() : 0;
      default:
        return "";
    }
  }, []);

  const processedProjects = useMemo(() => {
    return sortData(filteredProjects, getSortValue);
  }, [filteredProjects, sortData, getSortValue]);

  // Calculate Stats
  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(
      (p) => !["completed", "cancelled", "on_hold"].includes(p.status)
    ).length;
    const completed = projects.filter((p) => p.status === "completed").length;
    const totalQuoted = projects.reduce(
      (sum, p) => sum + (p.quoted_amount || 0),
      0
    );

    return { total, active, completed, totalQuoted };
  }, [projects]);

  // Define Columns
  const columns: ColumnDef<ProjectSummary>[] = [
    {
      key: "project_number",
      header: "Project",
      width: "20%",
      sortable: true,
      render: (project) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-600 block">
              {project.project_number}
            </span>
            {/* Show badge if linked to lead */}
            {/* The project summary type doesn't explicit expose lead_id here commonly, 
                but we can check if client_name is populated or similar. 
                Ideally, we'd check `lead_id` if available in summary. 
                Assuming summary might not have it, we skip for now or rely on API. */}
          </div>
          <p
            className="text-sm text-slate-900 font-medium truncate"
            title={project.name}
          >
            {project.name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                project.project_category === "turnkey"
                  ? "bg-indigo-50 text-indigo-700"
                  : project.project_category === "modular"
                  ? "bg-teal-50 text-teal-700"
                  : "bg-violet-50 text-violet-700"
              }`}
            >
              {ProjectCategoryLabels[project.project_category]}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "client_name",
      header: "Client",
      width: "15%",
      sortable: true,
      render: (project) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-slate-600">
              {project.client_name?.charAt(0).toUpperCase() || "?"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {project.client_name || "Unknown"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      sortable: true,
      render: (project) => {
        const colors = statusColors[project.status];
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
            {ProjectStatusLabels[project.status]}
          </span>
        );
      },
    },
    {
      key: "overall_progress",
      header: "Progress",
      width: "15%",
      sortable: true,
      render: (project) => (
        <div className="w-full max-w-[140px]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700">
              {project.overall_progress}%
            </span>
            <span className="text-slate-500">
              {/* Optional: Show phase summary e.g. 2/5 */}
              {project.phase_summary
                ? `${project.phase_summary.completed}/${project.phase_summary.total} phases`
                : ""}
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
      key: "dates",
      header: "Timeline",
      width: "13%",
      render: (project) => (
        <div className="text-xs text-slate-500 space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Start:</span>
            <span>{formatDate(project.start_date)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">End:</span>
            <span
              className={
                project.expected_end_date &&
                new Date(project.expected_end_date) < new Date() &&
                project.status !== "completed"
                  ? "text-red-600 font-medium"
                  : ""
              }
            >
              {formatDate(project.expected_end_date)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "quoted_amount",
      header: "Value",
      width: "10%",
      sortable: true,
      render: (project) => (
        <p className="text-sm font-semibold text-slate-900">
          {formatCurrency(project.quoted_amount)}
        </p>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "8%",
      render: (project) => (
        <div className="flex items-center justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/projects/${project.id}`);
            }}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageLayout>
      <PageHeader
        title="Projects Overview"
        breadcrumbs={[{ label: "Projects" }]}
        actions={
          <Link
            href="/dashboard/projects/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors shadow-sm"
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
              value={formatCurrency(stats.totalQuoted)}
              color="green"
            />
          </>
        }
      />

      <PageContent>
        {/* Toolbar */}
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 w-full max-w-sm">
            {/* AppTableSearch hook manages the UI for this usually, but we can also just bind it manually */}
            <input
              type="text"
              placeholder="Search by project, client..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer whitespace-nowrap"
            >
              <option value="">All Status</option>
              {PROJECT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer whitespace-nowrap"
            >
              <option value="">All Categories</option>
              {PROJECT_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <AppTable
          data={processedProjects}
          columns={columns}
          keyExtractor={(p) => p.id}
          isLoading={isLoading}
          sortable={true}
          sortState={sortState}
          onSort={handleSort}
          onRowClick={(project) =>
            router.push(`/dashboard/projects/${project.id}`)
          }
          emptyState={{
            title: "No projects found",
            description:
              searchValue || statusFilter
                ? "No projects match your current filters"
                : "Get started by creating your first project",
            icon: <BuildingOffice2Icon className="w-10 h-10 text-slate-300" />,
            action:
              !searchValue && !statusFilter ? (
                <Link
                  href="/dashboard/projects/new"
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium inline-flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create Project
                </Link>
              ) : undefined,
          }}
        />
      </PageContent>
    </PageLayout>
  );
}
