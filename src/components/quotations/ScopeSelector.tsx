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
}

export const defaultScope: ScopeSelection = {
  mode: "all",
  selectedSpaceIds: [],
  selectedComponentIds: [],
};

/**
 * Whether a component is inside the current selection.
 *
 * Unchanged, so anything already reading a ScopeSelection keeps working: the
 * selector below writes "all" or "components", and "spaces" is still honoured
 * for a selection made before the modes were merged.
 */
export function isInScope(
  spaceId: string,
  componentId: string | undefined,
  scope: ScopeSelection
): boolean {
  if (scope.mode === "all") return true;
  if (scope.mode === "spaces") return scope.selectedSpaceIds.includes(spaceId);
  if (scope.mode === "components" && componentId) {
    return scope.selectedComponentIds.includes(`${spaceId}:${componentId}`);
  }
  return false;
}

const key = (spaceId: string, componentId: string) => `${spaceId}:${componentId}`;

/**
 * Picks what a repricing applies to.
 *
 * One tree rather than the previous All / By Space / By Component tabs. Those
 * three were really one thing: "By Space" was a flat list of the same rooms
 * "By Component" already showed, so the middle mode taught the user nothing
 * and cost a decision. Here a room's checkbox stands for everything in it, and
 * expanding it lets you disagree with that on individual components.
 *
 * The mode is derived rather than chosen: everything ticked is "all", anything
 * less is an explicit component list.
 */
export function ScopeSelector({
  spaces,
  value,
  onChange,
}: ScopeSelectorProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allKeys = useMemo(
    () => spaces.flatMap((s) => s.components.map((c) => key(s.id, c.id))),
    [spaces]
  );

  // "all" carries no ids, so expand it into the real set before editing.
  const selected = useMemo(
    () => new Set(value.mode === "all" ? allKeys : value.selectedComponentIds),
    [value, allKeys]
  );

  const commit = (next: Set<string>) => {
    const isEverything =
      allKeys.length > 0 && allKeys.every((k) => next.has(k));
    onChange(
      isEverything
        ? defaultScope
        : {
            mode: "components",
            selectedSpaceIds: [],
            selectedComponentIds: [...next],
          }
    );
  };

  const toggleComponent = (spaceId: string, componentId: string) => {
    const next = new Set(selected);
    const k = key(spaceId, componentId);
    next.has(k) ? next.delete(k) : next.add(k);
    commit(next);
  };

  const toggleSpace = (space: BuilderSpace) => {
    const keys = space.components.map((c) => key(space.id, c.id));
    const allOn = keys.length > 0 && keys.every((k) => selected.has(k));
    const next = new Set(selected);
    keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
    commit(next);
  };

  const toggleExpand = (spaceId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(spaceId) ? next.delete(spaceId) : next.add(spaceId);
      return next;
    });

  const selectedCount = selected.size;
  const isAll = value.mode === "all" || selectedCount === allKeys.length;

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-slate-500">
          {isAll
            ? `All ${allKeys.length} components`
            : `${selectedCount} of ${allKeys.length} components`}
        </span>
        <button
          onClick={() => commit(isAll ? new Set() : new Set(allKeys))}
          className="text-xs text-blue-600 hover:text-blue-700 shrink-0"
        >
          {isAll ? "Clear" : "Select all"}
        </button>
      </div>

      {/* Fills the panel instead of the old fixed 192px / 256px caps, which
          made a 14-room quotation scroll inside a box with empty space
          underneath it. */}
      <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
        {spaces.map((space) => {
          const keys = space.components.map((c) => key(space.id, c.id));
          const on = keys.filter((k) => selected.has(k)).length;
          const isOpen = expanded.has(space.id);

          return (
            <div key={space.id}>
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={keys.length > 0 && on === keys.length}
                  ref={(el) => {
                    // Partly-selected rooms read as neither on nor off.
                    if (el) el.indeterminate = on > 0 && on < keys.length;
                  }}
                  onChange={() => toggleSpace(space)}
                  disabled={keys.length === 0}
                  className="w-4 h-4 shrink-0 text-blue-600 border-slate-300 rounded focus:ring-blue-500 disabled:opacity-40"
                />
                <button
                  onClick={() => toggleExpand(space.id)}
                  disabled={keys.length === 0}
                  className="flex-1 flex items-center gap-1.5 min-w-0 text-left disabled:cursor-default"
                >
                  <svg
                    className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${
                      isOpen ? "rotate-90" : ""
                    } ${keys.length === 0 ? "invisible" : ""}`}
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
                  <span
                    className="text-sm text-slate-700 truncate"
                    title={space.defaultName || space.name}
                  >
                    {space.defaultName || space.name}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-slate-400 tabular-nums">
                    {on}/{keys.length}
                  </span>
                </button>
              </div>

              {isOpen && keys.length > 0 && (
                <div className="pb-1">
                  {space.components.map((component) => (
                    <label
                      key={component.id}
                      className="flex items-center gap-1.5 pl-8 pr-2 py-1 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(key(space.id, component.id))}
                        onChange={() => toggleComponent(space.id, component.id)}
                        className="w-3.5 h-3.5 shrink-0 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span
                        className="text-xs text-slate-600 truncate"
                        title={component.name}
                      >
                        {component.name}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-slate-400 tabular-nums">
                        {component.lineItems.length}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {spaces.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-slate-400">
            Nothing to reprice yet.
          </p>
        )}
      </div>
    </div>
  );
}
