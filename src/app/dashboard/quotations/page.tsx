"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Quotation, QuotationStatus } from "@/types/quotations";
import {
  QuotationStatusLabels,
  QuotationStatusColors,
  PropertyTypeLabels,
} from "@/types/quotations";
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
  DocumentTextIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// Status options for filtering and bulk updates
const STATUS_OPTIONS: Array<{
  value: QuotationStatus;
  label: string;
  color: string;
}> = [
  { value: "draft", label: "Draft", color: "#94a3b8" },
  { value: "sent", label: "Sent", color: "#3b82f6" },
  { value: "viewed", label: "Viewed", color: "#8b5cf6" },
  { value: "negotiating", label: "Negotiating", color: "#f59e0b" },
  { value: "approved", label: "Approved", color: "#22c55e" },
  { value: "rejected", label: "Rejected", color: "#ef4444" },
  { value: "expired", label: "Expired", color: "#6b7280" },
];

// Active statuses constant
const ACTIVE_STATUSES: QuotationStatus[] = [
  "draft",
  "sent",
  "viewed",
  "negotiating",
];

export default function QuotationsListPage() {
  const router = useRouter();
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadStatusFilter, setLeadStatusFilter] = useState<
    "active" | "inactive"
  >("active");

  // Filter states
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "">("");

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<Quotation>();
  const { searchValue, setSearchValue } = useAppTableSearch<Quotation>([]);

  // Custom filter function for searching quotation data
  const filterData = useCallback(
    (data: Quotation[], searchTerm: string) => {
      let filtered = data;

      // Apply status filter
      if (statusFilter) {
        filtered = filtered.filter((q) => q.status === statusFilter);
      }

      // Apply search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (quotation) =>
            quotation.client_name?.toLowerCase().includes(query) ||
            quotation.client_email?.toLowerCase().includes(query) ||
            quotation.property_name?.toLowerCase().includes(query) ||
            quotation.quotation_number?.toLowerCase().includes(query) ||
            quotation.title?.toLowerCase().includes(query) ||
            (quotation.property_type &&
              PropertyTypeLabels[quotation.property_type]
                ?.toLowerCase()
                .includes(query)) ||
            QuotationStatusLabels[quotation.status]
              ?.toLowerCase()
              .includes(query)
        );
      }

      return filtered;
    },
    [statusFilter]
  );

  // Custom sort value getter
  const getSortValue = useCallback((item: Quotation, column: string) => {
    switch (column) {
      case "client_name":
        return item.client_name?.toLowerCase() || "";
      case "quotation_number":
        return item.quotation_number?.toLowerCase() || "";
      case "property_name":
        return item.property_name?.toLowerCase() || "";
      case "grand_total":
        return item.grand_total || 0;
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
        return statusOrder.indexOf(item.status);
      case "valid_until":
        return item.valid_until ? new Date(item.valid_until) : null;
      case "created_at":
      default:
        return item.created_at ? new Date(item.created_at) : null;
    }
  }, []);

  // Process data: filter -> sort
  const processedQuotations = useMemo(() => {
    const filtered = filterData(allQuotations, searchValue);
    return sortData(filtered, getSortValue);
  }, [allQuotations, searchValue, filterData, sortData, getSortValue]);

  // Fetch quotations
  const fetchQuotations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/quotations?lead_status=${leadStatusFilter}`
      );
      if (!response.ok) throw new Error("Failed to fetch quotations");

      const data = await response.json();
      setAllQuotations(data.quotations || []);
      setSelectedIds(new Set()); // Clear selection on refresh
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
  }, [fetchQuotations]);

  // Calculate stats
  const stats = useMemo(() => {
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

    // Count by status for filter badges
    const statusCounts = allQuotations.reduce((acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, active, approved, pipelineValue, statusCounts };
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

  // Check if quotation is expiring soon (within 7 days)
  const isExpiringSoon = (validUntil: string | undefined) => {
    if (!validUntil) return false;
    const diff = new Date(validUntil).getTime() - new Date().getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 7;
  };

  // Handle creating a revision
  const handleRevise = async (quotationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
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
    }
  };

  // Handle duplicate quotation
  const handleDuplicate = async (quotationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const response = await fetch(`/api/quotations/${quotationId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to duplicate quotation");
      }

      const data = await response.json();
      router.push(`/dashboard/quotations/${data.quotation.id}/edit`);
    } catch (err) {
      console.error("Error duplicating quotation:", err);
      alert(
        err instanceof Error ? err.message : "Failed to duplicate quotation"
      );
    }
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(processedQuotations.map((q) => q.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // Bulk status change handler
  const handleBulkStatusChange = async (newStatus: QuotationStatus) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/quotations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );
      await fetchQuotations();
    } catch (err) {
      console.error("Bulk status change error:", err);
      alert("Failed to update status");
    }
  };

  // Define table columns
  const columns: ColumnDef<Quotation>[] = [
    {
      key: "select",
      header: "",
      width: "4%",
      render: (quotation) => (
        <input
          type="checkbox"
          checked={selectedIds.has(quotation.id)}
          onChange={(e) => {
            e.stopPropagation();
            handleSelectOne(quotation.id, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      ),
    },
    {
      key: "quotation_number",
      header: "Quotation #",
      width: "11%",
      sortable: true,
      render: (quotation) => (
        <div>
          <p className="text-sm font-medium text-blue-600">
            {quotation.quotation_number}
          </p>
          <p className="text-xs text-slate-500">v{quotation.version}</p>
        </div>
      ),
    },
    {
      key: "client_name",
      header: "Client",
      width: "16%",
      sortable: true,
      render: (quotation) => (
        <div>
          <p className="text-sm font-medium text-slate-900">
            {quotation.client_name}
          </p>
          {quotation.client_email && (
            <p className="text-xs text-slate-500">{quotation.client_email}</p>
          )}
        </div>
      ),
    },
    {
      key: "property_name",
      header: "Property",
      width: "14%",
      sortable: true,
      render: (quotation) => (
        <div>
          {quotation.property_name && (
            <p className="text-sm font-medium text-slate-900">
              {quotation.property_name}
            </p>
          )}
          {quotation.property_type && (
            <p className="text-xs text-slate-500">
              {PropertyTypeLabels[quotation.property_type]}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "grand_total",
      header: "Amount",
      width: "11%",
      sortable: true,
      render: (quotation) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrency(quotation.grand_total)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "11%",
      sortable: true,
      render: (quotation) => {
        const colors = QuotationStatusColors[quotation.status];
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
            {QuotationStatusLabels[quotation.status]}
          </span>
        );
      },
    },
    {
      key: "valid_until",
      header: "Valid Until",
      width: "10%",
      sortable: true,
      render: (quotation) => (
        <div>
          <p
            className={`text-sm ${
              isExpiringSoon(quotation.valid_until)
                ? "text-amber-600 font-medium"
                : "text-slate-700"
            }`}
          >
            {formatDate(quotation.valid_until)}
          </p>
          {isExpiringSoon(quotation.valid_until) && (
            <p className="text-xs text-amber-600">Expiring soon</p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "13%",
      render: (quotation) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/quotations/${quotation.id}`);
            }}
            className="px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded font-medium"
          >
            View
          </button>
          <button
            onClick={(e) => handleDuplicate(quotation.id, e)}
            title="Duplicate"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>
          {quotation.status !== "rejected" &&
            quotation.status !== "expired" && (
              <button
                onClick={(e) => handleRevise(quotation.id, e)}
                title="Create Revision"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                <ArrowPathIcon className="w-4 h-4" />
              </button>
            )}
        </div>
      ),
    },
  ];

  // Tab filters for lead status
  const tabFilters = [
    {
      value: "active",
      label: "Active Leads",
      count: leadStatusFilter === "active" ? allQuotations.length : undefined,
    },
    {
      value: "inactive",
      label: "Inactive Leads",
      count: leadStatusFilter === "inactive" ? allQuotations.length : undefined,
    },
  ];

  return (
    <PageLayout>
      <PageHeader
        title="Quotation Management"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Quotations" },
        ]}
        actions={
          <button
            onClick={() => router.push("/dashboard/quotations/templates")}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm font-medium"
          >
            <DocumentTextIcon className="w-4 h-4" />
            Templates
          </button>
        }
        stats={
          <>
            <StatBadge label="Total" value={stats.total} color="slate" />
            <StatBadge label="Pipeline" value={stats.active} color="blue" />
            <StatBadge label="Approved" value={stats.approved} color="green" />
            <StatBadge
              label="Pipeline Value"
              value={formatCurrency(stats.pipelineValue)}
              color="amber"
            />
          </>
        }
      />

      <PageContent>
        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() =>
                  setSelectedIds(new Set(processedQuotations.map((q) => q.id)))
                }
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Select all {processedQuotations.length}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-slate-600 hover:text-slate-700"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusChange(e.target.value as QuotationStatus);
                    e.target.value = "";
                  }
                }}
                className="text-sm border border-blue-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
              >
                <option value="" disabled>
                  Change Status...
                </option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Status Filter Pills */}
        <div className="mb-4 flex items-center gap-4">
          <span className="text-sm text-slate-500">Status:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("")}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                statusFilter === ""
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setStatusFilter(statusFilter === opt.value ? "" : opt.value)
                }
                className={`px-3 py-1.5 text-sm rounded-full transition-colors flex items-center gap-1.5 ${
                  statusFilter === opt.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
                {stats.statusCounts[opt.value] && (
                  <span className="text-xs opacity-70">
                    ({stats.statusCounts[opt.value]})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <AppTable
          data={processedQuotations}
          columns={columns}
          keyExtractor={(q) => q.id}
          isLoading={isLoading}
          showToolbar={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search by client, property, quotation number..."
          tabs={tabFilters}
          activeTab={leadStatusFilter}
          onTabChange={(tab) =>
            setLeadStatusFilter(tab as "active" | "inactive")
          }
          sortable={true}
          sortState={sortState}
          onSort={handleSort}
          onRowClick={(quotation) =>
            router.push(`/dashboard/quotations/${quotation.id}`)
          }
          emptyState={{
            title: "No quotations found",
            description: statusFilter
              ? `No quotations with status "${QuotationStatusLabels[statusFilter]}". Try a different filter.`
              : "Quotations are automatically created when leads move to Proposal Discussion stage.",
            icon: <DocumentTextIcon className="w-6 h-6 text-slate-400" />,
          }}
        />
      </PageContent>
    </PageLayout>
  );
}
