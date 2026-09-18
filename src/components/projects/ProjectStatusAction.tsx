"use client";

/**
 * The project's next move, in the header - the lead page's stage button, for
 * projects.
 *
 * A project's transitions are not a dropdown: kick-off is a checklist, a hold
 * needs who/why/until, completion is gated on the handover step. So the
 * header offers exactly the moves the status allows, each opening one small
 * dialog, and POST /status decides. A refusal comes back as the server's own
 * sentence in the dialog.
 *
 *   new         Kick off (the page routes this to the checklist)
 *   in_progress Put on hold · Mark complete · Cancel
 *   on_hold     Resume · Cancel
 *   completed   Reopen
 *   cancelled   Reopen
 */

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useDelayReasons } from "@/lib/tasks/use-delay-reasons";
import { DelayOwnerLabels, type DelayOwner } from "@/types/tasks";

type Move = "on_hold" | "in_progress" | "completed" | "cancelled";

interface Props {
  projectId: string;
  status: string;
  canEdit: boolean;
  /** After a successful change: refetch quietly and say so. */
  onChanged: (message: string) => void;
}

const MOVES: Record<string, { to: Move; label: string; tone: string; title: string; blurb: string }[]> = {
  in_progress: [
    { to: "on_hold", label: "Put on hold", tone: "bg-amber-500 hover:bg-amber-600 text-white", title: "Put the project on hold", blurb: "Who are we waiting on, and why? Running steps pause with it, and every day is counted against them." },
    { to: "completed", label: "Mark complete", tone: "bg-emerald-600 hover:bg-emerald-700 text-white", title: "Mark the project complete", blurb: "Needs every step done, the handover milestone signed, and nothing still owed by the client." },
  ],
  on_hold: [
    { to: "in_progress", label: "Resume", tone: "bg-blue-600 hover:bg-blue-700 text-white", title: "Resume the project", blurb: "The days on hold are logged against whoever we were waiting on. Steps are resumed one by one as people pick them up." },
  ],
  completed: [
    { to: "in_progress", label: "Reopen", tone: "bg-slate-700 hover:bg-slate-800 text-white", title: "Reopen the project", blurb: "Back to In Progress; the plan comes back with it. Reopen the handover step afterwards if that is what needs redoing." },
  ],
  cancelled: [
    { to: "in_progress", label: "Reopen", tone: "bg-slate-700 hover:bg-slate-800 text-white", title: "Reopen the project", blurb: "Back to In Progress; the plan comes back with it." },
  ],
};

const CANCEL = { to: "cancelled" as Move, label: "Cancel project", title: "Cancel the project", blurb: "The plan and every open step are cancelled. Finished work stays as it is. This can be reopened later." };

export function ProjectStatusAction({ projectId, status, canEdit, onChanged }: Props) {
  const [open, setOpen] = useState<{ to: Move; label: string; title: string; blurb: string } | null>(null);
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState<DelayOwner | "">("");
  const [code, setCode] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasons = useDelayReasons();

  if (!canEdit) return null;
  const moves = MOVES[status] ?? [];
  const mayCancel = ["new", "in_progress", "on_hold"].includes(status);
  if (moves.length === 0 && !mayCancel) return null;

  const start = (m: { to: Move; label: string; title: string; blurb: string }) => {
    setOpen(m);
    setNote("");
    setOwner("");
    setCode("");
    setUntil("");
    setError(null);
  };

  const submit = async () => {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: open.to,
          note: note.trim(),
          hold_owner: open.to === "on_hold" ? owner || undefined : undefined,
          hold_reason_code: open.to === "on_hold" ? code || undefined : undefined,
          hold_expected_until: open.to === "on_hold" ? until || undefined : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "That did not go through");
        return;
      }
      const done = open.label;
      setOpen(null);
      onChanged(
        done === "Put on hold"
          ? "Project on hold."
          : done === "Resume"
            ? "Project resumed."
            : done === "Mark complete"
              ? "Project completed."
              : done === "Cancel project"
                ? "Project cancelled."
                : "Project reopened."
      );
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  const holdIncomplete = open?.to === "on_hold" && (!owner || !code);

  return (
    <>
      {moves.map((m) => (
        <button key={m.to} type="button" onClick={() => start(m)} className={cn(buttonVariants(), m.tone)}>
          {m.label}
        </button>
      ))}
      {mayCancel && (
        <button
          type="button"
          onClick={() => start(CANCEL)}
          className={cn(buttonVariants(), "bg-red-600 hover:bg-red-700 text-white")}
        >
          Cancel project
        </button>
      )}

      <Modal
        isOpen={!!open}
        onClose={() => setOpen(null)}
        title={open?.title ?? ""}
        subtitle={open?.blurb}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy || !note.trim() || holdIncomplete}
              onClick={() => void submit()}
              className={cn(buttonVariants(), open?.to === "cancelled" ? "bg-red-600 hover:bg-red-700" : "")}
            >
              {busy ? "Saving…" : open?.label}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {open?.to === "on_hold" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">
                Waiting on
                <select
                  value={owner}
                  onChange={(e) => {
                    setOwner(e.target.value as DelayOwner | "");
                    setCode("");
                  }}
                  className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white"
                >
                  <option value="">Choose…</option>
                  {(Object.keys(DelayOwnerLabels) as DelayOwner[]).map((o) => (
                    <option key={o} value={o}>
                      {DelayOwnerLabels[o]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Reason
                <select
                  value={code}
                  disabled={!owner}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white disabled:bg-slate-50"
                >
                  <option value="">{owner ? "Choose…" : "Pick who first"}</option>
                  {reasons
                    .filter((r) => r.owner === owner)
                    .map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-xs text-slate-600 col-span-2">
                Expected until
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white"
                />
              </label>
            </div>
          )}
          <label className="block text-xs text-slate-600">
            Note for the timeline
            <textarea
              autoFocus={open?.to !== "on_hold"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={
                open?.to === "on_hold"
                  ? "e.g. Site possession delayed - client confirms handover on 20 Oct"
                  : open?.to === "completed"
                    ? "e.g. Handover signed by the client on site, snag list closed"
                    : open?.to === "cancelled"
                      ? "e.g. Client withdrew after design stage; deposit refunded"
                      : "What changed, and with whom it was agreed"
              }
              className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
