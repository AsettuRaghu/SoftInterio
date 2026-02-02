"use client";

import React, { useRef, useEffect, useState } from "react";
import { ChevronDownIcon, CheckIcon } from "@heroicons/react/24/outline";

interface LeadsFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
}

export function LeadsFilterBar({
  searchValue,
  onSearchChange,
  selectedStatuses,
  onStatusChange,
}: LeadsFilterBarProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowStatusDropdown(false);
      }
    };

    if (showStatusDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showStatusDropdown]);

  return (
    <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-3">
      {/* Search Input */}
      <input
        type="text"
        placeholder="Search by name, email, property..."
        value={searchValue}
        onChange={(e) => {
          onSearchChange(e.target.value);
        }}
        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      />

      {/* Status Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
          className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-2 whitespace-nowrap"
        >
          Status:{" "}
          {selectedStatuses.length === 1
            ? selectedStatuses[0] === "active"
              ? "Active"
              : selectedStatuses[0] === "won"
              ? "Won"
              : selectedStatuses[0] === "lost"
              ? "Lost"
              : selectedStatuses[0] === "disqualified"
              ? "Disqualified"
              : "All"
            : `${selectedStatuses.length} selected`}
          <ChevronDownIcon
            className={`w-4 h-4 transition-transform ${
              showStatusDropdown ? "rotate-180" : ""
            }`}
          />
        </button>

        {showStatusDropdown && (
          <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-48">
            <div className="p-2">
              {/* Select All */}
              <button
                onClick={() => {
                  onStatusChange(["active", "won", "lost", "disqualified"]);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm font-medium text-slate-700 flex items-center gap-2"
              >
                <CheckIcon
                  className={`w-4 h-4 ${
                    selectedStatuses.length === 4
                      ? "text-blue-600"
                      : "text-transparent"
                  }`}
                />
                All Statuses
              </button>

              <div className="h-px bg-slate-200 my-1" />

              {/* Individual options */}
              {[
                { value: "active", label: "Active" },
                { value: "won", label: "Won" },
                { value: "lost", label: "Lost" },
                { value: "disqualified", label: "Disqualified" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onStatusChange(
                      selectedStatuses.includes(option.value)
                        ? selectedStatuses.filter((s) => s !== option.value)
                        : [...selectedStatuses, option.value]
                    );
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm text-slate-700 flex items-center gap-2"
                >
                  <CheckIcon
                    className={`w-4 h-4 ${
                      selectedStatuses.includes(option.value)
                        ? "text-blue-600"
                        : "text-transparent"
                    }`}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
