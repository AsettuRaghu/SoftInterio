"use client";

/**
 * The cells every list in the app is built from - the shape the leads and
 * projects lists settled on, so a reader walks from one list to the next
 * without relearning it.
 *
 *   Headline    the thing's name in bold, then one or two quieter lines: what
 *               it is, then where or what about. Small chips sit beside the
 *               name for a fact that changes what the row IS.
 *   StatusPill  a rounded pill with a dot, one tone per meaning.
 *   UpdatedCell when it was last touched, in plain slate - the same cell the
 *               leads and projects lists use for activity, without the
 *               staleness colouring, which means nothing for a template.
 */

import React from "react";
import { LastActivityCell } from "@/components/leads/activity-cells";

export function Headline({
  title,
  line1,
  line2,
  chips,
}: {
  title: React.ReactNode;
  line1?: React.ReactNode;
  line2?: React.ReactNode;
  chips?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
        {chips}
      </div>
      {line1 && (
        <p className="text-xs text-slate-600 truncate" title={typeof line1 === "string" ? line1 : undefined}>
          {line1}
        </p>
      )}
      {line2 && (
        <p className="text-xs text-slate-400 truncate" title={typeof line2 === "string" ? line2 : undefined}>
          {line2}
        </p>
      )}
    </div>
  );
}

export type PillTone = "green" | "blue" | "amber" | "violet" | "slate" | "red";

const PILL: Record<PillTone, { bg: string; text: string; dot: string }> = {
  green: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  blue: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  amber: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  violet: { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500" },
  slate: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
  red: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const c = PILL[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  );
}

/** A small fact beside the headline - "Default", "Cover", a level. */
export function Chip({ label, tone = "slate" }: { label: string; tone?: PillTone }) {
  const c = PILL[tone];
  return (
    <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      {label}
    </span>
  );
}

const TOUCH_LABELS: Record<string, string> = { created: "Created", edited: "Edited" };

export function UpdatedCell({ created_at, updated_at }: { created_at?: string | null; updated_at?: string | null }) {
  const touches: { type: string; at: string }[] = [];
  if (created_at) touches.push({ type: "created", at: created_at });
  if (updated_at && updated_at !== created_at) touches.push({ type: "edited", at: updated_at });
  touches.sort((a, b) => (a.at < b.at ? 1 : -1));
  const last = touches[0];
  return (
    <LastActivityCell
      at={last?.at}
      type={last?.type}
      recent={touches.slice(1)}
      labels={TOUCH_LABELS}
      urgency={false}
    />
  );
}
