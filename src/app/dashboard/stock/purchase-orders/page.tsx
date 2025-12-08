"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { POStatusBadge, CreatePurchaseOrderModal } from "@/components/stock";
import type { PurchaseOrder, POStatus, POPaymentStatus } from "@/types/stock";
import { POPaymentStatusLabels, POPaymentStatusColors } from "@/types/stock";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ClipboardDocumentListIcon,
  FunnelIcon,
  XMarkIcon,
  EyeIcon,
  ChevronUpDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

type SortField =
  | "po_number"
  | "order_date"
  | "expected_delivery"
  | "status"
  | "total_amount"
  | "created_at";
type SortOrder = "asc" | "desc";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Status workflow definition - Complete approval workflow
// Draft → Pending Approval → Approved → Sent to Vendor → Dispatched → Received
const STATUS_WORKFLOW: Record<
  POStatus,
  { next: POStatus | null; label: string; color: string; canApprove?: boolean }
> = {
  draft: {
    next: "pending_approval",
    label: "Submit for Approval",
    color: "yellow",
  },
  pending_approval: {
    next: "approved",
    label: "Approve",
    color: "green",
    canApprove: true,
  },
  approved: { next: "sent_to_vendor", label: "Send to Vendor", color: "blue" },
  rejected: { next: null, label: "", color: "" },
  sent_to_vendor: {
    next: "dispatched",
    label: "Mark Dispatched",
    color: "cyan",
  },
  acknowledged: { next: "dispatched", label: "Mark Dispatched", color: "cyan" },
  dispatched: {
    next: "fully_received",
    label: "Mark Received",
    color: "green",
  },
  partially_received: {
    next: "fully_received",
    label: "Mark Fully Received",
    color: "green",
  },
  fully_received: { next: null, label: "", color: "" },
  closed: { next: null, label: "", color: "" },
  cancelled: { next: null, label: "", color: "" },
};

const statusOptions: { value: POStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "sent_to_vendor", label: "Sent to Vendor" },
  { value: "dispatched", label: "Dispatched" },
  { value: "partially_received", label: "Partially Received" },
  { value: "fully_received", label: "Fully Received" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

// Status stepper component - shows order progress
function POStatusStepper({ status }: { status: POStatus }) {
  const steps = [
    { key: "draft", label: "Draft" },
    { key: "pending_approval", label: "Approval" },
    { key: "approved", label: "Approved" },
    { key: "sent_to_vendor", label: "Sent" },
    { key: "dispatched", label: "Dispatched" },
    { key: "fully_received", label: "Received" },
  ];

  const getStepStatus = (stepKey: string) => {
    const statusOrder = [
      "draft",
      "pending_approval",
      "approved",
      "sent_to_vendor",
      "acknowledged",
      "dispatched",
      "partially_received",
      "fully_received",
    ];
    const currentIndex = statusOrder.indexOf(status);

    // Map step keys to their position in the order
    let stepIndex = statusOrder.indexOf(stepKey);
    // Handle special cases - acknowledged maps to sent_to_vendor step
    if (stepKey === "sent_to_vendor" && status === "acknowledged") {
      return "completed";
    }
    // Handle partially_received mapping to dispatched step visually
    if (stepKey === "dispatched" && status === "partially_received") {
      return "completed";
    }

    if (status === "cancelled") return "cancelled";
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  if (status === "cancelled") {
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
        Cancelled
      </span>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {steps.map((step, index) => {
        const stepStatus = getStepStatus(step.key);
        return (
          <React.Fragment key={step.key}>
            <div
              className={`w-2 h-2 rounded-full ${
                stepStatus === "completed"
                  ? "bg-green-500"
                  : stepStatus === "current"
                  ? "bg-blue-500"
                  : "bg-slate-200"
              }`}
              title={step.label}
            />
            {index < steps.length - 1 && (
              <div
                className={`w-2 h-0.5 ${
                  stepStatus === "completed" ? "bg-green-500" : "bg-slate-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Payment Status Badge Component
function POPaymentStatusBadge({ status }: { status: POPaymentStatus }) {
  const colors = POPaymentStatusColors[status] || POPaymentStatusColors.pending;
  const label = POPaymentStatusLabels[status] || status;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<POStatus | "all">("all");
  const [hideClosed, setHideClosed] = useState(true); // Hide closed POs by default
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusUpdateId, setStatusUpdateId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const statusButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Fetch purchase orders
  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") {
        params.set("status", filterStatus);
      } else if (hideClosed) {
        // Exclude closed status when "All Status" is selected and hideClosed is true
        params.set("exclude_status", "closed");
      }
      params.set("sort_by", sortField);
      params.set("sort_order", sortOrder);
      params.set("limit", pagination.limit.toString());
      params.set(
        "offset",
        ((pagination.page - 1) * pagination.limit).toString()
      );

      const response = await fetch(
        `/api/stock/purchase-orders?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Failed to load purchase orders");
      }

      const data = await response.json();
      setPurchaseOrders(data.purchaseOrders || []);
      setPagination((prev) => ({
        ...prev,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / prev.limit),
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load purchase orders"
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    filterStatus,
    hideClosed,
    sortField,
    sortOrder,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  // Close status dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setStatusUpdateId(null);
        setDropdownPosition(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle status dropdown toggle with position calculation
  const handleStatusDropdownToggle = (
    poId: string,
    buttonElement: HTMLButtonElement | null
  ) => {
    if (statusUpdateId === poId) {
      setStatusUpdateId(null);
      setDropdownPosition(null);
    } else {
      setStatusUpdateId(poId);
      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        const dropdownWidth = 192; // w-48 = 12rem = 192px
        const dropdownHeight = 120; // approximate height
        const viewportHeight = window.innerHeight;

        // Position dropdown above if not enough space below
        let top = rect.bottom + 4;
        if (top + dropdownHeight > viewportHeight) {
          top = rect.top - dropdownHeight - 4;
        }

        // Align to right edge of button
        let left = rect.right - dropdownWidth;
        if (left < 0) left = rect.left;

        setDropdownPosition({ top, left });
      }
    }
  };

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
    setHideClosed(true); // Reset to default
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchQuery || filterStatus !== "all" || !hideClosed;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Update PO status
  const handleStatusUpdate = async (poId: string, newStatus: POStatus) => {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(
        `/api/stock/purchase-orders/${poId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }

      // Update local state
      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === poId ? { ...po, status: newStatus } : po))
      );
      setStatusUpdateId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Stats - Updated for new status workflow with approval
  const stats = {
    total: pagination.total,
    draft: purchaseOrders.filter((po) => po.status === "draft").length,
    pendingApproval: purchaseOrders.filter(
      (po) => po.status === "pending_approval"
    ).length,
    approved: purchaseOrders.filter((po) => po.status === "approved").length,
    sent: purchaseOrders.filter((po) => po.status === "sent_to_vendor").length,
    dispatched: purchaseOrders.filter((po) =>
      ["dispatched", "acknowledged"].includes(po.status)
    ).length,
    received: purchaseOrders.filter((po) =>
      ["partially_received", "fully_received"].includes(po.status)
    ).length,
    totalValue: purchaseOrders
      .filter((po) => !["cancelled", "fully_received"].includes(po.status))
      .reduce((sum, po) => sum + (po.total_amount || 0), 0),
  };

  return (
    <div className="space-y-4">
      {/* Header */}
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
              <span className="text-slate-700">Purchase Orders</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">
                Purchase Orders
              </h1>
              <div className="hidden md:flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                  {stats.total} Total
                </span>
                {stats.draft > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700">
                    {stats.draft} Draft
                  </span>
                )}
                {stats.pendingApproval > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-50 text-yellow-700">
                    {stats.pendingApproval} Pending Approval
                  </span>
                )}
                {stats.sent > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
                    {stats.sent} Sent
                  </span>
                )}
                {stats.dispatched > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-50 text-cyan-700">
                    {stats.dispatched} In Transit
                  </span>
                )}
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700">
                  {formatCurrency(stats.totalValue)}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add PO
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by PO number, vendor name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle & Quick Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                showFilters || hasActiveFilters
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FunnelIcon className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-full">
                  {(searchQuery ? 1 : 0) +
                    (filterStatus !== "all" ? 1 : 0) +
                    (!hideClosed ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Show Closed toggle */}
            <label className="inline-flex items-center gap-2 px-3 py-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={!hideClosed}
                onChange={(e) => {
                  setHideClosed(!e.target.checked);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Show Closed
            </label>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-2 text-xs text-slate-500 hover:text-slate-700"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value as POStatus | "all");
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        {/* Loading State */}
        {isLoading && (
          <div className="p-8">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-20 h-4 bg-slate-200 rounded" />
                  <div className="flex-1 h-4 bg-slate-200 rounded" />
                  <div className="w-24 h-4 bg-slate-200 rounded" />
                  <div className="w-24 h-4 bg-slate-200 rounded" />
                  <div className="w-20 h-4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-8 text-center">
            <div className="text-red-500 mb-2">
              <svg
                className="w-12 h-12 mx-auto"
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
            </div>
            <p className="text-sm font-medium text-slate-900">
              Error loading purchase orders
            </p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              onClick={fetchPurchaseOrders}
              className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && purchaseOrders.length === 0 && (
          <div className="p-12 text-center">
            <ClipboardDocumentListIcon className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">
              {hasActiveFilters
                ? "No purchase orders match your filters"
                : "No purchase orders yet"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Get started by creating your first purchase order."}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add PO
              </button>
            )}
          </div>
        )}

        {/* Table Content */}
        {!isLoading && !error && purchaseOrders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("po_number")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      PO Number
                      {renderSortIcon("po_number")}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">
                    Vendor
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("order_date")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Date
                      {renderSortIcon("order_date")}
                    </button>
                  </th>
                  <th className="text-right px-4 py-3">
                    <button
                      onClick={() => handleSort("total_amount")}
                      className="flex items-center gap-1 ml-auto text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Amount
                      {renderSortIcon("total_amount")}
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">
                    Progress
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">
                    Status
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">
                    Payment
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseOrders.map((po) => {
                  const workflow = STATUS_WORKFLOW[po.status];
                  const canProgress = workflow.next !== null;

                  return (
                    <tr
                      key={po.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/stock/purchase-orders/${po.id}`)
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          {po.po_number}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-900">
                          {po.vendor?.name || "Unknown"}
                        </div>
                        {po.vendor?.contact_person && (
                          <div className="text-xs text-slate-500">
                            {po.vendor.contact_person}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-900">
                          {formatDate(po.order_date)}
                        </div>
                        {po.expected_delivery && (
                          <div className="text-xs text-slate-500">
                            Due: {formatDate(po.expected_delivery)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-slate-900">
                          {formatCurrency(po.total_amount)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <POStatusStepper status={po.status} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <POStatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <POPaymentStatusBadge
                          status={
                            (po.payment_status as POPaymentStatus) || "pending"
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Status Update Button */}
                          {canProgress && (
                            <div
                              className="relative"
                              ref={
                                statusUpdateId === po.id
                                  ? statusDropdownRef
                                  : null
                              }
                            >
                              <button
                                ref={(el) => {
                                  if (el)
                                    statusButtonRefs.current.set(po.id, el);
                                  else statusButtonRefs.current.delete(po.id);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusDropdownToggle(
                                    po.id,
                                    statusButtonRefs.current.get(po.id) || null
                                  );
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                                  workflow.color === "blue"
                                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                                    : workflow.color === "green"
                                    ? "bg-green-50 text-green-700 hover:bg-green-100"
                                    : workflow.color === "purple"
                                    ? "bg-purple-50 text-purple-700 hover:bg-purple-100"
                                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <ChevronRightIcon className="h-3 w-3" />
                                {workflow.label}
                              </button>

                              {/* Status Update Dropdown - rendered as portal */}
                              {statusUpdateId === po.id &&
                                dropdownPosition &&
                                typeof document !== "undefined" &&
                                createPortal(
                                  <div
                                    ref={statusDropdownRef}
                                    className="fixed w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-9999"
                                    style={{
                                      top: dropdownPosition.top,
                                      left: dropdownPosition.left,
                                    }}
                                  >
                                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                                      <p className="text-xs font-medium text-slate-600">
                                        Update Status
                                      </p>
                                    </div>
                                    <div className="p-1">
                                      <button
                                        onClick={() =>
                                          handleStatusUpdate(
                                            po.id,
                                            workflow.next!
                                          )
                                        }
                                        disabled={isUpdatingStatus}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-green-50 rounded-md text-green-700"
                                      >
                                        <CheckCircleIcon className="h-4 w-4" />
                                        {workflow.label}
                                      </button>
                                      {/* Can cancel until goods are received */}
                                      {![
                                        "cancelled",
                                        "partially_received",
                                        "fully_received",
                                      ].includes(po.status) && (
                                        <button
                                          onClick={() =>
                                            handleStatusUpdate(
                                              po.id,
                                              "cancelled"
                                            )
                                          }
                                          disabled={isUpdatingStatus}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-red-50 rounded-md text-red-600"
                                        >
                                          <XMarkIcon className="h-4 w-4" />
                                          Cancel PO
                                        </button>
                                      )}
                                    </div>
                                  </div>,
                                  document.body
                                )}
                            </div>
                          )}

                          {/* View Button */}
                          <button
                            onClick={() =>
                              router.push(
                                `/dashboard/stock/purchase-orders/${po.id}`
                              )
                            }
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading &&
          !error &&
          purchaseOrders.length > 0 &&
          pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-600">
                  Showing{" "}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total
                    )}
                  </span>{" "}
                  of <span className="font-medium">{pagination.total}</span>{" "}
                  results
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPagination({ ...pagination, page: 1 })}
                    disabled={pagination.page === 1}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    title="First page"
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
                        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      setPagination({
                        ...pagination,
                        page: pagination.page - 1,
                      })
                    }
                    disabled={pagination.page === 1}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Previous page"
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
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  <span className="px-3 text-sm text-slate-700">
                    Page <span className="font-medium">{pagination.page}</span>{" "}
                    of{" "}
                    <span className="font-medium">
                      {pagination.totalPages || 1}
                    </span>
                  </span>

                  <button
                    onClick={() =>
                      setPagination({
                        ...pagination,
                        page: pagination.page + 1,
                      })
                    }
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Next page"
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      setPagination({
                        ...pagination,
                        page: pagination.totalPages,
                      })
                    }
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Last page"
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
                        d="M13 5l7 7-7 7M5 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Modals */}
      <CreatePurchaseOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchPurchaseOrders}
      />
    </div>
  );
}
