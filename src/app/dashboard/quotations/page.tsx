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
  ArrowPathIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Types for modal
interface Lead {
  id: string;
  lead_number: string;
  stage: string;
  client_name?: string;
  property_name?: string;
  // From client relationship
  client?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  // From property relationship
  property?: {
    id: string;
    property_name?: string;
    unit_number?: string;
  };
}

interface Project {
  id: string;
  project_number: string;
  name: string;
  client_name?: string;
  status: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  spaces_count?: number;
  components_count?: number;
}

// Status options for filtering and bulk updates
const STATUS_OPTIONS: Array<{
  value: QuotationStatus;
  label: string;
  color: string;
}> = [
  { value: "draft", label: "Draft", color: "#94a3b8" },
  { value: "sent", label: "Sent", color: "#3b82f6" },
  { value: "viewed", label: "Viewed", color: "#06b6d4" },
  { value: "negotiating", label: "Negotiating", color: "#f59e0b" },
  { value: "approved", label: "Approved", color: "#22c55e" },
  { value: "rejected", label: "Rejected", color: "#ef4444" },
  { value: "cancelled", label: "Cancelled", color: "#f97316" },
  { value: "expired", label: "Expired", color: "#6b7280" },
];

// Active statuses constant
const ACTIVE_STATUSES: QuotationStatus[] = ["draft", "sent"];

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

  // Create Quotation Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSource, setCreateSource] = useState<
    "lead" | "project" | "standalone"
  >("lead");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingModalData, setIsLoadingModalData] = useState(false);

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
    // Filter based on lead status filter
    let filteredByLeadStatus = allQuotations;
    if (leadStatusFilter === "active") {
      // Active: exclude quotations linked to closed leads (won/lost/disqualified)
      filteredByLeadStatus = allQuotations.filter(
        (q) =>
          !q.lead_stage ||
          !["won", "lost", "disqualified"].includes(q.lead_stage)
      );
    } else if (leadStatusFilter === "inactive") {
      // Inactive: show only quotations linked to closed leads (won/lost/disqualified)
      filteredByLeadStatus = allQuotations.filter(
        (q) =>
          q.lead_stage && ["won", "lost", "disqualified"].includes(q.lead_stage)
      );
    }
    const filtered = filterData(filteredByLeadStatus, searchValue);
    return sortData(filtered, getSortValue);
  }, [
    allQuotations,
    searchValue,
    filterData,
    sortData,
    getSortValue,
    leadStatusFilter,
  ]);

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

  // Fetch modal data when modal opens - fetch in parallel for speed
  const fetchModalData = useCallback(async () => {
    setIsLoadingModalData(true);
    try {
      // Fetch all data in parallel for faster loading
      const [leadsRes, projectsRes, templatesRes] = await Promise.all([
        // Fetch leads - filter by stage on server if supported, otherwise filter locally
        fetch(
          "/api/sales/leads?limit=100&stages=proposal_discussion,negotiation"
        ),
        // Fetch projects in execution stage only
        fetch("/api/projects?status=execution&limit=100"),
        // Fetch only active templates
        fetch("/api/quotations/templates?status=active"),
      ]);

      // Process leads
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        // Filter to only proposal_discussion and negotiation stages (in case API doesn't filter)
        const eligibleLeads = (leadsData.leads || []).filter((l: Lead) =>
          ["proposal_discussion", "negotiation"].includes(l.stage)
        );
        setLeads(eligibleLeads);
      }

      // Process projects
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData.projects || []);
      }

      // Process templates
      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        // Double-check is_active in case API doesn't filter properly
        const activeTemplates = (templatesData.templates || []).filter(
          (t: Template) => t.is_active !== false
        );
        setTemplates(activeTemplates);
      }
    } catch (err) {
      console.error("Error fetching modal data:", err);
    } finally {
      setIsLoadingModalData(false);
    }
  }, []);

  // Open create modal
  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setSelectedLeadId("");
    setSelectedProjectId("");
    setSelectedTemplateId("");
    setCreateSource("lead");
    fetchModalData();
  };

  // Create quotation
  const handleCreateQuotation = async () => {
    // For lead/project source, require selection
    if (createSource === "lead" && !selectedLeadId) {
      alert("Please select a lead");
      return;
    }
    if (createSource === "project" && !selectedProjectId) {
      alert("Please select a project");
      return;
    }

    setIsCreating(true);
    try {
      const payload: Record<string, string> = {};
      if (createSource === "lead" && selectedLeadId) {
        payload.lead_id = selectedLeadId;
      } else if (createSource === "project" && selectedProjectId) {
        payload.project_id = selectedProjectId;
      }
      // For standalone, we don't add lead_id or project_id
      if (selectedTemplateId) {
        payload.template_id = selectedTemplateId;
      }

      const response = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create quotation");
      }

      const data = await response.json();
      setShowCreateModal(false);
      router.push(`/dashboard/quotations/${data.quotation.id}/edit`);
    } catch (err) {
      console.error("Error creating quotation:", err);
      alert(err instanceof Error ? err.message : "Failed to create quotation");
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = allQuotations.length;
    const draft = allQuotations.filter((q) => q.status === "draft").length;
    const sent = allQuotations.filter((q) => q.status === "sent").length;
    const pipelineValue = allQuotations
      .filter((q) => q.status === "draft")
      .reduce((sum, q) => sum + (q.grand_total || 0), 0);

    // Count by status for filter badges
    const statusCounts = allQuotations.reduce((acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, draft, sent, pipelineValue, statusCounts };
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

    // Filter out quotations with closed leads
    const validIds = ids.filter((id) => {
      const quotation = allQuotations.find((q) => q.id === id);
      if (!quotation) return false;
      const isLeadClosed =
        quotation.lead_stage &&
        ["won", "lost", "disqualified"].includes(quotation.lead_stage);
      return !isLeadClosed;
    });

    if (validIds.length === 0) {
      alert(
        "Cannot change status for selected quotations - all leads are closed (won/lost/disqualified)"
      );
      return;
    }

    if (validIds.length < ids.length) {
      const skipped = ids.length - validIds.length;
      if (
        !confirm(
          `${skipped} quotation(s) will be skipped (closed leads). Continue with ${validIds.length} quotation(s)?`
        )
      ) {
        return;
      }
    } else {
      const confirmed = confirm(
        `Are you sure you want to mark ${validIds.length} quotation(s) as ${newStatus}?`
      );
      if (!confirmed) return;
    }

    try {
      await Promise.all(
        validIds.map((id) =>
          fetch(`/api/quotations/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );
      await fetchQuotations();
      setSelectedIds(new Set());
      alert(
        `Successfully updated ${validIds.length} quotation(s) to ${newStatus}`
      );
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
      render: (quotation) => {
        const isLeadClosed =
          quotation.lead_stage &&
          ["won", "lost", "disqualified"].includes(quotation.lead_stage);
        return (
          <input
            type="checkbox"
            checked={selectedIds.has(quotation.id)}
            onChange={(e) => {
              e.stopPropagation();
              handleSelectOne(quotation.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={isLeadClosed}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isLeadClosed ? "Cannot change status - lead is closed" : ""}
          />
        );
      },
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
      key: "spaces",
      header: "Details",
      width: "9%",
      render: (quotation) => (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span title="Spaces">
            <span className="font-medium text-slate-700">
              {quotation.spaces_count || 0}
            </span>{" "}
            Spaces
          </span>
          <span title="Components">
            <span className="font-medium text-slate-700">
              {quotation.components_count || 0}
            </span>{" "}
            Items
          </span>
        </div>
      ),
    },
    {
      key: "linked_to",
      header: "Linked To",
      width: "9%",
      render: (quotation) => {
        if (quotation.lead_id) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
              Lead
            </span>
          );
        }
        if (quotation.project_id) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 text-purple-700">
              Project
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-500">
            Standalone
          </span>
        );
      },
    },
    {
      key: "grand_total",
      header: "Amount",
      width: "10%",
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
          {/* Only show Revise button if lead is not closed (won/lost/disqualified) */}
          {(!quotation.lead_stage ||
            !["won", "lost", "disqualified"].includes(
              quotation.lead_stage
            )) && (
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

  return (
    <PageLayout>
      <PageHeader
        title="Quotation Management"
        breadcrumbs={[{ label: "Quotations" }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/quotations/templates")}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm font-medium"
            >
              <DocumentTextIcon className="w-4 h-4" />
              Templates
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4" />
              Create Quotation
            </button>
          </div>
        }
        stats={
          <>
            <StatBadge label="Total" value={stats.total} color="slate" />
            <StatBadge label="Draft" value={stats.draft} color="slate" />
            <StatBadge label="Sent" value={stats.sent} color="green" />
            <StatBadge
              label="Draft Value"
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

        {/* Toolbar with Search and Filters */}
        <div className="mb-4 flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search by client, property, quotation number..."
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
            onChange={(e) =>
              setStatusFilter(e.target.value as QuotationStatus | "")
            }
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({stats.statusCounts[opt.value] || 0})
              </option>
            ))}
          </select>

          {/* Lead Status Filter Dropdown */}
          <select
            value={leadStatusFilter}
            onChange={(e) =>
              setLeadStatusFilter(e.target.value as "active" | "inactive")
            }
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
          >
            <option value="active">Active Leads</option>
            <option value="inactive">Inactive Leads</option>
          </select>
        </div>

        <AppTable
          data={processedQuotations}
          columns={columns}
          keyExtractor={(q) => q.id}
          isLoading={isLoading}
          showToolbar={false}
          sortable={true}
          sortState={sortState}
          onSort={handleSort}
          onRowClick={(quotation) =>
            router.push(`/dashboard/quotations/${quotation.id}`)
          }
          emptyState={{
            title: "No quotations found",
            description:
              statusFilter || searchValue
                ? "No quotations match your filters. Try a different filter."
                : "Click 'Create Quotation' to create a new quotation for a lead or project.",
            icon: <DocumentTextIcon className="w-6 h-6 text-slate-400" />,
          }}
        />
      </PageContent>

      {/* Create Quotation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowCreateModal(false)}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg transform transition-all">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">
                  Create New Quotation
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-4 space-y-4">
                {isLoadingModalData ? (
                  <div className="py-8 text-center text-slate-500">
                    Loading...
                  </div>
                ) : (
                  <>
                    {/* Source Selection */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Create quotation for
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setCreateSource("lead");
                            setSelectedProjectId("");
                          }}
                          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                            createSource === "lead"
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Lead
                        </button>
                        <button
                          onClick={() => {
                            setCreateSource("project");
                            setSelectedLeadId("");
                          }}
                          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                            createSource === "project"
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Project
                        </button>
                        <button
                          onClick={() => {
                            setCreateSource("standalone");
                            setSelectedLeadId("");
                            setSelectedProjectId("");
                          }}
                          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                            createSource === "standalone"
                              ? "bg-slate-700 border-slate-700 text-white"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Standalone
                        </button>
                      </div>
                    </div>

                    {/* Lead Selection */}
                    {createSource === "lead" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Select Lead <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={selectedLeadId}
                          onChange={(e) => setSelectedLeadId(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        >
                          <option value="">Choose a lead...</option>
                          {leads.map((lead) => {
                            // Get client name from client relationship or fallback to direct field
                            const clientName =
                              lead.client?.name ||
                              lead.client_name ||
                              "No client";
                            // Get property name from property relationship or fallback
                            const propertyName =
                              lead.property?.property_name ||
                              lead.property?.unit_number ||
                              lead.property_name;
                            return (
                              <option key={lead.id} value={lead.id}>
                                {lead.lead_number} - {clientName}
                                {propertyName ? ` (${propertyName})` : ""}
                              </option>
                            );
                          })}
                        </select>
                        {leads.length === 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            No leads in Proposal Discussion or Negotiation stage
                          </p>
                        )}
                      </div>
                    )}

                    {/* Project Selection */}
                    {createSource === "project" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Select Project <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={selectedProjectId}
                          onChange={(e) => setSelectedProjectId(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        >
                          <option value="">Choose a project...</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.project_number} - {project.name}
                              {project.client_name
                                ? ` (${project.client_name})`
                                : ""}
                            </option>
                          ))}
                        </select>
                        {projects.length === 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            No projects in Execution stage
                          </p>
                        )}
                      </div>
                    )}

                    {/* Standalone Info */}
                    {createSource === "standalone" && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">
                            Standalone quotation
                          </span>{" "}
                          — This quotation will not be linked to any lead or
                          project. You can add client and property details
                          manually in the quotation editor.
                        </p>
                      </div>
                    )}

                    {/* Template Selection (Optional) */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Load from Template{" "}
                        <span className="text-slate-400 font-normal">
                          (optional)
                        </span>
                      </label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      >
                        <option value="">Start from scratch</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                            {template.spaces_count
                              ? ` (${template.spaces_count} spaces, ${
                                  template.components_count || 0
                                } components)`
                              : ""}
                          </option>
                        ))}
                      </select>
                      {templates.length === 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          No templates available.{" "}
                          <button
                            onClick={() =>
                              router.push("/dashboard/quotations/templates/new")
                            }
                            className="text-blue-600 hover:underline"
                          >
                            Create one
                          </button>
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateQuotation}
                  disabled={
                    isCreating ||
                    (createSource === "lead" && !selectedLeadId) ||
                    (createSource === "project" && !selectedProjectId) ||
                    (createSource === "standalone" && isLoadingModalData)
                  }
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Quotation"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
