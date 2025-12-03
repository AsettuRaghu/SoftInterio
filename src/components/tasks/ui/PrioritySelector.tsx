"use client";

import React from "react";

type Priority = "urgent" | "high" | "medium" | "low";

interface PrioritySelectorProps {
  value: Priority;
  onChange: (value: Priority) => void;
  className?: string;
}

const priorities: {
  value: Priority;
  label: string;
  color: string;
  icon: string;
}[] = [
  { value: "urgent", label: "Urgent", color: "text-red-600", icon: "🔴" },
  { value: "high", label: "High", color: "text-orange-600", icon: "🟠" },
  { value: "medium", label: "Medium", color: "text-yellow-600", icon: "🟡" },
  { value: "low", label: "Low", color: "text-slate-600", icon: "⚪" },
];

export function PrioritySelector({
  value,
  onChange,
  className = "",
}: PrioritySelectorProps) {
  const selected = priorities.find((p) => p.value === value) || priorities[2];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {priorities.map((priority) => (
        <button
          key={priority.value}
          type="button"
          onClick={() => onChange(priority.value)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
            value === priority.value
              ? `${priority.color} bg-slate-100 ring-2 ring-slate-300`
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
          title={priority.label}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" />
          </svg>
          {value === priority.value && <span>{priority.label}</span>}
        </button>
      ))}
    </div>
  );
}
