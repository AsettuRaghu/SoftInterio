"use client";

/**
 * What the project is waiting on someone else for.
 *
 * Every open entry in project_dependencies - the client/vendor steps of the
 * playbook (raised by trigger) and anything the PM added by hand - with who
 * owns it and when it was expected. Overdue in red, due this week in amber.
 * A tick marks "they delivered"; an entry tied to a playbook step is settled
 * by the step and cannot be ticked here.
 *
 * Sits on the Plan tab of a live project. The kick-off checklist shows the
 * same list while the project is new; this is the working view after.
 */

import React, { useCallback, useEffect, useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { buttonVariants } from "@/components/ui/Button";

interface Dependency {
  id: string;
  task_id: string | null;
  owner_type: "client" | "vendor";
  counterpart: string | null;
  description: string;
  expected_by: string | null;
  raised_at: string;
  resolved_at: string | null;
}

interface Props {
  projectId: string;
  canEdit: boolean;
  /** Bumped by the page when the plan changes, so the list re-reads. */
  refreshKey?: number;
  onChanged?: () => void;
  onError: (message: string) => void;
}

const OWNER: Record<Dependency["owner_type"], { word: string; chip: string }> = {
  client: { word: "Client", chip: "bg-amber-100 text-amber-800" },
  vendor: { word: "Vendor", chip: "bg-violet-100 text-violet-800" },
};

function daysFrom(date: string): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function WaitingOnPanel({ projectId, canEdit, refreshKey = 0, onChanged, onError }: Props) {
  const [items, setItems] = useState<Dependency[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ owner_type: "client", description: "", expected_by: "", counterpart: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/dependencies`);
      const json = await res.json();
      if (res.ok) setItems(json.data ?? []);
    } catch {
      /* keep what is on screen */
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const act = async (key: string, fn: () => Promise<Response>) => {
    setBusy(key);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(json.error || "That did not save");
        return false;
      }
      await load();
      onChanged?.();
      return true;
    } catch {
      onError("Could not reach the server");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const patch = (id: string, body: Record<string, unknown>) =>
    act(id, () =>
      fetch(`/api/projects/${projectId}/dependencies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  const add = async () => {
    if (!draft.description.trim()) return;
    const ok = await act("new", () =>
      fetch(`/api/projects/${projectId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_type: draft.owner_type,
          description: draft.description.trim(),
          expected_by: draft.expected_by || null,
          counterpart: draft.counterpart.trim() || null,
        }),
      })
    );
    if (ok) {
      setDraft({ owner_type: "client", description: "", expected_by: "", counterpart: "" });
      setAdding(false);
    }
  };

  if (items === null) return null;

  const open = items
    .filter((d) => !d.resolved_at)
    .sort((a, b) => (a.expected_by ?? "9999").localeCompare(b.expected_by ?? "9999"));
  const done = items.filter((d) => d.resolved_at);
  const overdue = open.filter((d) => d.expected_by && daysFrom(d.expected_by) < 0);

  if (open.length === 0 && done.length === 0 && !canEdit) return null;

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-800">Waiting on others</h3>
        <span className="text-xs text-slate-500">
          {open.length === 0
            ? "Nothing outstanding"
            : `${open.length} open${overdue.length ? ` · ${overdue.length} overdue` : ""}`}
        </span>
        <span className="flex-1" />
        {done.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            {showDone ? "Hide delivered" : `${done.length} delivered`}
          </button>
        )}
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Add
          </button>
        )}
      </div>

      {open.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {open.map((d) => {
            const days = d.expected_by ? daysFrom(d.expected_by) : null;
            const tone =
              days === null
                ? "text-slate-400"
                : days < 0
                  ? "text-red-600 font-medium"
                  : days <= 7
                    ? "text-amber-700"
                    : "text-slate-500";
            const rowBusy = busy === d.id;
            return (
              <li key={d.id} className={cn("px-4 py-2 flex flex-wrap items-center gap-2 text-xs", rowBusy && "opacity-60")}>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", OWNER[d.owner_type].chip)}>
                  {OWNER[d.owner_type].word}
                </span>
                <span className="flex-1 min-w-[12rem] text-slate-800">
                  {d.description}
                  {d.counterpart && <span className="text-slate-500"> · {d.counterpart}</span>}
                </span>
                <span className={cn("tabular-nums whitespace-nowrap", tone)}>
                  {days === null
                    ? "no date"
                    : days < 0
                      ? `${-days}d overdue · ${fmt(d.expected_by!)}`
                      : days === 0
                        ? "due today"
                        : `due ${fmt(d.expected_by!)}`}
                </span>
                {canEdit && (
                  <input
                    type="date"
                    value={d.expected_by ?? ""}
                    disabled={rowBusy}
                    onChange={(e) => void patch(d.id, { expected_by: e.target.value || null })}
                    title="Expected by"
                    className="rounded border border-slate-200 px-1.5 py-0.5 bg-white"
                  />
                )}
                {canEdit && !d.task_id ? (
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => void patch(d.id, { resolved: true })}
                    title="They delivered"
                    className="w-6 h-6 flex items-center justify-center rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 whitespace-nowrap" title="Settled by completing the step">
                    step
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showDone && done.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/60">
          {done.map((d) => (
            <li key={d.id} className="px-4 py-1.5 flex items-center gap-2 text-xs text-slate-500">
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium opacity-70", OWNER[d.owner_type].chip)}>
                {OWNER[d.owner_type].word}
              </span>
              <span className="flex-1 line-through">{d.description}</span>
              <span className="tabular-nums">
                delivered {fmt(d.resolved_at!)}
                {d.expected_by && daysFrom(d.expected_by) < 0 && new Date(d.resolved_at!) > new Date(d.expected_by)
                  ? ` · ${Math.round((new Date(d.resolved_at!).getTime() - new Date(d.expected_by).getTime()) / 86400000)}d late`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="px-4 py-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <select
            value={draft.owner_type}
            onChange={(e) => setDraft((v) => ({ ...v, owner_type: e.target.value }))}
            className="rounded border border-slate-200 bg-white px-1.5 py-1"
          >
            <option value="client">Client</option>
            <option value="vendor">Vendor</option>
          </select>
          <input
            type="text"
            autoFocus
            value={draft.description}
            onChange={(e) => setDraft((v) => ({ ...v, description: e.target.value }))}
            placeholder="What are we waiting for?"
            className="flex-1 min-w-[12rem] rounded border border-slate-200 px-2 py-1"
          />
          <input
            type="text"
            value={draft.counterpart}
            onChange={(e) => setDraft((v) => ({ ...v, counterpart: e.target.value }))}
            placeholder="Who (optional)"
            className="w-32 rounded border border-slate-200 px-2 py-1"
          />
          <input
            type="date"
            value={draft.expected_by}
            onChange={(e) => setDraft((v) => ({ ...v, expected_by: e.target.value }))}
            className="rounded border border-slate-200 px-1.5 py-1 bg-white"
          />
          <button
            type="button"
            disabled={busy === "new" || !draft.description.trim()}
            onClick={() => void add()}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
