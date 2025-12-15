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
  XMarkIcon,
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
  onCountChange?: (count: number) => void;
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
  onCountChange,
}: ProjectNotesTabProps) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<ProjectNote | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [projectId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectId}/notes`);
      if (!response.ok) {
        if (response.status === 500) {
          setError("Notes feature is not available");
          setNotes([]);
          onCountChange?.(0);
          return;
        }
        throw new Error("Failed to fetch notes");
      }
      const data = await response.json();
      const notesList = data.notes || [];
      setNotes(notesList);
      onCountChange?.(notesList.length);
    } catch (err) {
      console.error("Error fetching notes:", err);
      setError("Could not load notes");
      setNotes([]);
      onCountChange?.(0);
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

  const handleEditNote = (note: ProjectNote) => {
    setEditingNote(note);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingNote(null);
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

  if (error) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>Notes feature unavailable:</strong> {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Project Notes
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Track meetings, decisions, and important information
          </p>
        </div>
        {!error && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 transition-colors"
            title="Add a new note"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add Note
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="text-center py-8">
          <DocumentTextIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600 font-medium">No notes yet</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Add your first note to keep track of project information
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pinned Notes */}
          {pinnedNotes.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <PinIcon className="w-3 h-3 rotate-45" />
                Pinned ({pinnedNotes.length})
              </h4>
              <div className="space-y-1.5">
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={handleEditNote}
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
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                  Other Notes ({unpinnedNotes.length})
                </h4>
              )}
              <div className="space-y-1.5">
                {unpinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={handleEditNote}
                    onDelete={deleteNote}
                    onTogglePin={togglePin}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Note Modal */}
      {showAddModal && (
        <AddNoteModal
          projectId={projectId}
          phases={phases}
          note={editingNote}
          onClose={handleCloseModal}
          onSave={() => {
            handleCloseModal();
            fetchNotes();
          }}
        />
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
      className={`p-3 bg-white border rounded-lg ${
        note.is_pinned ? "border-amber-200 bg-amber-50/30" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${categoryStyle.bg} ${categoryStyle.text}`}
            >
              {ProjectNoteCategoryLabels[note.category]}
            </span>
            {note.phase && (
              <span className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                {note.phase.name}
              </span>
            )}
            {note.is_pinned && (
              <PinIcon className="w-3 h-3 text-amber-500 rotate-45" />
            )}
          </div>

          {/* Title */}
          {note.title && (
            <h4 className="text-sm font-medium text-slate-900 mb-1">
              {note.title}
            </h4>
          )}

          {/* Content */}
          <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-3">
            {note.content}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-0.5">
              <CalendarIcon className="w-3 h-3" />
              {new Date(note.created_at).toLocaleDateString()}
            </span>
            {note.created_by_user && (
              <span>by {note.created_by_user.name}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onTogglePin(note.id, note.is_pinned)}
            className={`p-1 rounded ${
              note.is_pinned
                ? "text-amber-500 hover:text-amber-700 hover:bg-amber-100"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            }`}
            title={note.is_pinned ? "Unpin" : "Pin"}
          >
            <PinIcon className="w-3.5 h-3.5 rotate-45" />
          </button>
          <button
            onClick={() => onEdit(note)}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
            title="Edit"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Delete"
          >
            <TrashIcon className="w-3.5 h-3.5" />
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

// Add/Edit Note Modal
interface AddNoteModalProps {
  projectId: string;
  phases: ProjectPhase[];
  note?: ProjectNote | null;
  onClose: () => void;
  onSave: () => void;
}

function AddNoteModal({
  projectId,
  phases,
  note,
  onClose,
  onSave,
}: AddNoteModalProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [category, setCategory] = useState<ProjectNoteCategory>(
    note?.category || "general"
  );
  const [phaseId, setPhaseId] = useState(note?.phase_id || "");
  const [isPinned, setIsPinned] = useState(note?.is_pinned || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setSaving(true);

    try {
      const method = note ? "PATCH" : "POST";
      const url = note
        ? `/api/projects/${projectId}/notes/${note.id}`
        : `/api/projects/${projectId}/notes`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          content,
          category,
          phase_id: phaseId || null,
          is_pinned: isPinned,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save note");
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {note ? "Edit Note" : "Add Note"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here..."
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProjectNoteCategory)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {Object.entries(ProjectNoteCategoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>



          {/* Pin Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPinned"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label
              htmlFor="isPinned"
              className="ml-2 text-sm font-medium text-slate-700"
            >
              Pin this note
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
