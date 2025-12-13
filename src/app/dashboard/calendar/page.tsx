"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  XMarkIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatBadge,
} from "@/components/ui/PageLayout";

interface CalendarEvent {
  id: string;
  source_type: "lead" | "project" | "standalone";
  source_id: string | null;
  source_number: string | null;
  source_name: string | null;
  activity_type: string;
  meeting_type: string | null;
  title: string;
  description: string | null;
  scheduled_at: string;
  end_at?: string;
  is_all_day?: boolean;
  location: string | null;
  is_completed: boolean;
  notes: string | null;
  attendees: { type: string; id?: string; email?: string; name: string }[];
  created_by: string;
  created_at: string;
  created_user: { id: string; name: string; avatar_url: string | null } | null;
  client_email?: string;
  client_phone?: string;
  property_name?: string;
  is_standalone?: boolean;
}

interface LinkedEntity {
  type: "lead" | "project";
  id: string;
  name: string;
}

type ViewMode = "month" | "day" | "agenda";

const MEETING_TYPE_COLORS: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  client_meeting: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  internal_meeting: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  site_visit: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  follow_up: {
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
    dot: "bg-teal-500",
  },
  reminder: {
    bg: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-700",
    dot: "bg-pink-500",
  },
  meeting_scheduled: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  other_meeting: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    dot: "bg-slate-500",
  },
  other: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    dot: "bg-slate-500",
  },
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  client_meeting: "Client Meeting",
  internal_meeting: "Internal Meeting",
  site_visit: "Site Visit",
  follow_up: "Follow Up",
  reminder: "Reminder",
  meeting_scheduled: "Meeting",
  other_meeting: "Other",
  other: "Other",
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [overdueEvents, setOverdueEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );

  // Create Event Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    event_type: "client_meeting" as string,
    scheduled_at: "",
    end_at: "",
    location: "",
    lead_id: null as string | null,
    project_id: null as string | null,
    attendees: [] as { type: string; name: string }[],
  });

  // Fetch calendar events
  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get start and end of current view period
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 2, 0).toISOString(); // Include next month for better UX

      const response = await fetch(
        `/api/calendar?start=${startDate}&end=${endDate}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch calendar events");
      }

      const data = await response.json();
      setEvents(data.events || []);
      setUpcomingEvents(data.upcomingEvents || []);
      setOverdueEvents(data.overdueEvents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Create a new event
  const handleCreateEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.scheduled_at) {
      setCreateError("Title and date/time are required");
      return;
    }

    try {
      setIsSubmitting(true);
      setCreateError(null);

      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newEvent.title.trim(),
          description: newEvent.description.trim() || null,
          event_type: newEvent.event_type,
          scheduled_at: new Date(newEvent.scheduled_at).toISOString(),
          end_at: newEvent.end_at
            ? new Date(newEvent.end_at).toISOString()
            : null,
          location: newEvent.location.trim() || null,
          lead_id: newEvent.lead_id,
          project_id: newEvent.project_id,
          attendees: newEvent.attendees.length > 0 ? newEvent.attendees : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create event");
      }

      // Reset form and close modal
      setNewEvent({
        title: "",
        description: "",
        event_type: "client_meeting",
        scheduled_at: "",
        end_at: "",
        location: "",
        lead_id: null,
        project_id: null,
        attendees: [],
      });
      setIsCreateModalOpen(false);

      // Refresh events
      fetchEvents();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar calculations
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: {
      date: Date;
      isCurrentMonth: boolean;
      events: CalendarEvent[];
    }[] = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date, isCurrentMonth: false, events: [] });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split("T")[0];
      const dayEvents = events.filter((e) =>
        e.scheduled_at.startsWith(dateStr)
      );
      days.push({ date, isCurrentMonth: true, events: dayEvents });
    }

    // Next month days to complete the grid
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({ date, isCurrentMonth: false, events: [] });
    }

    return days;
  }, [currentDate, events]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getEventColor = (event: CalendarEvent) => {
    const type = event.meeting_type || event.activity_type || "other";
    return MEETING_TYPE_COLORS[type] || MEETING_TYPE_COLORS.other;
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <PageLayout isLoading={isLoading} loadingText="Loading calendar...">
      <PageHeader
        title="Calendar"
        subtitle="Schedule and manage meetings, site visits, and appointments"
        breadcrumbs={[{ label: "Calendar" }]}
        icon={<CalendarIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-indigo-500 to-indigo-600"
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-indigo-600 to-indigo-500 text-white text-sm font-medium rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-all shadow-sm hover:shadow-md"
          >
            <PlusIcon className="w-4 h-4" />
            New Event
          </button>
        }
        stats={
          events.length > 0 ? (
            <>
              <StatBadge
                label="This Month"
                value={events.length}
                color="blue"
              />
              <StatBadge
                label="Upcoming"
                value={upcomingEvents.length}
                color="green"
              />
              {overdueEvents.length > 0 && (
                <StatBadge
                  label="Overdue"
                  value={overdueEvents.length}
                  color="red"
                />
              )}
            </>
          ) : undefined
        }
      />

      <PageContent>
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Calendar */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              {/* Calendar Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    {monthNames[currentDate.getMonth()]}{" "}
                    {currentDate.getFullYear()}
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={goToPreviousMonth}
                      className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={goToToday}
                      className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Today
                    </button>
                    <button
                      onClick={goToNextMonth}
                      className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                    {(["month", "agenda"] as ViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          viewMode === mode
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Calendar Grid */}
              {viewMode === "month" && (
                <div className="p-3">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <div
                          key={day}
                          className="py-1.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider"
                        >
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
                    {calendarDays.map((day, idx) => (
                      <div
                        key={idx}
                        className={`min-h-[85px] p-1.5 bg-white ${
                          !day.isCurrentMonth ? "bg-slate-50" : ""
                        } ${isToday(day.date) ? "bg-blue-50" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span
                            className={`text-xs font-medium ${
                              !day.isCurrentMonth
                                ? "text-slate-400"
                                : isToday(day.date)
                                ? "w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs"
                                : "text-slate-700"
                            }`}
                          >
                            {day.date.getDate()}
                          </span>
                        </div>

                        {/* Events for this day */}
                        <div className="space-y-0.5">
                          {day.events.slice(0, 2).map((event) => {
                            const colors = getEventColor(event);
                            return (
                              <button
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                className={`w-full text-left px-1 py-0.5 rounded text-[11px] truncate ${colors.bg} ${colors.text} hover:opacity-80 transition-opacity leading-tight`}
                              >
                                <span
                                  className={`inline-block w-1.5 h-1.5 rounded-full ${colors.dot} mr-0.5`}
                                />
                                {formatTime(event.scheduled_at)} {event.title}
                              </button>
                            );
                          })}
                          {day.events.length > 2 && (
                            <button
                              onClick={() => {
                                // Could expand to show all events
                              }}
                              className="w-full text-left px-1 text-[11px] text-slate-500 hover:text-slate-700"
                            >
                              +{day.events.length - 2} more
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agenda View */}
              {viewMode === "agenda" && (
                <div className="p-4">
                  {events.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>No events scheduled for this period</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {events.map((event) => {
                        const colors = getEventColor(event);
                        return (
                          <div
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            className={`p-4 rounded-xl border ${colors.border} ${colors.bg} cursor-pointer hover:shadow-md transition-shadow`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`w-2 h-2 rounded-full ${colors.dot}`}
                                  />
                                  <span
                                    className={`text-xs font-medium ${colors.text}`}
                                  >
                                    {MEETING_TYPE_LABELS[
                                      event.meeting_type || event.activity_type
                                    ] || "Event"}
                                  </span>
                                  {event.is_completed && (
                                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                                  )}
                                  {event.source_type === "standalone" && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                                      Standalone
                                    </span>
                                  )}
                                </div>
                                <h3 className="font-semibold text-slate-900">
                                  {event.title}
                                </h3>
                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                                  <span className="flex items-center gap-1">
                                    <ClockIcon className="w-4 h-4" />
                                    {formatDate(event.scheduled_at)} at{" "}
                                    {formatTime(event.scheduled_at)}
                                  </span>
                                  {event.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPinIcon className="w-4 h-4" />
                                      {event.location}
                                    </span>
                                  )}
                                </div>
                                {/* Attendees */}
                                {event.attendees &&
                                  event.attendees.length > 0 && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <UserGroupIcon className="w-4 h-4 text-slate-400" />
                                      <div className="flex flex-wrap gap-1">
                                        {event.attendees.map(
                                          (attendee: any, idx: number) => (
                                            <span
                                              key={idx}
                                              className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                                attendee.type === "team"
                                                  ? "bg-blue-100 text-blue-700"
                                                  : "bg-purple-100 text-purple-700"
                                              }`}
                                            >
                                              {attendee.name}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                              {event.source_id && (
                                <div className="text-right">
                                  <Link
                                    href={
                                      event.source_type === "lead"
                                        ? `/dashboard/sales/leads/${event.source_id}`
                                        : `/dashboard/projects/${event.source_id}`
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    {event.source_number}
                                  </Link>
                                  <p className="text-sm text-slate-500">
                                    {event.source_name}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Events */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ClockIcon className="w-5 h-5 text-blue-500" />
                  Upcoming
                </h3>
              </div>
              <div className="p-4">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No upcoming events in the next 7 days
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcomingEvents.slice(0, 5).map((event) => {
                      const colors = getEventColor(event);
                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`p-3 rounded-lg border ${colors.border} ${colors.bg} cursor-pointer hover:shadow-sm transition-shadow`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`w-2 h-2 rounded-full ${colors.dot}`}
                            />
                            <span className="text-xs font-medium text-slate-500">
                              {formatDate(event.scheduled_at)}
                            </span>
                          </div>
                          <p className="font-medium text-sm text-slate-900 truncate">
                            {event.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatTime(event.scheduled_at)}
                            {event.source_name && ` • ${event.source_name}`}
                            {!event.source_name &&
                              event.source_type === "standalone" &&
                              " • Standalone"}
                          </p>
                          {/* Attendees */}
                          {event.attendees && event.attendees.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {event.attendees
                                .slice(0, 3)
                                .map((attendee: any, idx: number) => (
                                  <span
                                    key={idx}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      attendee.type === "team"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-purple-100 text-purple-700"
                                    }`}
                                  >
                                    {attendee.name?.split(" ")[0]}
                                  </span>
                                ))}
                              {event.attendees.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                  +{event.attendees.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Overdue Events */}
            {overdueEvents.length > 0 && (
              <div className="bg-white rounded-xl border border-red-200 shadow-sm">
                <div className="p-4 border-b border-red-200 bg-red-50 rounded-t-xl">
                  <h3 className="font-semibold text-red-700 flex items-center gap-2">
                    <ExclamationCircleIcon className="w-5 h-5" />
                    Overdue ({overdueEvents.length})
                  </h3>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {overdueEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="p-3 rounded-lg border border-red-100 bg-red-50 cursor-pointer hover:shadow-sm transition-shadow"
                      >
                        <p className="font-medium text-sm text-slate-900 truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-red-600">
                          Was scheduled for {formatDate(event.scheduled_at)}
                        </p>
                        {event.source_id ? (
                          <Link
                            href={
                              event.source_type === "lead"
                                ? `/dashboard/sales/leads/${event.source_id}`
                                : `/dashboard/projects/${event.source_id}`
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            {event.source_name}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Standalone Event
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Legend</h3>
              <div className="space-y-2">
                {Object.entries(MEETING_TYPE_LABELS).map(([key, label]) => {
                  const colors = MEETING_TYPE_COLORS[key];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
                      <span className="text-sm text-slate-600">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        getEventColor(selectedEvent).dot
                      }`}
                    />
                    <span
                      className={`text-xs font-medium ${
                        getEventColor(selectedEvent).text
                      }`}
                    >
                      {
                        MEETING_TYPE_LABELS[
                          selectedEvent.meeting_type ||
                            selectedEvent.activity_type
                        ]
                      }
                    </span>
                    {selectedEvent.is_completed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircleIcon className="w-3 h-3" /> Completed
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedEvent.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Date & Time */}
                <div className="flex items-start gap-3">
                  <ClockIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">
                      {new Date(selectedEvent.scheduled_at).toLocaleDateString(
                        "en-IN",
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatTime(selectedEvent.scheduled_at)}
                    </p>
                  </div>
                </div>

                {/* Location */}
                {selectedEvent.location && (
                  <div className="flex items-start gap-3">
                    <MapPinIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                    <p className="text-slate-700">{selectedEvent.location}</p>
                  </div>
                )}

                {/* Client/Lead */}
                {selectedEvent.source_id ? (
                  <div className="flex items-start gap-3">
                    <LinkIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <Link
                        href={
                          selectedEvent.source_type === "lead"
                            ? `/dashboard/sales/leads/${selectedEvent.source_id}`
                            : `/dashboard/projects/${selectedEvent.source_id}`
                        }
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {selectedEvent.source_name}
                      </Link>
                      <p className="text-sm text-slate-500">
                        {selectedEvent.source_number}
                      </p>
                      {selectedEvent.property_name && (
                        <p className="text-sm text-slate-500">
                          {selectedEvent.property_name}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                        Standalone Event
                      </span>
                      <p className="text-sm text-slate-500 mt-1">
                        Not linked to any lead or project
                      </p>
                    </div>
                  </div>
                )}

                {/* Attendees */}
                {selectedEvent.attendees &&
                  selectedEvent.attendees.length > 0 && (
                    <div className="flex items-start gap-3">
                      <UserGroupIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 mb-2">
                          Attendees
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedEvent.attendees.map((attendee, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                attendee.type === "team"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {attendee.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Description */}
                {selectedEvent.description && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      Description
                    </p>
                    <p className="text-slate-600">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                {/* Meeting Notes */}
                {selectedEvent.notes && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      Meeting Notes
                    </p>
                    <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                      {selectedEvent.notes}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  {selectedEvent.source_id &&
                    selectedEvent.source_type === "lead" && (
                      <Link
                        href={`/dashboard/sales/leads/${selectedEvent.source_id}?tab=calendar`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View in Lead
                      </Link>
                    )}
                  {selectedEvent.source_id &&
                    selectedEvent.source_type === "project" && (
                      <Link
                        href={`/dashboard/projects/${selectedEvent.source_id}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View Project
                      </Link>
                    )}
                  {!selectedEvent.source_id && <div />}
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Event Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    New Calendar Event
                  </h2>
                  <p className="text-sm text-slate-500">
                    Create a standalone event or link to a lead/project
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setCreateError(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {createError}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="Enter event title"
                  />
                </div>

                {/* Event Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Event Type
                  </label>
                  <select
                    value={newEvent.event_type}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, event_type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  >
                    <option value="client_meeting">Client Meeting</option>
                    <option value="internal_meeting">Internal Meeting</option>
                    <option value="site_visit">Site Visit</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="reminder">Reminder</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Start Date & Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={newEvent.scheduled_at}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          scheduled_at: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={newEvent.end_at}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, end_at: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, location: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="Enter location or meeting link"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                    placeholder="Add event details or notes"
                  />
                </div>

                {/* Info Box */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-sm text-slate-600">
                    <strong>💡 Tip:</strong> To link this event to a lead or
                    project, create it from the respective lead or project page.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setCreateError(null);
                    }}
                    className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateEvent}
                    disabled={
                      isSubmitting ||
                      !newEvent.title.trim() ||
                      !newEvent.scheduled_at
                    }
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="w-4 h-4" />
                        Create Event
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
