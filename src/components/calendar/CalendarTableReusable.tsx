"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { SearchBox } from "@/components/ui/SearchBox";
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

// =====================================================
// TYPES & INTERFACES
// =====================================================

interface CalendarEvent {
  id: string;
  activity_type: string;
  meeting_type?: string;
  title: string;
  description?: string | null;
  created_at: string;
  created_user?: { name: string; id: string; avatar_url?: string | null };
  meeting_scheduled_at?: string | null;
  meeting_location?: string | null;
  meeting_completed?: boolean;
  meeting_notes?: string | null;
  attendees?: any[];
}

interface CalendarTableReusableProps {
  // Filtering by linked entity
  linkedType?: "lead" | "project" | "all";
  linkedId?: string;

  // External data & control
  externalEvents?: CalendarEvent[];
  onRefresh?: () => void;

  // UI Configuration
  showHeader?: boolean;
  compact?: boolean;
  readOnly?: boolean;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  showFilters?: boolean;

  // Callbacks
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: () => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (event: CalendarEvent) => void;
  onCompleteEvent?: (eventId: string) => void;
}

const MEETING_TYPE_LABELS: Record<string, string> = {
  client_meeting: "Client Meeting",
  internal_meeting: "Internal Meeting",
  site_visit: "Site Visit",
  follow_up: "Follow Up",
  meeting_scheduled: "Meeting",
  other: "Other",
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function CalendarTableReusable({
  linkedType = "all",
  linkedId,
  externalEvents,
  onRefresh,
  showHeader = true,
  compact = false,
  readOnly = false,
  allowCreate = true,
  allowEdit = true,
  allowDelete = false,
  showFilters = true,
  onEventClick,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent,
  onCompleteEvent,
}: CalendarTableReusableProps) {
  // =====================================================
  // STATE MANAGEMENT
  // =====================================================

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("meeting_scheduled_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // =====================================================
  // CACHING LOGIC
  // =====================================================

  const getCacheKey = () => {
    if (linkedType && linkedId) {
      return `calendar-events-${linkedType}-${linkedId}`;
    }
    return `calendar-events-all`;
  };

  const getCachedEvents = (): {
    events: CalendarEvent[];
    timestamp: number;
  } | null => {
    try {
      const cached = sessionStorage.getItem(getCacheKey());
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error("Error reading cache:", error);
    }
    return null;
  };

  const setCachedEvents = (events: CalendarEvent[]) => {
    try {
      sessionStorage.setItem(
        getCacheKey(),
        JSON.stringify({ events, timestamp: Date.now() })
      );
    } catch (error) {
      console.error("Error setting cache:", error);
    }
  };

  const clearCache = () => {
    try {
      sessionStorage.removeItem(getCacheKey());
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  };

  // =====================================================
  // DATA FETCHING
  // =====================================================

  const fetchEvents = useCallback(async () => {
    // If external events are provided, use them
    if (externalEvents) {
      setEvents(externalEvents);
      setCachedEvents(externalEvents);
      return;
    }

    // Otherwise fetch from API
    try {
      setIsLoading(true);

      let url = "/api/calendar";
      const params = new URLSearchParams();

      if (linkedType && linkedType !== "all") {
        params.append("source", linkedType);
      }
      if (linkedId) {
        params.append("linked_id", linkedId);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch calendar events");

      const data = await response.json();
      const fetchedEvents = data.events || [];
      setEvents(fetchedEvents);
      setCachedEvents(fetchedEvents);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [linkedType, linkedId, externalEvents]);

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    // Check cache first
    const cached = getCachedEvents();
    if (cached && Date.now() - cached.timestamp < 30000) {
      setEvents(cached.events);
      fetchEvents();
    } else {
      fetchEvents();
    }
  }, [fetchEvents]);

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  const handleCompleteEvent = async (
    event: CalendarEvent,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (onCompleteEvent) {
      onCompleteEvent(event.id);
      return;
    }

    if (!linkedId || !linkedType) return;

    try {
      const apiEndpoint =
        linkedType === "lead"
          ? `/api/sales/leads/${linkedId}/activities?activityId=${event.id}`
          : `/api/projects/${linkedId}/activities?activityId=${event.id}`;

      const response = await fetch(apiEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_completed: true }),
      });

      if (!response.ok) throw new Error("Failed to complete event");

      // Update local state optimistically
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id ? { ...e, meeting_completed: true } : e
        )
      );

      clearCache();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error completing event:", error);
    }
  };

  const handleDeleteEvent = async (
    event: CalendarEvent,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (onDeleteEvent) {
      onDeleteEvent(event);
      return;
    }

    if (!confirm("Are you sure you want to delete this event?")) return;

    if (!linkedId || !linkedType) return;

    try {
      const apiEndpoint =
        linkedType === "lead"
          ? `/api/sales/leads/${linkedId}/activities?activityId=${event.id}`
          : `/api/projects/${linkedId}/activities?activityId=${event.id}`;

      const response = await fetch(apiEndpoint, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete event");

      setEvents((prev) => prev.filter((e) => e.id !== event.id));

      clearCache();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error deleting event:", error);
    }
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
  // UTILITY FUNCTIONS (defined before useMemo to avoid initialization errors)
  // =====================================================

  const getMeetingTypeLabel = (type: string | undefined) => {
    return MEETING_TYPE_LABELS[type || "other"] || MEETING_TYPE_LABELS.other;
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =====================================================
  // FILTERING & SORTING
  // =====================================================

  const filteredAndSortedEvents = useMemo(() => {
    let filtered = [...events];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event) => {
        // Search in title
        if (event.title.toLowerCase().includes(query)) return true;

        // Search in description
        if (event.description?.toLowerCase().includes(query)) return true;

        // Search in location
        if (event.meeting_location?.toLowerCase().includes(query)) return true;

        // Search in created user name
        if (event.created_user?.name.toLowerCase().includes(query)) return true;

        // Search in meeting type
        const meetingTypeLabel = getMeetingTypeLabel(event.meeting_type);
        if (meetingTypeLabel.toLowerCase().includes(query)) return true;

        // Search in formatted date
        if (event.meeting_scheduled_at) {
          const formattedDate = formatDate(event.meeting_scheduled_at);
          const formattedTime = formatTime(event.meeting_scheduled_at);
          const formattedDateTime = formatDateTime(event.meeting_scheduled_at);
          if (formattedDate.toLowerCase().includes(query)) return true;
          if (formattedTime.toLowerCase().includes(query)) return true;
          if (formattedDateTime.toLowerCase().includes(query)) return true;
        }

        // Search in status
        if (event.meeting_completed && "completed".includes(query)) return true;
        if (!event.meeting_completed && event.meeting_scheduled_at) {
          const now = new Date();
          const scheduledAt = new Date(event.meeting_scheduled_at);
          if (scheduledAt < now && "overdue".includes(query)) return true;
          if (scheduledAt >= now && "upcoming".includes(query)) return true;
        }

        return false;
      });
    }

    // Meeting type filter
    if (filterType !== "all") {
      filtered = filtered.filter((e) => e.meeting_type === filterType);
    }

    // Status filter
    const now = new Date();
    if (filterStatus === "upcoming") {
      filtered = filtered.filter(
        (e) =>
          e.meeting_scheduled_at &&
          new Date(e.meeting_scheduled_at) >= now &&
          !e.meeting_completed
      );
    } else if (filterStatus === "completed") {
      filtered = filtered.filter((e) => e.meeting_completed);
    } else if (filterStatus === "overdue") {
      filtered = filtered.filter(
        (e) =>
          e.meeting_scheduled_at &&
          new Date(e.meeting_scheduled_at) < now &&
          !e.meeting_completed
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "meeting_type":
          aValue = a.meeting_type || "";
          bValue = b.meeting_type || "";
          break;
        case "meeting_scheduled_at":
          aValue = a.meeting_scheduled_at
            ? new Date(a.meeting_scheduled_at).getTime()
            : 0;
          bValue = b.meeting_scheduled_at
            ? new Date(b.meeting_scheduled_at).getTime()
            : 0;
          break;
        case "meeting_location":
          aValue = a.meeting_location || "";
          bValue = b.meeting_location || "";
          break;
        case "status":
          aValue = a.meeting_completed ? "completed" : "pending";
          bValue = b.meeting_completed ? "completed" : "pending";
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [events, searchQuery, filterType, filterStatus, sortField, sortDirection]);

  // =====================================================
  // STATUS BADGE UTILITY
  // =====================================================

  const getStatusBadge = (event: CalendarEvent) => {
    if (event.meeting_completed) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
          Completed
        </span>
      );
    }

    const now = new Date();
    const scheduledAt = event.meeting_scheduled_at
      ? new Date(event.meeting_scheduled_at)
      : null;

    if (!scheduledAt) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
          —
        </span>
      );
    }

    if (scheduledAt < now) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
          Overdue
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
        Upcoming
      </span>
    );
  };

  // =====================================================
  // RENDER: LOADING STATE
  // =====================================================

  if (isLoading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  // =====================================================
  // RENDER: MAIN LAYOUT
  // =====================================================

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200">
      {/* Search and Filters */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-200">
        <div className="flex-1">
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search events..."
          />
        </div>

        {/* Meeting Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          {Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="upcoming">Upcoming</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
        </select>

        {/* Schedule Event Button */}
        {!readOnly && allowCreate && onCreateEvent && (
          <button
            onClick={onCreateEvent}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <span>+</span> Schedule Event
          </button>
        )}
      </div>

      {/* Events Table */}
      {filteredAndSortedEvents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700 mb-1">
              No events found
            </p>
            <p className="text-xs text-slate-500">
              {searchQuery || filterType !== "all" || filterStatus !== "all"
                ? "Try adjusting your filters"
                : "Schedule your first event to get started"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort("title")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Title
                    <SortIndicator field="title" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("meeting_type")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Type
                    <SortIndicator field="meeting_type" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("meeting_scheduled_at")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Date & Time
                    <SortIndicator field="meeting_scheduled_at" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("meeting_location")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Location
                    <SortIndicator field="meeting_location" />
                  </div>
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Attendees
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Status
                    <SortIndicator field="status" />
                  </div>
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredAndSortedEvents.map((event) => (
                <tr
                  key={event.id}
                  className="group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 cursor-pointer"
                  onClick={() => onEventClick && onEventClick(event)}
                >
                  <td className="px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">
                        {event.title}
                      </p>
                      {event.description && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                      {getMeetingTypeLabel(event.meeting_type)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs text-slate-800">
                      {formatDate(event.meeting_scheduled_at)}
                    </div>
                    {event.meeting_scheduled_at && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {formatTime(event.meeting_scheduled_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {event.meeting_location ? (
                      <div className="flex items-center gap-1">
                        <MapPinIcon className="w-3 h-3 text-slate-400" />
                        <span className="truncate max-w-[150px]">
                          {event.meeting_location}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {event.attendees && event.attendees.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <UserGroupIcon className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] text-slate-700">
                          {event.attendees.length}{" "}
                          {event.attendees.length === 1
                            ? "attendee"
                            : "attendees"}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{getStatusBadge(event)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {!event.meeting_completed && allowEdit && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEditEvent) onEditEvent(event);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit event"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleCompleteEvent(event, e)}
                            className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Mark as completed"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {allowDelete && (
                        <button
                          onClick={(e) => handleDeleteEvent(event, e)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete event"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
