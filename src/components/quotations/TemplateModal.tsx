"use client";

import React, { useState, useEffect } from "react";

interface Template {
  id: string;
  name: string;
  property_type: string;
  quality_tier: string;
  description?: string;
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (templateId: string) => Promise<void> | void;
  onFetchTemplates: (search: string) => Promise<void> | void;
  templates: Template[];
  isLoading?: boolean;
  isApplying?: boolean;
}

export function TemplateModal({
  isOpen,
  onClose,
  onLoad,
  onFetchTemplates,
  templates,
  isLoading = false,
  isApplying = false,
}: TemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      onFetchTemplates("");
    }
  }, [isOpen, onFetchTemplates]);

  if (!isOpen) return null;

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    await onFetchTemplates(query);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Use Template
            </h2>
            <p className="text-sm text-slate-500">Select a template to load</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <svg
              className="w-6 h-6"
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

        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4"
        />

        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : templates.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              No templates found
            </p>
          ) : (
            templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplateId(template.id)}
                className={`w-full p-4 text-left border rounded-lg transition-all ${
                  selectedTemplateId === template.id
                    ? "border-purple-500 bg-purple-50"
                    : "border-slate-200 hover:border-purple-300"
                }`}
              >
                <div className="font-medium text-slate-900">
                  {template.name}
                </div>
                <div className="text-sm text-slate-500">
                  {template.property_type} • {template.quality_tier}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedTemplateId) {
                onLoad(selectedTemplateId);
              }
            }}
            disabled={!selectedTemplateId || isApplying}
            className="flex-1 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            {isApplying ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              "Load Template"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
