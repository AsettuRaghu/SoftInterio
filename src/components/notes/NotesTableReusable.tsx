"use client";

/**
 * Notes list, shared by leads and projects.
 *
 * Styled to match the task table so the two read the same way: a compact
 * header row, dense rows, and the same pagination control.
 *
 * The pinned/unpinned filter was removed - pinning was used on 0 of 19 real
 * notes, so filtering by it was dead weight. The filter that matters is
 * follow-ups, since that is the one people need to find again.
 */

import React, { useCallback, useMemo, useState } from "react";
import { NoteModal, type NoteCategoryOption } from "./NoteModal";
import { SearchBox } from "@/components/ui/SearchBox";
import { DatePicker } from "@/components/tasks/ui";
import {
  PlusIcon,
  ChatBubbleLeftIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";

export interface NoteItem {
  id: string;
  title?: string | null;
  content: string;
  category?: string | null;
  is_pinned: boolean;
  /**
   * A note with a date is a scheduled next contact. The note text IS the
   * reason, so there is no separate reason field. Resolved via
   * follow_up_done_at - without that it would stay due forever.
   */
  follow_up_at?: string | null;
  follow_up_done_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  created_user?: { id: string; name: string; avatar_url?: string | null };
}

interface NotesTableReusableProps {
  notes?: NoteItem[];
  externalNotes?: NoteItem[];
  onRefresh?: () => void;

  /** When set, this component owns creation and follow-up editing. */
  createEndpoint?: string;
  /** Base path for per-note updates: `${updateEndpoint}/${noteId}` */
  updateEndpoint?: string;
  /** Project notes carry a title; lead notes do not. */
  showNoteTitle?: boolean;
  noteCategories?: NoteCategoryOption[];

  showHeader?: boolean;
  compact?: boolean;
  readOnly?: boolean;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  showFilters?: boolean;

  onNoteClick?: (note: NoteItem) => void;
  onCreateNote?: () => void;
  // Callers pass richer note types (ProjectNote carries project_id, LeadNote
  // carries lead_id). These only fire when the component is NOT owning the
  // modal, so the extra fields are the caller's business, not ours.
  onEditNote?: (note: never) => void;
  onDeleteNote?: (note: never) => void;
}

type FollowUpFilter = "all" | "follow_ups" | "due" | "done";

const FILTERS: { key: FollowUpFilter; label: string }[] = [
  { key: "all", label: "All notes" },
  { key: "follow_ups", label: "With follow-up" },
  { key: "due", label: "Due" },
  { key: "done", label: "Followed up" },
];

/**
 * dd-mm-yy for the Created and Updated columns.
 *
 * Built from the date parts rather than a locale format, so the padding and
 * separator are the same on every machine - en-IN renders "4/9/26" with no
 * zero padding, which does not line up in a column.
 */
const shortDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${pad(d.getFullYear() % 100)}`;
};

export default function NotesTableReusable({
  notes = [],
  externalNotes,
  onRefresh,
  createEndpoint,
  updateEndpoint,
  showNoteTitle = false,
  noteCategories,
  readOnly = false,
  allowCreate = true,
  allowEdit = true,
  allowDelete = false,
  showFilters = true,
  onCreateNote,
  onEditNote,
  onDeleteNote,
}: NotesTableReusableProps) {
  const data = externalNotes ?? notes;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FollowUpFilter>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busy, setBusy] = useState<string | null>(null);
  const [modalNote, setModalNote] = useState<NoteItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  /** Overdue only counts while the follow-up is still outstanding. */
  const followUpState = useCallback(
    (note: NoteItem) => {
      if (!note.follow_up_at) return null;
      if (note.follow_up_done_at) return "done" as const;
      return note.follow_up_at < today ? ("overdue" as const) : ("due" as const);
    },
    [today]
  );

  const filtered = useMemo(() => {
    let rows = [...data];

    if (filter !== "all") {
      rows = rows.filter((n) => {
        const state = followUpState(n);
        if (filter === "follow_ups") return !!n.follow_up_at;
        if (filter === "due") return state === "due" || state === "overdue";
        return state === "done";
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (n) =>
          n.content?.toLowerCase().includes(q) ||
          n.title?.toLowerCase().includes(q) ||
          n.created_user?.name?.toLowerCase().includes(q)
      );
    }

    // Pinned notes still float, so historic pins keep working - but nothing
    // in the UI can set one any more. Pinning was used on 0 of 19 real notes
    // and the row icon was pure clutter; if it is wanted back it belongs in
    // the edit modal, not on every row.
    const dir = sortDirection === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;

      switch (sortField) {
        case "content":
          return (a.content || "").localeCompare(b.content || "") * dir;
        case "follow_up_at":
          // Notes without a follow-up sink to the bottom either way, so the
          // sort surfaces what is actually scheduled.
          if (!a.follow_up_at && !b.follow_up_at) return 0;
          if (!a.follow_up_at) return 1;
          if (!b.follow_up_at) return -1;
          return a.follow_up_at.localeCompare(b.follow_up_at) * dir;
        case "created_user":
          return (
            (a.created_user?.name || "").localeCompare(
              b.created_user?.name || ""
            ) * dir
          );
        case "updated_at":
          return (a.updated_at || "").localeCompare(b.updated_at || "") * dir;
        default:
          return (a.created_at || "").localeCompare(b.created_at || "") * dir;
      }
    });
  }, [data, filter, search, followUpState, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const SortIndicator = ({ field }: { field: string }) => (
    <span className="ml-1 inline-flex">
      {sortField === field ? (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={sortDirection === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
          />
        </svg>
      ) : (
        <svg
          className="w-3 h-3 opacity-0 group-hover:opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l4-4 4 4m0 6l-4 4-4-4"
          />
        </svg>
      )}
    </span>
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  );

  const patchNote = async (noteId: string, payload: Record<string, unknown>) => {
    if (!updateEndpoint) return;
    setBusy(noteId);
    try {
      const response = await fetch(`${updateEndpoint}/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) onRefresh?.();
    } finally {
      setBusy(null);
    }
  };

  const openNote = (note: NoteItem | null) => {
    if (createEndpoint) {
      setModalNote(note);
      setIsModalOpen(true);
    } else if (note) {
      onEditNote?.(note as never);
    } else {
      onCreateNote?.();
    }
  };

  const counts = useMemo(
    () => ({
      follow_ups: data.filter((n) => n.follow_up_at).length,
      due: data.filter((n) => {
        const s = followUpState(n);
        return s === "due" || s === "overdue";
      }).length,
      done: data.filter((n) => followUpState(n) === "done").length,
    }),
    [data, followUpState]
  );

  return (
    <>
      <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200">
        {showFilters && (
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 flex-wrap shrink-0">
            {/* Same treatment as the task tabs: solid blue when active, with
                the count carried inside the pill. */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              {FILTERS.map((f) => {
                const count =
                  f.key === "all"
                    ? data.length
                    : f.key === "follow_ups"
                    ? counts.follow_ups
                    : f.key === "due"
                    ? counts.due
                    : counts.done;
                const isActive = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setFilter(f.key);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    {f.label}
                    <span
                      className={`ml-1 text-[10px] ${
                        isActive ? "text-blue-200" : "text-slate-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-w-40">
              <SearchBox
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setCurrentPage(1);
                }}
                placeholder="Search notes..."
              />
            </div>

            {allowCreate && !readOnly && (
              <button
                type="button"
                onClick={() => openNote(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shrink-0"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Note
              </button>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <ChatBubbleLeftIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">
                {search || filter !== "all" ? "No matching notes" : "No notes yet"}
              </p>
              <p className="text-xs text-slate-500">
                {search || filter !== "all"
                  ? "Try a different filter"
                  : "Record what happened, and set a follow-up if you need one"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                <tr>
                  {[
                    { label: "Note", field: "content" },
                    { label: "Follow-up", field: "follow_up_at" },
                    { label: "Added by", field: "created_user" },
                    { label: "Created", field: "created_at" },
                    { label: "Updated", field: "updated_at" },
                  ].map((h) => (
                    <th
                      key={h.field}
                      onClick={() => handleSort(h.field)}
                      className="group px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <span className="inline-flex items-center">
                        {h.label}
                        <SortIndicator field={h.field} />
                      </span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-slate-100">
                {paged.map((note) => {
                  const state = followUpState(note);
                  return (
                    <tr
                      key={note.id}
                      className="group hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-2 py-2 max-w-md">
                        <button
                          type="button"
                          onClick={() => allowEdit && !readOnly && openNote(note)}
                          className="text-left w-full"
                          disabled={!allowEdit || readOnly}
                        >
                          {note.title && (
                            <span className="block text-xs font-medium text-slate-800 truncate">
                              {note.title}
                            </span>
                          )}
                          <span className="block text-xs text-slate-700 line-clamp-2">
                            {note.content}
                          </span>
                          {note.category && note.category !== "general" && (
                            <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
                              {note.category.replace(/_/g, " ")}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Same inline DatePicker the task table uses for Due,
                          so setting or clearing a follow-up works identically
                          in both places. Overdue tints the cell. */}
                      <td
                        className={`px-2 py-2 whitespace-nowrap ${
                          state === "overdue" ? "bg-red-50/60" : ""
                        }`}
                        title={state === "overdue" ? "Overdue" : undefined}
                      >
                        <span
                          className={
                            state === "done" ? "opacity-50 line-through" : ""
                          }
                        >
                          <DatePicker
                            value={note.follow_up_at || ""}
                            onChange={(val) =>
                              void patchNote(note.id, {
                                follow_up_at: val || null,
                              })
                            }
                            placeholder="Follow up"
                            readOnly={readOnly || !updateEndpoint}
                          />
                        </span>
                      </td>

                      <td className="px-2 py-2 whitespace-nowrap text-slate-600">
                        {note.created_user?.name || "—"}
                      </td>

                      <td className="px-2 py-2 whitespace-nowrap text-slate-400">
                        {shortDate(note.created_at)}
                      </td>

                      {/* Only shown when it differs - an "updated" date equal
                          to the created date is noise, not information. */}
                      <td className="px-2 py-2 whitespace-nowrap text-slate-400">
                        {note.updated_at &&
                        note.updated_at.slice(0, 10) !==
                          note.created_at.slice(0, 10)
                          ? shortDate(note.updated_at)
                          : "—"}
                      </td>

                      <td className="px-2 py-2 whitespace-nowrap text-right">
                        {/* Always visible, not hover-revealed: a hidden edit
                            button was the reason this column read as broken.
                            Colour matches the task table's action buttons. */}
                        <span className="inline-flex items-center gap-1">
                          {note.follow_up_at && !readOnly && updateEndpoint && (
                            <button
                              type="button"
                              disabled={busy === note.id}
                              onClick={() =>
                                void patchNote(note.id, {
                                  follow_up_done: !note.follow_up_done_at,
                                })
                              }
                              title={
                                note.follow_up_done_at
                                  ? "Reopen this follow-up"
                                  : "Mark as followed up"
                              }
                              className={`w-6.5 h-6.5 flex items-center justify-center rounded-md border transition-all disabled:opacity-40 ${
                                note.follow_up_done_at
                                  ? "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                                  : "bg-green-50 text-green-600 border-green-200 hover:bg-green-100 hover:border-green-300"
                              }`}
                            >
                              {note.follow_up_done_at ? (
                                <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                              ) : (
                                <CheckIcon className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {allowEdit && !readOnly && (
                            <button
                              type="button"
                              onClick={() => openNote(note)}
                              title="Edit note"
                              className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all"
                            >
                              <PencilSquareIcon className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {allowDelete && !readOnly && onDeleteNote && (
                            <button
                              type="button"
                              onClick={() => onDeleteNote(note as never)}
                              title="Delete note"
                              className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Same pagination control as the task table. */}
        {filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">
                  <span className="font-medium">
                    {Math.min((currentPage - 1) * pageSize + 1, filtered.length)}
                  </span>
                  {"-"}
                  <span className="font-medium">
                    {Math.min(currentPage * pageSize, filtered.length)}
                  </span>
                  {" of "}
                  <span className="font-medium">{filtered.length}</span>
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-1.5 py-0.5 text-[10px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <div className="flex items-center gap-0.5 mx-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let n = i + 1;
                    if (totalPages > 5) {
                      if (currentPage <= 3) n = i + 1;
                      else if (currentPage >= totalPages - 2)
                        n = totalPages - 4 + i;
                      else n = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={n}
                        onClick={() => setCurrentPage(n)}
                        className={`w-6 h-6 text-[10px] font-medium rounded transition-colors ${
                          currentPage === n
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {createEndpoint && (
        <NoteModal
          isOpen={isModalOpen}
          note={modalNote}
          onClose={() => {
            setIsModalOpen(false);
            setModalNote(null);
          }}
          createEndpoint={createEndpoint}
          updateEndpoint={updateEndpoint}
          showTitle={showNoteTitle}
          categories={noteCategories}
          onSaved={onRefresh}
        />
      )}
    </>
  );
}
