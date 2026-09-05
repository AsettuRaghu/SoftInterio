"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { SearchBox } from "@/components/ui/SearchBox";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  CheckIcon,
  PencilSquareIcon,
  TrashIcon,
  UserGroupIcon,
  PlusIcon,
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
  /** True for rows derived from note follow-ups - they have no event row. */
  is_derived?: boolean;
  /** Set on rows derived from a task's due date. */
  task_id?: string;
  /** The note behind a derived follow-up row. */
  note_id?: string;
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

/**
 * The three states an event can be in. Completion wins over date: an event
 * held late is done, not overdue. An event with no date is in no bucket at
 * all, which is why this can return null.
 */
function statusOf(event: {
  meeting_completed?: boolean;
  meeting_scheduled_at?: string | null;
}): "upcoming" | "overdue" | "completed" | null {
  if (event.meeting_completed) return "completed";
  if (!event.meeting_scheduled_at) return null;
  return new Date(event.meeting_scheduled_at) < new Date()
    ? "overdue"
    : "upcoming";
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

const MEETING_TYPE_LABELS: Record<string, string> = {
  client_meeting: "Client Meeting",
  internal_meeting: "Internal Meeting",
  site_visit: "Site Visit",
  follow_up: "Follow Up",
  task_due: "Task Due",
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
  const { confirm, confirmDialog } = useConfirm();
  // =====================================================
  // STATE MANAGEMENT
  // =====================================================

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
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

  /**
   * This component was written around lead_activities, so it reads
   * meeting_scheduled_at. /api/calendar normalises every source to
   * scheduled_at, which left the date column empty for anything fetched
   * rather than passed in. Bridge the two names once, here, instead of
   * touching a dozen read sites.
   */
  const normalise = (rows: any[]): CalendarEvent[] =>
    (rows || []).map((e) => ({
      ...e,
      meeting_scheduled_at: e.meeting_scheduled_at ?? e.scheduled_at ?? null,
      meeting_type: e.meeting_type ?? e.event_type ?? e.activity_type,
      meeting_completed: e.meeting_completed ?? e.is_completed ?? false,
    }));

  /**
   * `background: true` refreshes without the blocking spinner.
   *
   * Unlike the notes and tasks tabs, which receive their rows as props from the
   * already-loaded page, this component fetches its own - /api/calendar unions
   * five sources and cannot be filtered out of the lead payload. That meant
   * every visit to the tab flipped isLoading and, with nothing yet in state,
   * replaced the whole table with a spinner. Showing what we already have and
   * updating it quietly is the difference.
   */
  const fetchEvents = useCallback(
    async (opts?: { background?: boolean }) => {
    // If external events are provided, use them
    if (externalEvents) {
      setEvents(normalise(externalEvents));
      setCachedEvents(normalise(externalEvents));
      return;
    }

    // Otherwise fetch from API
    try {
      if (!opts?.background) setIsLoading(true);

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
      const fetchedEvents = normalise(data.events || []);
      setEvents(fetchedEvents);
      setCachedEvents(fetchedEvents);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
    } finally {
      if (!opts?.background) setIsLoading(false);
    }
  },
    [linkedType, linkedId, externalEvents]
  );

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    const cached = getCachedEvents();

    // Anything cached goes on screen immediately, however old. Stale rows for a
    // moment beat an empty spinner - the previous code only used the cache when
    // it was under 30 seconds old, so any tab visit after that showed the
    // spinner even though usable data was sitting right there.
    if (cached?.events?.length) {
      setEvents(cached.events);

      // Very fresh data needs no request at all, which is what makes flicking
      // between tabs feel instant.
      if (Date.now() - cached.timestamp < 30000) return;

      void fetchEvents({ background: true });
      return;
    }

    // Genuinely nothing to show - this is the only case that earns a spinner.
    void fetchEvents();
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

    // A task-due row is derived from the task itself. It completes through the
    // task endpoint, and needs no linked lead or project to do it - a
    // standalone task appears on this calendar too.
    if (event.is_derived && event.task_id) {
      try {
        const response = await fetch(`/api/tasks/${event.task_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
        if (!response.ok) throw new Error("Failed to complete task");

        // Completing the task removes it from the calendar entirely - the
        // source query excludes finished work - so drop the row rather than
        // showing a completed deadline.
        setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
        clearCache();
        if (onRefresh) onRefresh();
      } catch (error) {
        console.error("Error completing task:", error);
        alert("Failed to complete task");
      }
      return;
    }

    if (!linkedId || !linkedType) return;

    try {
      // A follow-up row is derived from a note - there is no activity to
      // complete. Sending it to the activities endpoint would PATCH a
      // non-existent record while the optimistic update below made it look
      // like it had worked.
      const isFollowUp = event.is_derived && event.note_id;

      const apiEndpoint = isFollowUp
        ? linkedType === "lead"
          ? `/api/sales/leads/notes/${event.note_id}`
          : `/api/projects/${linkedId}/notes/${event.note_id}`
        : linkedType === "lead"
        ? `/api/sales/leads/${linkedId}/activities?activityId=${event.id}`
        : `/api/projects/${linkedId}/activities?activityId=${event.id}`;

      const response = await fetch(apiEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isFollowUp
            ? { follow_up_done: true }
            : { meeting_completed: true }
        ),
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

    // A follow-up has no event row to delete - it belongs to a note. Deleting
    // it here would either 404 or, worse, remove an unrelated activity.
    if (event.is_derived) {
      alert(
        event.task_id
          ? "This is a task's due date. Change or clear the due date on the task instead."
          : "This follow-up belongs to a note. Clear the follow-up date on the note instead."
      );
      return;
    }

    if (
      !(await confirm({
        title: "Delete this event?",
        message: "This cannot be undone.",
      }))
    ) {
      return;
    }

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

  const matchingEvents = useMemo(() => {
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

    return filtered;
  }, [events, searchQuery, filterType]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: matchingEvents.length,
      upcoming: 0,
      overdue: 0,
      completed: 0,
    };
    for (const e of matchingEvents) {
      const st = statusOf(e);
      if (st) counts[st] += 1;
    }
    return counts;
  }, [matchingEvents]);

  const filteredAndSortedEvents = useMemo(() => {
    let filtered =
      filterStatus === "all"
        ? [...matchingEvents]
        : matchingEvents.filter((e) => statusOf(e) === filterStatus);

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
  }, [matchingEvents, filterStatus, sortField, sortDirection]);

  // Pagination, as in the notes and tasks tables.
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedEvents.length / pageSize));
  const paginatedEvents = useMemo(
    () =>
      filteredAndSortedEvents.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      ),
    [filteredAndSortedEvents, currentPage, pageSize]
  );

  // A filter change can leave the user on a page that no longer exists.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

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

  // Only a genuine first load reaches this - any cached rows are rendered
  // instead and refreshed quietly. The card shell is kept so the panel does not
  // disappear and then snap back, which read as the tab breaking.
  if (isLoading && events.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-64 bg-white rounded-lg border border-slate-200 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="mt-3 text-xs text-slate-400">Loading calendar...</p>
      </div>
    );
  }

  // =====================================================
  // RENDER: MAIN LAYOUT
  // =====================================================

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200">
      {/* One row: status pills, then search, then actions - the same order the
          notes and tasks tables use, so the three read alike. */}
      {showFilters && (
        <div className="flex items-center gap-2 p-3 border-b border-slate-200">
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg shrink-0">
            {STATUS_FILTERS.map((f) => {
              const isActive = filterStatus === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setFilterStatus(f.key);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  {f.label}
                  <span
                    className={`ml-1 text-[10px] ${
                      isActive ? "text-blue-200" : "text-slate-400"
                    }`}
                  >
                    {statusCounts[f.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-40">
            <SearchBox
              value={searchQuery}
              onChange={(v) => {
                setSearchQuery(v);
                setCurrentPage(1);
              }}
              placeholder="Search events..."
            />
          </div>

          {/* Type has too many values to read as pills, so it stays a select. */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="shrink-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            {Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {!readOnly && allowCreate && onCreateEvent && (
            <button
              type="button"
              onClick={onCreateEvent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shrink-0"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Event
            </button>
          )}
        </div>
      )}

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
              {paginatedEvents.map((event) => (
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
                    <div className="flex items-center justify-end gap-1.5">
                      {!event.meeting_completed && allowEdit && (
                        <>
                          <button
                            onClick={(e) => handleCompleteEvent(event, e)}
                            className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-green-50 text-green-600 border-green-200 hover:bg-green-100 hover:border-green-300 transition-all"
                            title="Mark as completed"
                          >
                            <CheckIcon className="w-3.5 h-3.5" />
                          </button>
                          {/* A derived row has no calendar_events record to
                              edit - it belongs to a note or a task. */}
                          {!event.is_derived && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onEditEvent) onEditEvent(event);
                              }}
                              className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all"
                              title="Edit event"
                            >
                              <PencilSquareIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                      {allowDelete && !event.is_derived && (
                        <button
                          onClick={(e) => handleDeleteEvent(event, e)}
                          className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all"
                          title="Delete event"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
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

      {/* Pagination, matching the notes and tasks tables. Shown whenever there
          are rows - a short list still reports its total and keeps the page
          size selector reachable, as the notes table does. */}
      {filteredAndSortedEvents.length > 0 && (
        <div className="border-t border-slate-200 px-3 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">
              Showing{" "}
              <span className="font-medium">
                {Math.min(
                  (currentPage - 1) * pageSize + 1,
                  filteredAndSortedEvents.length
                )}
              </span>
              {"-"}
              <span className="font-medium">
                {Math.min(
                  currentPage * pageSize,
                  filteredAndSortedEvents.length
                )}
              </span>
              {" of "}
              <span className="font-medium">
                {filteredAndSortedEvents.length}
              </span>
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-1.5 py-0.5 text-[10px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <div className="flex items-center gap-0.5 mx-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let n = i + 1;
                if (totalPages > 5) {
                  if (currentPage <= 3) n = i + 1;
                  else if (currentPage >= totalPages - 2)
                    n = totalPages - 4 + i;
                  else n = currentPage - 2 + i;
                }
                return (
                  <button
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    className={`w-6 h-6 text-[10px] font-medium rounded transition-colors ${
                      currentPage === n
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
