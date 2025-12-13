"use client";

import React, { useState, useMemo } from "react";
import { BuilderSpace } from "./types";

export type ScopeMode = "all" | "spaces" | "components";

export interface ScopeSelection {
  mode: ScopeMode;
  selectedSpaceIds: string[];
  selectedComponentIds: string[]; // Format: "spaceId:componentId"
}

interface ScopeSelectorProps {
  spaces: BuilderSpace[];
  value: ScopeSelection;
  onChange: (selection: ScopeSelection) => void;
  compact?: boolean;
}

export function ScopeSelector({
  spaces,
  value,
  onChange,
  compact = false,
}: ScopeSelectorProps) {
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());

  // Toggle space expansion for component selection
  const toggleSpaceExpand = (spaceId: string) => {
    const newExpanded = new Set(expandedSpaces);
    if (newExpanded.has(spaceId)) {
      newExpanded.delete(spaceId);
    } else {
      newExpanded.add(spaceId);
    }
    setExpandedSpaces(newExpanded);
  };

  // Handle mode change
  const handleModeChange = (mode: ScopeMode) => {
    if (mode === "all") {
      onChange({ mode, selectedSpaceIds: [], selectedComponentIds: [] });
    } else if (mode === "spaces") {
      // Select all spaces by default when switching to spaces mode
      onChange({
        mode,
        selectedSpaceIds: spaces.map((s) => s.id),
        selectedComponentIds: [],
      });
    } else {
      // Select all components by default when switching to components mode
      const allComponentIds = spaces.flatMap((s) =>
        s.components.map((c) => `${s.id}:${c.id}`)
      );
      onChange({
        mode,
        selectedSpaceIds: [],
        selectedComponentIds: allComponentIds,
      });
    }
  };

  // Toggle space selection
  const toggleSpace = (spaceId: string) => {
    const newSelected = value.selectedSpaceIds.includes(spaceId)
      ? value.selectedSpaceIds.filter((id) => id !== spaceId)
      : [...value.selectedSpaceIds, spaceId];
    onChange({ ...value, selectedSpaceIds: newSelected });
  };

  // Toggle component selection
  const toggleComponent = (spaceId: string, componentId: string) => {
    const key = `${spaceId}:${componentId}`;
    const newSelected = value.selectedComponentIds.includes(key)
      ? value.selectedComponentIds.filter((id) => id !== key)
      : [...value.selectedComponentIds, key];
    onChange({ ...value, selectedComponentIds: newSelected });
  };

  // Toggle all components in a space
  const toggleAllComponentsInSpace = (spaceId: string) => {
    const space = spaces.find((s) => s.id === spaceId);
    if (!space) return;

    const spaceComponentKeys = space.components.map(
      (c) => `${spaceId}:${c.id}`
    );
    const allSelected = spaceComponentKeys.every((key) =>
      value.selectedComponentIds.includes(key)
    );

    let newSelected: string[];
    if (allSelected) {
      // Deselect all in this space
      newSelected = value.selectedComponentIds.filter(
        (key) => !key.startsWith(`${spaceId}:`)
      );
    } else {
      // Select all in this space
      const existing = value.selectedComponentIds.filter(
        (key) => !key.startsWith(`${spaceId}:`)
      );
      newSelected = [...existing, ...spaceComponentKeys];
    }
    onChange({ ...value, selectedComponentIds: newSelected });
  };

  // Select/Deselect all
  const selectAll = () => {
    if (value.mode === "spaces") {
      onChange({
        ...value,
        selectedSpaceIds: spaces.map((s) => s.id),
      });
    } else if (value.mode === "components") {
      onChange({
        ...value,
        selectedComponentIds: spaces.flatMap((s) =>
          s.components.map((c) => `${s.id}:${c.id}`)
        ),
      });
    }
  };

  const deselectAll = () => {
    if (value.mode === "spaces") {
      onChange({ ...value, selectedSpaceIds: [] });
    } else if (value.mode === "components") {
      onChange({ ...value, selectedComponentIds: [] });
    }
  };

  // Count selections
  const selectionCount = useMemo(() => {
    if (value.mode === "all") {
      const totalSpaces = spaces.length;
      const totalComponents = spaces.reduce(
        (acc, s) => acc + s.components.length,
        0
      );
      return { spaces: totalSpaces, components: totalComponents };
    } else if (value.mode === "spaces") {
      const selectedComponents = spaces
        .filter((s) => value.selectedSpaceIds.includes(s.id))
        .reduce((acc, s) => acc + s.components.length, 0);
      return {
        spaces: value.selectedSpaceIds.length,
        components: selectedComponents,
      };
    } else {
      const uniqueSpaces = new Set(
        value.selectedComponentIds.map((key) => key.split(":")[0])
      );
      return {
        spaces: uniqueSpaces.size,
        components: value.selectedComponentIds.length,
      };
    }
  }, [spaces, value]);

  const totalSpaces = spaces.length;
  const totalComponents = spaces.reduce(
    (acc, s) => acc + s.components.length,
    0
  );

  return (
    <div className={`${compact ? "" : "space-y-3"}`}>
      {/* Mode Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => handleModeChange("all")}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value.mode === "all"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All
        </button>
        <button
          onClick={() => handleModeChange("spaces")}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value.mode === "spaces"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          By Space
        </button>
        <button
          onClick={() => handleModeChange("components")}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value.mode === "components"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          By Component
        </button>
      </div>

      {/* Selection Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {selectionCount.spaces}/{totalSpaces} spaces,{" "}
          {selectionCount.components}/{totalComponents} components
        </span>
        {value.mode !== "all" && (
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-blue-600 hover:text-blue-700"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={deselectAll}
              className="text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Space/Component Selection */}
      {value.mode === "spaces" && (
        <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2">
          {spaces.map((space) => (
            <label
              key={space.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.selectedSpaceIds.includes(space.id)}
                onChange={() => toggleSpace(space.id)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">
                {space.defaultName || space.name}
              </span>
              <span className="text-xs text-slate-400 ml-auto">
                {space.components.length} components
              </span>
            </label>
          ))}
        </div>
      )}

      {value.mode === "components" && (
        <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
          {spaces.map((space) => {
            const isExpanded = expandedSpaces.has(space.id);
            const spaceComponentKeys = space.components.map(
              (c) => `${space.id}:${c.id}`
            );
            const selectedInSpace = spaceComponentKeys.filter((key) =>
              value.selectedComponentIds.includes(key)
            ).length;
            const allInSpaceSelected =
              selectedInSpace === space.components.length;
            const someInSpaceSelected =
              selectedInSpace > 0 && !allInSpaceSelected;

            return (
              <div
                key={space.id}
                className="border-b border-slate-100 last:border-b-0"
              >
                {/* Space Header */}
                <div
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSpaceExpand(space.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAllComponentsInSpace(space.id);
                    }}
                    className="flex items-center justify-center w-4 h-4"
                  >
                    <div
                      className={`w-4 h-4 border rounded flex items-center justify-center ${
                        allInSpaceSelected
                          ? "bg-blue-600 border-blue-600"
                          : someInSpaceSelected
                          ? "bg-blue-200 border-blue-400"
                          : "border-slate-300"
                      }`}
                    >
                      {allInSpaceSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                      {someInSpaceSelected && (
                        <div className="w-2 h-0.5 bg-blue-600 rounded" />
                      )}
                    </div>
                  </button>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isExpanded ? "rotate-90" : ""
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
                  <span className="text-sm font-medium text-slate-700">
                    {space.defaultName || space.name}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {selectedInSpace}/{space.components.length}
                  </span>
                </div>

                {/* Components */}
                {isExpanded && (
                  <div className="pl-8 py-1">
                    {space.components.map((comp) => {
                      const key = `${space.id}:${comp.id}`;
                      const isSelected =
                        value.selectedComponentIds.includes(key);
                      return (
                        <label
                          key={comp.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleComponent(space.id, comp.id)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-600">
                            {comp.name}
                          </span>
                          {comp.variantName && (
                            <span className="text-xs text-slate-400">
                              ({comp.variantName})
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper function to check if a component is in scope
export function isInScope(
  spaceId: string,
  componentId: string | undefined,
  scope: ScopeSelection
): boolean {
  if (scope.mode === "all") {
    return true;
  }

  if (scope.mode === "spaces") {
    return scope.selectedSpaceIds.includes(spaceId);
  }

  if (scope.mode === "components" && componentId) {
    return scope.selectedComponentIds.includes(`${spaceId}:${componentId}`);
  }

  return false;
}

// Default scope (all selected)
export const defaultScope: ScopeSelection = {
  mode: "all",
  selectedSpaceIds: [],
  selectedComponentIds: [],
};
