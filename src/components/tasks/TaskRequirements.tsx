"use client";

/**
 * The gates on a task: what must be true before it can be completed.
 *
 * Sign-off, not routed approval — anyone who can see the task may confirm a
 * review step, and the record is who and when. Upload gates are read-only
 * here: they satisfy themselves when a file lands, and letting someone tick
 * one by hand would make the evidence worthless.
 *
 * A checklist line can ask for a photo. Then the photo IS the tick: the
 * camera button attaches it to that line, the database ticks the line when
 * the row lands, and Confirm is not offered. Deleting the last photo unticks
 * it again.
 */

import React, { useCallback, useEffect, useState } from "react";
import { TaskFormFields } from "@/components/tasks/TaskFormFields";

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
  needs_photo?: boolean;
  scope_item_id?: string | null;
  photos?: { id: string; original_name: string | null; file_type: string | null }[];
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
  /** Signed URLs for the photos on ticks, keyed by document id. */
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const loadPhotoUrls = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`);
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const a of data.attachments ?? []) {
        if (a.id && a.signed_url) map[a.id] = a.signed_url;
      }
      setPhotoUrls(map);
    } catch {
      /* the names still show; only the links are missing */
    }
  }, [taskId]);

  const attachPhoto = async (requirementId: string, file: File) => {
    setBusyId(requirementId);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("requirement_id", requirementId);
      const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not attach the photo");
        return;
      }
      await load();
      await loadPhotoUrls();
      onChanged?.();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusyId(null);
    }
  };

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/requirements`);
      if (!response.ok) return;
      const data = await response.json();
      const rows: Requirement[] = data.requirements || [];
      setRequirements(rows);
      if (rows.some((r) => (r.photos?.length ?? 0) > 0)) void loadPhotoUrls();
    } finally {
      setIsLoading(false);
    }
  }, [taskId, loadPhotoUrls]);

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
                  {!r.is_satisfied && r.needs_photo && (
                    <span className="block text-[10px] text-slate-500">
                      Ticked by attaching a photo
                    </span>
                  )}
                  {(r.photos?.length ?? 0) > 0 && (
                    <span className="flex flex-wrap gap-x-2 text-[10px] text-slate-500">
                      {r.photos!.map((ph) =>
                        photoUrls[ph.id] ? (
                          <a
                            key={ph.id}
                            href={photoUrls[ph.id]}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            📷 {ph.original_name || "photo"}
                          </a>
                        ) : (
                          <span key={ph.id}>📷 {ph.original_name || "photo"}</span>
                        )
                      )}
                    </span>
                  )}
                </span>

                {!readOnly && r.needs_photo && (
                  <label
                    className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                      busyId === r.id
                        ? "opacity-50 pointer-events-none"
                        : r.is_satisfied
                          ? "border-slate-200 text-slate-500 hover:bg-slate-100"
                          : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                    title={r.is_satisfied ? "Add another photo" : "Attach a photo to tick this line"}
                  >
                    {busyId === r.id ? "Uploading…" : r.is_satisfied ? "+ Photo" : "📷 Attach photo"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void attachPhoto(r.id, f);
                      }}
                    />
                  </label>
                )}

                {r.requirement_type === "form" && (
                  <span className="sr-only">form fields below</span>
                )}

                {!readOnly && signable && !(r.needs_photo && !r.is_satisfied) && (
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
              {r.requirement_type === "form" && (
                <TaskFormFields
                  taskId={taskId}
                  readOnly={readOnly}
                  onSaved={() => {
                    void load();
                    onChanged?.();
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TaskRequirements;
