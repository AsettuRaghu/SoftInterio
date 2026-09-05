"use client";

/**
 * Create or edit a terms & conditions clause.
 *
 * Clauses are the building blocks a quotation assembles its terms from. The
 * assembled text is snapshotted onto the quotation, so editing a clause here
 * never alters terms a client has already been sent.
 */

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { QuotationTermsClause } from "@/types/quotations";

interface TermsClauseModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Null creates a new clause. */
  clause: QuotationTermsClause | null;
  /** Categories already in use, offered as suggestions. */
  categories?: string[];
  onSaved: () => void;
}

export function TermsClauseModal({
  isOpen,
  onClose,
  clause,
  categories = [],
  onSaved,
}: TermsClauseModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTitle(clause?.title || "");
    setCategory(clause?.category || "");
    setContent(clause?.content || "");
    setIsDefault(clause?.is_default ?? false);
    setIsActive(clause?.is_active ?? true);
  }, [isOpen, clause]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!content.trim()) {
      setError("Clause text is required");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const url = clause
        ? `/api/quotations/terms-clauses/${clause.id}`
        : "/api/quotations/terms-clauses";

      const response = await fetch(url, {
        method: clause ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category: category.trim() || null,
          is_default: isDefault,
          is_active: isActive,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save");

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[84vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {clause ? "Edit clause" : "New clause"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Material warranty"
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category
                <span className="ml-1 font-normal text-slate-400">
                  optional
                </span>
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="clause-categories"
                placeholder="e.g. Warranty, Payment, Scope"
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
              {/* Free text with suggestions rather than a fixed list: the
                  groupings that matter differ by trade. */}
              <datalist id="clause-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Clause text <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="The wording that appears on the quotation..."
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-y"
                required
              />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1">
              <label className="flex items-start gap-2.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block text-sm text-slate-700">
                    Include on new quotations by default
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    Several clauses can be defaults; they are pre-selected and
                    can still be removed per quotation.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block text-sm text-slate-700">Active</span>
                  <span className="block text-[11px] text-slate-400">
                    Inactive clauses stay saved but are not offered when
                    building a quotation.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : clause ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TermsClauseModal;
