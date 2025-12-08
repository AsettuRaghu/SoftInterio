"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  EyeIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";

interface GRNItem {
  id: string;
  po_item_id: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  rejection_reason: string | null;
  po_item: {
    id: string;
    material: {
      id: string;
      name: string;
      sku: string;
      unit_of_measure: string;
    };
  };
}

interface GoodsReceipt {
  id: string;
  grn_number: string;
  po_id: string;
  received_date: string;
  received_by: string;
  status: string;
  delivery_note_number: string | null;
  vehicle_number: string | null;
  notes: string | null;
  created_at: string;
  purchase_order: {
    id: string;
    po_number: string;
    vendor: {
      id: string;
      name: string;
      code: string;
    };
  };
  received_by_user: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  items: GRNItem[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortField = "grn_number" | "received_date" | "status" | "created_at";
type SortOrder = "asc" | "desc";

// Status badge component
const GRNStatusBadge = ({ status }: { status: string }) => {
  const configs: Record<
    string,
    { label: string; bg: string; text: string; dot: string }
  > = {
    draft: {
      label: "Draft",
      bg: "bg-slate-100",
      text: "text-slate-700",
      dot: "bg-slate-500",
    },
    pending_inspection: {
      label: "Pending Inspection",
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
    },
    completed: {
      label: "Completed",
      bg: "bg-green-50",
      text: "text-green-700",
      dot: "bg-green-500",
    },
    partial: {
      label: "Partial",
      bg: "bg-blue-50",
      text: "text-blue-700",
      dot: "bg-blue-500",
    },
  };

  const config = configs[status] || configs.draft;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      {config.label}
    </span>
  );
};

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "pending_inspection", label: "Pending Inspection" },
  { value: "completed", label: "Completed" },
  { value: "partial", label: "Partial" },
];

export default function GRNPage() {
  const router = useRouter();
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Fetch GRNs
  const fetchGRNs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(`/api/stock/grn?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch GRNs");
      }

      const data = await response.json();
      setGrns(data.grns);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load GRNs");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus, pagination.page, pagination.limit]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchGRNs();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchGRNs]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronUpDownIcon className="h-3.5 w-3.5 text-slate-400" />;
    }
    return (
      <ChevronUpDownIcon
        className={`h-3.5 w-3.5 text-blue-600 ${
          sortOrder === "desc" ? "rotate-180" : ""
        }`}
      />
    );
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchQuery || filterStatus !== "all";

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Stats
  const stats = {
    total: pagination.total,
    draft: grns.filter((g) => g.status === "draft").length,
    pending: grns.filter((g) => g.status === "pending_inspection").length,
    completed: grns.filter((g) => g.status === "completed").length,
    partial: grns.filter((g) => g.status === "partial").length,
  };

  return (
    <div className="space-y-6">
      {/* Header with Breadcrumb */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <Link href="/dashboard" className="hover:text-blue-600">
                Dashboard
              </Link>
              <span>/</span>
              <Link href="/dashboard/stock" className="hover:text-blue-600">
                Stock
              </Link>
              <span>/</span>
              <span className="text-slate-700">Goods Receipts</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">
                Goods Receipt Notes
              </h1>
              <div className="hidden md:flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                  {stats.total} Total
                </span>
                {stats.pending > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700">
                    {stats.pending} Pending
                  </span>
                )}
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700">
                  {stats.completed} Completed
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/stock/grn/create")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4" />
            Create GRN
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by GRN number, PO number, vendor..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading && grns.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-slate-500">Loading goods receipts...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">
              Error Loading Goods Receipts
            </h3>
            <p className="text-xs text-slate-500 mb-4">{error}</p>
            <button
              onClick={fetchGRNs}
              className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : grns.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">
              No Goods Receipts Found
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {hasActiveFilters
                ? "Try adjusting your filters"
                : "Create your first GRN from a received purchase order"}
            </p>
            <button
              onClick={() => router.push("/dashboard/stock/grn/create")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4" />
              Create First GRN
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort("grn_number")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      GRN Number
                      {renderSortIcon("grn_number")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Purchase Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort("received_date")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Received Date
                      {renderSortIcon("received_date")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Received By
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort("status")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Status
                      {renderSortIcon("status")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    Items
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grns.map((grn) => (
                  <tr
                    key={grn.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/stock/grn/${grn.id}`)
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">
                        {grn.grn_number}
                      </div>
                      {grn.delivery_note_number && (
                        <div className="text-xs text-slate-500">
                          DN: {grn.delivery_note_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">
                        {grn.purchase_order.po_number}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">
                        {grn.purchase_order.vendor.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {grn.purchase_order.vendor.code}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(grn.received_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">
                        {grn.received_by_user?.full_name || "N/A"}
                      </div>
                      {grn.received_by_user && (
                        <div className="text-xs text-slate-500">
                          {grn.received_by_user.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <GRNStatusBadge status={grn.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded">
                        {grn.items?.length || 0} items
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/stock/grn/${grn.id}`);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && grns.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total} results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                disabled={pagination.page === 1}
                className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
