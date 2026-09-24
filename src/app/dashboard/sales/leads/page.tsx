"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import type {
  Lead,
} from "@/types/leads";
import {
  LeadActivityTypeLabels,
  LeadStageLabels as StageLabels,
  LeadSourceLabels,
  ServiceTypeLabels,
} from "@/types/leads";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/components/ui/PageLayout";
import {
  useAppTableSort,
  useAppTablePagination,
  useAppTableSearch,
} from "@/components/ui/AppTable";
import { uiLogger } from "@/lib/logger";
import { LeadsTable } from "@/modules/sales/components";
import { ListFilterBar, MultiSelectFilter } from "@/components/ui/ListFilterBar";
import ReferrerFilter from "@/components/leads/ReferrerFilter";
import {
  UserGroupIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import {
  ACTIVE_STAGES,
  PRIORITY_ORDER,
  PRIORITY_LABELS,
  BUDGET_ORDER,
  getLeadStatusLabel,
  type TeamMember,
} from "@/modules/sales/constants/leadsConstants";


import { CreateLeadModal } from "@/modules/sales/components/CreateLeadModal";

export default function LeadsPage() {
  const router = useRouter();
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * Source, who referred it, and what we are selling.
   *
   * The list could be narrowed by status alone, on a business where more than
   * 95% of leads arrive as referrals - so "how is JustDial doing against the
   * architects" and "what has Naveen sent us" were both unanswerable from the
   * screen that exists to answer them. Empty means no filter, which is why the
   * default is empty rather than every value selected: a filter nobody has
   * touched should not need to know the full list to be a no-op.
   */
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [referrerId, setReferrerId] = useState<string>("");
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
        // The two signal columns are searchable too, or the list would show
        // text the search box cannot find.
        lead.last_activity_detail, // What the last activity actually said
        lead.last_activity_type, // e.g. note_added
        lead.last_activity_type
          ? LeadActivityTypeLabels[lead.last_activity_type]
          : null, // e.g. "Note Added"
        formatDateForSearch(lead.last_activity_at),
        formatDateForSearch(lead.next_follow_up_at),
        // The column lists task titles and note openings now, so searching
        // "site visit" should find the lead that has one due.
        ...(lead.upcoming_items || []).map((i) => i.label),
        ...(lead.upcoming_items || []).map((i) => formatDateForSearch(i.at)),
        // Lets "overdue" and "today" find the leads the column marks as such,
        // since those words are rendered rather than stored.
        followUpKeywords(lead.next_follow_up_at),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(term);

      /**
       * The Follow-up column renders "Overdue" or "Today" instead of a date,
       * so those words must be searchable even though no field contains them.
       */
      function followUpKeywords(dateString: string | null | undefined) {
        if (!dateString) return "";
        const today = new Date().toISOString().slice(0, 10);
        const due = dateString.slice(0, 10);
        if (due < today) return "overdue";
        if (due === today) return "today";
        return "upcoming";
      }

      // Helper to format date for search
      function formatDateForSearch(dateString: string | null | undefined) {
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

    if (selectedSources.length) {
      result = result.filter((lead) => lead.lead_source && selectedSources.includes(lead.lead_source));
    }
    if (selectedServices.length) {
      result = result.filter((lead) => lead.service_type && selectedServices.includes(lead.service_type));
    }
    if (referrerId) {
      result = result.filter((lead) => lead.referred_by_partner_id === referrerId);
    }

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
          case "next_follow_up_at": {
            // The column is sortable and had no case here, so it fell through
            // to "" and every row compared equal - clicking the header did
            // nothing. Sorts by whatever is actually due soonest, which is now
            // a task as often as a follow-up, and puts leads with nothing
            // pending last rather than first.
            const soonest =
              item.upcoming_items?.[0]?.at || item.next_follow_up_at;
            return soonest ? new Date(soonest).getTime() : Infinity;
          }
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
    selectedSources,
    selectedServices,
    referrerId,
    searchValue,
    filterData,
    sortData,
    sortState.column,
  ]);

  // Pagination
  const { paginatedData, pagination, setPage, setPageSize } =
    useAppTablePagination(processedLeads, 25);


  // Format helpers - using useCallback for stable references



  // Column definitions
  // The column definitions live in LeadsTable, which owns its own columns and
  // takes no `columns` prop. A second, unused copy used to sit here - edits to
  // it silently did nothing.

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
            {/* One line, the shared bar - the module's own copy predated
                components/ui/ListFilterBar and was the drift this file's notes
                already named. */}
            <ListFilterBar
              searchValue={searchValue}
              onSearchChange={(value) => {
                setSearchValue(value);
                setPage(1);
              }}
              searchPlaceholder="Search by name, email, property..."
            >
              <MultiSelectFilter
                label="Status"
                options={[
                  { value: "active", label: "Active" },
                  { value: "won", label: "Won" },
                  { value: "lost", label: "Lost" },
                  { value: "disqualified", label: "Disqualified" },
                ]}
                selected={selectedStatuses}
                onChange={(v) => {
                  setSelectedStatuses(v);
                  setPage(1);
                }}
              />
              <MultiSelectFilter
                label="Source"
                options={Object.entries(LeadSourceLabels).map(([value, label]) => ({ value, label: String(label) }))}
                selected={selectedSources}
                onChange={(v) => {
                  setSelectedSources(v);
                  setPage(1);
                }}
              />
              <MultiSelectFilter
                label="Service"
                options={Object.entries(ServiceTypeLabels).map(([value, label]) => ({ value, label: String(label) }))}
                selected={selectedServices}
                onChange={(v) => {
                  setSelectedServices(v);
                  setPage(1);
                }}
              />
              {/* A SearchSelect, not a dropdown: this grows with every architect
                  and customer on the books, and it is the filter that answers
                  "what has Naveen sent us". */}
              <ReferrerFilter
                value={referrerId}
                onChange={(v) => {
                  setReferrerId(v);
                  setPage(1);
                }}
              />
            </ListFilterBar>

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
