"use client";

import React, { useMemo, useCallback } from "react";
import {
  LastActivityCell,
  FollowUpCell,
} from "@/components/leads/activity-cells";
import { Lead, LeadStage } from "@/types/leads";
import {
  LeadStageLabels as StageLabels,
  LeadStageColors as StageColors,
  BudgetRangeLabels,
  LeadActivityTypeLabels,
} from "@/types/leads";
import { AppTable, type ColumnDef } from "@/components/ui/AppTable";

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
        width: "15%",
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
        width: "10%",
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
        width: "10%",
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
            if (stage === "disqualified") return "bg-slate-100 text-slate-700";
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
      //
      // The column carries the three most recent entries rather than one. When
      // something last happened tells you little on its own - three notes this
      // week reads as momentum, one in April reads as abandoned, and the same
      // "5d ago" label sits on top of both.
      {
        key: "last_activity_at",
        header: "Last Activity",
        width: "17%",
        sortable: true,
        render: (lead) => (
          <LastActivityCell
            at={lead.last_activity_at}
            type={lead.last_activity_type}
            detail={lead.last_activity_detail}
            recent={lead.recent_activities}
            labels={LeadActivityTypeLabels as Record<string, string>}
          />
        ),
      },

      {
        key: "next_follow_up_at",
        header: "Follow-up",
        // Widened from 9%: it now carries what is due rather than only when.
        width: "14%",
        sortable: true,
        render: (lead) => (
          <FollowUpCell
            items={lead.upcoming_items}
            fallbackAt={lead.next_follow_up_at}
          />
        ),
      },
    ],
    [getInitials]
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
