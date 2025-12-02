"use client";

import React, { useState, useEffect, useRef } from "react";

// Icons
const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

export interface InlineDatePickerProps {
  value?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InlineDatePicker({
  value,
  onChange,
  disabled,
  placeholder = "No due date",
}: InlineDatePickerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return placeholder;
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isOverdue =
    value &&
    new Date(value) < new Date() &&
    new Date(value).toDateString() !== new Date().toDateString();

  const isToday =
    value && new Date(value).toDateString() === new Date().toDateString();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={value || ""}
        onChange={(e) => {
          onChange(e.target.value || null);
          setIsEditing(false);
        }}
        onBlur={() => setIsEditing(false)}
        onClick={(e) => e.stopPropagation()}
        className="px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) setIsEditing(true);
      }}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-sm rounded-lg transition-all ${
        isOverdue
          ? "text-red-600 bg-red-50"
          : isToday
          ? "text-orange-600 bg-orange-50"
          : value
          ? "text-slate-700"
          : "text-slate-400"
      } ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-slate-100 cursor-pointer"
      }`}
    >
      <CalendarIcon className="w-4 h-4" />
      {formatDate(value)}
    </button>
  );
}
