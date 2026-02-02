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
import { CreateQuotationModal } from "@/components/quotations/CreateQuotationModal";
import {
  QUOTATION_STATUS_OPTIONS,
  ACTIVE_QUOTATION_STATUSES,
} from "@/utils/quotations";

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

// Status options for bulk updates (exclude auto-set statuses)
const STATUS_OPTIONS = QUOTATION_STATUS_OPTIONS.filter(
  (opt) => opt.value !== "linked_to_project" && opt.value !== "project_baseline"
);

// Allowed status filter options for list view display
const ALLOWED_STATUS_FILTER_OPTIONS = QUOTATION_STATUS_OPTIONS.filter((opt) =>
  [
    "draft",
    "sent",
    "negotiating",
    "approved",
    "project_baseline",
    "rejected",
    "cancelled",
  ].includes(opt.value)
);

// Active statuses constant
const ACTIVE_STATUSES = ACTIVE_QUOTATION_STATUSES;

export default function QuotationsListPage() {
  const router = useRouter();
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadStatuses, setSelectedLeadStatuses] = useState<
    Set<"active" | "inactive">
  >(new Set(["active"] as ("active" | "inactive")[]));

  // Filter states - multi-select for status filter
  const [selectedStatuses, setSelectedStatuses] = useState<
    Set<QuotationStatus>
  >(
    new Set([
      "draft",
      "sent",
      "negotiating",
      "approved",
      "project_baseline",
    ] as QuotationStatus[])
  );
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showLeadStatusDropdown, setShowLeadStatusDropdown] = useState(false);

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

      // Apply status filter (multi-select)
      if (selectedStatuses.size > 0) {
        filtered = filtered.filter((q) => selectedStatuses.has(q.status));
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
    [selectedStatuses]
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
          "negotiating",
          "approved",
          "rejected",
          "expired",
        ];
        return statusOrder.indexOf(item.status);
      case "valid_until":
        return item.created_at ? new Date(item.created_at) : null;
      case "created_at":
      default:
        return item.created_at ? new Date(item.created_at) : null;
    }
  }, []);

  // Process data: filter -> sort
  const processedQuotations = useMemo(() => {
    // Filter based on lead status filter
    let filteredByLeadStatus = allQuotations;
    if (selectedLeadStatuses.has("active")) {
      // Active: exclude quotations linked to closed leads (won/lost/disqualified)
      const activeQuotations = allQuotations.filter(
        (q) =>
          !q.lead_stage ||
          !["won", "lost", "disqualified"].includes(q.lead_stage)
      );

      if (selectedLeadStatuses.has("inactive")) {
        // Both selected: show all
        filteredByLeadStatus = allQuotations;
      } else {
        // Only active selected
        filteredByLeadStatus = activeQuotations;
      }
    } else if (selectedLeadStatuses.has("inactive")) {
      // Only inactive selected: show only quotations linked to closed leads
      filteredByLeadStatus = allQuotations.filter(
        (q) =>
          q.lead_stage && ["won", "lost", "disqualified"].includes(q.lead_stage)
      );
    }

    // Filter by selected statuses from dropdown (no hard-coded filter)
    const filteredByStatus = filteredByLeadStatus.filter((q) =>
      selectedStatuses.has(q.status)
    );

    const filtered = filterData(filteredByStatus, searchValue);
    return sortData(filtered, getSortValue);
  }, [
    allQuotations,
    searchValue,
    filterData,
    sortData,
    getSortValue,
    selectedLeadStatuses,
    selectedStatuses,
  ]);

  // Fetch quotations
  const fetchQuotations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Determine lead_status parameter: if both selected, use "all", else use specific status
      const leadStatusParam =
        selectedLeadStatuses.has("active") &&
        selectedLeadStatuses.has("inactive")
          ? "all"
          : selectedLeadStatuses.has("inactive")
          ? "inactive"
          : "active";

      const response = await fetch(
        `/api/quotations?lead_status=${leadStatusParam}`
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
  }, [selectedLeadStatuses]);

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
  const handleCreateQuotation = async (data?: {
    source: "lead" | "project" | "standalone";
    leadId?: string;
    projectId?: string;
    templateId?: string;
  }) => {
    const leadId = data?.leadId || selectedLeadId;
    const projectId = data?.projectId || selectedProjectId;
    const templateId = data?.templateId || selectedTemplateId;
    const source = data?.source || createSource;

    // For lead/project source, require selection
    if (source === "lead" && !leadId) {
      alert("Please select a lead");
      return;
    }
    if (source === "project" && !projectId) {
      alert("Please select a project");
      return;
    }

    setIsCreating(true);
    try {
      const payload: Record<string, string> = {};
      if (source === "lead" && leadId) {
        payload.lead_id = leadId;
      } else if (source === "project" && projectId) {
        payload.project_id = projectId;
      }
      // For standalone, we don't add lead_id or project_id
      if (templateId) {
        payload.template_id = templateId;
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

  // Handle URL parameters to auto-open create modal
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const shouldCreate = searchParams.get("create") === "true";
    const leadId = searchParams.get("lead_id");

    if (shouldCreate && !showCreateModal) {
      setShowCreateModal(true);
      setCreateSource("lead");
      fetchModalData(); // Fetch leads, projects, and templates
      // Clear the URL parameters
      window.history.replaceState({}, "", "/dashboard/quotations");
    }
  }, [showCreateModal, fetchModalData]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = allQuotations.length;
    const draft = allQuotations.filter((q) => q.status === "draft").length;
    const sent = allQuotations.filter((q) => q.status === "sent").length;

    // Get only latest version of each quotation (by quotation_number)
    const latestQuotations = new Map<string, Quotation>();
    allQuotations.forEach((q) => {
      const key = q.quotation_number;
      const existing = latestQuotations.get(key);
      if (
        !existing ||
        (q.version && existing.version && q.version > existing.version)
      ) {
        latestQuotations.set(key, q);
      }
    });

    const pipelineValue = Array.from(latestQuotations.values())
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
          !!quotation.lead_stage &&
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
      header: "Created At",
      width: "10%",
      sortable: true,
      render: (quotation) => (
        <div>
          <p className="text-sm text-slate-700">
            {formatDate(quotation.created_at)}
          </p>
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

          {/* Status Filter Dropdown with Checkboxes */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer hover:bg-slate-50 flex items-center gap-2"
            >
              Status Filter ({selectedStatuses.size})
              <svg
                className={`w-4 h-4 transition-transform ${
                  showStatusDropdown ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </button>

            {showStatusDropdown && (
              <>
                {/* Overlay to close dropdown */}
                <div
                  className="fixed inset-0"
                  style={{ zIndex: 998 }}
                  onClick={() => setShowStatusDropdown(false)}
                />

                {/* Dropdown Menu - Fixed positioning to float above everything */}
                <div
                  className="fixed bg-white border border-slate-200 rounded-lg shadow-2xl min-w-max p-2 max-h-96 overflow-y-auto"
                  style={{
                    zIndex: 999,
                    top: "140px",
                    left: "540px",
                    maxWidth: "350px",
                  }}
                >
                  {/* Select All / Deselect All */}
                  <div className="px-3 py-2 border-b border-slate-200 mb-2">
                    <button
                      onClick={() => {
                        if (
                          selectedStatuses.size ===
                          ALLOWED_STATUS_FILTER_OPTIONS.length
                        ) {
                          setSelectedStatuses(new Set());
                        } else {
                          setSelectedStatuses(
                            new Set(
                              ALLOWED_STATUS_FILTER_OPTIONS.map(
                                (opt) => opt.value
                              )
                            )
                          );
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {selectedStatuses.size ===
                      ALLOWED_STATUS_FILTER_OPTIONS.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>

                  {/* Status Options */}
                  {ALLOWED_STATUS_FILTER_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStatuses.has(opt.value)}
                        onChange={(e) => {
                          const newStatuses = new Set(selectedStatuses);
                          if (e.target.checked) {
                            newStatuses.add(opt.value);
                          } else {
                            newStatuses.delete(opt.value);
                          }
                          setSelectedStatuses(newStatuses);
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-700">
                        {opt.label} ({stats.statusCounts[opt.value] || 0})
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Lead Status Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLeadStatusDropdown(!showLeadStatusDropdown)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer hover:bg-slate-50 flex items-center gap-2"
            >
              Lead Status ({selectedLeadStatuses.size})
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {showLeadStatusDropdown && (
              <>
                <div
                  className="fixed inset-0"
                  style={{ zIndex: 998 }}
                  onClick={() => setShowLeadStatusDropdown(false)}
                />
                <div
                  className="fixed bg-white border border-slate-200 rounded-lg shadow-2xl p-2"
                  style={{
                    zIndex: 999,
                    top: "140px",
                    left: "630px",
                    minWidth: "200px",
                  }}
                >
                  {/* Select All / Deselect All */}
                  <button
                    onClick={() => {
                      if (selectedLeadStatuses.size === 2) {
                        setSelectedLeadStatuses(new Set());
                      } else {
                        setSelectedLeadStatuses(
                          new Set(["active", "inactive"] as (
                            | "active"
                            | "inactive"
                          )[])
                        );
                      }
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 rounded font-medium mb-1"
                  >
                    {selectedLeadStatuses.size === 2
                      ? "Deselect All"
                      : "Select All"}
                  </button>

                  <div className="border-t border-slate-200 my-1" />

                  {/* Active Leads */}
                  <label className="flex items-center px-3 py-2 hover:bg-slate-100 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLeadStatuses.has("active")}
                      onChange={(e) => {
                        const newStatuses = new Set(selectedLeadStatuses);
                        if (e.target.checked) {
                          newStatuses.add("active");
                        } else {
                          newStatuses.delete("active");
                        }
                        setSelectedLeadStatuses(newStatuses);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="ml-3 text-sm text-slate-700 flex-1">
                      Active
                    </span>
                    <span className="text-xs text-slate-500">
                      {
                        allQuotations.filter(
                          (q) =>
                            !q.lead_stage ||
                            !["won", "lost", "disqualified"].includes(
                              q.lead_stage
                            )
                        ).length
                      }
                    </span>
                  </label>

                  {/* Inactive Leads */}
                  <label className="flex items-center px-3 py-2 hover:bg-slate-100 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLeadStatuses.has("inactive")}
                      onChange={(e) => {
                        const newStatuses = new Set(selectedLeadStatuses);
                        if (e.target.checked) {
                          newStatuses.add("inactive");
                        } else {
                          newStatuses.delete("inactive");
                        }
                        setSelectedLeadStatuses(newStatuses);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="ml-3 text-sm text-slate-700 flex-1">
                      Inactive
                    </span>
                    <span className="text-xs text-slate-500">
                      {
                        allQuotations.filter(
                          (q) =>
                            q.lead_stage &&
                            ["won", "lost", "disqualified"].includes(
                              q.lead_stage
                            )
                        ).length
                      }
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>
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
              selectedStatuses.size < ALLOWED_STATUS_FILTER_OPTIONS.length ||
              searchValue
                ? "No quotations match your filters. Try a different filter."
                : "Click 'Create Quotation' to create a new quotation for a lead or project.",
            icon: <DocumentTextIcon className="w-6 h-6 text-slate-400" />,
          }}
        />
      </PageContent>

      {/* Create Quotation Modal */}
      <CreateQuotationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (data) => {
          await handleCreateQuotation(data);
        }}
        leads={leads}
        projects={projects}
        templates={templates}
        isLoading={isLoadingModalData}
        isCreating={isCreating}
      />
    </PageLayout>
  );
}
