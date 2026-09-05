"use client";

import React, { useState, useEffect } from "react";

interface Template {
  id: string;
  name: string;
  property_type: string;
  quality_tier: string;
  description?: string;
  /** What the template is a template of. Absent on older rows. */
  level?: string;
  /** Space types this template suits. Empty means "no opinion". */
  applicable_space_type_ids?: string[];
  /** Component types its line items belong to, for the mismatch warning. */
  component_type_ids?: string[];
  component_type_names?: string[];
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * mode only applies to whole-quotation and space templates; the narrower
   * levels always insert into the thing they were opened from.
   */
  onLoad: (
    templateId: string,
    mode: "append" | "replace"
  ) => Promise<void> | void;
  /** Where the template is going, so only usable ones are offered. */
  target?:
    | { level: "quotation" | "space" }
    | { level: "component"; spaceName: string; spaceTypeId?: string }
    | {
        level: "cost_items";
        componentName: string;
        componentTypeId?: string;
      };
  onFetchTemplates: (search: string) => Promise<void> | void;
  templates: Template[];
  isLoading?: boolean;
  isApplying?: boolean;
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
  muted = false,
}: {
  template: Template;
  isSelected: boolean;
  onSelect: () => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-4 text-left border rounded-lg transition-all ${
        isSelected
          ? "border-purple-500 bg-purple-50"
          : "border-slate-200 hover:border-purple-300"
      } ${muted && !isSelected ? "opacity-70" : ""}`}
    >
      <div className="font-medium text-slate-900">{template.name}</div>
      <div className="text-sm text-slate-500">
        {template.property_type} • {template.quality_tier}
      </div>
    </button>
  );
}

export function TemplateModal({
  isOpen,
  onClose,
  onLoad,
  target = { level: "quotation" },
  onFetchTemplates,
  templates,
  isLoading = false,
  isApplying = false,
}: TemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  // Append by default. Replacing used to be the only behaviour, which
  // discarded whatever was already built - fine on an empty quotation, and
  // destructive on any other.
  const [mode, setMode] = useState<"append" | "replace">("append");
  // Collapsed: the point of the split is that these are read second.
  const [showOthers, setShowOthers] = useState(false);

  // Only templates that can actually go where this was opened from. Rows
  // predating the level column are whole-quotation templates.
  const usable = templates.filter(
    (t) => (t.level || "quotation") === target.level
  );

  const spaceTypeId =
    target.level === "component" ? target.spaceTypeId : undefined;
  const componentTypeId =
    target.level === "cost_items" ? target.componentTypeId : undefined;

  /**
   * Whether a template was built for the room being added to.
   *
   * Deliberately generous. A template with no mapping at all counts as
   * suggested rather than being pushed down - "we do not know" should not read
   * as "wrong", and two of the seeded component types carry no mapping.
   */
  const suitsTarget = (t: Template) => {
    if (!spaceTypeId) return true;
    const applicable = t.applicable_space_type_ids || [];
    if (applicable.length === 0) return true;
    return applicable.includes(spaceTypeId);
  };

  // Nothing is hidden - a wardrobe in a dressing area off a bathroom is a real
  // job, and a template that vanishes is far more confusing than one listed
  // second. The split only decides what is read first.
  const suggested = usable.filter(suitsTarget);
  const others = usable.filter((t) => !suitsTarget(t));

  const selected = usable.find((t) => t.id === selectedTemplateId);

  /**
   * A template built for a different component is the mismatch worth stopping
   * for: pouring wardrobe carcass and shutter lines into a TV unit is wrong in
   * any room, whereas the wrong room is often just an unusual layout.
   */
  const componentMismatch =
    selected &&
    componentTypeId &&
    (selected.component_type_ids?.length || 0) > 0 &&
    !selected.component_type_ids!.includes(componentTypeId)
      ? selected.component_type_names?.[0] || "another component"
      : null;

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

        {(target.level === "quotation" || target.level === "space") && (
          <div className="mb-3 flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg w-fit">
            {(["append", "replace"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  mode === m
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                {m === "append" ? "Add to quotation" : "Replace everything"}
              </button>
            ))}
          </div>
        )}

        {target.level === "component" && (
          <p className="mb-3 text-xs text-slate-500">
            Adding into <span className="font-medium">{(target as { spaceName: string }).spaceName}</span>
          </p>
        )}
        {target.level === "cost_items" && (
          <p className="mb-3 text-xs text-slate-500">
            Adding into <span className="font-medium">{(target as { componentName: string }).componentName}</span>
          </p>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : usable.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              {target.level === "component"
                ? "No component templates yet. Create one from Templates, choosing the Component level."
                : target.level === "cost_items"
                ? "No cost item bundles yet. Create one from Templates, choosing the Cost item bundle level."
                : "No templates found"}
            </p>
          ) : (
            <>
              {/* Only worth splitting when the target says something about
                  which templates belong and some actually fall outside it. */}
              {others.length > 0 && suggested.length > 0 && (
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 pt-1">
                  Suggested for{" "}
                  {(target as { spaceName?: string }).spaceName || "this space"}
                </p>
              )}

              {suggested.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplateId === template.id}
                  onSelect={() => setSelectedTemplateId(template.id)}
                />
              ))}

              {others.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowOthers((v) => !v)}
                    className="flex items-center gap-1.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 hover:text-slate-600"
                  >
                    <svg
                      className={`w-3 h-3 transition-transform ${
                        showOthers ? "rotate-90" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    Built for other spaces ({others.length})
                  </button>

                  {showOthers &&
                    others.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        isSelected={selectedTemplateId === template.id}
                        onSelect={() => setSelectedTemplateId(template.id)}
                        muted
                      />
                    ))}
                </>
              )}
            </>
          )}
        </div>

        {componentMismatch && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <svg
              className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0l-7.1 12.25A2 2 0 004.99 19z"
              />
            </svg>
            <p className="text-xs text-amber-800">
              This bundle was built for a{" "}
              <span className="font-medium">{componentMismatch}</span>. Its cost
              items may not suit{" "}
              <span className="font-medium">
                {(target as { componentName?: string }).componentName}
              </span>
              .
            </p>
          </div>
        )}

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
                onLoad(selectedTemplateId, mode);
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
              componentMismatch ? "Add anyway" : "Load Template"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
