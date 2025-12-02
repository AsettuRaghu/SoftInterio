"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Lead,
  LeadStage,
  PropertyType,
  ServiceType,
  LeadSource,
} from "@/types/leads";

// Import the label/color maps
import {
  LeadStageLabels as StageLabels,
  LeadStageColors as StageColors,
  PropertyTypeLabels as PropLabels,
  ServiceTypeLabels as SvcLabels,
  LeadSourceLabels as SrcLabels,
} from "@/types/leads";
import { SortIcon as SortIconBase } from "@/components/ui/DataTable";

// SortIcon component for table headers
function SortIcon({
  field,
  sortBy,
  sortOrder,
}: {
  field: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}) {
  return (
    <SortIconBase
      direction={sortBy === field ? sortOrder : null}
      active={sortBy === field}
    />
  );
}

// Stage filter tabs
const ACTIVE_STAGES: LeadStage[] = [
  "new",
  "qualified",
  "requirement_discussion",
  "proposal_discussion",
];

const STAGE_FILTERS: { value: LeadStage | "active"; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "disqualified", label: "Disqualified" },
];

export default function LeadsPage() {
  const router = useRouter();
  const [allLeads, setAllLeads] = useState<Lead[]>([]); // All leads from API
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters - all handled locally
  const [stageFilter, setStageFilter] = useState<LeadStage | "active">(
    "active"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch ALL leads once (no server-side filtering/sorting)
  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: "1",
        limit: "1000", // Get all leads for local processing
      });

      console.log("[LeadsPage] Fetching all leads...");
      const response = await fetch(`/api/sales/leads?${params}`);
      const data = await response.json();

      if (!response.ok) {
        console.error("[LeadsPage] API error:", data);
        throw new Error(data.error || "Failed to fetch leads");
      }

      console.log("[LeadsPage] Received", data.leads?.length || 0, "leads");
      setAllLeads(data.leads || []);

      // Show warning if module not initialized
      if (data.warning) {
        console.warn("[LeadsPage] Warning:", data.warning);
      }
    } catch (err) {
      console.error("[LeadsPage] Error fetching leads:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setAllLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Process leads locally: filter, search, sort
  const processedLeads = React.useMemo(() => {
    let result = [...allLeads];

    // Filter by stage
    if (stageFilter === "active") {
      result = result.filter((lead) => ACTIVE_STAGES.includes(lead.stage));
    } else {
      result = result.filter((lead) => lead.stage === stageFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((lead) => {
        return (
          lead.client_name?.toLowerCase().includes(query) ||
          lead.email?.toLowerCase().includes(query) ||
          lead.phone?.toLowerCase().includes(query) ||
          lead.property_name?.toLowerCase().includes(query) ||
          lead.property_type?.toLowerCase().includes(query) ||
          lead.flat_number?.toLowerCase().includes(query) ||
          lead.lead_number?.toLowerCase().includes(query) ||
          PropLabels[lead.property_type]?.toLowerCase().includes(query) ||
          (lead.service_type &&
            SvcLabels[lead.service_type]?.toLowerCase().includes(query)) ||
          StageLabels[lead.stage]?.toLowerCase().includes(query)
        );
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case "client_name":
          aVal = a.client_name?.toLowerCase() || "";
          bVal = b.client_name?.toLowerCase() || "";
          break;
        case "property_name":
          aVal = a.property_name?.toLowerCase() || "";
          bVal = b.property_name?.toLowerCase() || "";
          break;
        case "property_type":
          aVal = PropLabels[a.property_type]?.toLowerCase() || "";
          bVal = PropLabels[b.property_type]?.toLowerCase() || "";
          break;
        case "priority":
          const priorityOrder = ["low", "medium", "high", "urgent"];
          aVal = priorityOrder.indexOf(a.priority);
          bVal = priorityOrder.indexOf(b.priority);
          break;
        case "stage":
          const stageOrder = [
            "new",
            "qualified",
            "requirement_discussion",
            "proposal_discussion",
            "won",
            "lost",
            "disqualified",
          ];
          aVal = stageOrder.indexOf(a.stage);
          bVal = stageOrder.indexOf(b.stage);
          break;
        case "assigned_to":
          aVal = a.assigned_user?.name?.toLowerCase() || "zzz";
          bVal = b.assigned_user?.name?.toLowerCase() || "zzz";
          break;
        case "last_activity_at":
          aVal = a.last_activity_at
            ? new Date(a.last_activity_at).getTime()
            : 0;
          bVal = b.last_activity_at
            ? new Date(b.last_activity_at).getTime()
            : 0;
          break;
        case "created_at":
        default:
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
      }

      if (typeof aVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [allLeads, stageFilter, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Format currency
  const formatCurrency = (amount: number | null) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get stage badge
  const getStageBadge = (stage: LeadStage) => {
    const colors = StageColors[stage];
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
        {StageLabels[stage]}
      </span>
    );
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {/* Compact Header with Stats */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <Link href="/dashboard/sales" className="hover:text-blue-600">
                Sales
              </Link>
              <span>/</span>
              <span className="text-slate-700">Leads</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900">
              Leads Management
            </h1>
          </div>

          {/* Stats in header - compact pills from local data */}
          {allLeads.length > 0 && (
            <div className="hidden md:flex items-center gap-2 pl-6 border-l border-slate-200">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                <span className="font-medium">{allLeads.length}</span> Total
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                <span className="font-medium">
                  {
                    allLeads.filter(
                      (l) => !["won", "lost", "disqualified"].includes(l.stage)
                    ).length
                  }
                </span>{" "}
                Pipeline
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">
                <span className="font-medium">
                  {allLeads.filter((l) => l.stage === "won").length}
                </span>{" "}
                Won
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                <span className="font-medium">
                  {allLeads.filter((l) => l.stage === "new").length}
                </span>{" "}
                New
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-medium flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Lead
        </button>
      </div>

      {/* Filters Row - Stage tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Stage Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STAGE_FILTERS.map((filter) => {
            // Calculate count from local data
            const count =
              filter.value === "active"
                ? allLeads.filter((l) => ACTIVE_STAGES.includes(l.stage)).length
                : allLeads.filter((l) => l.stage === filter.value).length;

            return (
              <button
                key={filter.value}
                onClick={() => setStageFilter(filter.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  stageFilter === filter.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {filter.label}
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    stageFilter === filter.value
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, property..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
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
            <p className="text-xs text-slate-500 mb-3">
              {error.includes("migration")
                ? "The leads database tables need to be created. Please run migration 007_leads_module.sql in Supabase."
                : "Please try again or contact support if the issue persists."}
            </p>
            <button
              onClick={() => {
                setError(null);
                fetchLeads();
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : processedLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <svg
              className="w-16 h-16 mb-4 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-base font-medium mb-1">No leads found</p>
            <p className="text-sm text-slate-400">
              {searchQuery
                ? "Try adjusting your search"
                : stageFilter !== "active"
                ? "No leads in this status"
                : "Create your first lead to get started"}
            </p>
            {stageFilter === "active" && !searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                + Add Your First Lead
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      if (sortBy === "client_name") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("client_name");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Client
                      <SortIcon
                        field="client_name"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      if (sortBy === "property_name") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("property_name");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Property
                      <SortIcon
                        field="property_name"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      if (sortBy === "property_type") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("property_type");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Lead Attributes
                      <SortIcon
                        field="property_type"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      if (sortBy === "priority") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("priority");
                        setSortOrder("desc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Priority
                      <SortIcon
                        field="priority"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      if (sortBy === "stage") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("stage");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Stage
                      <SortIcon
                        field="stage"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      if (sortBy === "assigned_to") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("assigned_to");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Assigned
                      <SortIcon
                        field="assigned_to"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      if (sortBy === "last_activity_at") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("last_activity_at");
                        setSortOrder("desc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Activity
                      <SortIcon
                        field="last_activity_at"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    onClick={() =>
                      router.push(`/dashboard/sales/leads/${lead.id}`)
                    }
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                            {lead.client_name}
                          </p>
                          {lead.priority === "high" && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700 rounded">
                              High
                            </span>
                          )}
                          {lead.priority === "urgent" && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded">
                              Urgent
                            </span>
                          )}
                        </div>
                        {lead.email && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {lead.email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {lead.property_name && (
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {lead.property_name}
                          </p>
                        )}
                        {lead.flat_number && (
                          <p className="text-xs text-slate-500">
                            Flat: {lead.flat_number}
                          </p>
                        )}
                        {lead.carpet_area_sqft && (
                          <p className="text-xs text-slate-400">
                            {lead.carpet_area_sqft} sq.ft
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs text-slate-600">
                          {PropLabels[lead.property_type]}
                        </p>
                        {lead.service_type && (
                          <p className="text-xs text-slate-500">
                            {SvcLabels[lead.service_type]}
                          </p>
                        )}
                        {lead.lead_source && (
                          <p className="text-xs text-slate-400">
                            {SrcLabels[lead.lead_source]}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                          lead.priority === "urgent"
                            ? "bg-red-100 text-red-700"
                            : lead.priority === "high"
                            ? "bg-orange-100 text-orange-700"
                            : lead.priority === "medium"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {lead.priority.charAt(0).toUpperCase() +
                          lead.priority.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getStageBadge(lead.stage)}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const displayUser =
                          lead.assigned_user || lead.created_user;
                        if (displayUser) {
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xs font-medium shadow-sm">
                                {getInitials(displayUser.name)}
                              </div>
                              <span className="text-sm text-slate-700 truncate">
                                {displayUser.name}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <span className="text-sm text-slate-400 italic">
                            Unassigned
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-600">
                        {formatDate(lead.last_activity_at)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(
                            `/dashboard/sales/leads/${lead.id}?openStageModal=true`
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Change Stage"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                          />
                        </svg>
                        Stage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Results count */}
        {!isLoading && processedLeads.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-600">
              Showing{" "}
              <span className="font-medium">{processedLeads.length}</span> of{" "}
              <span className="font-medium">{allLeads.length}</span> leads
              {stageFilter !== "active" && (
                <span className="text-slate-400">
                  {" "}
                  • Filtered by {StageLabels[stageFilter]}
                </span>
              )}
              {stageFilter === "active" && (
                <span className="text-slate-400"> • Active leads only</span>
              )}
              {searchQuery && (
                <span className="text-slate-400">
                  {" "}
                  • Searching "{searchQuery}"
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Create Lead Modal */}
      {showCreateModal && (
        <CreateLeadModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchLeads();
          }}
        />
      )}
    </div>
  );
}

// Create Lead Modal Component
function CreateLeadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    client_name: "",
    phone: "",
    email: "",
    property_type: "" as PropertyType | "",
    service_type: "" as ServiceType | "",
    lead_source: "" as LeadSource | "",
    property_name: "",
    flat_number: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sales/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          property_type: formData.property_type || undefined,
          service_type: formData.service_type || undefined,
          lead_source: formData.lead_source || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create lead");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Create New Lead</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.client_name}
                onChange={(e) =>
                  setFormData({ ...formData, client_name: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter client name"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+91 98765 43210"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email <span className="text-slate-400 text-xs">(optional)</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="client@email.com"
              />
            </div>

            {/* Property Type (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Property Type
              </label>
              <select
                value={formData.property_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    property_type: e.target.value as PropertyType,
                  })
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Select property type</option>
                {Object.entries(PropLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Type (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Service Type
              </label>
              <select
                value={formData.service_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    service_type: e.target.value as ServiceType,
                  })
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Select service type</option>
                {Object.entries(SvcLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Lead Source (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Lead Source
              </label>
              <select
                value={formData.lead_source}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lead_source: e.target.value as LeadSource,
                  })
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Select lead source</option>
                {Object.entries(SrcLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Property Name (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Property Name
              </label>
              <input
                type="text"
                value={formData.property_name}
                onChange={(e) =>
                  setFormData({ ...formData, property_name: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Prestige Lakeside"
              />
            </div>

            {/* Flat Number (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Flat/Unit Number
              </label>
              <input
                type="text"
                value={formData.flat_number}
                onChange={(e) =>
                  setFormData({ ...formData, flat_number: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., A-1502"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Initial Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Any initial notes about this lead..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Lead"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
