"use client";

/**
 * A discussion thread on the scope - one space or component, or the scope
 * as a whole. Each entry is a note or a decision; one flagged as needing
 * rework can become a task on the lead or project. Shared by the space
 * panel and the Conversation section of the Scope tab.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowTopRightOnSquareIcon, CheckBadgeIcon, TrashIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import type { useConfirm } from "@/components/ui/ConfirmDialog";
import type { ScopeComment } from "@/types/property-scope";

export function ScopeDiscussion({
  scopeItemId,
  propertyId,
  linkedType,
  linkedId,
  readOnly,
  confirm,
  onCountChange,
}: {
  /** null = the scope as a whole. */
  scopeItemId: string | null;
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  /** Tells the caller how much is here, for a collapsed header. */
  onCountChange?: (counts: { notes: number; decisions: number }) => void;
}) {
  const [rows, setRows] = useState<ScopeComment[]>([]);
  const [text, setText] = useState("");
  const [decision, setDecision] = useState(false);
  const [rework, setRework] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/scope/conversation${scopeItemId ? `?item=${scopeItemId}` : "?item=none"}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) setRows(json.data ?? []);
  }, [scopeItemId, propertyId]);

  useEffect(() => {
    // setState happens after the fetch resolves; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    onCountChange?.({ notes: rows.filter((r) => !r.is_decision).length, decisions: rows.filter((r) => r.is_decision).length });
  }, [rows, onCountChange]);

  const post = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/properties/${propertyId}/scope/conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope_item_id: scopeItemId, body: text.trim(), is_decision: decision, needs_rework: rework }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || "Could not save");
    setRows((r) => [...r, json.data]);
    setText("");
    setDecision(false);
    setRework(false);
  };

  const patch = async (c: ScopeComment, p: Partial<ScopeComment>) => {
    setRows((r) => r.map((x) => (x.id === c.id ? { ...x, ...p } : x)));
    await fetch(`/api/properties/${propertyId}/scope/conversation/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  };

  const remove = async (c: ScopeComment) => {
    if (!(await confirm({ title: "Delete this entry?", message: "It leaves the discussion for good.", confirmLabel: "Delete", tone: "danger" }))) return;
    setRows((r) => r.filter((x) => x.id !== c.id));
    await fetch(`/api/properties/${propertyId}/scope/conversation/${c.id}`, { method: "DELETE" });
  };

  const makeTask = async (c: ScopeComment) => {
    const res = await fetch(`/api/properties/${propertyId}/scope/conversation/${c.id}/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ related_type: linkedType, related_id: linkedId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not create the task");
    setRows((r) => r.map((x) => (x.id === c.id ? { ...x, task_id: json.data.task_id, needs_rework: true } : x)));
  };

  return (
    <div className="flex flex-col">
      <div className="p-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400">No discussion yet. What was said, what was agreed - it goes here and stays with the record into the project.</p>
        ) : (
          rows.map((c) => (
            <div key={c.id} className={cn("group rounded-lg border px-3 py-2", c.is_decision ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white")}>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-medium text-slate-700">{c.author_name}</span>
                <span>{new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                {c.is_decision && <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><CheckBadgeIcon className="w-3.5 h-3.5" /> decision</span>}
                {c.needs_rework && !c.task_id && <span className="text-amber-700 font-medium">needs rework</span>}
                {c.task_id && <Link href={`/dashboard/tasks/${c.task_id}`} className="text-blue-600 hover:underline inline-flex items-center gap-0.5">task <ArrowTopRightOnSquareIcon className="w-3 h-3" /></Link>}
                <span className="flex-1" />
                {!readOnly && (
                  <span className="hidden group-hover:inline-flex items-center gap-1">
                    <button type="button" onClick={() => void patch(c, { is_decision: !c.is_decision })} className="px-1.5 py-0.5 rounded hover:bg-slate-100" title={c.is_decision ? "Back to a note" : "Mark as the decision"}>
                      {c.is_decision ? "un-decide" : "decision"}
                    </button>
                    {!c.task_id && (
                      <button type="button" onClick={() => void makeTask(c)} className="px-1.5 py-0.5 rounded hover:bg-slate-100" title="Turn into a task on this record">
                        make a task
                      </button>
                    )}
                    <button type="button" onClick={() => void remove(c)} className="px-1.5 py-0.5 rounded hover:bg-red-50 text-red-600" title="Delete">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))
        )}
      </div>
      {!readOnly && (
        <div className="border-t border-slate-100 p-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void post();
            }}
            rows={2}
            placeholder="What was said or agreed… (⌘↵ to post)"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 resize-none"
          />
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={decision} onChange={(e) => setDecision(e.target.checked)} className="rounded border-slate-300" /> Decision
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={rework} onChange={(e) => setRework(e.target.checked)} className="rounded border-slate-300" /> Needs rework
            </label>
            <span className="flex-1" />
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button type="button" onClick={() => void post()} disabled={busy || !text.trim()} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

