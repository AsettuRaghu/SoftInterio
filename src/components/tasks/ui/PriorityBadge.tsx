"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

type TaskPriority = "critical" | "high" | "medium" | "low" | null;

interface PriorityConfig {
  label: string;
  color: string;
  bgColor: string;
  flagColor: string;
}

const priorityConfig: Record<NonNullable<TaskPriority>, PriorityConfig> = {
  critical: {
    label: "Critical",
    color: "text-red-900",
    bgColor: "bg-red-50 hover:bg-red-100",
    flagColor: "text-red-600",
  },
  high: {
    label: "High",
    color: "text-orange-900",
    bgColor: "bg-orange-50 hover:bg-orange-100",
    flagColor: "text-orange-600",
  },
  medium: {
    label: "Medium",
    color: "text-blue-900",
    bgColor: "bg-blue-50 hover:bg-blue-100",
    flagColor: "text-blue-600",
  },
  low: {
    label: "Low",
    color: "text-green-700",
    bgColor: "bg-green-50 hover:bg-green-100",
    flagColor: "text-green-500",
  },
};

const FlagIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" />
  </svg>
);

interface PriorityBadgeProps {
  value: TaskPriority;
  onChange?: (value: TaskPriority) => void;
  readOnly?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const noPriorityConfig: PriorityConfig = {
  label: "None",
  color: "text-slate-500",
  bgColor: "bg-slate-50 hover:bg-slate-100",
  flagColor: "text-slate-400",
};

export function PriorityBadge({
  value,
  onChange,
  readOnly = false,
  showLabel = true,
  size = "md",
}: PriorityBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const config = value ? priorityConfig[value] : noPriorityConfig;

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 180;

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

  const iconSize = size === "sm" ? "w-4 h-4" : "w-4 h-4";
  const padding = size === "sm" ? "p-1.5" : "p-1.5";

  const allPriorityOptions: TaskPriority[] = [
    "critical",
    "high",
    "medium",
    "low",
  ];

  const dropdownContent =
    isOpen && position.ready && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-9999 w-36 bg-white rounded-lg shadow-xl border border-slate-200 py-1 animate-in fade-in slide-in-from-top-1 duration-150"
            style={{ top: position.top, left: position.left }}
          >
            {allPriorityOptions.map((priority) => {
              const cfg = priority
                ? priorityConfig[priority]
                : noPriorityConfig;
              return (
                <button
                  key={priority ?? "none"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange?.(priority);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                    value === priority ? "bg-slate-50" : ""
                  }`}
                >
                  <FlagIcon className={`w-4 h-4 ${cfg.flagColor}`} />
                  <span className={`font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  {value === priority && (
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
        className={`inline-flex items-center gap-1 ${padding} rounded-md ${config.bgColor} ${config.flagColor}`}
        title={config.label}
      >
        <FlagIcon className={iconSize} />
        {showLabel && (
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 ${padding} rounded-md transition-all ${config.bgColor} ${config.flagColor} hover:shadow-sm cursor-pointer`}
        title={config.label}
      >
        <FlagIcon className={iconSize} />
        {showLabel && (
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
        )}
      </button>
      {dropdownContent}
    </>
  );
}

export type { TaskPriority };
