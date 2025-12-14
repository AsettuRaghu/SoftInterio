"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { POStatusBadge, CreatePurchaseOrderModal } from "@/components/stock";
import type { PurchaseOrder, POStatus, POPaymentStatus } from "@/types/stock";
import { POPaymentStatusLabels, POPaymentStatusColors } from "@/types/stock";
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
import {
  PlusIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Status workflow definition
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

// Status options for filter
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "#94a3b8" },
  { value: "pending_approval", label: "Pending Approval", color: "#eab308" },
  { value: "approved", label: "Approved", color: "#22c55e" },
  { value: "sent_to_vendor", label: "Sent to Vendor", color: "#3b82f6" },
  { value: "dispatched", label: "Dispatched", color: "#06b6d4" },
  {
    value: "partially_received",
    label: "Partially Received",
    color: "#8b5cf6",
  },
  { value: "fully_received", label: "Fully Received", color: "#22c55e" },
];

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Status stepper component
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
    let stepIndex = statusOrder.indexOf(stepKey);

    if (stepKey === "sent_to_vendor" && status === "acknowledged") {
      return "completed";
    }
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

// Payment Status Badge
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
  const [allPurchaseOrders, setAllPurchaseOrders] = useState<PurchaseOrder[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [hideClosed, setHideClosed] = useState(true);

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<PurchaseOrder>();
  const { searchValue, setSearchValue } = useAppTableSearch<PurchaseOrder>([]);

  // Custom filter function
  const filterData = useCallback(
    (data: PurchaseOrder[], searchTerm: string) => {
      let filtered = data;

      // Apply status filter
      if (statusFilter) {
        filtered = filtered.filter((po) => po.status === statusFilter);
      }

      // Hide closed/cancelled by default
      if (hideClosed && !statusFilter) {
        filtered = filtered.filter(
          (po) => !["closed", "cancelled"].includes(po.status)
        );
      }

      // Apply search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (po) =>
            po.po_number?.toLowerCase().includes(query) ||
            po.vendor?.name?.toLowerCase().includes(query) ||
            po.vendor?.contact_person?.toLowerCase().includes(query)
        );
      }

      return filtered;
    },
    [statusFilter, hideClosed]
  );

  // Custom sort value getter
  const getSortValue = useCallback((item: PurchaseOrder, column: string) => {
    switch (column) {
      case "po_number":
        return item.po_number?.toLowerCase() || "";
      case "order_date":
        return item.order_date ? new Date(item.order_date) : null;
      case "expected_delivery":
        return item.expected_delivery ? new Date(item.expected_delivery) : null;
      case "total_amount":
        return item.total_amount || 0;
      case "status":
        const statusOrder = [
          "draft",
          "pending_approval",
          "approved",
          "sent_to_vendor",
          "dispatched",
          "partially_received",
          "fully_received",
          "closed",
          "cancelled",
        ];
        return statusOrder.indexOf(item.status);
      case "created_at":
      default:
        return item.created_at ? new Date(item.created_at) : null;
    }
  }, []);

  // Process data: filter -> sort
  const processedPurchaseOrders = useMemo(() => {
    const filtered = filterData(allPurchaseOrders, searchValue);
    return sortData(filtered, getSortValue);
  }, [allPurchaseOrders, searchValue, filterData, sortData, getSortValue]);

  // Fetch purchase orders
  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
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
      setAllPurchaseOrders(data.purchaseOrders || []);
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
  }, [pagination.page, pagination.limit]);

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

  // Calculate stats
  const stats = useMemo(() => {
    const total = allPurchaseOrders.length;
    const draft = allPurchaseOrders.filter(
      (po) => po.status === "draft"
    ).length;
    const pendingApproval = allPurchaseOrders.filter(
      (po) => po.status === "pending_approval"
    ).length;
    const inProgress = allPurchaseOrders.filter((po) =>
      ["approved", "sent_to_vendor", "dispatched"].includes(po.status)
    ).length;
    const totalValue = allPurchaseOrders
      .filter(
        (po) => !["cancelled", "fully_received", "closed"].includes(po.status)
      )
      .reduce((sum, po) => sum + (po.total_amount || 0), 0);

    return { total, draft, pendingApproval, inProgress, totalValue };
  }, [allPurchaseOrders]);

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
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Handle status dropdown toggle
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
        const dropdownWidth = 192;
        const dropdownHeight = 120;
        const viewportHeight = window.innerHeight;

        let top = rect.bottom + 4;
        if (top + dropdownHeight > viewportHeight) {
          top = rect.top - dropdownHeight - 4;
        }

        let left = rect.right - dropdownWidth;
        if (left < 0) left = rect.left;

        setDropdownPosition({ top, left });
      }
    }
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

      setAllPurchaseOrders((prev) =>
        prev.map((po) => (po.id === poId ? { ...po, status: newStatus } : po))
      );
      setStatusUpdateId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Define table columns
  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      key: "po_number",
      header: "PO Number",
      width: "12%",
      sortable: true,
      render: (po) => (
        <div className="text-sm font-medium text-blue-600 hover:text-blue-700">
          {po.po_number}
        </div>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      width: "18%",
      render: (po) => (
        <div>
          <div className="text-sm font-medium text-slate-900">
            {po.vendor?.name || "Unknown"}
          </div>
          {po.vendor?.contact_person && (
            <div className="text-xs text-slate-500">
              {po.vendor.contact_person}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "order_date",
      header: "Date",
      width: "12%",
      sortable: true,
      render: (po) => (
        <div>
          <div className="text-sm text-slate-900">
            {formatDate(po.order_date)}
          </div>
          {po.expected_delivery && (
            <div className="text-xs text-slate-500">
              Due: {formatDate(po.expected_delivery)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "total_amount",
      header: "Amount",
      width: "12%",
      sortable: true,
      align: "right",
      render: (po) => (
        <div className="text-sm font-semibold text-slate-900">
          {formatCurrency(po.total_amount)}
        </div>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      width: "12%",
      align: "center",
      render: (po) => (
        <div className="flex justify-center">
          <POStatusStepper status={po.status} />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      align: "center",
      render: (po) => <POStatusBadge status={po.status} />,
    },
    {
      key: "payment_status",
      header: "Payment",
      width: "10%",
      align: "center",
      render: (po) => (
        <POPaymentStatusBadge
          status={(po.payment_status as POPaymentStatus) || "pending"}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      width: "12%",
      render: (po) => {
        const workflow = STATUS_WORKFLOW[po.status];
        const canProgress = workflow.next !== null;

        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {canProgress && (
              <div
                className="relative"
                ref={statusUpdateId === po.id ? statusDropdownRef : null}
              >
                <button
                  ref={(el) => {
                    if (el) statusButtonRefs.current.set(po.id, el);
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
                            handleStatusUpdate(po.id, workflow.next!)
                          }
                          disabled={isUpdatingStatus}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-green-50 rounded-md text-green-700"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          {workflow.label}
                        </button>
                        {![
                          "cancelled",
                          "partially_received",
                          "fully_received",
                        ].includes(po.status) && (
                          <button
                            onClick={() =>
                              handleStatusUpdate(po.id, "cancelled")
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

            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/stock/purchase-orders/${po.id}`);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              title="View Details"
            >
              <EyeIcon className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <PageLayout isLoading={isLoading && allPurchaseOrders.length === 0}>
      <PageHeader
        title="Purchase Orders"
        breadcrumbs={[
          { label: "Stock & Procurement" },
          { label: "Purchase Orders" },
        ]}
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Add PO
          </button>
        }
        stats={
          <>
            <StatBadge label="Total" value={stats.total} color="slate" />
            <StatBadge label="Draft" value={stats.draft} color="slate" />
            <StatBadge
              label="Pending Approval"
              value={stats.pendingApproval}
              color="amber"
            />
            <StatBadge
              label="In Progress"
              value={stats.inProgress}
              color="blue"
            />
            <StatBadge
              label="Pipeline Value"
              value={formatCurrency(stats.totalValue)}
              color="green"
            />
          </>
        }
      />

      <PageContent>
        {/* Toolbar with Search and Filters */}
        <div className="mb-4 flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search by PO number, vendor name..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100"
              >
                <span className="text-slate-400 text-xs">✕</span>
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Show Closed Toggle */}
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={!hideClosed}
              onChange={(e) => setHideClosed(!e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Show Closed
          </label>
        </div>

        <AppTable
          data={processedPurchaseOrders}
          columns={columns}
          keyExtractor={(po) => po.id}
          isLoading={isLoading}
          showToolbar={false}
          sortable={true}
          sortState={sortState}
          onSort={handleSort}
          onRowClick={(po) =>
            router.push(`/dashboard/stock/purchase-orders/${po.id}`)
          }
          emptyState={{
            title: "No purchase orders found",
            description:
              statusFilter || !hideClosed || searchValue
                ? "No purchase orders match your filters. Try a different filter."
                : "Get started by creating your first purchase order.",
            icon: (
              <ClipboardDocumentListIcon className="w-6 h-6 text-slate-400" />
            ),
          }}
        />
      </PageContent>

      {/* Modals */}
      <CreatePurchaseOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchPurchaseOrders}
      />
    </PageLayout>
  );
}
