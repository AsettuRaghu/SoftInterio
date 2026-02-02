"use client";

import React, { useState, useMemo } from "react";
import { SearchBox } from "@/components/ui/SearchBox";
import {
  ChatBubbleLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  StarIcon as StarIconOutline,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface NoteItem {
  id: string;
  content: string;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined user info
  created_user?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
}

interface NotesTableReusableProps {
  // Data sources
  notes?: NoteItem[];

  // External control
  externalNotes?: NoteItem[];
  onRefresh?: () => void;

  // UI Configuration
  showHeader?: boolean;
  compact?: boolean;
  readOnly?: boolean;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowPin?: boolean;
  showFilters?: boolean;

  // Callbacks
  onNoteClick?: (note: NoteItem) => void;
  onCreateNote?: () => void;
  onEditNote?: (note: NoteItem) => void;
  onDeleteNote?: (note: NoteItem) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function NotesTableReusable({
  notes = [],
  externalNotes,
  onRefresh,
  showHeader = true,
  compact = false,
  readOnly = false,
  allowCreate = true,
  allowEdit = true,
  allowDelete = false,
  allowPin = true,
  showFilters = true,
  onNoteClick,
  onCreateNote,
  onEditNote,
  onDeleteNote,
  onTogglePin,
}: NotesTableReusableProps) {
  // =====================================================
  // STATE MANAGEMENT
  // =====================================================

  const [searchQuery, setSearchQuery] = useState("");
  const [filterPinned, setFilterPinned] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =====================================================
  // SORTING
  // =====================================================

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: string }) => (
    <span className="ml-1 inline-flex">
      {sortField === field ? (
        sortDirection === "asc" ? (
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
              d="M5 15l7-7 7 7"
            />
          </svg>
        ) : (
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
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )
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
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      )}
    </span>
  );

  // =====================================================
  // DATA PROCESSING
  // =====================================================

  const allNotes = useMemo(() => {
    return externalNotes || notes;
  }, [externalNotes, notes]);

  const filteredAndSortedNotes = useMemo(() => {
    let filtered = [...allNotes];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((note) => {
        // Search in content
        if (note.content.toLowerCase().includes(query)) return true;

        // Search in user name
        if (note.created_user?.name.toLowerCase().includes(query)) return true;

        return false;
      });
    }

    // Pinned filter
    if (filterPinned === "pinned") {
      filtered = filtered.filter((note) => note.is_pinned);
    } else if (filterPinned === "unpinned") {
      filtered = filtered.filter((note) => !note.is_pinned);
    }

    // Sort by selected field
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Always prioritize pinned notes
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }

      switch (sortField) {
        case "content":
          aValue = a.content.toLowerCase();
          bValue = b.content.toLowerCase();
          break;
        case "user":
          aValue = (a.created_user?.name || "").toLowerCase();
          bValue = (b.created_user?.name || "").toLowerCase();
          break;
        case "updated_at":
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        case "created_at":
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [allNotes, searchQuery, filterPinned, sortField, sortDirection]);

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  const handleTogglePin = async (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePin) {
      onTogglePin(note.id, !note.is_pinned);
    }
  };

  const handleEdit = (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditNote) {
      onEditNote(note);
    }
  };

  const handleDelete = (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteNote) {
      onDeleteNote(note);
    }
  };

  // =====================================================
  // RENDER: MAIN LAYOUT
  // =====================================================

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200">
      {/* Search and Filters */}
      {showFilters && (
        <div className="flex items-center gap-2 p-3 border-b border-slate-200">
          <div className="flex-1">
            <SearchBox
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search notes..."
            />
          </div>

          {/* Pinned Filter */}
          <select
            value={filterPinned}
            onChange={(e) => setFilterPinned(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Notes</option>
            <option value="pinned">Pinned</option>
            <option value="unpinned">Unpinned</option>
          </select>

          {/* Add Note Button */}
          {allowCreate && onCreateNote && (
            <button
              onClick={onCreateNote}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Note
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {filteredAndSortedNotes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <ChatBubbleLeftIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">No notes found</p>
            <p className="text-xs text-slate-500">
              {searchQuery || filterPinned !== "all"
                ? "Try adjusting your filters"
                : "Add your first note to get started"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr>
                {allowPin && <th className="w-10 px-3 py-2"></th>}
                <th
                  onClick={() => handleSort("content")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Note
                    <SortIndicator field="content" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("created_at")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Created
                    <SortIndicator field="created_at" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("updated_at")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Updated
                    <SortIndicator field="updated_at" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("user")}
                  className="group px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center">
                    Created By
                    <SortIndicator field="user" />
                  </div>
                </th>
                {(allowEdit || allowDelete) && (
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredAndSortedNotes.map((note) => {
                const userName = note.created_user?.name || "—";
                const avatarUrl = note.created_user?.avatar_url;

                return (
                  <tr
                    key={note.id}
                    className={`hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 cursor-pointer ${
                      note.is_pinned ? "bg-yellow-50/30" : ""
                    }`}
                    onClick={() => onNoteClick && onNoteClick(note)}
                  >
                    {/* Pin Icon */}
                    {allowPin && (
                      <td className="px-3 py-3">
                        <button
                          onClick={(e) => handleTogglePin(note, e)}
                          className="p-1 hover:bg-slate-100 rounded transition-colors"
                          title={note.is_pinned ? "Unpin note" : "Pin note"}
                        >
                          {note.is_pinned ? (
                            <StarIconSolid className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <StarIconOutline className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                    )}

                    {/* Note Content */}
                    <td className="px-3 py-3">
                      <p className="text-xs text-slate-800 line-clamp-2">
                        {note.content}
                      </p>
                    </td>

                    {/* Created Date */}
                    <td className="px-3 py-3">
                      <div className="text-xs text-slate-800">
                        {formatDate(note.created_at)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {formatTime(note.created_at)}
                      </div>
                    </td>

                    {/* Updated Date */}
                    <td className="px-3 py-3">
                      <div className="text-xs text-slate-800">
                        {formatDate(note.updated_at)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {formatTime(note.updated_at)}
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={userName}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                            <span className="text-[10px] font-medium text-slate-600">
                              {userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-slate-700 truncate max-w-[120px]">
                          {userName}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    {(allowEdit || allowDelete) && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {allowEdit && !readOnly && (
                            <button
                              onClick={(e) => handleEdit(note, e)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit note"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                          )}
                          {allowDelete && (
                            <button
                              onClick={(e) => handleDelete(note, e)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete note"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
