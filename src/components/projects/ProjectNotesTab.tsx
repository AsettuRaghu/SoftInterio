"use client";

import React, { useState, useEffect } from "react";
import {
  DocumentTextIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  CalendarIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import {
  ProjectNote,
  ProjectNoteCategory,
  ProjectNoteCategoryLabels,
  ProjectPhase,
} from "@/types/projects";

interface ProjectNotesTabProps {
  projectId: string;
  phases: ProjectPhase[];
  onCreateNote: () => void;
  onEditNote: (note: ProjectNote) => void;
}

const CategoryColors: Record<
  ProjectNoteCategory,
  { bg: string; text: string }
> = {
  general: { bg: "bg-slate-100", text: "text-slate-700" },
  meeting: { bg: "bg-blue-100", text: "text-blue-700" },
  decision: { bg: "bg-purple-100", text: "text-purple-700" },
  issue: { bg: "bg-red-100", text: "text-red-700" },
  followup: { bg: "bg-amber-100", text: "text-amber-700" },
  client_communication: { bg: "bg-green-100", text: "text-green-700" },
};

export default function ProjectNotesTab({
  projectId,
  phases,
  onCreateNote,
  onEditNote,
}: ProjectNotesTabProps) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");

  useEffect(() => {
    fetchNotes();
  }, [projectId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/notes`);
      if (!response.ok) throw new Error("Failed to fetch notes");
      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const togglePin = async (noteId: string, currentPinned: boolean) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/notes/${noteId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_pinned: !currentPinned }),
        }
      );
      if (!response.ok) throw new Error("Failed to update note");
      fetchNotes();
    } catch (err) {
      console.error("Error toggling pin:", err);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/notes/${noteId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) throw new Error("Failed to delete note");
      fetchNotes();
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesCategory =
      categoryFilter === "all" || note.category === categoryFilter;
    const matchesPhase =
      phaseFilter === "all" ||
      (phaseFilter === "unassigned" && !note.phase_id) ||
      note.phase_id === phaseFilter;
    return matchesCategory && matchesPhase;
  });

  // Separate pinned and unpinned
  const pinnedNotes = filteredNotes.filter((n) => n.is_pinned);
  const unpinnedNotes = filteredNotes.filter((n) => !n.is_pinned);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-slate-200 rounded"></div>
        <div className="h-20 bg-slate-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-900">Project Notes</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Keep track of meetings, decisions, and important information
          </p>
        </div>
        <button
          onClick={onCreateNote}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          Add Note
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          {Object.entries(ProjectNoteCategoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Phases</option>
          <option value="unassigned">General (No Phase)</option>
          {phases
            .filter((p) => p.is_enabled)
            .map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
        </select>

        <span className="text-xs text-slate-500 ml-auto">
          {filteredNotes.length} note{filteredNotes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No notes yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Add your first note to keep track of project information
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pinned Notes */}
          {pinnedNotes.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                <PinIcon className="w-3.5 h-3.5 rotate-45" />
                Pinned ({pinnedNotes.length})
              </h4>
              <div className="space-y-2">
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={onEditNote}
                    onDelete={deleteNote}
                    onTogglePin={togglePin}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Notes */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Other Notes ({unpinnedNotes.length})
                </h4>
              )}
              <div className="space-y-2">
                {unpinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={onEditNote}
                    onDelete={deleteNote}
                    onTogglePin={togglePin}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Note Card Component
interface NoteCardProps {
  note: ProjectNote;
  onEdit: (note: ProjectNote) => void;
  onDelete: (noteId: string) => void;
  onTogglePin: (noteId: string, currentPinned: boolean) => void;
}

function NoteCard({ note, onEdit, onDelete, onTogglePin }: NoteCardProps) {
  const categoryStyle = CategoryColors[note.category] || CategoryColors.general;

  return (
    <div
      className={`p-4 bg-white border rounded-lg ${
        note.is_pinned ? "border-amber-200 bg-amber-50/30" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${categoryStyle.bg} ${categoryStyle.text}`}
            >
              {ProjectNoteCategoryLabels[note.category]}
            </span>
            {note.phase && (
              <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                {note.phase.name}
              </span>
            )}
            {note.is_pinned && (
              <PinIcon className="w-3.5 h-3.5 text-amber-500 rotate-45" />
            )}
          </div>

          {/* Title */}
          {note.title && (
            <h4 className="font-medium text-slate-900 mb-1">{note.title}</h4>
          )}

          {/* Content */}
          <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-4">
            {note.content}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5" />
              {new Date(note.created_at).toLocaleDateString()}
            </span>
            {note.created_by_user && (
              <span>by {note.created_by_user.name}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTogglePin(note.id, note.is_pinned)}
            className={`p-1.5 rounded ${
              note.is_pinned
                ? "text-amber-500 hover:text-amber-700 hover:bg-amber-100"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            }`}
            title={note.is_pinned ? "Unpin" : "Pin"}
          >
            <PinIcon className="w-4 h-4 rotate-45" />
          </button>
          <button
            onClick={() => onEdit(note)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Pin Icon (custom since Heroicons doesn't have one)
function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );
}
