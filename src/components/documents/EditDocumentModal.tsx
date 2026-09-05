"use client";

/**
 * Edit an existing document's details.
 *
 * Deliberately built as a mirror of AddDocumentModal: same shell, same field
 * order, same styling. The two are the only places a document's metadata is
 * written, and having them look unrelated made the edit path feel like a
 * different feature.
 *
 * The one structural difference is the file itself. Uploading replaces the
 * stored object, which is a different operation from correcting its details,
 * so the drop zone is replaced by a read-only summary of the stored file.
 * Renaming here changes the title people see, never the stored object.
 */

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import {
  DocumentCategory,
  DocumentCategoryLabels,
  formatFileSize,
} from "@/types/documents";

interface EditableDocument {
  id: string;
  title?: string | null;
  original_name?: string | null;
  file_size?: number | null;
  file_extension?: string | null;
  category?: DocumentCategory | string | null;
  description?: string | null;
  tags?: string[] | null;
}

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: EditableDocument | null;
  onSaved?: () => void;
}

export function EditDocumentModal({
  isOpen,
  onClose,
  document: doc,
  onSaved,
}: EditDocumentModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !doc) return;
    setTitle(doc.title || doc.original_name || "");
    setCategory((doc.category as DocumentCategory) || "");
    setDescription(doc.description || "");
    setTags(doc.tags || []);
    setError(null);

    void (async () => {
      try {
        const response = await fetch("/api/documents/tags");
        if (!response.ok) return;
        const data = await response.json();
        setTagSuggestions(
          (data.tags || []).map((t: { name: string }) => t.name)
        );
      } catch {
        // Suggestions are a convenience; typing still works without them.
      }
    })();
  }, [isOpen, doc]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc) return;

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!category) {
      setError("Please select a category");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          description: description.trim() || null,
          tags,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save changes");
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !doc) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[84vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Edit Document
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Stored file. Sits where the drop zone sits in the add modal, so
                the two read the same way, but it is not replaceable here. */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                File
              </label>
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <svg
                    className="h-5 w-5 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {doc.original_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {doc.file_extension?.toUpperCase()}
                    {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Display name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                required
              />
              <p className="mt-1 text-[11px] text-slate-400">
                This is the name shown everywhere. The uploaded file itself is
                untouched.
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as DocumentCategory)
                }
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-white"
                required
              >
                <option value="">Select a category</option>
                {(
                  Object.keys(DocumentCategoryLabels) as DocumentCategory[]
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {DocumentCategoryLabels[cat]}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tags
                <span className="ml-1 font-normal text-slate-400">optional</span>
              </label>
              <TagInput
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                placeholder="Add tags..."
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Category is what kind of file this is. Tags are what it is
                about, and a file can have several.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any notes or description..."
                rows={3}
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditDocumentModal;
