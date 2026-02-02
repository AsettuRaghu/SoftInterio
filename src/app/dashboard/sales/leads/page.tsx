"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import type {
  Lead,
  LeadStage,
  PropertyType,
  PropertyCategory,
  PropertySubtype,
  ServiceType,
  LeadSource,
  BudgetRange,
} from "@/types/leads";
import {
  LeadStageLabels as StageLabels,
  LeadStageColors as StageColors,
  PropertyTypeLabels as PropLabels,
  PropertyCategoryLabels as CatLabels,
  PropertySubtypeLabels as SubtypeLabels,
  PropertyTypesByCategory,
  PropertySubtypesByCategory,
  ServiceTypeLabels as SvcLabels,
  LeadSourceLabels as SrcLabels,
  BudgetRangeLabels,
} from "@/types/leads";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatBadge,
} from "@/components/ui/PageLayout";
import {
  AppTable,
  useAppTableSort,
  useAppTablePagination,
  useAppTableSearch,
  type ColumnDef,
  type FilterOption,
} from "@/components/ui/AppTable";
import { uiLogger } from "@/lib/logger";
import { LeadsFilterBar, LeadsTable } from "@/modules/sales/components";
import {
  UserGroupIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  XMarkIcon,
  CalendarIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import {
  ACTIVE_STAGES,
  STAGE_TABS,
  BUDGET_OPTIONS,
  PRIORITY_ORDER,
  PRIORITY_LABELS,
  BUDGET_ORDER,
  getLeadStatusLabel,
  getLeadStatusColor,
  type TeamMember,
} from "@/modules/sales/constants/leadsConstants";
import {
  InlineDateEditor,
  InlineBudgetEditor,
} from "@/modules/sales/components/InlineEditors";
import { CreateLeadModal } from "@/modules/sales/components/CreateLeadModal";

export default function LeadsPage() {
  const router = useRouter();
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    "active",
  ]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<Lead>();
  const { searchValue, setSearchValue } = useAppTableSearch<Lead>([]);

  // Custom filter function for searching nested client/property data
  const filterData = useCallback((data: Lead[], searchTerm: string) => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((lead) => {
      // Search across all visible fields
      const searchableText = [
        lead.client?.name,
        lead.client?.email,
        lead.client?.phone,
        lead.property?.property_name,
        lead.property?.unit_number,
        lead.property?.property_type,
        lead.property?.category,
        lead.service_type,
        lead.lead_source,
        lead.stage, // Stage field (new, qualified, etc.)
        StageLabels[lead.stage], // Stage display label (Proposal & Negotiation, etc.)
        getLeadStatusLabel(lead.stage), // Status label (Active, Won, Lost, Disqualified)
        lead.priority, // Priority field
        PRIORITY_LABELS[lead.priority || "medium"], // Priority label
        lead.assigned_user?.name, // Assigned person name
        lead.created_user?.name, // Created by person name
        formatDateForSearch(lead.created_at), // Created date
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(term);

      // Helper to format date for search
      function formatDateForSearch(dateString: string | null) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    });
  }, []);

  // Fetch ALL leads once
  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: "1", limit: "1000" });

      uiLogger.info("Fetching all leads...", {
        module: "LeadsPage",
        action: "fetch_leads",
      });
      const response = await fetch(`/api/sales/leads?${params}`);
      const data = await response.json();

      if (!response.ok) {
        uiLogger.error("API error fetching leads", data, {
          module: "LeadsPage",
        });
        throw new Error(data.error || "Failed to fetch leads");
      }

      uiLogger.info(`Received ${data.leads?.length || 0} leads`, {
        module: "LeadsPage",
        action: "leads_received",
      });
      setAllLeads(data.leads || []);

      if (data.warning) {
        uiLogger.warn(data.warning, { module: "LeadsPage" });
      }
    } catch (err) {
      uiLogger.error("Error fetching leads", err as Error, {
        module: "LeadsPage",
      });
      setError(err instanceof Error ? err.message : "An error occurred");
      setAllLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch team members for assignee dropdown
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/team/members");
      const data = await response.json();
      // API returns { success: true, data: [...members] }
      if (response.ok && data.success && data.data) {
        setTeamMembers(
          data.data.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchTeamMembers();
  }, [fetchLeads, fetchTeamMembers]);

  // Inline update handler for editable fields
  const handleInlineUpdate = useCallback(
    async (leadId: string, field: string, value: string | number | null) => {
      try {
        uiLogger.info(`Updating lead ${leadId} field ${field}`, {
          module: "LeadsPage",
          action: "inline_update",
        });

        const response = await fetch(`/api/sales/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update");
        }

        // Update local state
        setAllLeads((prev) =>
          prev.map((lead) => {
            if (lead.id !== leadId) return lead;

            // Special handling for assigned_to - update the user object too
            if (field === "assigned_to") {
              const assignedMember = value
                ? teamMembers.find((m) => m.id === value)
                : undefined;
              return {
                ...lead,
                assigned_to: value as string | null,
                assigned_user: assignedMember
                  ? {
                      id: assignedMember.id,
                      name: assignedMember.name,
                      avatar_url: assignedMember.avatar_url || null,
                    }
                  : undefined,
              };
            }

            return { ...lead, [field]: value };
          })
        );

        uiLogger.info(`Successfully updated lead ${leadId}`, {
          module: "LeadsPage",
          action: "inline_update_success",
        });
      } catch (err) {
        uiLogger.error("Error updating lead inline", err as Error, {
          module: "LeadsPage",
        });
        // Optionally show a toast or error message
        throw err; // Re-throw so the inline editor can handle it
      }
    },
    [teamMembers]
  );

  // Process leads: filter by stage, search, sort
  const processedLeads = useMemo(() => {
    let result = [...allLeads];

    // Filter by selected statuses
    result = result.filter((lead) => {
      for (const status of selectedStatuses) {
        if (status === "active") {
          if (ACTIVE_STAGES.includes(lead.stage)) return true;
        } else {
          if (lead.stage === status) return true;
        }
      }
      return false;
    });

    // Apply search
    result = filterData(result, searchValue);

    // Apply sort with custom getValue functions
    if (sortState.column) {
      result = sortData(result, (item, col) => {
        switch (col) {
          case "client_name":
            return item.client?.name || "";
          case "property_name":
            return item.property?.property_name || "";
          case "property_type":
            return item.property?.property_type || "";
          case "target_start_date":
            return item.target_start_date
              ? new Date(item.target_start_date).getTime()
              : 0;
          case "budget_range":
            return item.budget_range ? BUDGET_ORDER[item.budget_range] : 0;
          case "stage":
            return item.stage || "";
          case "priority":
            return PRIORITY_ORDER[item.priority || "medium"] || 0;
          case "assigned_to":
            return item.assigned_user?.name || item.created_user?.name || "";
          case "last_activity_at":
            return item.last_activity_at
              ? new Date(item.last_activity_at).getTime()
              : 0;
          case "created_at":
            return item.created_at ? new Date(item.created_at).getTime() : 0;
          default:
            return "";
        }
      });
    }

    return result;
  }, [
    allLeads,
    selectedStatuses,
    searchValue,
    filterData,
    sortData,
    sortState.column,
  ]);

  // Pagination
  const { paginatedData, pagination, setPage, setPageSize } =
    useAppTablePagination(processedLeads, 25);

  // Calculate tab counts
  const tabsWithCounts: FilterOption[] = useMemo(() => {
    return STAGE_TABS.map((tab) => ({
      ...tab,
      count:
        tab.value === "active"
          ? allLeads.filter((l) => ACTIVE_STAGES.includes(l.stage)).length
          : allLeads.filter((l) => l.stage === tab.value).length,
    }));
  }, [allLeads]);

  // Format helpers - using useCallback for stable references
  const formatDate = useCallback((dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  const getInitials = useCallback((name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, []);

  // Column definitions
  const columns: ColumnDef<Lead>[] = useMemo(
    () => [
      {
        key: "client_name",
        header: "Client",
        width: "18%",
        sortable: true,
        render: (lead) => (
          <div className="space-y-1">
            <p className="font-semibold text-sm text-slate-900">
              {lead.client?.name || "Unknown"}
            </p>
            {lead.client?.email && (
              <p className="text-xs text-slate-500 truncate">
                {lead.client.email}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "property_name",
        header: "Property",
        width: "13%",
        sortable: true,
        render: (lead) => (
          <div>
            {lead.property?.property_name && (
              <p className="text-sm font-medium text-slate-900 truncate">
                {lead.property.property_name}
              </p>
            )}
            {(lead.property?.unit_number || lead.property?.carpet_area) && (
              <p className="text-xs text-slate-500">
                {lead.property?.unit_number &&
                  `Unit: ${lead.property.unit_number}`}
                {lead.property?.unit_number &&
                  lead.property?.carpet_area &&
                  " • "}
                {lead.property?.carpet_area &&
                  `${lead.property.carpet_area} sq.ft`}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "budget_range",
        header: "Budget",
        width: "11%",
        sortable: true,
        render: (lead) => (
          <div className="space-y-0.5">
            {lead.budget_range ? (
              <p className="text-sm text-slate-700">
                {BudgetRangeLabels[lead.budget_range]}
              </p>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </div>
        ),
      },
      {
        key: "stage",
        header: "Stage",
        width: "13%",
        sortable: true,
        render: (lead) => {
          const colors = StageColors[lead.stage];
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
              {StageLabels[lead.stage]}
            </span>
          );
        },
      },

      {
        key: "status",
        header: "Status",
        width: "10%",
        sortable: true,
        render: (lead) => (
          <span
            className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getLeadStatusColor(
              lead.stage
            )}`}
          >
            {getLeadStatusLabel(lead.stage)}
          </span>
        ),
      },

      {
        key: "priority",
        header: "Priority",
        width: "9%",
        sortable: true,
        render: (lead) => {
          const priorityColors: Record<string, string> = {
            low: "bg-slate-100 text-slate-700",
            medium: "bg-yellow-100 text-yellow-700",
            high: "bg-orange-100 text-orange-700",
            urgent: "bg-red-100 text-red-700",
          };

          const priorityLabels: Record<string, string> = {
            low: "Low",
            medium: "Medium",
            high: "High",
            urgent: "Urgent",
          };

          const priority = lead.priority || "medium";
          return (
            <span
              className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                priorityColors[priority] || priorityColors["medium"]
              }`}
            >
              {priorityLabels[priority] || priority}
            </span>
          );
        },
      },

      {
        key: "assigned_to",
        header: "Assigned",
        width: "12%",
        sortable: true,
        render: (lead) => {
          const displayUser = lead.assigned_user || lead.created_user;
          const getInitials = (name: string) =>
            name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

          return (
            <div className="flex items-center gap-2">
              {displayUser ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-[9px] font-medium shrink-0">
                    {getInitials(displayUser.name)}
                  </div>
                  <span className="text-sm text-slate-700 font-medium">
                    {displayUser.name}
                  </span>
                </>
              ) : (
                <span className="text-sm text-slate-400 italic">
                  Unassigned
                </span>
              )}
            </div>
          );
        },
      },

      {
        key: "created_at",
        header: "Created Date",
        width: "11%",
        sortable: true,
        render: (lead) => (
          <div>
            <p className="text-sm text-slate-900 font-medium">
              {formatDate(lead.created_at)}
            </p>
            {lead.created_user && (
              <p className="text-xs text-slate-500">
                by {lead.created_user.name}
              </p>
            )}
          </div>
        ),
      },
    ],
    [handleInlineUpdate, formatDate, teamMembers, fetchLeads]
  );

  return (
    <PageLayout isLoading={isLoading} loadingText="Loading leads...">
      <PageHeader
        title="Leads Management"
        subtitle="Track and manage your sales leads"
        breadcrumbs={[{ label: "Leads" }]}
        basePath={{ label: "Sales", href: "/dashboard/sales" }}
        icon={<UserGroupIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-medium flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Add Lead
          </button>
        }
      />

      <PageContent noPadding>
        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center px-4">
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
              onClick={() => {
                setError(null);
                fetchLeads();
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Filter Bar Component */}
            <LeadsFilterBar
              searchValue={searchValue}
              onSearchChange={(value) => {
                setSearchValue(value);
                setPage(1);
              }}
              selectedStatuses={selectedStatuses}
              onStatusChange={setSelectedStatuses}
            />

            {/* Leads Table Component */}
            <LeadsTable
              data={paginatedData}
              sortState={sortState}
              onSort={handleSort}
              pagination={pagination}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onRowClick={(lead) =>
                router.push(`/dashboard/sales/leads/${lead.id}`)
              }
              emptyState={{
                icon: <UserGroupIcon className="w-6 h-6 text-slate-400" />,
                title: "No leads found",
                description: searchValue
                  ? "Try adjusting your search"
                  : selectedStatuses.length === 0
                  ? "No leads in the selected statuses"
                  : "Create your first lead to get started",
                action:
                  selectedStatuses.includes("active") && !searchValue ? (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      + Add Your First Lead
                    </button>
                  ) : undefined,
              }}
              stickyHeader={true}
            />
          </>
        )}
      </PageContent>

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
    </PageLayout>
  );
}
