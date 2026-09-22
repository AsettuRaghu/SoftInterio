"use client";

/**
 * A single-choice dropdown you can type into. The native <select> cannot
 * be searched and lists its options in whatever order they were given, and
 * a category filter with 25 entries, or a component's spaces with 18, is
 * where that stops being fine (2026-09-22). Options are sorted A→Z unless
 * told not to; a search box takes focus when it opens; ↑ ↓ Enter Esc work;
 * the chosen option is ticked. Looks like the app's other filter buttons.
 *
 * Reach for it wherever a dropdown has more than a handful of entries or
 * could grow - a native <select> is still right for five fixed values.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** A quieter second line, searched too. */
  hint?: string;
}

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  /** An "all / none" row shown first, with this label, for value "". */
  emptyLabel,
  sort = true,
  disabled = false,
  className,
  buttonClassName,
  align = "left",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  sort?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => (sort ? [...options].sort((a, b) => a.label.localeCompare(b.label)) : options), [options, sort]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = q ? sorted.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)) : sorted;
    return emptyLabel !== undefined && (!q || emptyLabel.toLowerCase().includes(q)) ? [{ value: "", label: emptyLabel }, ...list] : list;
  }, [sorted, q, emptyLabel]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    inputRef.current?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };
  const current = value === "" && emptyLabel !== undefined ? emptyLabel : options.find((o) => o.value === value)?.label;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => { setOpen((v) => !v); setActive(0); }}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-left text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-60 disabled:cursor-default",
          buttonClassName,
        )}
      >
        <span className={cn("truncate", !current && "text-slate-400")}>{current ?? placeholder}</span>
        <ChevronDownIcon className={cn("w-4 h-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className={cn("absolute top-full mt-1 z-50 w-full min-w-56 bg-white border border-slate-200 rounded-lg shadow-lg", align === "right" ? "right-0" : "left-0")}>
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active].value); }
                  else if (e.key === "Escape") { setOpen(false); setQuery(""); }
                }}
                placeholder="Type to find…"
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto p-1" role="listbox">
            {shown.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">Nothing matches.</li>}
            {shown.map((o, i) => (
              <li key={o.value || "__empty"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o.value)}
                  className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-2", i === active ? "bg-slate-100" : "hover:bg-slate-50", o.value === value ? "text-slate-900" : "text-slate-700")}
                >
                  <CheckIcon className={cn("w-4 h-4 shrink-0", o.value === value ? "text-blue-600" : "text-transparent")} />
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block text-[11px] text-slate-400 truncate">{o.hint}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
