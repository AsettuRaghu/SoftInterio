"use client";

/**
 * Create or edit a note — reusable across leads, projects and anything else
 * that keeps notes.
 *
 * Deliberately endpoint-driven rather than entity-aware: the caller supplies
 * where to POST and PATCH, so this component never learns what a lead or a
 * project is. Leads and projects genuinely differ (project notes carry a title
 * and category, lead notes do not), and those differences are props rather
 * than branches.
 *
 * A follow-up lives on the note because the note text IS the reason for it:
 * "client asked to call back after Diwali" is both the record and the reason.
 */

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { NoteItem } from "./NotesTableReusable";

export interface NoteCategoryOption {
  value: string;
  label: string;
}

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where to POST a new note. */
  createEndpoint: string;
  /** Base path for edits: `${updateEndpoint}/${noteId}` */
  updateEndpoint?: string;
  /** Pass a note to edit it; omit to create. */
  note?: NoteItem | null;
  /** Project notes have a title; lead notes do not. */
  showTitle?: boolean;
  /** Supply to show a category picker. */
  categories?: NoteCategoryOption[];
  onSaved?: () => void;
}

/** "Call back in 10 days" is the common case, so make it one click. */
const SNOOZE_PRESETS = [
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "10 days", days: 10 },
  { label: "1 month", days: 30 },
];

const dateAfter = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function NoteModal({
  isOpen,
  onClose,
  createEndpoint,
  updateEndpoint,
  note,
  showTitle = false,
  categories,
  onSaved,
}: NoteModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpDone, setFollowUpDone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!note;
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!isOpen) return;
    setTitle((note as { title?: string } | null)?.title || "");
    setContent(note?.content || "");
    setCategory((note as { category?: string } | null)?.category || "general");
    // An already-resolved follow-up is not offered for editing - reopening it
    // is a separate, deliberate action from the notes list.
    setFollowUpAt(note?.follow_up_at || "");
    setFollowUpDone(!!note?.follow_up_done_at);
    setError(null);
  }, [isOpen, note]);

  const save = async () => {
    if (!content.trim()) {
      setError("Write something first");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const url =
        isEdit && updateEndpoint
          ? `${updateEndpoint}/${note!.id}`
          : createEndpoint;

      const payload: Record<string, unknown> = {
        content: content.trim(),
        follow_up_at: followUpAt || null,
      };
      // Only sent when editing an existing follow-up - a new note has nothing
      // to resolve yet.
      if (isEdit && note?.follow_up_at) {
        payload.follow_up_done = followUpDone;
      }
      if (showTitle) payload.title = title.trim() || null;
      if (categories) payload.category = category;
      // Pinning is deliberately NOT asked here. It was used on 0 of 19 real
      // notes, and you rarely know at writing time whether something deserves
      // pinning - it is a decision made later, from the list.

      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not save the note");
        return;
      }

      onSaved?.();
      onClose();
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit note" : "Add note"}
      subtitle="Record what happened, and set a reminder to follow up if you need one."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || !content.trim()}
            onClick={() => void save()}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : isEdit ? "Save changes" : "Add note"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {showTitle && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional heading"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Note
          </label>
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="What happened? e.g. Called Priya — asked us to check back after Diwali"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        {categories && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Follow-up. Optional, and off unless the user asks for it. */}
        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!followUpAt}
              onChange={(e) => {
                setFollowUpAt(e.target.checked ? dateAfter(3) : "");
                if (!e.target.checked) setFollowUpDone(false);
              }}
            />
            <span className="text-sm font-medium text-slate-700">
              Remind me to follow up
            </span>
            {isEdit && note?.follow_up_at && (
              <span
                className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  followUpDone
                    ? "bg-green-50 text-green-600"
                    : note.follow_up_at < today
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {followUpDone
                  ? "done"
                  : note.follow_up_at < today
                  ? "overdue"
                  : "pending"}
              </span>
            )}
          </label>

          {followUpAt && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={followUpAt}
                  min={today}
                  onChange={(e) => setFollowUpAt(e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {SNOOZE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setFollowUpAt(dateAfter(p.days))}
                    className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
                      followUpAt === dateAfter(p.days)
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {isEdit && note?.follow_up_at ? (
                <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-200">
                  <input
                    type="checkbox"
                    checked={followUpDone}
                    onChange={(e) => setFollowUpDone(e.target.checked)}
                  />
                  <span className="text-sm text-slate-600">
                    I have followed up
                  </span>
                  <span className="text-[11px] text-slate-400">
                    — clears it from the queue
                  </span>
                </label>
              ) : (
                <p className="text-[11px] text-slate-500">
                  This note becomes the reminder, so whatever you wrote above is
                  the reason you will see when it comes due.
                </p>
              )}
            </>
          )}
        </div>

      </div>
    </Modal>
  );
}

export default NoteModal;
