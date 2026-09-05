"use client";

/**
 * Save part of a quotation as a reusable template.
 *
 * This is the half that makes a template library exist at all. Building
 * templates from scratch in a separate screen is work nobody does - two
 * templates against thirty-four quotations says so - whereas keeping a
 * wardrobe you have just finished pricing costs one click and happens at the
 * moment its value is obvious.
 */

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { TEMPLATE_LEVELS, type TemplateLevel } from "@/types/quotations";

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: TemplateLevel;
  /** What is being saved, for the heading - "Master Bedroom", "Wardrobe". */
  sourceName: string;
  /** How many cost items will be captured, so the count is not a surprise. */
  itemCount: number;
  onSave: (name: string, description: string) => Promise<void>;
}

export function SaveAsTemplateModal({
  isOpen,
  onClose,
  level,
  sourceName,
  itemCount,
  onSave,
}: SaveAsTemplateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Pre-filled from what is being saved: most templates are named after the
    // thing itself, and an empty box invites abandoning the save.
    setName(sourceName);
    setDescription("");
    setError(null);
  }, [isOpen, sourceName]);

  if (!isOpen) return null;

  const levelLabel =
    TEMPLATE_LEVELS.find((l) => l.key === level)?.label || level;

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Give the template a name");
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      await onSave(name.trim(), description.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Save as template
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {levelLabel} · {itemCount} cost item
              {itemCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard 8ft sliding wardrobe"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
              <span className="ml-1 font-normal text-slate-400">optional</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When should this be used?"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Cost items and their quantities are saved. Rates are not: applying
            this later uses whatever the cost item library charges then, so the
            template cannot go stale after a price revision.
          </p>
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
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SaveAsTemplateModal;
