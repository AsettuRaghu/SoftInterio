"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/utils/cn";
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
import { LinkedEntity } from "@/components/tasks/ui";
import {
  MonthView,
  WeekView,
  AgendaView,
  MiniMonth,
  DayPopover,
  AgendaRow,
  KIND_STYLES,
  kindOf,
  keyOfIso,
  sameDay,
  type CalendarEventLite,
} from "@/components/calendar/CalendarViews";

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

type ViewMode = "month" | "week" | "agenda";

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
  // Task due dates are derived onto the calendar by /api/calendar. Without an
  // entry here they fell back to the generic "other" styling and read as
  // meetings.
  task_due: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    dot: "bg-violet-500",
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
  task_due: "Task Due",
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
  // The day the side panel shows; null means today.
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  // "+N more" on a month cell opens that day over the grid.
  const [dayPopover, setDayPopover] = useState<{ date: Date; anchor: { top: number; left: number; width: number } } | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  // Kinds switched off from the legend. Empty means everything.
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );

  // Create Event Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [linkedEntity, setLinkedEntity] = useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    event_type: "client_meeting" as string,
    scheduled_at: "",
    end_at: "",
    location: "",
    attendees: [] as { type: string; name: string }[],
  });

  // Fetch calendar events
  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get start and end of current view period
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      // The month grid shows up to six days of the previous month and two
      // weeks of the next, and the week view can straddle a month edge, so
      // read a week either side of the month.
      const startDate = new Date(year, month, -7).toISOString();
      const endDate = new Date(year, month + 1, 7).toISOString();

      const response = await fetch(
        `/api/calendar?start=${startDate}&end=${endDate}`,
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
          linked_type: linkedEntity?.type || null,
          linked_id: linkedEntity?.id || null,
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
        attendees: [],
      });
      setLinkedEntity(null);
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
    if (viewMode === "week") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
      return;
    }
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    if (viewMode === "week") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
      return;
    }
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar calculations

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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

  // What the legend leaves on.
  const visibleEvents = useMemo(
    () => (events as CalendarEventLite[]).filter((e) => !hiddenKinds.has(kindOf(e))),
    [events, hiddenKinds]
  );

  return (
    // The whole calendar in the viewable area, no page scroll: the shell
    // leaves 100vh minus its top bar (pt-20) and padding (p-3 above and
    // below), and this fills exactly that. No page header - the month name
    // is the title, and the toolbar carries the one action.
    <div className="h-[calc(100vh-104px)] flex flex-col min-h-0">
      {error && (
        <div className="shrink-0 mb-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      {/* Top bar, the way Google Calendar has it: a menu toggle for the rail,
          Today, the arrows, the month as the title; the view on the right. */}
      <div className="shrink-0 flex items-center gap-2 pb-3">
        <button type="button" onClick={() => setRailOpen((v) => !v)} className="p-2 rounded-full text-slate-600 hover:bg-slate-100" aria-label="Toggle the side rail">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold tabular-nums">{new Date().getDate()}</div>
          <span className="text-lg text-slate-800">Calendar</span>
        </div>
        <button
          type="button"
          onClick={() => {
            goToToday();
            setSelectedDay(null);
          }}
          className="px-4 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50"
        >
          Today
        </button>
        <button onClick={goToPreviousMonth} className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100" aria-label="Previous"><ChevronLeftIcon className="w-5 h-5" /></button>
        <button onClick={goToNextMonth} className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100" aria-label="Next"><ChevronRightIcon className="w-5 h-5" /></button>
        <h2 className="text-xl text-slate-900 ml-1 tabular-nums">
          {viewMode === "week"
            ? (() => {
                const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - currentDate.getDay());
                const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
                const f = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                return `${f(start)} – ${f(end)}, ${end.getFullYear()}`;
              })()
            : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
        </h2>
        <span className="flex-1" />
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
          className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full bg-white hover:bg-slate-50"
        >
          <option value="month">Month</option>
          <option value="week">Week</option>
          <option value="agenda">Agenda</option>
        </select>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* Left rail: Create, the mini month, the calendars (one per kind,
            each a checkbox), and what is overdue. */}
        {railOpen && (
          <aside className="w-60 shrink-0 min-h-0 overflow-y-auto pr-1 space-y-5">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 pl-4 pr-5 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md text-sm font-medium text-slate-800 transition-shadow"
            >
              <PlusIcon className="w-5 h-5" />
              Create
            </button>

            <MiniMonth
              cursor={currentDate}
              onCursor={(d) => setCurrentDate(d)}
              eventDays={new Set(visibleEvents.map((e) => keyOfIso(e.scheduled_at)))}
              onPickDay={(d) => {
                setCurrentDate(viewMode === "week" ? d : new Date(d.getFullYear(), d.getMonth(), 1));
                setSelectedDay(sameDay(d, new Date()) ? null : d);
              }}
            />

            <div>
              <p className="text-sm font-medium text-slate-800 mb-1">My calendars</p>
              <ul className="space-y-0.5">
                {Object.entries(KIND_STYLES)
                  .filter(([k]) => events.some((e) => kindOf(e as CalendarEventLite) === k))
                  .map(([k, st]) => {
                    const on = !hiddenKinds.has(k);
                    const n = events.filter((e) => kindOf(e as CalendarEventLite) === k).length;
                    return (
                      <li key={k}>
                        <label className="flex items-center gap-2 px-1 py-1 rounded hover:bg-slate-100 cursor-pointer text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setHiddenKinds((prev) => {
                                const next = new Set(prev);
                                if (next.has(k)) next.delete(k);
                                else next.add(k);
                                return next;
                              })
                            }
                            className="sr-only"
                          />
                          <span className={cn("w-4 h-4 rounded flex items-center justify-center text-white", on ? st.solid : "border-2 border-slate-300")}>
                            {on && <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" /></svg>}
                          </span>
                          <span className="flex-1 truncate">{st.label}s</span>
                          <span className="text-xs text-slate-400 tabular-nums">{n}</span>
                        </label>
                      </li>
                    );
                  })}
                {events.length === 0 && <li className="px-1 text-xs text-slate-400">Nothing booked this month.</li>}
              </ul>
            </div>

            {overdueEvents.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-700 mb-1">Overdue <span className="text-red-400 font-normal">{overdueEvents.length}</span></p>
                <div className="space-y-1">
                  {(overdueEvents as CalendarEventLite[]).slice(0, 6).map((e) => (
                    <AgendaRow key={e.id} event={e} onOpen={() => setSelectedEvent(e as CalendarEvent)} showDate />
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* The grid */}
        <div className="flex-1 min-w-0 min-h-0 bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
          {viewMode === "month" && (
            <MonthView
              cursor={currentDate}
              events={visibleEvents}
              selected={selectedDay}
              onSelectDay={(d) => {
                // Clicking an empty day starts an event on it, as Google does.
                const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0);
                const pad = (n: number) => String(n).padStart(2, "0");
                setNewEvent((prev) => ({
                  ...prev,
                  scheduled_at: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`,
                }));
                setIsCreateModalOpen(true);
              }}
              onOpen={(e) => setSelectedEvent(e as CalendarEvent)}
              onMore={(d, rect) => setDayPopover({ date: d, anchor: { top: rect.top - 8, left: rect.left, width: rect.width } })}
            />
          )}
          {viewMode === "week" && (
            <WeekView
              cursor={currentDate}
              events={visibleEvents}
              selected={selectedDay}
              onSelectDay={(d) => setSelectedDay(sameDay(d, new Date()) ? null : d)}
              onOpen={(e) => setSelectedEvent(e as CalendarEvent)}
            />
          )}
          {viewMode === "agenda" && (
            <AgendaView
              events={visibleEvents.filter((e) => new Date(e.scheduled_at).getMonth() === currentDate.getMonth())}
              onOpen={(e) => setSelectedEvent(e as CalendarEvent)}
            />
          )}
        </div>
      </div>

      {dayPopover && (
        <DayPopover
          date={dayPopover.date}
          events={visibleEvents}
          anchor={dayPopover.anchor}
          onOpen={(e) => {
            setDayPopover(null);
            setSelectedEvent(e as CalendarEvent);
          }}
          onClose={() => setDayPopover(null)}
          onAdd={() => {
            const d = dayPopover.date;
            const pad = (n: number) => String(n).padStart(2, "0");
            setNewEvent((prev) => ({ ...prev, scheduled_at: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00` }));
            setDayPopover(null);
            setIsCreateModalOpen(true);
          }}
        />
      )}

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
                      {MEETING_TYPE_LABELS[
                        selectedEvent.meeting_type ||
                          selectedEvent.activity_type
                      ] || "Event"}
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
                        },
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
            <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] overflow-y-auto">
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

                {/* Event Type & Location */}
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                {/* Date & Time with Link */}
                <div className="grid grid-cols-3 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Link to Lead/Project
                    </label>
                    <LinkedEntity
                      value={linkedEntity}
                      onChange={(val) =>
                        setLinkedEntity(
                          Array.isArray(val) ? val[0] || null : val,
                        )
                      }
                      placeholder="Link"
                    />
                  </div>
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
                    <strong>💡 Tip:</strong> Link this event to a lead or
                    project to track it in their timeline.
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
    </div>
  );
}
