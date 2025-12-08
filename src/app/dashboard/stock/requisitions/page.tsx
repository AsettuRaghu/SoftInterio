"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RequisitionDetailModal,
  MR_STATUS_LABELS,
  MR_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/components/stock";

interface MRItem {
  id: string;
  material_id: string;
  quantity_requested: number;
  quantity_approved: number | null;
  notes: string | null;
  material: {
    id: string;
    name: string;
    sku: string;
    unit_of_measure: string;
  };
}

interface MaterialRequisition {
  id: string;
  mr_number: string;
  project_id: string | null;
  requested_by: string;
  approved_by: string | null;
  required_date: string | null;
  priority: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  requested_by_user: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  approved_by_user: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  project: {
    id: string;
    name: string;
  } | null;
  items: MRItem[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<MaterialRequisition[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRequisition, setSelectedRequisition] =
    useState<MaterialRequisition | null>(null);

  const fetchRequisitions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus) params.set("status", filterStatus);
      if (filterPriority) params.set("priority", filterPriority);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(
        `/api/stock/requisitions?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch requisitions");
      }
      const data = await response.json();
      setRequisitions(data.requisitions);
      setPagination(data.pagination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load requisitions"
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    filterStatus,
    filterPriority,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchRequisitions();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchRequisitions]);

  // Stats calculation
  const stats = {
    total: pagination.total,
    pending: requisitions.filter((r) => r.status === "submitted").length,
    approved: requisitions.filter(
      (r) => r.status === "approved" || r.status === "partially_approved"
    ).length,
    fulfilled: requisitions.filter((r) => r.status === "fulfilled").length,
  };

  if (isLoading && requisitions.length === 0) {
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
                <Link href="/dashboard/stock" className="hover:text-slate-700">
                  Stock
                </Link>
                <span>/</span>
                <span className="text-slate-700">Requisitions</span>
              </div>
              <h1 className="text-lg font-semibold text-slate-900">
                Material Requisitions
              </h1>
            </div>
          </div>
        </div>
        {/* Loading skeleton */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
                <Link href="/dashboard/stock" className="hover:text-slate-700">
                  Stock
                </Link>
                <span>/</span>
                <span className="text-slate-700">Requisitions</span>
              </div>
              <h1 className="text-lg font-semibold text-slate-900">
                Material Requisitions
              </h1>
            </div>
          </div>
        </div>
        {/* Error message */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="text-center">
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
              Error Loading Requisitions
            </h3>
            <p className="text-xs text-slate-500 mb-4">{error}</p>
            <button
              onClick={fetchRequisitions}
              className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Header with Breadcrumb and Quick Stats */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/dashboard" className="hover:text-slate-700">
                Dashboard
              </Link>
              <span>/</span>
              <Link href="/dashboard/stock" className="hover:text-slate-700">
                Stock
              </Link>
              <span>/</span>
              <span className="text-slate-700">Requisitions</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">
                Material Requisitions
              </h1>
              {/* Inline Quick Stats */}
              <div className="hidden md:flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                  {stats.total} Total
                </span>
                {stats.pending > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
                    {stats.pending} Pending
                  </span>
                )}
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700">
                  {stats.approved} Approved
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50">
              Export
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + New MR
            </button>
          </div>
        </div>
      </div>

      {/* Compact Search and Filters */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
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
                placeholder="Search by MR number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {Object.entries(MR_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Compact Requisitions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {requisitions.length === 0 ? (
          <div className="text-center py-10">
            <svg
              className="w-12 h-12 text-slate-300 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="text-sm font-medium text-slate-900 mb-1">
              No requisitions found
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Create your first material requisition.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + New MR
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      MR Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Project
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Requested By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Items
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Required
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requisitions.map((requisition) => (
                    <tr
                      key={requisition.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedRequisition(requisition)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          {requisition.mr_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {requisition.project?.name || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs text-slate-900">
                            {requisition.requested_by_user?.full_name ||
                              "Unknown"}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {new Date(
                              requisition.created_at
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-700">
                          {requisition.items?.length || 0} items
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {requisition.required_date
                          ? new Date(
                              requisition.required_date
                            ).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            PRIORITY_COLORS[requisition.priority] ||
                            PRIORITY_COLORS.normal
                          }`}
                        >
                          {PRIORITY_LABELS[requisition.priority] ||
                            requisition.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            MR_STATUS_COLORS[requisition.status] ||
                            MR_STATUS_COLORS.draft
                          }`}
                        >
                          {MR_STATUS_LABELS[requisition.status] ||
                            requisition.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedRequisition(requisition)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View Details"
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
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          {requisition.status === "draft" && (
                            <button
                              className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Submit"
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
                                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                <p className="text-sm text-slate-600">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total
                  )}{" "}
                  of {pagination.total} requisitions
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setPagination({
                        ...pagination,
                        page: pagination.page - 1,
                      })
                    }
                    disabled={pagination.page === 1}
                    className="px-3 py-1 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setPagination({
                        ...pagination,
                        page: pagination.page + 1,
                      })
                    }
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* View Requisition Detail Modal */}
      {selectedRequisition && (
        <RequisitionDetailModal
          requisition={selectedRequisition}
          onClose={() => setSelectedRequisition(null)}
        />
      )}
    </div>
  );
}
