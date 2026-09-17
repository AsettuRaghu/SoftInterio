"use client";

/**
 * The one-line filter bar every list page carries: a search box that takes
 * the width, then one or more "Label: value ▾" multi-select dropdowns.
 * Copied from the leads and projects filter bars, which were written
 * separately and had already drifted a little; new lists use this.
 */

import React, { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

export function ListFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  children,
}: {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-3">
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      />
      {children}
    </div>
  );
}

export function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const all = selected.length === options.length;
  const text = all
    ? "All"
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? "1 selected"
      : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-2 whitespace-nowrap"
      >
        {label}: {text}
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-48">
          <div className="p-2">
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm font-medium text-slate-700 flex items-center gap-2"
            >
              <CheckIcon className={`w-4 h-4 ${all ? "text-blue-600" : "text-transparent"}`} />
              All
            </button>
            <div className="h-px bg-slate-200 my-1" />
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  onChange(selected.includes(o.value) ? selected.filter((s) => s !== o.value) : [...selected, o.value])
                }
                className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm text-slate-700 flex items-center gap-2"
              >
                <CheckIcon className={`w-4 h-4 ${selected.includes(o.value) ? "text-blue-600" : "text-transparent"}`} />
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
