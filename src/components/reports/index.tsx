"use client";

/**
 * The shared furniture of a report page.
 *
 * Sales Reports and Project Reports are two reports about one business and they
 * were built weeks apart, so they had drifted into looking like two products:
 * one with coloured metric chips, tinted pills and bar rows, the other with
 * plain boxes of numbers. Copying the styling across would have left two sets to
 * keep in step, so the pieces live here and both pages import them.
 *
 * What belongs in here: anything whose job is to make a figure legible. What
 * does not: anything that knows what the figure means. A funnel step and an
 * overdue project are both `StatBar`, and neither of them belongs to this file.
 */

import React from "react";

/* ------------------------------------------------------------------ layout */

/**
 * A band of the report, with a heading saying what its figures cover.
 *
 * `action` sits on the trailing edge of the heading row. Because every heading
 * is the same height the control lands in the same place on each band, rather
 * than at whatever x the note happens to end on.
 */
export function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2.5 flex-wrap min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </h2>
          {note && <span className="text-[11px] text-slate-400">{note}</span>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * A panel.
 *
 * `flush` is for panels whose content is a list or a table: the rows carry their
 * own `px-4` and run the full width, so a hover highlight meets the border
 * instead of stopping just short of it.
 */
export function Panel({
  title,
  hint,
  flush = false,
  children,
}: {
  title: string;
  hint?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div
        className={`flex items-baseline justify-between gap-3 px-4 pt-3.5 ${
          flush ? "pb-2" : "pb-3"
        }`}
      >
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint && (
          <span className="text-[11px] text-slate-400 text-right shrink-0">
            {hint}
          </span>
        )}
      </div>
      <div className={flush ? "pb-2" : "px-4 pb-4"}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ figures */

export type MetricTone = "blue" | "emerald" | "violet" | "amber" | "slate" | "red";

/**
 * A headline figure, with its icon in a tinted chip.
 *
 * Colour carries meaning rather than decoration, and the same meaning on both
 * reports: blue is work in play, emerald is something finished or won, amber is
 * something slipping, red is something wrong, violet and slate are neutral
 * counts. A reader who learns that once can scan either page without reading
 * the labels.
 */
export function Metric({
  label,
  value,
  hint,
  hintTone = "muted",
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "muted" | "good" | "warn" | "bad";
  tone: MetricTone;
  icon: React.ReactNode;
}) {
  const tones = {
    blue: { chip: "bg-blue-100 text-blue-600", value: "text-slate-900" },
    emerald: {
      chip: "bg-emerald-100 text-emerald-600",
      value: "text-emerald-700",
    },
    violet: { chip: "bg-violet-100 text-violet-600", value: "text-slate-900" },
    amber: { chip: "bg-amber-100 text-amber-600", value: "text-slate-900" },
    slate: { chip: "bg-slate-100 text-slate-600", value: "text-slate-900" },
    red: { chip: "bg-red-100 text-red-600", value: "text-red-700" },
  }[tone];
  const hints = {
    muted: "text-slate-400",
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-red-600",
  }[hintTone];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500">{label}</span>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tones.chip}`}
        >
          {icon}
        </div>
      </div>
      <p className={`text-xl font-bold tabular-nums ${tones.value}`}>{value}</p>
      {hint && <p className={`text-[11px] ${hints}`}>{hint}</p>}
    </div>
  );
}

/**
 * A labelled bar: name on the left, figure on the right, proportion beneath.
 *
 * The shape both reports reach for constantly - a funnel step, a loss reason, a
 * status mix, tasks per project. `max` is the scale the bar is drawn against, so
 * a set of these compares against one another rather than each filling its own
 * track.
 */
export function StatBar({
  label,
  value,
  max,
  bar = "bg-blue-400",
  right,
  aside,
  thin = false,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  /** Tailwind background for the fill. */
  bar?: string;
  /** What to show on the right of the label row. Defaults to the value. */
  right?: React.ReactNode;
  /** A line beneath the bar, for context that is not the number. */
  aside?: React.ReactNode;
  thin?: boolean;
}) {
  const width = Math.max(max > 0 ? (value / max) * 100 : 0, value > 0 ? 2 : 0);
  const h = thin ? "h-1.5" : "h-2";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-slate-700">{label}</span>
        <span className="shrink-0 tabular-nums font-medium text-slate-900">
          {right ?? value}
        </span>
      </div>
      <div className={`mt-1 ${h} bg-slate-100 rounded overflow-hidden`}>
        <div className={`${h} rounded ${bar}`} style={{ width: `${width}%` }} />
      </div>
      {aside && <div className="mt-1 text-[11px]">{aside}</div>}
    </div>
  );
}

/** A small tinted pill, for a rate or a count that carries a judgement. */
export function Pill({
  children,
  tint,
}: {
  children: React.ReactNode;
  tint: string;
}) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium tabular-nums ${tint}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------- tints */

/** Strongest performer reads strongest. Used for rates out of 100. */
export const rankTint = (rate: number) =>
  rate >= 60
    ? "text-emerald-700 bg-emerald-50"
    : rate >= 30
      ? "text-amber-700 bg-amber-50"
      : rate > 0
        ? "text-orange-700 bg-orange-50"
        : "text-slate-400 bg-slate-50";

/** How worried to look about something that has not moved, in days. */
export const ageTint = (days: number) =>
  days >= 60
    ? "text-red-600"
    : days >= 30
      ? "text-amber-600"
      : days >= 7
        ? "text-orange-600"
        : "text-slate-400";

/* ------------------------------------------------------------------- format */

/** Lakhs and crores - a rupee figure in millions reads as a foreign currency. */
export const money = (amount: number) => {
  if (!amount) return "₹0";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
};

export const humanise = (value: string) =>
  value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/* -------------------------------------------------------------------- icons */

export const Icon = ({ d }: { d: string }) => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

export const ICONS = {
  pipeline: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  money:
    "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  target:
    "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  deal: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  people:
    "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  warning:
    "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  list: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  calendar:
    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  building:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
};
