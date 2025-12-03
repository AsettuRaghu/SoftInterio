"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

type TaskStatus =
  | "todo"
  | "in_progress"
  | "review"
  | "completed"
  | "on_hold"
  | "cancelled";

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const statusConfig: Record<TaskStatus, StatusConfig> = {
  todo: {
    label: "To Do",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
  in_progress: {
    label: "In Progress",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  review: {
    label: "Review",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  completed: {
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  on_hold: {
    label: "On Hold",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
};

const allStatuses: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "completed",
  "on_hold",
  "cancelled",
];

interface StatusFilterDropdownProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function StatusFilterDropdown({
  selected,
  onChange,
}: StatusFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 300;
      const spaceBelow = window.innerHeight - rect.bottom;

      return {
        top:
          spaceBelow > dropdownHeight
            ? rect.bottom + 4
            : rect.top - dropdownHeight - 4,
        left: Math.min(rect.left, window.innerWidth - 220),
        ready: true,
      };
    }
    return { top: 0, left: 0, ready: false };
  };

  const handleOpen = () => {
    if (!isOpen) {
      setPosition(calculatePosition());
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const toggleStatus = (status: string) => {
    onChange(
      selected.includes(status)
        ? selected.filter((s) => s !== status)
        : [...selected, status]
    );
  };

  const selectAll = () => {
    onChange([...allStatuses]);
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedCount = selected.length;
  const displayText =
    selectedCount === 0
      ? "Status"
      : selectedCount === allStatuses.length
      ? "All Status"
      : `${selectedCount} selected`;

  const dropdownContent =
    isOpen && position.ready && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-9999 w-52 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
            style={{ top: position.top, left: position.left }}
          >
            {/* Quick actions */}
            <div className="px-2 py-1.5 border-b border-slate-100 flex items-center justify-between">
              <button
                onClick={selectAll}
                className="text-[10px] font-medium text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <button
                onClick={clearAll}
                className="text-[10px] font-medium text-slate-500 hover:text-slate-700"
              >
                Clear
              </button>
            </div>

            {/* Status options */}
            <div className="py-1 max-h-64 overflow-y-auto">
              {allStatuses.map((status) => {
                const config = statusConfig[status];
                const isSelected = selected.includes(status);

                return (
                  <label
                    key={status}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStatus(status)}
                      className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border ${config.color} ${config.bgColor} ${config.borderColor}`}
                    >
                      {config.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
      >
        <span>{displayText}</span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {dropdownContent}
    </>
  );
}
