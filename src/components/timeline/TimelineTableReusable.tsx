"use client";

import React, { useState, useMemo } from "react";
import { SearchBox } from "@/components/ui/SearchBox";
import {
  ArrowPathIcon,
  ChatBubbleLeftIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  DocumentTextIcon,
  MapPinIcon,
  UserGroupIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface TimelineItem {
  id: string;
  type: "activity" | "stage";
  created_at: string;
  created_by?: string;

  // Activity fields
  activity_type?: string;
  title?: string;
  description?: string | null;
  notes?: string | null;

  // Call fields
  call_duration_seconds?: number | null;
  call_outcome?: string | null;

  // Meeting fields
  meeting_type?: string | null;
  meeting_scheduled_at?: string | null;
  meeting_location?: string | null;
  meeting_completed?: boolean;
  meeting_notes?: string | null;
  attendees?: any[];

  // Email fields
  email_subject?: string | null;

  // Stage change fields
  from_stage?: string | null;
  to_stage?: string | null;

  // User info
  created_user?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
  created_by_user?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
}

interface TimelineTableReusableProps {
  // Data sources
  activities?: Omit<TimelineItem, "type">[];
  stageHistory?: Omit<TimelineItem, "type">[];

  // External control
  externalItems?: TimelineItem[];
  onRefresh?: () => void;

  // UI Configuration
  showHeader?: boolean;
  compact?: boolean;
  readOnly?: boolean;
  showFilters?: boolean;

  // Callbacks
  onItemClick?: (item: TimelineItem) => void;

  // Label mappings
  activityTypeLabels?: Record<string, string>;
  stageLabels?: Record<string, string>;
}

// Default labels
const DEFAULT_ACTIVITY_LABELS: Record<string, string> = {
  call_made: "Call Made",
  call_received: "Call Received",
  call_missed: "Call Missed",
  email_sent: "Email Sent",
  email_received: "Email Received",
  meeting_scheduled: "Meeting Scheduled",
  meeting_completed: "Meeting Completed",
  client_meeting: "Client Meeting",
  internal_meeting: "Internal Meeting",
  site_visit: "Site Visit",
  quotation_sent: "Quotation Sent",
  quotation_revised: "Quotation Revised",
  note_added: "Note Added",
  stage_changed: "Stage Changed",
  assignment_changed: "Assignment Changed",
  document_uploaded: "Document Uploaded",
  task_created: "Task Created",
  task_completed: "Task Completed",
  task_assigned: "Task Assigned",
  task_updated: "Task Updated",
  other: "Other",
};

const DEFAULT_STAGE_LABELS: Record<string, string> = {
  new: "New",
  qualified: "Qualified",
  disqualified: "Disqualified",
  requirement_discussion: "Requirement Discussion",
  proposal_discussion: "Proposal Discussion",
  won: "Won",
  lost: "Lost",
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function TimelineTableReusable({
  activities = [],
  stageHistory = [],
  externalItems,
  onRefresh,
  showHeader = true,
  compact = false,
  readOnly = true,
  showFilters = true,
  onItemClick,
  activityTypeLabels = DEFAULT_ACTIVITY_LABELS,
  stageLabels = DEFAULT_STAGE_LABELS,
}: TimelineTableReusableProps) {
  // =====================================================
  // STATE MANAGEMENT
  // =====================================================

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "—";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getActivityIcon = (item: TimelineItem) => {
    if (item.type === "stage") {
      return <ArrowPathIcon className="w-4 h-4" />;
    }

    const activityType = item.activity_type || "";

    if (activityType.includes("call")) {
      return <PhoneIcon className="w-4 h-4" />;
    }
    if (activityType.includes("email")) {
      return <EnvelopeIcon className="w-4 h-4" />;
    }
    if (
      activityType.includes("meeting") ||
      activityType.includes("site_visit")
    ) {
      return <CalendarIcon className="w-4 h-4" />;
    }
    if (activityType.includes("note")) {
      return <ChatBubbleLeftIcon className="w-4 h-4" />;
    }
    if (
      activityType.includes("document") ||
      activityType.includes("quotation")
    ) {
      return <DocumentTextIcon className="w-4 h-4" />;
    }

    return <ClockIcon className="w-4 h-4" />;
  };

  const getActivityColor = (item: TimelineItem) => {
    if (item.type === "stage") {
      return "bg-purple-100 text-purple-600";
    }

    const activityType = item.activity_type || "";

    if (activityType.includes("call")) {
      return "bg-blue-100 text-blue-600";
    }
    if (activityType.includes("email")) {
      return "bg-green-100 text-green-600";
    }
    if (
      activityType.includes("meeting") ||
      activityType.includes("site_visit")
    ) {
      return "bg-orange-100 text-orange-600";
    }
    if (activityType.includes("note")) {
      return "bg-yellow-100 text-yellow-600";
    }
    if (
      activityType.includes("document") ||
      activityType.includes("quotation")
    ) {
      return "bg-indigo-100 text-indigo-600";
    }

    return "bg-slate-100 text-slate-600";
  };

  const getActivityTitle = (item: TimelineItem): string => {
    if (item.type === "stage") {
      const toStageLabel =
        stageLabels[item.to_stage || ""] || item.to_stage || "";
      return `Moved to ${toStageLabel}`;
    }

    if (item.title) {
      return item.title;
    }

    const activityType = item.activity_type || "";
    return activityTypeLabels[activityType] || activityType;
  };

  const getActivityTypeLabel = (activityType: string | undefined): string => {
    if (!activityType) return "Activity";
    return activityTypeLabels[activityType] || activityType;
  };

  // =====================================================
  // SORTING
  // =====================================================

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: string }) => (
    <span className="ml-1 inline-flex">
      {sortField === field ? (
        sortDirection === "asc" ? (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
        ) : (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )
      ) : (
        <svg
          className="w-3 h-3 opacity-0 group-hover:opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      )}
    </span>
  );

  // =====================================================
  // DATA PROCESSING
  // =====================================================

  const allItems = useMemo(() => {
    // Use external items if provided, otherwise merge activities and stage history
    if (externalItems) {
      return externalItems;
    }

    return [
      ...activities.map((a) => ({ ...a, type: "activity" as const })),
      ...stageHistory.map((s) => ({ ...s, type: "stage" as const })),
    ];
  }, [externalItems, activities, stageHistory]);

  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...allItems];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        // Search in title
        const title = getActivityTitle(item);
        if (title.toLowerCase().includes(query)) return true;

        // Search in description
        if (item.description?.toLowerCase().includes(query)) return true;

        // Search in notes
        if (item.notes?.toLowerCase().includes(query)) return true;
        if (item.meeting_notes?.toLowerCase().includes(query)) return true;

        // Search in user name
        const userName =
          item.created_user?.name || item.created_by_user?.name || "";
        if (userName.toLowerCase().includes(query)) return true;

        // Search in activity type
        if (item.activity_type) {
          const typeLabel = getActivityTypeLabel(item.activity_type);
          if (typeLabel.toLowerCase().includes(query)) return true;
        }

        // Search in location
        if (item.meeting_location?.toLowerCase().includes(query)) return true;

        // Search in email subject
        if (item.email_subject?.toLowerCase().includes(query)) return true;

        return false;
      });
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter((item) => {
        if (filterType === "stage") return item.type === "stage";
        if (filterType === "activity") return item.type === "activity";
        if (item.type === "activity" && item.activity_type) {
          return item.activity_type === filterType;
        }
        return false;
      });
    }

    // Sort by selected field
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "activity":
          aValue = getActivityTitle(a).toLowerCase();
          bValue = getActivityTitle(b).toLowerCase();
          break;
        case "user":
          aValue = (
            a.created_user?.name ||
            a.created_by_user?.name ||
            ""
          ).toLowerCase();
          bValue = (
            b.created_user?.name ||
            b.created_by_user?.name ||
            ""
          ).toLowerCase();
          break;
        case "created_at":
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [
    allItems,
    searchQuery,
    filterType,
    sortField,
    sortDirection,
    getActivityTitle,
  ]);

  // Get unique activity types for filter dropdown
  const activityTypes = useMemo(() => {
    const types = new Set<string>();
    allItems.forEach((item) => {
      if (item.type === "activity" && item.activity_type) {
        types.add(item.activity_type);
      }
    });
    return Array.from(types);
  }, [allItems]);

  // =====================================================
  // RENDER: MAIN LAYOUT
  // =====================================================

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200">
      {/* Search and Filters */}
      {showFilters && (
        <div className="flex items-center gap-2 p-3 border-b border-slate-200">
          <div className="flex-1">
            <SearchBox
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search timeline..."
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="activity">Activities</option>
            <option value="stage">Stage Changes</option>
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {activityTypeLabels[type] || type}
              </option>
            ))}
          </select>

          {/* Sort Direction */}
          <button
            onClick={() =>
              setSortDirection(sortDirection === "desc" ? "asc" : "desc")
            }
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={sortDirection === "desc" ? "Newest first" : "Oldest first"}
          >
            {sortDirection === "desc" ? "↓ Newest" : "↑ Oldest"}
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredAndSortedItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <ClockIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">
              No timeline items found
            </p>
            <p className="text-xs text-slate-500">
              {searchQuery || filterType !== "all"
                ? "Try adjusting your filters"
                : "Activities will appear here as they happen"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th
                  onClick={() => handleSort("activity")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Activity
                    <SortIndicator field="activity" />
                  </div>
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Details
                </th>
                <th
                  onClick={() => handleSort("created_at")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Date & Time
                    <SortIndicator field="created_at" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("user")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    User
                    <SortIndicator field="user" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredAndSortedItems.map((item) => {
                const userName =
                  item.created_user?.name || item.created_by_user?.name || "—";
                const avatarUrl =
                  item.created_user?.avatar_url ||
                  item.created_by_user?.avatar_url;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 cursor-pointer"
                    onClick={() => onItemClick && onItemClick(item)}
                  >
                    {/* Icon Column */}
                    <td className="px-3 py-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(
                          item
                        )}`}
                      >
                        {getActivityIcon(item)}
                      </div>
                    </td>

                    {/* Activity Title */}
                    <td className="px-3 py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">
                          {getActivityTitle(item)}
                        </p>
                        {item.activity_type && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {getActivityTypeLabel(item.activity_type)}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Details Column */}
                    <td className="px-3 py-3 max-w-md">
                      <div className="space-y-1">
                        {/* Description or Notes */}
                        {(item.description ||
                          item.notes ||
                          item.meeting_notes) && (
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {item.description ||
                              item.notes ||
                              item.meeting_notes}
                          </p>
                        )}

                        {/* Call Details */}
                        {item.call_duration_seconds !== null &&
                          item.call_duration_seconds !== undefined && (
                            <div className="flex items-center gap-3 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <ClockIcon className="w-3 h-3" />
                                {formatDuration(item.call_duration_seconds)}
                              </span>
                              {item.call_outcome && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {item.call_outcome}
                                </span>
                              )}
                            </div>
                          )}

                        {/* Meeting Details */}
                        {item.meeting_scheduled_at && (
                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {formatDateTime(item.meeting_scheduled_at)}
                            </span>
                            {item.meeting_completed && (
                              <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
                                Completed
                              </span>
                            )}
                          </div>
                        )}

                        {/* Meeting Location */}
                        {item.meeting_location && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <MapPinIcon className="w-3 h-3" />
                            <span className="truncate">
                              {item.meeting_location}
                            </span>
                          </div>
                        )}

                        {/* Attendees */}
                        {item.attendees && item.attendees.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <UserGroupIcon className="w-3 h-3" />
                            <span>
                              {item.attendees.length}{" "}
                              {item.attendees.length === 1
                                ? "attendee"
                                : "attendees"}
                            </span>
                          </div>
                        )}

                        {/* Email Subject */}
                        {item.email_subject && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <EnvelopeIcon className="w-3 h-3" />
                            <span className="truncate">
                              {item.email_subject}
                            </span>
                          </div>
                        )}

                        {/* Stage Change */}
                        {item.type === "stage" && item.from_stage && (
                          <p className="text-[10px] text-slate-500">
                            From:{" "}
                            {stageLabels[item.from_stage] || item.from_stage}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Date & Time */}
                    <td className="px-3 py-3">
                      <div className="text-xs text-slate-800">
                        {formatDate(item.created_at)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {formatTime(item.created_at)}
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={userName}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                            <span className="text-[10px] font-medium text-slate-600">
                              {userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-slate-700 truncate max-w-[120px]">
                          {userName}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
