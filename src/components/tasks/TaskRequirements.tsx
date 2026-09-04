"use client";

/**
 * The gates on a task: what must be true before it can be completed.
 *
 * Sign-off, not routed approval — anyone who can see the task may confirm a
 * review step, and the record is who and when. Upload gates are read-only
 * here: they satisfy themselves when a file lands, and letting someone tick
 * one by hand would make the evidence worthless.
 */

import React, { useCallback, useEffect, useState } from "react";

interface Requirement {
  id: string;
  requirement_type: string;
  requirement_key: string;
  requirement_label?: string | null;
  is_required: boolean;
  is_satisfied: boolean;
  satisfied_at?: string | null;
  note?: string | null;
  satisfied_user?: { id: string; name: string } | null;
}

interface Props {
  taskId: string;
  readOnly?: boolean;
  /** Called after a change, so the parent can refresh gate-dependent state. */
  onChanged?: () => void;
}

/** Types a person can confirm. Everything else proves itself. */
const SIGNABLE = new Set(["approval", "checklist", "manual"]);

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function TaskRequirements({ taskId, readOnly = false, onChanged }: Props) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/requirements`);
      if (!response.ok) return;
      const data = await response.json();
      setRequirements(data.requirements || []);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "sign_off" | "revoke", text?: string) => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/requirements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id: id, action, note: text }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not update the requirement");
        return;
      }
      setRequirements(data.requirements || []);
      setNoteFor(null);
      setNote("");
      onChanged?.();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading || requirements.length === 0) return null;

  const outstanding = requirements.filter(
    (r) => r.is_required && !r.is_satisfied
  ).length;

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Requirements
        <span
          className={`ml-1 normal-case font-normal ${
            outstanding > 0 ? "text-amber-600" : "text-green-600"
          }`}
        >
          {outstanding > 0
            ? `(${outstanding} outstanding)`
            : "(all met)"}
        </span>
      </label>

      {error && <p className="mb-1.5 text-xs text-red-600">{error}</p>}

      <div className="space-y-1">
        {requirements.map((r) => {
          const signable = SIGNABLE.has(r.requirement_type);
          return (
            <div
              key={r.id}
              className={`px-2.5 py-2 rounded-md border ${
                r.is_satisfied
                  ? "bg-green-50/50 border-green-200"
                  : "bg-amber-50/40 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    r.is_satisfied
                      ? "bg-green-500 text-white"
                      : "border border-amber-400 text-transparent"
                  }`}
                >
                  ✓
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-slate-700">
                    {r.requirement_label || r.requirement_key}
                  </span>
                  {r.is_satisfied && r.satisfied_at && (
                    <span className="block text-[10px] text-slate-500">
                      {r.satisfied_user?.name
                        ? `${r.satisfied_user.name} · `
                        : ""}
                      {when(r.satisfied_at)}
                      {r.note ? ` · "${r.note}"` : ""}
                    </span>
                  )}
                  {!r.is_satisfied && !signable && (
                    <span className="block text-[10px] text-slate-500">
                      Satisfied automatically once the work is done
                    </span>
                  )}
                </span>

                {!readOnly && signable && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() =>
                      r.is_satisfied
                        ? void act(r.id, "revoke")
                        : setNoteFor(noteFor === r.id ? null : r.id)
                    }
                    className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                      r.is_satisfied
                        ? "border-slate-200 text-slate-500 hover:bg-slate-100"
                        : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {r.is_satisfied ? "Withdraw" : "Confirm"}
                  </button>
                )}
              </div>

              {noteFor === r.id && (
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void act(r.id, "sign_off", note);
                      if (e.key === "Escape") setNoteFor(null);
                    }}
                    placeholder="Optional note — what did you check?"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void act(r.id, "sign_off", note)}
                    className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Sign off
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TaskRequirements;
