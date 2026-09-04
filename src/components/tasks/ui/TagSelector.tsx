"use client";

/**
 * Task tag picker.
 *
 * Multi-select over the tenant's task_tags, with inline creation for tags that
 * don't exist yet. Controlled: the parent owns the selected ids and decides
 * when to persist.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TaskTag } from "@/types/tasks";

interface TagSelectorProps {
  selected: string[];
  onChange: (tagIds: string[]) => void;
  /** Supply to avoid every instance re-fetching the tag list. */
  tags?: TaskTag[];
  disabled?: boolean;
  placeholder?: string;
  /** Allow creating a new tag from the search box. */
  allowCreate?: boolean;
}

const SWATCHES = [
  "#6B7280", // slate
  "#2563EB", // blue
  "#059669", // green
  "#D97706", // amber
  "#DC2626", // red
  "#7C3AED", // violet
  "#DB2777", // pink
  "#0891B2", // cyan
];

export function TagSelector({
  selected,
  onChange,
  tags: providedTags,
  disabled = false,
  placeholder = "Add tags...",
  allowCreate = true,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tags, setTags] = useState<TaskTag[]>(providedTags || []);
  const [isLoading, setIsLoading] = useState(!providedTags);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, ready: false });

  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (providedTags) {
      setTags(providedTags);
      setIsLoading(false);
    }
  }, [providedTags]);

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch("/api/tasks/tags");
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch {
      // Non-fatal: the picker just shows an empty list.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!providedTags) void fetchTags();
  }, [providedTags, fetchTags]);

  // Position the portal under the anchor, flipping up if there is no room.
  const open = () => {
    if (disabled) return;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      const estimatedHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      setPosition({
        top: spaceBelow > estimatedHeight ? rect.bottom + 4 : rect.top - estimatedHeight - 4,
        left: rect.left,
        width: rect.width,
        ready: true,
      });
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current?.contains(event.target as Node) ||
        anchorRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
      setSearch("");
      setError(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedTags = useMemo(
    () => tags.filter((t) => selected.includes(t.id)),
    [tags, selected]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(query));
  }, [tags, search]);

  const exactMatch = useMemo(
    () => tags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase()),
    [tags, search]
  );

  const toggle = (tagId: string) => {
    onChange(
      selected.includes(tagId)
        ? selected.filter((id) => id !== tagId)
        : [...selected, tagId]
    );
  };

  const createTag = async () => {
    const name = search.trim();
    if (!name || isCreating) return;

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          // Deterministic colour so the same name looks the same everywhere.
          color: SWATCHES[name.length % SWATCHES.length],
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not create tag");
        return;
      }

      setTags((prev) => [...prev, data.tag]);
      onChange([...selected, data.tag.id]);
      setSearch("");
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsCreating(false);
    }
  };

  const dropdown =
    isOpen && position.ready && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-9999 bg-white rounded-lg shadow-xl border border-slate-200 py-1 flex flex-col"
            style={{ top: position.top, left: position.left, width: Math.max(position.width, 240) }}
          >
            <div className="px-2 py-1.5 border-b border-slate-100">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && allowCreate && search.trim() && !exactMatch) {
                    e.preventDefault();
                    void createTag();
                  }
                  if (e.key === "Escape") setIsOpen(false);
                }}
                placeholder="Search or create..."
                className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-52 overflow-y-auto">
              {isLoading ? (
                <p className="px-3 py-3 text-sm text-slate-400">Loading tags...</p>
              ) : filtered.length === 0 && !search.trim() ? (
                <p className="px-3 py-3 text-sm text-slate-400">
                  No tags yet. Type a name to create one.
                </p>
              ) : (
                filtered.map((tag) => {
                  const isSelected = selected.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggle(tag.id)}
                      className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                        isSelected ? "bg-slate-50" : ""
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-slate-700 truncate">{tag.name}</span>
                      {isSelected && (
                        <svg
                          className="w-4 h-4 ml-auto text-blue-600 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {allowCreate && search.trim() && !exactMatch && (
              <button
                type="button"
                onClick={() => void createTag()}
                disabled={isCreating}
                className="px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 border-t border-slate-100 disabled:opacity-50"
              >
                {isCreating ? "Creating..." : `Create "${search.trim()}"`}
              </button>
            )}

            {error && (
              <p className="px-3 py-1.5 text-xs text-red-600 border-t border-slate-100">
                {error}
              </p>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={anchorRef}
        onClick={open}
        className={`min-h-9 w-full px-2 py-1.5 flex items-center gap-1.5 flex-wrap rounded-lg border transition-colors ${
          disabled
            ? "bg-slate-50 border-slate-200 cursor-not-allowed"
            : "bg-white border-slate-200 hover:border-slate-300 cursor-pointer"
        }`}
      >
        {selectedTags.length === 0 ? (
          <span className="text-sm text-slate-400">{placeholder}</span>
        ) : (
          selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
              style={{
                color: tag.color,
                borderColor: `${tag.color}40`,
                backgroundColor: `${tag.color}14`,
              }}
            >
              {tag.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(tag.id);
                  }}
                  className="hover:opacity-60"
                  aria-label={`Remove ${tag.name}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))
        )}
      </div>
      {dropdown}
    </>
  );
}

/** Read-only tag chips, for table cells and detail headers. */
export function TagChips({
  tags,
  max,
  size = "sm",
}: {
  tags?: Pick<TaskTag, "id" | "name" | "color">[];
  max?: number;
  size?: "xs" | "sm";
}) {
  if (!tags || tags.length === 0) return null;

  const shown = max ? tags.slice(0, max) : tags;
  const overflow = max ? tags.length - shown.length : 0;
  const padding = size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {shown.map((tag) => (
        <span
          key={tag.id}
          className={`inline-flex items-center ${padding} rounded-md font-medium border whitespace-nowrap`}
          style={{
            color: tag.color,
            borderColor: `${tag.color}40`,
            backgroundColor: `${tag.color}14`,
          }}
        >
          {tag.name}
        </span>
      ))}
      {overflow > 0 && (
        <span className={`${padding} text-slate-400 font-medium`}>+{overflow}</span>
      )}
    </span>
  );
}

export default TagSelector;
