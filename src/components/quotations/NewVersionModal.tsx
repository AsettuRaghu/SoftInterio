"use client";

import React, { useState } from "react";

interface NewVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateVersion: (notes: string) => Promise<void> | void;
  currentVersion: number;
  isCreating?: boolean;
}

export function NewVersionModal({
  isOpen,
  onClose,
  onCreateVersion,
  currentVersion,
  isCreating = false,
}: NewVersionModalProps) {
  const [versionNotes, setVersionNotes] = useState("");

  if (!isOpen) return null;

  const handleCreate = async () => {
    await onCreateVersion(versionNotes);
    setVersionNotes("");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Create New Version
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          This will save as version {currentVersion + 1} while keeping the
          original.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Version Notes
          </label>
          <textarea
            value={versionNotes}
            onChange={(e) => setVersionNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            rows={3}
            placeholder="Describe changes..."
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="flex-1 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              "Create Version"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
