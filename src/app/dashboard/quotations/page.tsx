"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Quotation, QuotationStatus } from "@/types/quotations";

// Import the label/color maps
import {
  QuotationStatusLabels as StatusLabels,
  QuotationStatusColors as StatusColors,
  PropertyTypeLabels as PropLabels,
} from "@/types/quotations";
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

export default function QuotationsListPage() {
  const router = useRouter();
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisingId, setRevisingId] = useState<string | null>(null);

  // Filters
  const [leadStatusFilter, setLeadStatusFilter] = useState<
    "active" | "inactive"
  >("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch quotations from API
  const fetchQuotations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/quotations?lead_status=${leadStatusFilter}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch quotations");
      }

      const data = await response.json();
      setAllQuotations(data.quotations || []);
    } catch (err) {
      console.error("Error fetching quotations:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load quotations"
      );
    } finally {
      setIsLoading(false);
    }
  }, [leadStatusFilter]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations, leadStatusFilter]);

  // Process quotations locally: filter, search, sort
  const processedQuotations = React.useMemo(() => {
    let result = [...allQuotations];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((quotation) => {
        return (
          quotation.client_name?.toLowerCase().includes(query) ||
          quotation.client_email?.toLowerCase().includes(query) ||
          quotation.property_name?.toLowerCase().includes(query) ||
          quotation.quotation_number?.toLowerCase().includes(query) ||
          quotation.title?.toLowerCase().includes(query) ||
          (quotation.property_type &&
            PropLabels[quotation.property_type]
              ?.toLowerCase()
              .includes(query)) ||
          StatusLabels[quotation.status]?.toLowerCase().includes(query)
        );
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case "client_name":
          aVal = a.client_name?.toLowerCase() || "";
          bVal = b.client_name?.toLowerCase() || "";
          break;
        case "quotation_number":
          aVal = a.quotation_number?.toLowerCase() || "";
          bVal = b.quotation_number?.toLowerCase() || "";
          break;
        case "property_name":
          aVal = a.property_name?.toLowerCase() || "";
          bVal = b.property_name?.toLowerCase() || "";
          break;
        case "grand_total":
          aVal = a.grand_total || 0;
          bVal = b.grand_total || 0;
          break;
        case "status":
          const statusOrder: QuotationStatus[] = [
            "draft",
            "sent",
            "viewed",
            "negotiating",
            "approved",
            "rejected",
            "expired",
          ];
          aVal = statusOrder.indexOf(a.status);
          bVal = statusOrder.indexOf(b.status);
          break;
        case "valid_until":
          aVal = a.valid_until ? new Date(a.valid_until).getTime() : 0;
          bVal = b.valid_until ? new Date(b.valid_until).getTime() : 0;
          break;
        case "created_at":
        default:
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
      }

      if (typeof aVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortOrder === "asc"
        ? aVal - (bVal as number)
        : (bVal as number) - aVal;
    });

    return result;
  }, [allQuotations, searchQuery, sortBy, sortOrder]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const ACTIVE_STATUSES: QuotationStatus[] = [
      "draft",
      "sent",
      "viewed",
      "negotiating",
    ];
    const total = allQuotations.length;
    const active = allQuotations.filter((q) =>
      ACTIVE_STATUSES.includes(q.status)
    ).length;
    const approved = allQuotations.filter(
      (q) => q.status === "approved"
    ).length;
    const pipelineValue = allQuotations
      .filter((q) => ACTIVE_STATUSES.includes(q.status))
      .reduce((sum, q) => sum + (q.grand_total || 0), 0);

    return { total, active, approved, pipelineValue };
  }, [allQuotations]);

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
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get status badge
  const getStatusBadge = (status: QuotationStatus) => {
    const colors = StatusColors[status];
    const baseClasses =
      "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full";
    const colorClasses = colors.bg + " " + colors.text;
    const dotClasses = "w-1.5 h-1.5 rounded-full " + colors.dot;

    return (
      <span className={baseClasses + " " + colorClasses}>
        <span className={dotClasses}></span>
        {StatusLabels[status]}
      </span>
    );
  };

  // Check if quotation is expiring soon (within 7 days)
  const isExpiringSoon = (validUntil: string | undefined) => {
    if (!validUntil) return false;
    const diff = new Date(validUntil).getTime() - new Date().getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 7;
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder(
        field === "client_name" || field === "property_name" ? "asc" : "desc"
      );
    }
  };

  // Handle creating a revision
  const handleRevise = async (quotationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setRevisingId(quotationId);
      const response = await fetch(`/api/quotations/${quotationId}/revision`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create revision");
      }

      const data = await response.json();
      router.push(`/dashboard/quotations/${data.quotation.id}/edit`);
    } catch (err) {
      console.error("Error creating revision:", err);
      alert(err instanceof Error ? err.message : "Failed to create revision");
    } finally {
      setRevisingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Header with Stats */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <Link href="/dashboard" className="hover:text-blue-600">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-700">Quotations</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900">
              Quotation Management
            </h1>
          </div>

          {/* Stats in header - compact pills */}
          {allQuotations.length > 0 && (
            <div className="hidden md:flex items-center gap-2 pl-6 border-l border-slate-200">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                <span className="font-medium">{stats.total}</span> Total
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                <span className="font-medium">{stats.active}</span> Pipeline
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">
                <span className="font-medium">{stats.approved}</span> Approved
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                <span className="font-medium">
                  {formatCurrency(stats.pipelineValue)}
                </span>
              </span>
            </div>
          )}
        </div>
        {/* Info: Quotations are created from leads */}
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <svg
            className="w-4 h-4 text-blue-600 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-xs text-blue-700">
            Quotations are auto-created when a lead moves to Proposal Discussion
            stage.{" "}
            <Link
              href="/dashboard/sales/leads"
              className="font-medium underline hover:text-blue-900"
            >
              Go to Leads
            </Link>
          </span>
        </div>
      </div>

      {/* Filters Row - Lead Status + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Lead Status Filter */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setLeadStatusFilter("active")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              leadStatusFilter === "active"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Active Leads
          </button>
          <button
            onClick={() => setLeadStatusFilter("inactive")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              leadStatusFilter === "inactive"
                ? "bg-slate-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Inactive Leads
          </button>
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
              placeholder="Search by client, property, quote #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500">Loading quotations...</p>
            </div>
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
            <button
              onClick={fetchQuotations}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : processedQuotations.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-base font-medium mb-1">No quotations found</p>
            <p className="text-sm text-slate-400">
              {searchQuery
                ? "Try adjusting your search"
                : statusFilter !== "active" && statusFilter !== "all"
                ? "No quotations in this status"
                : "Quotations are created when leads move to Proposal Discussion stage"}
            </p>
            {statusFilter === "active" &&
              !searchQuery &&
              allQuotations.length === 0 && (
                <Link
                  href="/dashboard/sales/leads"
                  className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Go to Leads
                </Link>
              )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("quotation_number")}
                  >
                    <div className="flex items-center">
                      Quote #
                      <SortIcon
                        field="quotation_number"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Version
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("client_name")}
                  >
                    <div className="flex items-center">
                      Lead
                      <SortIcon
                        field="client_name"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("grand_total")}
                  >
                    <div className="flex items-center">
                      Amount
                      <SortIcon
                        field="grand_total"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      Status
                      <SortIcon
                        field="status"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("valid_until")}
                  >
                    <div className="flex items-center">
                      Valid Until
                      <SortIcon
                        field="valid_until"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center">
                      Created
                      <SortIcon
                        field="created_at"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Assigned To
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedQuotations.map((quotation) => (
                  <tr
                    key={quotation.id}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    onClick={() =>
                      router.push("/dashboard/quotations/" + quotation.id)
                    }
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                        {quotation.quotation_number}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                        v{quotation.version}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-slate-900 truncate">
                          {quotation.client_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {[quotation.property_name, quotation.flat_number]
                            .filter(Boolean)
                            .join(" • ") || "—"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">
                          {formatCurrency(quotation.grand_total)}
                        </p>
                        {quotation.discount_amount &&
                          quotation.discount_amount > 0 && (
                            <p className="text-xs text-green-600">
                              -{formatCurrency(quotation.discount_amount)} off
                            </p>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(quotation.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <p className="text-sm text-slate-600">
                          {formatDate(quotation.valid_until)}
                        </p>
                        {isExpiringSoon(quotation.valid_until) &&
                          ACTIVE_STATUSES.includes(quotation.status) && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                              Expiring
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-600">
                        {formatDate(quotation.created_at)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {(quotation as any).assigned_to_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium shrink-0">
                            {(
                              quotation as any
                            ).assigned_to_name?.[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700 truncate">
                            {(quotation as any).assigned_to_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/quotations/${quotation.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit quotation"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          Edit
                        </Link>
                        <button
                          onClick={(e) => handleRevise(quotation.id, e)}
                          disabled={revisingId === quotation.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
                          title="Create new revision"
                        >
                          {revisingId === quotation.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          )}
                          Revise
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Results count */}
        {!isLoading && processedQuotations.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-600">
              Showing{" "}
              <span className="font-medium">{processedQuotations.length}</span>{" "}
              of <span className="font-medium">{allQuotations.length}</span>{" "}
              quotations
              <span className="text-slate-400">
                {" "}
                • {leadStatusFilter === "active" ? "Active" : "Inactive"} leads
              </span>
              {searchQuery && (
                <span className="text-slate-400">
                  {" "}
                  • Searching &quot;{searchQuery}&quot;
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
