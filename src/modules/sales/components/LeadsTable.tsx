"use client";

import React, { useMemo, useCallback } from "react";
import { Lead, LeadStage } from "@/types/leads";
import {
  LeadStageLabels as StageLabels,
  LeadStageColors as StageColors,
  BudgetRangeLabels,
  LeadActivityTypeLabels,
} from "@/types/leads";
import { AppTable, type ColumnDef } from "@/components/ui/AppTable";
import { CalendarIcon } from "@heroicons/react/24/outline";

const ACTIVE_STAGES: LeadStage[] = [
  "new",
  "qualified",
  "requirement_discussion",
  "proposal_discussion",
];

interface LeadsTableProps {
  data: Lead[];
  sortState: any;
  onSort: (column: string) => void;
  pagination: any;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRowClick: (lead: Lead) => void;
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
  };
  stickyHeader?: boolean;
}

export function LeadsTable({
  data,
  sortState,
  onSort,
  pagination,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  emptyState,
  stickyHeader,
}: LeadsTableProps) {
  /**
   * dd-mm-yy, matching the notes table. Built from the parts rather than a
   * locale format so the padding is stable - en-IN gives "4/9/26", which does
   * not line up in a column.
   */
  const shortDate = useCallback((iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${pad(
      d.getFullYear() % 100
    )}`;
  }, []);

  /** Whole days between then and now. Null when there is no date at all. */
  const daysSince = useCallback((dateString?: string | null) => {
    if (!dateString) return null;
    const then = new Date(dateString).getTime();
    if (Number.isNaN(then)) return null;
    return Math.max(0, Math.floor((Date.now() - then) / 86400000));
  }, []);

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
        width: "16%",
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
        width: "11%",
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
        width: "9%",
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
        width: "11%",
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
        width: "8%",
        sortable: true,
        render: (lead) => {
          const getStatusLabel = (stage: LeadStage) => {
            if (ACTIVE_STAGES.includes(stage)) return "Active";
            if (stage === "won") return "Won";
            if (stage === "lost") return "Lost";
            if (stage === "disqualified") return "Disqualified";
            return stage;
          };

          const getStatusBgColor = (stage: LeadStage) => {
            if (ACTIVE_STAGES.includes(stage))
              return "bg-blue-100 text-blue-700";
            if (stage === "won") return "bg-green-100 text-green-700";
            if (stage === "lost") return "bg-red-100 text-red-700";
            if (stage === "disqualified") return "bg-gray-100 text-gray-700";
            return "bg-slate-100 text-slate-700";
          };

          return (
            <span
              className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBgColor(
                lead.stage
              )}`}
            >
              {getStatusLabel(lead.stage)}
            </span>
          );
        },
      },

      {
        key: "priority",
        header: "Priority",
        width: "7%",
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
        width: "10%",
        sortable: true,
        render: (lead) => {
          const displayUser = lead.assigned_user || lead.created_user;

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

      // Replaces the Created Date column. A creation date never changes and
      // says nothing about whether a lead needs attention; recency of contact
      // does. Both fields below are already maintained on the leads table.
      {
        key: "last_activity_at",
        header: "Last Activity",
        width: "19%",
        sortable: true,
        render: (lead) => {
          const days = daysSince(lead.last_activity_at);

          // Three bands only: green means acted on, orange means going cold,
          // red means abandoned. More gradations than that stop reading as a
          // signal and start reading as decoration.
          const { label, tone } =
            days === null
              ? { label: "Never", tone: "text-red-600" }
              : days === 0
              ? { label: "Today", tone: "text-emerald-600" }
              : days === 1
              ? { label: "Yesterday", tone: "text-emerald-600" }
              : days <= 15
              ? { label: `${days}d ago`, tone: "text-orange-600" }
              : { label: `${days}d ago`, tone: "text-red-600" };

          return (
            <div>
              <p className={`text-sm font-medium ${tone}`}>{label}</p>
              {/* The activity's own words where we have them - "Budget range:
                  5L-10L → 10L-15L" tells a seller far more than "Lead
                  Updated". The type label is the fallback.

                  Wrapped and shown in full, never cropped: a seller reading
                  this column needs the whole context, and half a sentence is
                  worse than none. Long entries make the row taller rather than
                  widening the column. */}
              {(lead.last_activity_detail || lead.last_activity_type) && (
                <p
                  className="text-xs text-slate-500 break-words whitespace-normal leading-snug"
                  title={
                    lead.last_activity_detail
                      ? `${
                          lead.last_activity_type
                            ? LeadActivityTypeLabels[lead.last_activity_type] ||
                              lead.last_activity_type
                            : "Activity"
                        } — ${lead.last_activity_detail}`
                      : undefined
                  }
                >
                  {lead.last_activity_detail ||
                    LeadActivityTypeLabels[lead.last_activity_type!] ||
                    lead.last_activity_type}
                </p>
              )}
            </div>
          );
        },
      },

      {
        key: "next_follow_up_at",
        header: "Follow-up",
        width: "9%",
        sortable: true,
        render: (lead) => {
          if (!lead.next_follow_up_at) {
            return <span className="text-sm text-slate-300">—</span>;
          }
          const today = new Date().toISOString().slice(0, 10);
          const due = lead.next_follow_up_at.slice(0, 10);
          // Same red / amber / slate coding as the follow-up filters on the
          // notes table, so the two read the same way.
          if (due < today) {
            const over = daysSince(lead.next_follow_up_at) ?? 0;
            return (
              <div>
                <p className="text-sm font-medium text-red-600">Overdue</p>
                <p className="text-xs text-red-500">{over}d late</p>
              </div>
            );
          }
          if (due === today) {
            return <p className="text-sm font-medium text-amber-600">Today</p>;
          }
          return (
            <p className="text-sm text-slate-700 tabular-nums">
              {shortDate(lead.next_follow_up_at)}
            </p>
          );
        },
      },
    ],
    [formatDate, daysSince, shortDate, getInitials]
  );

  return (
    <AppTable
      // Without table-fixed the browser uses auto layout, where the column
      // widths above are only hints - a long activity description stretches
      // its column and squeezes the rest. Fixed layout makes the percentages
      // authoritative, so long text wraps within its column instead.
      className="table-fixed"
      data={data}
      columns={columns}
      keyExtractor={(lead) => lead.id}
      showToolbar={false}
      searchValue=""
      onSearchChange={() => {}}
      searchPlaceholder=""
      tabs={[]}
      activeTab=""
      onTabChange={() => {}}
      sortable={true}
      sortState={sortState}
      onSort={onSort}
      pagination={pagination}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onRowClick={onRowClick}
      emptyState={
        emptyState || {
          icon: null,
          title: "No leads found",
          description: "Try adjusting your search or filters",
        }
      }
      stickyHeader={stickyHeader ?? true}
    />
  );
}
