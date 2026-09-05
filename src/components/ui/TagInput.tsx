"use client";

/**
 * Free-text tag picker.
 *
 * Deliberately the same experience as the task TagSelector: a chip box that
 * opens a dropdown with a search field, the full list of existing tags with
 * colour dots and ticks, and a "Create" row when what you typed does not exist
 * yet. Tags are one idea in this product and should not feel like two
 * depending on which screen you are on.
 *
 * The difference is underneath. Task tags are rows in task_tags with an id and
 * a stored colour; these are plain strings in a text[] column. So there is no
 * id to select, nothing to POST when creating, and no colour to read - the
 * colour is derived from the name instead, using the task palette so the same
 * name always looks the same and the two features look like one system.
 *
 * The suggestion list is what keeps this usable: left to free typing, tags
 * decay into "site photo", "site-photo" and "sitephoto" within weeks and stop
 * finding anything.
 */

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Existing tags to offer, ideally most-used first. */
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Guards against a tag list longer than the thing it describes. */
  maxTags?: number;
}

// The task tag palette, so both pickers draw from the same set of colours.
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

/** Trimmed and lower-cased. Case is not a meaningful difference in a tag. */
function normalise(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * A stable colour for a tag name. Task tags store theirs; these have nowhere to
 * store one, so it is derived - the same name must always come out the same
 * colour or the chips would flicker between renders.
 */
export function tagColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return SWATCHES[hash % SWATCHES.length];
}

/**
 * Renders string tags the way TagChips renders task tags, so a tag looks the
 * same wherever it appears.
 */
export function StringTagChips({
  tags,
  max,
  size = "sm",
}: {
  tags?: string[] | null;
  max?: number;
  size?: "xs" | "sm";
}) {
  if (!tags || tags.length === 0) return null;

  const shown = max ? tags.slice(0, max) : tags;
  const overflow = max ? tags.length - shown.length : 0;
  const padding =
    size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {shown.map((tag) => {
        const colour = tagColour(tag.trim().toLowerCase());
        return (
          <span
            key={tag}
            className={`inline-flex items-center ${padding} rounded-md font-medium border whitespace-nowrap`}
            style={{
              color: colour,
              borderColor: `${colour}40`,
              backgroundColor: `${colour}14`,
            }}
          >
            {tag}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className={`${padding} text-slate-400 font-medium`}>
          +{overflow}
        </span>
      )}
    </span>
  );
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add tags...",
  disabled = false,
  maxTags = 12,
}: TagInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    ready: false,
  });

  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const atLimit = value.length >= maxTags;

  // Position the portal under the anchor, flipping up if there is no room.
  const open = () => {
    if (disabled) return;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      const estimatedHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      setPosition({
        top:
          spaceBelow > estimatedHeight
            ? rect.bottom + 4
            : rect.top - estimatedHeight - 4,
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
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const query = normalise(search);
    const unique = [...new Set(suggestions.map(normalise))];
    if (!query) return unique;
    return unique.filter((t) => t.includes(query));
  }, [suggestions, search]);

  const exactMatch = useMemo(
    () => filtered.some((t) => t === normalise(search)),
    [filtered, search]
  );

  const toggle = (tag: string) => {
    const clean = normalise(tag);
    if (value.some((t) => normalise(t) === clean)) {
      onChange(value.filter((t) => normalise(t) !== clean));
      return;
    }
    if (atLimit) return;
    onChange([...value, clean]);
  };

  const createTag = () => {
    const name = normalise(search);
    if (!name || atLimit) return;
    if (!value.some((t) => normalise(t) === name)) {
      onChange([...value, name]);
    }
    setSearch("");
  };

  const dropdown =
    isOpen && position.ready && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-9999 bg-white rounded-lg shadow-xl border border-slate-200 py-1 flex flex-col"
            style={{
              top: position.top,
              left: position.left,
              width: Math.max(position.width, 240),
            }}
          >
            <div className="px-2 py-1.5 border-b border-slate-100">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim() && !exactMatch) {
                    // Enter would otherwise submit the surrounding form.
                    e.preventDefault();
                    createTag();
                  } else if (e.key === "Escape") {
                    setIsOpen(false);
                    setSearch("");
                  }
                }}
                placeholder="Search or create..."
                className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 && !search.trim() ? (
                <p className="px-3 py-3 text-sm text-slate-400">
                  No tags yet. Type a name to create one.
                </p>
              ) : (
                filtered.map((tag) => {
                  const isSelected = value.some(
                    (t) => normalise(t) === tag
                  );
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggle(tag)}
                      className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                        isSelected ? "bg-slate-50" : ""
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tagColour(tag) }}
                      />
                      <span className="text-slate-700 truncate">{tag}</span>
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

            {search.trim() && !exactMatch && (
              <button
                type="button"
                onClick={createTag}
                disabled={atLimit}
                className="px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 border-t border-slate-100 disabled:opacity-50"
              >
                Create &ldquo;{normalise(search)}&rdquo;
              </button>
            )}

            {atLimit && (
              <p className="px-3 py-1.5 text-xs text-slate-500 border-t border-slate-100">
                Limit of {maxTags} tags reached.
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
        {value.length === 0 ? (
          <span className="text-sm text-slate-400">{placeholder}</span>
        ) : (
          value.map((tag) => {
            const colour = tagColour(normalise(tag));
            return (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
                style={{
                  color: colour,
                  borderColor: `${colour}40`,
                  backgroundColor: `${colour}14`,
                }}
              >
                {tag}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(value.filter((t) => t !== tag));
                    }}
                    className="opacity-60 hover:opacity-100"
                    title={`Remove ${tag}`}
                  >
                    <svg
                      className="w-3 h-3"
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
                )}
              </span>
            );
          })
        )}
      </div>
      {dropdown}
    </>
  );
}

export default TagInput;
