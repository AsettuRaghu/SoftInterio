"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

type TaskStatus =
  | "todo"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "cancelled";

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}

const statusConfig: Record<TaskStatus, StatusConfig> = {
  todo: {
    label: "To Do",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    icon: (
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  in_progress: {
    label: "In Progress",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: (
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M12 3v18m0-18a9 9 0 0 1 9 9H12V3z" />
      </svg>
    ),
  },
  completed: {
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: (
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  on_hold: {
    label: "On Hold",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: (
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    ),
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: (
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
};

interface StatusBadgeProps {
  value: TaskStatus;
  onChange?: (value: TaskStatus) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: StatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const config = statusConfig[value] || statusConfig.todo;

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 200;

      return {
        top:
          spaceBelow > dropdownHeight
            ? rect.bottom + 4
            : rect.top - dropdownHeight - 4,
        left: rect.left,
        ready: true,
      };
    }
    return { top: 0, left: 0, ready: false };
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const sizeClasses =
    size === "sm" ? "px-2 py-0.5 text-xs gap-1" : "px-2.5 py-1 text-xs gap-1.5";

  const dropdownContent =
    isOpen && position.ready && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-9999 w-40 bg-white rounded-lg shadow-xl border border-slate-200 py-1 animate-in fade-in slide-in-from-top-1 duration-150"
            style={{ top: position.top, left: position.left }}
          >
            {(Object.keys(statusConfig) as TaskStatus[]).map((status) => {
              const cfg = statusConfig[status];
              return (
                <button
                  key={status}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange?.(status);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                    value === status ? "bg-slate-50" : ""
                  }`}
                >
                  <span className={cfg.color}>{cfg.icon}</span>
                  <span className={`font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  {value === status && (
                    <svg
                      className="w-4 h-4 ml-auto text-blue-600"
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
            })}
          </div>,
          document.body
        )
      : null;

  if (readOnly) {
    return (
      <span
        className={`inline-flex items-center ${sizeClasses} font-medium rounded-md border ${config.bgColor} ${config.color} ${config.borderColor}`}
      >
        {config.icon}
        <span>{config.label}</span>
      </span>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center ${sizeClasses} font-medium rounded-md border transition-all ${config.bgColor} ${config.color} ${config.borderColor} hover:shadow-sm cursor-pointer`}
      >
        {config.icon}
        <span>{config.label}</span>
        <svg
          className="w-3 h-3 ml-0.5 opacity-50"
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

export type { TaskStatus };
