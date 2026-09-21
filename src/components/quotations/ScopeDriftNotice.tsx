"use client";

/**
 * "The scope has moved since this quotation" - one quiet line above the
 * document, with the detail a click away. Read from
 * /api/quotations/[id]/scope-drift; nothing here changes the quotation.
 *
 * What it offers depends on where the quotation is:
 *   draft              Bring in (the additions; sizes and drops are for the
 *                      person to judge)
 *   sent / rejected    Revise, then bring in - said, not offered, because
 *                      Revise lives in the page header
 *   approved, project  Raise a variation: a new quotation of only what has
 *                      changed since sign-off
 * Nothing is shown when nothing has moved.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import type { ScopeDrift } from "@/lib/quotations/scope-drift";

export function ScopeDriftNotice({
  quotationId,
  status,
  projectId,
  onBringIn,
  bringingIn = false,
  refreshKey,
  className,
}: {
  quotationId: string;
  status: string;
  projectId?: string | null;
  /** The builder's own "Bring in from scope"; omit where it cannot be offered. */
  onBringIn?: () => void | Promise<void>;
  bringingIn?: boolean;
  /** Change to re-read - after a bring-in, a save, a revise. */
  refreshKey?: unknown;
  className?: string;
}) {
  const router = useRouter();
  const [drift, setDrift] = useState<ScopeDrift | null>(null);
  const [open, setOpen] = useState(false);
  const [raising, setRaising] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/quotations/${quotationId}/scope-drift`);
    const json = await res.json().catch(() => ({}));
    setDrift(res.ok ? json.data : null);
  }, [quotationId]);

  useEffect(() => {
    // setState happens after the fetch resolves; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  if (!drift || drift.total === 0) return null;

  const a = drift.additions;
  const addCount = a.spaces.length + a.components.length + a.lines.length;
  const parts: string[] = [];
  if (addCount) {
    const bits = [
      a.spaces.length ? `${a.spaces.length} room${a.spaces.length === 1 ? "" : "s"}` : null,
      a.components.length ? `${a.components.length} component${a.components.length === 1 ? "" : "s"}` : null,
      a.lines.length ? `${a.lines.length} item${a.lines.length === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    parts.push(`${bits.join(", ")} not in it yet`);
  }
  if (drift.resized.length) parts.push(`${drift.resized.length} component${drift.resized.length === 1 ? "" : "s"} resized`);
  if (drift.dropped.length) parts.push(`${drift.dropped.length} item${drift.dropped.length === 1 ? "" : "s"} no longer chosen`);
  if (drift.not_ours.length) parts.push(`${drift.not_ours.length} now done by someone else`);

  const raiseVariation = async () => {
    if (!projectId || raising) return;
    setRaising(true);
    setError(null);
    const res = await fetch("/api/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, from_scope: true, variation: true }),
    });
    const json = await res.json().catch(() => ({}));
    setRaising(false);
    if (!res.ok) return setError(json.error || "Could not raise the variation");
    router.push(`/dashboard/quotations/${json.quotation?.id}`);
  };

  const canBring = status === "draft" && !!onBringIn && addCount > 0;
  const canVary = status === "approved" && !!projectId;
  const since = drift.last_change ? new Date(drift.last_change).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;

  return (
    <div className={cn("rounded-lg border border-amber-200 bg-amber-50/60 text-amber-900", className)}>
      <div className="px-3 py-2 flex items-center gap-2 text-xs">
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 font-medium hover:underline">
          {open ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
          The scope has moved since this quotation{since ? ` (last change ${since})` : ""}
        </button>
        <span className="text-amber-800/80 truncate">· {parts.join(" · ")}</span>
        <span className="flex-1" />
        {error && <span className="text-red-700">{error}</span>}
        {canBring && (
          <button type="button" onClick={() => void onBringIn?.()} disabled={bringingIn} className="px-2.5 py-1 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-60">
            {bringingIn ? "Bringing in…" : "Bring in"}
          </button>
        )}
        {!canBring && status !== "draft" && !canVary && <span className="text-amber-800/80">Revise to bring it in.</span>}
        {canVary && (
          <button type="button" onClick={() => void raiseVariation()} disabled={raising} className="px-2.5 py-1 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-60" title="A new quotation of only what has changed since this one was approved">
            {raising ? "Raising…" : "Raise a variation"}
          </button>
        )}
      </div>
      {open && (
        <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs border-t border-amber-200/70 pt-2">
          {addCount > 0 && (
            <div>
              <p className="font-medium mb-0.5">Not in this quotation yet</p>
              <ul className="space-y-0.5 text-amber-900/90">
                {a.spaces.map((n) => <li key={`s-${n}`}>Room: {n}</li>)}
                {a.components.map((n) => <li key={`c-${n}`}>Component: {n}</li>)}
                {a.lines.map((n, i) => <li key={`l-${i}-${n}`}>Item: {n}</li>)}
              </ul>
            </div>
          )}
          {drift.resized.length > 0 && (
            <div>
              <p className="font-medium mb-0.5">Resized on the scope</p>
              <ul className="space-y-0.5 text-amber-900/90">
                {drift.resized.map((r, i) => <li key={i}>{r.component} ({r.space}): {r.from} → {r.to}</li>)}
              </ul>
            </div>
          )}
          {drift.dropped.length > 0 && (
            <div>
              <p className="font-medium mb-0.5">No longer the first preference</p>
              <ul className="space-y-0.5 text-amber-900/90">
                {drift.dropped.map((d, i) => <li key={i}>{d.line} on {d.component}</li>)}
              </ul>
            </div>
          )}
          {drift.not_ours.length > 0 && (
            <div>
              <p className="font-medium mb-0.5">Now done by someone else</p>
              <ul className="space-y-0.5 text-amber-900/90">
                {drift.not_ours.map((n, i) => <li key={i}>{n.component}: {n.owner}</li>)}
              </ul>
            </div>
          )}
          <p className="md:col-span-2 text-amber-800/70">This quotation is not changed by any of this. Bring in what is new, or revise it; sizes and dropped items are yours to judge.</p>
        </div>
      )}
    </div>
  );
}
