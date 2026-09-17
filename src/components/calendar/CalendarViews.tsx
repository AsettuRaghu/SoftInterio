"use client";

/**
 * The calendar's three views and its side panels.
 *
 * Month is the overview: seven columns, weekends tinted, today ringed,
 * each day carrying up to three event chips and a "+N" that opens the day
 * in the side panel. Week is the working view: seven day columns with the
 * day's events stacked in time order, an all-day row on top. Agenda is the
 * list, grouped by day with a date rail.
 *
 * One colour per kind of event, everywhere - the legend, the chips, the
 * panels - and the legend doubles as the kind filter. A day is selected by
 * clicking it in any view; the side panel then shows that day and offers
 * "Add on this day".
 */

import React, { useMemo } from "react";
import { cn } from "@/utils/cn";
import { CheckCircleIcon, MapPinIcon, PlusIcon } from "@heroicons/react/24/outline";

export interface CalendarEventLite {
  id: string;
  title: string;
  scheduled_at: string;
  end_at?: string;
  is_all_day?: boolean;
  is_completed: boolean;
  location: string | null;
  meeting_type: string | null;
  activity_type: string;
  source_type: "lead" | "project" | "standalone";
  source_name: string | null;
  source_number: string | null;
}

export interface KindStyle {
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
  /** Solid fill for the week view's blocks. */
  solid: string;
}

export const KIND_STYLES: Record<string, KindStyle> = {
  client_meeting: { label: "Client meeting", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500", solid: "bg-blue-500" },
  internal_meeting: { label: "Internal meeting", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", dot: "bg-violet-500", solid: "bg-violet-500" },
  site_visit: { label: "Site visit", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500", solid: "bg-amber-500" },
  follow_up: { label: "Follow-up", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", dot: "bg-teal-500", solid: "bg-teal-500" },
  reminder: { label: "Reminder", bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700", dot: "bg-pink-500", solid: "bg-pink-500" },
  meeting_scheduled: { label: "Meeting", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", solid: "bg-emerald-500" },
  other: { label: "Other", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", dot: "bg-slate-400", solid: "bg-slate-400" },
};

export const kindOf = (e: CalendarEventLite) => {
  const k = e.meeting_type || e.activity_type || "other";
  return KIND_STYLES[k] ? k : "other";
};
export const styleOf = (e: CalendarEventLite) => KIND_STYLES[kindOf(e)];

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const keyOfIso = (iso: string) => dayKey(new Date(iso));
export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "").toLowerCase();
const longDay = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
const shortDay = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short" });

/** "in 2h", "in 3d", "45m ago" - said the way someone would say it. */
export function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const unit = abs < 3600e3 ? `${Math.max(1, Math.round(abs / 60e3))}m` : abs < 86400e3 ? `${Math.round(abs / 3600e3)}h` : `${Math.round(abs / 86400e3)}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}

/* ------------------------------------------------------------------ chip */

/**
 * An event in a cell, the way Google Calendar draws them: an all-day event
 * is a filled bar in its colour; a timed one is a dot, the time and the
 * title on the cell's own background. Both truncate to one line.
 */
export function EventChip({ event, onClick, dense = false }: { event: CalendarEventLite; onClick: () => void; dense?: boolean }) {
  const s = styleOf(event);
  const title = `${event.is_all_day ? "All day" : timeOf(event.scheduled_at)} · ${event.title}${event.source_name ? ` · ${event.source_name}` : ""}`;
  if (event.is_all_day) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={title}
        className={cn(
          "w-full text-left rounded px-1.5 leading-tight truncate text-white font-medium transition-opacity hover:opacity-90",
          dense ? "py-0.5 text-[11px]" : "py-1 text-xs",
          s.solid,
          event.is_completed && "opacity-50 line-through"
        )}
      >
        {event.title}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={cn(
        "w-full text-left rounded px-1 leading-tight truncate transition-colors hover:bg-slate-100",
        dense ? "py-0.5 text-[11px]" : "py-1 text-xs",
        event.is_completed && "opacity-50 line-through"
      )}
    >
      <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5 align-middle", s.dot)} />
      <span className="text-slate-600 tabular-nums">{timeOf(event.scheduled_at)}</span>{" "}
      <span className="font-medium text-slate-800">{event.title}</span>
    </button>
  );
}

/* ---------------------------------------------------------------- legend */

export function KindLegend({ counts, active, onToggle }: { counts: Record<string, number>; active: Set<string>; onToggle: (k: string) => void }) {
  const kinds = Object.keys(KIND_STYLES).filter((k) => (counts[k] ?? 0) > 0);
  if (kinds.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {kinds.map((k) => {
        const s = KIND_STYLES[k];
        const on = active.size === 0 || active.has(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => onToggle(k)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border transition-opacity",
              s.bg,
              s.border,
              s.text,
              !on && "opacity-40"
            )}
            title={on ? `Hide ${s.label.toLowerCase()}s` : `Show ${s.label.toLowerCase()}s`}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
            {s.label}
            <span className="tabular-nums opacity-70">{counts[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- month */

export function MonthView({
  cursor,
  events,
  selected,
  onSelectDay,
  onOpen,
  onMore,
}: {
  cursor: Date;
  events: CalendarEventLite[];
  selected: Date | null;
  onSelectDay: (d: Date) => void;
  onOpen: (e: CalendarEventLite) => void;
  /** "+N more" pressed on a day: open it, anchored to the cell. */
  onMore?: (d: Date, rect: DOMRect) => void;
}) {
  const today = new Date();
  const days = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    const byDay = new Map<string, CalendarEventLite[]>();
    for (const e of events) {
      const k = keyOfIso(e.scheduled_at);
      byDay.set(k, [...(byDay.get(k) ?? []), e]);
    }
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const list = (byDay.get(dayKey(d)) ?? []).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
      return { date: d, inMonth: d.getMonth() === m, events: list };
    });
  }, [cursor, events]);

  // Six rows always (42 cells), so the grid can be told to fill its box and
  // every row takes a sixth of it - the whole month in view, no scrolling.
  const visibleRows = 3;
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="grid grid-cols-7 shrink-0 border-b border-slate-200">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {d}
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-7 grid-rows-6">
        {days.map(({ date, inMonth, events: list }, i) => {
          const isToday = sameDay(date, today);
          const isSel = selected ? sameDay(date, selected) : false;
          const firstOfMonth = date.getDate() === 1;
          return (
            <div
              key={dayKey(date)}
              onClick={() => onSelectDay(date)}
              className={cn(
                "min-h-0 overflow-hidden px-1 pt-1 pb-0.5 cursor-pointer transition-colors border-b border-r border-slate-200",
                i % 7 === 0 && "border-l",
                isSel ? "bg-blue-50/60" : "bg-white hover:bg-slate-50/70"
              )}
            >
              <div className="flex justify-center mb-0.5">
                <span
                  className={cn(
                    "text-xs tabular-nums h-6 min-w-6 px-1.5 flex items-center justify-center rounded-full",
                    isToday ? "bg-blue-600 text-white font-semibold" : inMonth ? "text-slate-700" : "text-slate-400"
                  )}
                >
                  {firstOfMonth ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : date.getDate()}
                </span>
              </div>
              <div className="space-y-px">
                {list.slice(0, visibleRows).map((e) => (
                  <EventChip key={e.id} event={e} onClick={() => onOpen(e)} dense />
                ))}
                {list.length > visibleRows && (
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onMore?.(date, (ev.currentTarget as HTMLElement).getBoundingClientRect());
                    }}
                    className="w-full text-left px-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded"
                  >
                    {list.length - visibleRows} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ week */

export function WeekView({
  cursor,
  events,
  selected,
  onSelectDay,
  onOpen,
}: {
  cursor: Date;
  events: CalendarEventLite[];
  selected: Date | null;
  onSelectDay: (d: Date) => void;
  onOpen: (e: CalendarEventLite) => void;
}) {
  const today = new Date();
  const days = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - cursor.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const k = dayKey(d);
      const list = events.filter((e) => keyOfIso(e.scheduled_at) === k).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
      return { date: d, allDay: list.filter((e) => e.is_all_day), timed: list.filter((e) => !e.is_all_day) };
    });
  }, [cursor, events]);

  return (
    <div className="p-3 h-full min-h-0">
      <div className="grid grid-cols-7 gap-2 h-full min-h-0">
        {days.map(({ date, allDay, timed }) => {
          const isToday = sameDay(date, today);
          const isSel = selected ? sameDay(date, selected) : false;
          return (
            <div
              key={dayKey(date)}
              onClick={() => onSelectDay(date)}
              className={cn(
                "rounded-lg border min-h-0 flex flex-col cursor-pointer transition-colors",
                isSel ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 hover:border-slate-300",
                isToday ? "bg-blue-50/30" : "bg-white"
              )}
            >
              <div className={cn("px-2 py-2 border-b text-center", isToday ? "border-blue-200" : "border-slate-100")}>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{shortDay(date)}</p>
                <p className={cn("text-lg font-semibold leading-tight", isToday ? "text-blue-700" : "text-slate-800")}>{date.getDate()}</p>
              </div>
              {allDay.length > 0 && (
                <div className="px-1.5 pt-1.5 space-y-0.5 border-b border-dashed border-slate-100 pb-1.5">
                  {allDay.map((e) => (
                    <EventChip key={e.id} event={e} onClick={() => onOpen(e)} dense />
                  ))}
                </div>
              )}
              <div className="p-1.5 space-y-1 flex-1 min-h-0 overflow-y-auto">
                {timed.length === 0 && allDay.length === 0 && <p className="text-[11px] text-slate-300 text-center pt-6">—</p>}
                {timed.map((e) => {
                  const s = styleOf(e);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onOpen(e);
                      }}
                      className={cn(
                        "w-full text-left rounded-md border-l-[3px] px-2 py-1.5 bg-white border border-slate-100 shadow-sm hover:shadow transition-shadow",
                        e.is_completed && "opacity-50"
                      )}
                      style={{ borderLeftColor: "transparent" }}
                    >
                      <span className={cn("block h-full", "")}>
                        <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle", s.dot)} />
                        <span className="text-[11px] font-medium text-slate-500 tabular-nums">{timeOf(e.scheduled_at)}</span>
                        <span className={cn("block text-xs font-medium text-slate-800 leading-snug", e.is_completed && "line-through")}>{e.title}</span>
                        {e.source_name && <span className="block text-[10px] text-slate-400 truncate">{e.source_name}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- agenda */

export function AgendaView({ events, onOpen }: { events: CalendarEventLite[]; onOpen: (e: CalendarEventLite) => void }) {
  const groups = useMemo(() => {
    const byDay = new Map<string, CalendarEventLite[]>();
    for (const e of [...events].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))) {
      const k = keyOfIso(e.scheduled_at);
      byDay.set(k, [...(byDay.get(k) ?? []), e]);
    }
    return [...byDay.entries()];
  }, [events]);
  if (groups.length === 0) {
    return <p className="p-10 text-center text-sm text-slate-400">Nothing booked in this period.</p>;
  }
  const today = new Date();
  return (
    <div className="p-3 divide-y divide-slate-100 h-full overflow-y-auto">
      {groups.map(([k, list]) => {
        const d = new Date(list[0].scheduled_at);
        const isToday = sameDay(d, today);
        return (
          <div key={k} className="flex gap-4 py-3">
            <div className="w-16 shrink-0 text-center">
              <p className={cn("text-[10px] uppercase tracking-wider", isToday ? "text-blue-600" : "text-slate-400")}>{shortDay(d)}</p>
              <p className={cn("text-2xl font-semibold leading-none", isToday ? "text-blue-700" : "text-slate-800")}>{d.getDate()}</p>
              <p className="text-[10px] text-slate-400">{d.toLocaleDateString("en-IN", { month: "short" })}</p>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {list.map((e) => (
                <AgendaRow key={e.id} event={e} onOpen={() => onOpen(e)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AgendaRow({ event: e, onOpen, showDate = false }: { event: CalendarEventLite; onOpen: () => void; showDate?: boolean }) {
  const s = styleOf(e);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("w-full text-left flex items-start gap-3 rounded-lg border px-3 py-2 bg-white hover:bg-slate-50 transition-colors", "border-slate-200", e.is_completed && "opacity-60")}
    >
      <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", s.dot)} />
      <span className="flex-1 min-w-0">
        <span className={cn("block text-sm font-medium text-slate-800 truncate", e.is_completed && "line-through")}>{e.title}</span>
        <span className="block text-xs text-slate-500 truncate">
          {showDate ? `${new Date(e.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ` : ""}
          {e.is_all_day ? "All day" : timeOf(e.scheduled_at)}
          {e.end_at && !e.is_all_day ? `–${timeOf(e.end_at)}` : ""}
          {" · "}
          {s.label}
          {e.source_name ? ` · ${e.source_name}` : ""}
        </span>
        {e.location && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
            <MapPinIcon className="w-3 h-3" />
            {e.location}
          </span>
        )}
      </span>
      {e.is_completed && <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />}
    </button>
  );
}

/* ------------------------------------------------------------ side panels */

export function DayPanel({
  date,
  events,
  onOpen,
  onAdd,
  onClear,
}: {
  date: Date;
  events: CalendarEventLite[];
  onOpen: (e: CalendarEventLite) => void;
  onAdd: () => void;
  onClear: () => void;
}) {
  const list = events.filter((e) => sameDay(new Date(e.scheduled_at), date)).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const isToday = sameDay(date, new Date());
  return (
    <section className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{isToday ? "Today" : longDay(date)}</h3>
          {isToday && <p className="text-xs text-slate-500">{longDay(date)}</p>}
        </div>
        {!isToday && (
          <button type="button" onClick={onClear} className="text-xs text-slate-500 hover:text-slate-800">
            Back to today
          </button>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        {list.length === 0 ? (
          <p className="text-sm text-slate-400 py-3 text-center">Nothing booked.</p>
        ) : (
          list.map((e) => <AgendaRow key={e.id} event={e} onOpen={() => onOpen(e)} />)
        )}
        <button
          type="button"
          onClick={onAdd}
          className="w-full mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/40"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add on this day
        </button>
      </div>
    </section>
  );
}

export function UpNextPanel({ events, onOpen }: { events: CalendarEventLite[]; onOpen: (e: CalendarEventLite) => void }) {
  const now = Date.now();
  const next = [...events]
    .filter((e) => !e.is_completed && new Date(e.scheduled_at).getTime() >= now)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const first = next[0];
  const groups = new Map<string, CalendarEventLite[]>();
  for (const e of next.slice(0, 12)) {
    const k = keyOfIso(e.scheduled_at);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return (
    <section className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Up next</h3>
        {first ? (
          <p className="text-xs text-slate-500 truncate">
            <span className={cn("font-medium", styleOf(first).text)}>{first.title}</span> · {relative(first.scheduled_at)}
          </p>
        ) : (
          <p className="text-xs text-slate-400">Nothing coming up in this period.</p>
        )}
      </div>
      {groups.size > 0 && (
        <div className="p-3 space-y-3">
          {[...groups.entries()].map(([k, list]) => {
            const d = new Date(list[0].scheduled_at);
            return (
              <div key={k}>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                  {sameDay(d, new Date()) ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <div className="space-y-1.5">
                  {list.map((e) => (
                    <AgendaRow key={e.id} event={e} onOpen={() => onOpen(e)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function OverduePanel({ events, onOpen }: { events: CalendarEventLite[]; onOpen: (e: CalendarEventLite) => void }) {
  if (events.length === 0) return null;
  return (
    <section className="bg-white rounded-lg border border-red-200">
      <div className="px-4 py-3 border-b border-red-100 bg-red-50/60 rounded-t-lg">
        <h3 className="text-sm font-semibold text-red-700">
          Overdue <span className="font-normal text-red-500">{events.length}</span>
        </h3>
        <p className="text-xs text-red-600/80">Booked, not marked done. Either it happened and wants closing, or it wants rebooking.</p>
      </div>
      <div className="p-3 space-y-1.5">
        {events.map((e) => (
          <AgendaRow key={e.id} event={e} onOpen={() => onOpen(e)} showDate />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ mini month */

/** The small month in the left rail: navigates the big one, marks today and days with events. */
export function MiniMonth({
  cursor,
  onCursor,
  eventDays,
  onPickDay,
}: {
  cursor: Date;
  onCursor: (d: Date) => void;
  eventDays: Set<string>;
  onPickDay: (d: Date) => void;
}) {
  const today = new Date();
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  return (
    <div className="select-none">
      <div className="flex items-center justify-between px-1 mb-1">
        <p className="text-sm font-medium text-slate-800">{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
        <div className="flex items-center">
          <button type="button" onClick={() => onCursor(new Date(y, m - 1, 1))} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Previous month">‹</button>
          <button type="button" onClick={() => onCursor(new Date(y, m + 1, 1))} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Next month">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-slate-500 mb-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="py-0.5">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const isToday = sameDay(d, today);
          const inMonth = d.getMonth() === m;
          const has = eventDays.has(dayKey(d));
          return (
            <button
              key={dayKey(d)}
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                "relative mx-auto w-6 h-6 rounded-full text-[11px] tabular-nums flex items-center justify-center transition-colors",
                isToday ? "bg-blue-600 text-white font-semibold" : inMonth ? "text-slate-700 hover:bg-slate-100" : "text-slate-300 hover:bg-slate-50"
              )}
            >
              {d.getDate()}
              {has && !isToday && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- day popover */

/** "+N more" opens the day: its events, over the grid, anchored to the cell. */
export function DayPopover({
  date,
  events,
  anchor,
  onOpen,
  onClose,
  onAdd,
}: {
  date: Date;
  events: CalendarEventLite[];
  anchor: { top: number; left: number; width: number };
  onOpen: (e: CalendarEventLite) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const list = events.filter((e) => sameDay(new Date(e.scheduled_at), date)).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const left = Math.min(anchor.left, window.innerWidth - 300);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 w-72 rounded-xl bg-white shadow-xl border border-slate-200 p-3" style={{ top: anchor.top, left }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{date.toLocaleDateString("en-IN", { weekday: "short" })}</p>
            <p className="text-2xl font-semibold text-slate-800 leading-none">{date.getDate()}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {list.map((e) => <EventChip key={e.id} event={e} onClick={() => onOpen(e)} />)}
        </div>
        <button type="button" onClick={onAdd} className="mt-2 w-full text-left text-xs text-blue-600 hover:underline">+ Add on this day</button>
      </div>
    </>
  );
}
