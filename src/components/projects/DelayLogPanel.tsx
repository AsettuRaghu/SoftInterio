"use client";

/**
 * The delay log: where the time went, and whose it was.
 *
 * One line closed - "10 days behind the agreed plan · client 7 · vendor 3" -
 * and, opened, every hold the plan recorded: stage, step, who we waited on,
 * why, from when to when, how many days. It reads the holds people pressed
 * Pause for; nothing is inferred. A step that simply ran long with no hold
 * is not a delay anyone owns, and it does not appear here.
 *
 * Sits beside "Waiting on others" on the Plan tab. That list is what we are
 * waiting for; this is what waiting has cost so far.
 */

import React, { useCallback, useEffect, useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { DelayOwnerLabels, type DelayOwner } from "@/types/tasks";

interface Entry {
  task_id: string;
  step: string;
  stage: string | null;
  owner: DelayOwner;
  reason_label: string | null;
  counterpart: string | null;
  note: string | null;
  started_at: string;
  ended_at: string | null;
  expected_until: string | null;
  days: number;
  expected_days: number | null;
  recorded_by: string | null;
}

interface Data {
  agreed_end: string | null;
  agreed_version: number | null;
  current_end: string | null;
  slip_days: number | null;
  project_hold: { owner: DelayOwner; since: string | null } | null;
  totals: Partial<Record<DelayOwner, number>>;
  expected_totals: Partial<Record<DelayOwner, number>>;
  entries: Entry[];
}

interface Props {
  projectId: string;
  /** Bumped by the page whenever the plan changes, so the log re-reads. */
  refreshKey?: number;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

const OWNER_TONE: Record<DelayOwner, string> = {
  client: "bg-amber-50 text-amber-800 border-amber-200",
  vendor: "bg-violet-50 text-violet-800 border-violet-200",
  internal: "bg-blue-50 text-blue-800 border-blue-200",
  third_party: "bg-slate-100 text-slate-700 border-slate-200",
};

const ORDER: DelayOwner[] = ["client", "vendor", "internal", "third_party"];

export function DelayLogPanel({ projectId, refreshKey }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/delays`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json.data ?? null);
    } catch {
      /* the panel simply stays as it was */
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!data) return null;
  const { entries, totals, expected_totals, slip_days, agreed_end, current_end } = data;
  const owned = ORDER.filter((o) => (expected_totals[o] ?? 0) > 0);
  if (entries.length === 0 && (slip_days ?? 0) <= 0) return null;

  const slipText =
    slip_days === null
      ? null
      : slip_days > 0
        ? `${slip_days} day${slip_days === 1 ? "" : "s"} behind the agreed plan`
        : slip_days < 0
          ? `${-slip_days} day${slip_days === -1 ? "" : "s"} ahead of the agreed plan`
          : "on the agreed plan";

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white">
      <div className="px-3 py-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-left min-w-0 flex-wrap"
        >
          <ChevronRightIcon
            className={cn("w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform", open && "rotate-90")}
          />
          <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">Delays</span>
          {slipText && (
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                (slip_days ?? 0) > 0 ? "font-medium text-red-600" : "text-slate-500"
              )}
            >
              {slipText}
            </span>
          )}
          {owned.map((o) => (
            <span
              key={o}
              className={cn("text-[11px] px-1.5 py-0.5 rounded border whitespace-nowrap", OWNER_TONE[o])}
              title={`Days on hold waiting on ${DelayOwnerLabels[o].toLowerCase()}`}
            >
              {DelayOwnerLabels[o]} {expected_totals[o]}d
              {(totals[o] ?? 0) !== (expected_totals[o] ?? 0) ? ` (${totals[o] ?? 0} so far)` : ""}
            </span>
          ))}
          {entries.length === 0 && (
            <span className="text-xs text-slate-500">no hold recorded — the plan moved without anyone being named</span>
          )}
        </button>
        <span className="flex-1" />
        {agreed_end && current_end && (
          <span className="text-xs text-slate-500 whitespace-nowrap" title="Agreed at kick-off → where the plan ends now">
            Agreed {fmt(agreed_end)} → now {fmt(current_end)}
          </span>
        )}
      </div>

      {open && entries.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {entries.map((e, i) => (
            <li key={`${e.task_id}-${i}`} className="px-3 py-2 flex items-start gap-3 text-sm">
              <span className={cn("mt-0.5 text-[11px] px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0", OWNER_TONE[e.owner])}>
                {DelayOwnerLabels[e.owner]}
                {e.counterpart ? ` · ${e.counterpart}` : ""}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-slate-800">
                  {e.stage ? <span className="text-slate-500">{e.stage} · </span> : null}
                  {e.step}
                  {e.reason_label ? <span className="text-slate-500"> — {e.reason_label}</span> : null}
                </span>
                <span className="block text-xs text-slate-500">
                  {fmt(e.started_at)} → {e.ended_at ? fmt(e.ended_at) : "still waiting"}
                  {!e.ended_at && e.expected_until ? ` (expected ${fmt(e.expected_until)})` : ""}
                  {e.recorded_by ? ` · recorded by ${e.recorded_by}` : ""}
                  {e.note ? ` · "${e.note}"` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={cn("block text-sm font-semibold tabular-nums", e.ended_at ? "text-slate-800" : "text-red-600")}>
                  {e.days}d
                </span>
                {!e.ended_at && e.expected_days !== null && e.expected_days > e.days && (
                  <span className="block text-[11px] text-slate-500 tabular-nums">of {e.expected_days} expected</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
