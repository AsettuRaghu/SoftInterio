"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ProjectSummary,
  ProjectStatus,
  ProjectCategory,
  ProjectStatusLabels,
  ProjectCategoryLabels,
  ProjectTypeLabels,
  PROJECT_STATUS_OPTIONS,
  PROJECT_CATEGORY_OPTIONS,
} from "@/types/projects";

// Icons
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  EyeIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  UserCircleIcon,
  CurrencyRupeeIcon,
  ClockIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ListBulletIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon as CheckCircleSolid,
  ClockIcon as ClockSolid,
} from "@heroicons/react/24/solid";

// Status color mapping
const statusColors: Record<
  ProjectStatus,
  { bg: string; text: string; dot: string; badge: string }
> = {
  planning: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700",
  },
  design: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
    badge: "bg-purple-100 text-purple-700",
  },
  procurement: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700",
  },
  execution: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700",
  },
  finishing: {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
    badge: "bg-cyan-100 text-cyan-700",
  },
  handover: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
  },
  completed: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-700",
  },
  on_hold: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
    badge: "bg-yellow-100 text-yellow-700",
  },
  cancelled: {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700",
  },
};

const categoryColors: Record<
  ProjectCategory,
  { bg: string; text: string; dot: string }
> = {
  turnkey: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
  },
  modular: { bg: "bg-teal-100", text: "text-teal-700", dot: "bg-teal-500" },
  hybrid: {
    bg: "bg-violet-100",
    text: "text-violet-700",
    dot: "bg-violet-500",
  },
  renovation: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  consultation: {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
  },
  commercial_fitout: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  other: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    dot: "bg-gray-500",
  },
};

// Status workflow for visual stepper
const STATUS_WORKFLOW = [
  "planning",
  "design",
  "procurement",
  "execution",
  "finishing",
  "handover",
  "completed",
];

// Status Stepper Component
function ProjectStatusStepper({ status }: { status: ProjectStatus }) {
  if (status === "cancelled" || status === "on_hold") {
    const colors = statusColors[status];
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${colors.badge}`}
      >
        {ProjectStatusLabels[status]}
      </span>
    );
  }

  const currentIndex = STATUS_WORKFLOW.indexOf(status);

  return (
    <div className="flex items-center gap-0.5">
      {STATUS_WORKFLOW.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <React.Fragment key={step}>
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                isCompleted
                  ? "bg-green-500"
                  : isCurrent
                  ? "bg-blue-500"
                  : "bg-slate-200"
              }`}
              title={ProjectStatusLabels[step as ProjectStatus]}
            />
            {index < STATUS_WORKFLOW.length - 1 && (
              <div
                className={`w-3 h-0.5 ${
                  isCompleted ? "bg-green-500" : "bg-slate-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Sort icon component
function SortIcon({
  field,
  sortBy,
  sortOrder,
}: {
  field: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}) {
  if (sortBy !== field) {
    return <ChevronUpDownIcon className="w-4 h-4 text-slate-400" />;
  }
  return (
    <ChevronUpDownIcon
      className={`w-4 h-4 text-blue-600 ${
        sortOrder === "desc" ? "rotate-180" : ""
      }`}
    />
  );
}

// Format currency
const formatCurrency = (amount: number | undefined) => {
  if (!amount) return "₹0";
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
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Calculate days remaining/overdue
const getDaysStatus = (endDate: string | undefined) => {
  if (!endDate) return null;
  const end = new Date(endDate);
  const today = new Date();
  const diffDays = Math.ceil(
    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays;
};

type SortField =
  | "project_number"
  | "name"
  | "client_name"
  | "status"
  | "quoted_amount"
  | "overall_progress"
  | "expected_end_date"
  | "created_at";
type ViewMode = "table" | "cards";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
    totalQuoted: 0,
    avgProgress: 0,
  });

  // Fetch projects
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects?limit=500`);
      if (!response.ok) throw new Error("Failed to fetch projects");

      const data = await response.json();
      setProjects(data.projects || []);

      // Calculate stats
      const allProjects = data.projects || [];
      const activeProjects = allProjects.filter(
        (p: ProjectSummary) =>
          !["completed", "cancelled", "on_hold"].includes(p.status)
      );
      const completedProjects = allProjects.filter(
        (p: ProjectSummary) => p.status === "completed"
      );
      const onHoldProjects = allProjects.filter(
        (p: ProjectSummary) => p.status === "on_hold"
      );
      const inProgressProjects = allProjects.filter(
        (p: ProjectSummary) =>
          !["planning", "completed", "cancelled", "on_hold"].includes(p.status)
      );

      const totalQuoted = allProjects.reduce(
        (sum: number, p: ProjectSummary) => sum + (p.quoted_amount || 0),
        0
      );
      const avgProgress =
        activeProjects.length > 0
          ? activeProjects.reduce(
              (sum: number, p: ProjectSummary) =>
                sum + (p.overall_progress || 0),
              0
            ) / activeProjects.length
          : 0;

      setStats({
        total: allProjects.length,
        active: activeProjects.length,
        inProgress: inProgressProjects.length,
        completed: completedProjects.length,
        onHold: onHoldProjects.length,
        totalQuoted,
        avgProgress: Math.round(avgProgress),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort projects locally
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.project_number?.toLowerCase().includes(query) ||
          p.name?.toLowerCase().includes(query) ||
          p.client_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter((p) => p.project_category === categoryFilter);
    }

    // Hide completed
    if (hideCompleted) {
      result = result.filter((p) => p.status !== "completed");
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case "project_number":
          aVal = a.project_number || "";
          bVal = b.project_number || "";
          break;
        case "name":
          aVal = a.name?.toLowerCase() || "";
          bVal = b.name?.toLowerCase() || "";
          break;
        case "client_name":
          aVal = a.client_name?.toLowerCase() || "";
          bVal = b.client_name?.toLowerCase() || "";
          break;
        case "status":
          aVal = STATUS_WORKFLOW.indexOf(a.status);
          bVal = STATUS_WORKFLOW.indexOf(b.status);
          break;
        case "quoted_amount":
          aVal = a.quoted_amount || 0;
          bVal = b.quoted_amount || 0;
          break;
        case "overall_progress":
          aVal = a.overall_progress || 0;
          bVal = b.overall_progress || 0;
          break;
        case "expected_end_date":
          aVal = a.expected_end_date
            ? new Date(a.expected_end_date).getTime()
            : 0;
          bVal = b.expected_end_date
            ? new Date(b.expected_end_date).getTime()
            : 0;
          break;
        default:
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [
    projects,
    searchQuery,
    statusFilter,
    categoryFilter,
    hideCompleted,
    sortBy,
    sortOrder,
  ]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setCategoryFilter("");
    setHideCompleted(false);
  };

  const hasActiveFilters =
    searchQuery || statusFilter || categoryFilter || hideCompleted;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <div className="animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-48 mb-2"></div>
            <div className="h-3 bg-slate-200 rounded w-32"></div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-slate-200 p-4"
            >
              <div className="animate-pulse">
                <div className="h-3 bg-slate-200 rounded w-16 mb-2"></div>
                <div className="h-6 bg-slate-200 rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-red-800 mb-1">
          Error Loading Projects
        </h2>
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchProjects}
          className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Breadcrumb */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/dashboard" className="hover:text-slate-700">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-700">Projects</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">
                Projects Overview
              </h1>
              {/* Inline Quick Stats */}
              <div className="hidden md:flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                  {stats.total} Total
                </span>
                {stats.active > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
                    {stats.active} Active
                  </span>
                )}
                {stats.onHold > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-50 text-yellow-700">
                    {stats.onHold} On Hold
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/projects/new"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <PlusIcon className="w-4 h-4" />
              New Project
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Projects */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Total Projects</span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <BuildingOffice2Icon className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500">All time</p>
        </div>

        {/* Active Projects */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Active</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <ClockIcon className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
          <p className="text-xs text-slate-500">In progress</p>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Completed</span>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircleIcon className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-slate-500">Delivered</p>
        </div>

        {/* On Hold */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">On Hold</span>
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <PauseCircleIcon className="w-4 h-4 text-yellow-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.onHold}</p>
          <p className="text-xs text-slate-500">Paused</p>
        </div>

        {/* Total Value */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Total Value</span>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <CurrencyRupeeIcon className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(stats.totalQuoted)}
          </p>
          <p className="text-xs text-slate-500">Quoted amount</p>
        </div>

        {/* Average Progress */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs">Avg Progress</span>
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {stats.avgProgress}%
          </p>
          <p className="text-xs text-slate-500">Active projects</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {PROJECT_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-2 text-sm border rounded-md ${
                showFilters
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              More
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                <XMarkIcon className="w-4 h-4" />
                Clear
              </button>
            )}

            {/* View Toggle */}
            <div className="border-l border-slate-200 pl-2 ml-2 flex items-center gap-1">
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded ${
                  viewMode === "table"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="Table View"
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`p-2 rounded ${
                  viewMode === "cards"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="Card View"
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Hide Completed
            </label>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Showing {filteredProjects.length} of {projects.length} projects
        </span>
      </div>

      {/* Projects Table */}
      {viewMode === "table" ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th
                    className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("project_number")}
                  >
                    <div className="flex items-center gap-1">
                      Project
                      <SortIcon
                        field="project_number"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("client_name")}
                  >
                    <div className="flex items-center gap-1">
                      Client
                      <SortIcon
                        field="client_name"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Category
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      <SortIcon
                        field="status"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("overall_progress")}
                  >
                    <div className="flex items-center gap-1">
                      Progress
                      <SortIcon
                        field="overall_progress"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("quoted_amount")}
                  >
                    <div className="flex items-center gap-1">
                      Value
                      <SortIcon
                        field="quoted_amount"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("expected_end_date")}
                  >
                    <div className="flex items-center gap-1">
                      Deadline
                      <SortIcon
                        field="expected_end_date"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Manager
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600 w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <BuildingOffice2Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600 font-medium">
                        No projects found
                      </p>
                      <p className="text-slate-500 text-sm mt-1">
                        {hasActiveFilters
                          ? "Try adjusting your filters"
                          : "Create your first project to get started"}
                      </p>
                      {!hasActiveFilters && (
                        <Link
                          href="/dashboard/projects/new"
                          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          <PlusIcon className="w-4 h-4" />
                          Create Project
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => {
                    const daysRemaining = getDaysStatus(
                      project.expected_end_date
                    );
                    const isOverdue =
                      daysRemaining !== null && daysRemaining < 0;
                    const isUrgent =
                      daysRemaining !== null &&
                      daysRemaining <= 7 &&
                      daysRemaining >= 0;

                    return (
                      <tr
                        key={project.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() =>
                          router.push(`/dashboard/projects/${project.id}`)
                        }
                      >
                        {/* Project */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-900">
                              {project.name}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">
                              {project.project_number}
                            </p>
                          </div>
                        </td>

                        {/* Client */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-slate-900">
                              {project.client_name || "-"}
                            </p>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              categoryColors[project.project_category]?.bg
                            } ${
                              categoryColors[project.project_category]?.text
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                categoryColors[project.project_category]?.dot
                              }`}
                            />
                            {ProjectCategoryLabels[project.project_category]}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <ProjectStatusStepper status={project.status} />
                        </td>

                        {/* Progress */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  project.overall_progress === 100
                                    ? "bg-green-500"
                                    : project.overall_progress >= 50
                                    ? "bg-blue-500"
                                    : "bg-orange-500"
                                }`}
                                style={{
                                  width: `${project.overall_progress || 0}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-700 w-10">
                              {project.overall_progress || 0}%
                            </span>
                          </div>
                        </td>

                        {/* Value */}
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">
                            {formatCurrency(project.quoted_amount)}
                          </span>
                        </td>

                        {/* Deadline */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-slate-900">
                              {formatDate(project.expected_end_date)}
                            </p>
                            {daysRemaining !== null &&
                              project.status !== "completed" && (
                                <p
                                  className={`text-xs ${
                                    isOverdue
                                      ? "text-red-600"
                                      : isUrgent
                                      ? "text-yellow-600"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {isOverdue
                                    ? `${Math.abs(daysRemaining)} days overdue`
                                    : `${daysRemaining} days left`}
                                </p>
                              )}
                          </div>
                        </td>

                        {/* Manager */}
                        <td className="px-4 py-3">
                          {project.project_manager ? (
                            <div className="flex items-center gap-2">
                              {project.project_manager.avatar_url ? (
                                <img
                                  src={project.project_manager.avatar_url}
                                  alt=""
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                                  <span className="text-xs font-medium text-slate-600">
                                    {project.project_manager.name?.charAt(0) ||
                                      "?"}
                                  </span>
                                </div>
                              )}
                              <span className="text-slate-700 text-sm">
                                {project.project_manager.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Link
                              href={`/dashboard/projects/${project.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                              title="View Project"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </Link>
                            <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg border border-slate-200 p-12 text-center">
              <BuildingOffice2Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No projects found</p>
              <p className="text-slate-500 text-sm mt-1">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Create your first project to get started"}
              </p>
            </div>
          ) : (
            filteredProjects.map((project) => {
              const daysRemaining = getDaysStatus(project.expected_end_date);
              const isOverdue = daysRemaining !== null && daysRemaining < 0;
              const isUrgent =
                daysRemaining !== null &&
                daysRemaining <= 7 &&
                daysRemaining >= 0;

              return (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="block bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {project.name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {project.project_number}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        categoryColors[project.project_category]?.bg
                      } ${categoryColors[project.project_category]?.text}`}
                    >
                      {ProjectCategoryLabels[project.project_category]}
                    </span>
                  </div>

                  {/* Client */}
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                    <UserCircleIcon className="w-4 h-4" />
                    <span>{project.client_name || "No client"}</span>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">Progress</span>
                      <span className="font-medium text-slate-700">
                        {project.overall_progress || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          project.overall_progress === 100
                            ? "bg-green-500"
                            : project.overall_progress >= 50
                            ? "bg-blue-500"
                            : "bg-orange-500"
                        }`}
                        style={{ width: `${project.overall_progress || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="mb-3">
                    <ProjectStatusStepper status={project.status} />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-sm font-medium text-emerald-600">
                      {formatCurrency(project.quoted_amount)}
                    </span>
                    {project.expected_end_date && (
                      <span
                        className={`text-xs ${
                          isOverdue
                            ? "text-red-600"
                            : isUrgent
                            ? "text-yellow-600"
                            : "text-slate-500"
                        }`}
                      >
                        {formatDate(project.expected_end_date)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
