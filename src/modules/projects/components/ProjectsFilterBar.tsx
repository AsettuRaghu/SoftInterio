"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  ChevronDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { ProjectStatus } from "@/types/projects";
import {
  PROJECT_STATUS_OPTIONS,
} from "@/modules/projects/constants";

interface ProjectsFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedStatuses: ProjectStatus[];
  onStatusChange: (statuses: ProjectStatus[]) => void;
  selectedPhases: string[];
  onPhaseChange: (phases: string[]) => void;
  availablePhases?: string[];
}

export default function ProjectsFilterBar({
  searchValue,
  onSearchChange,
  selectedStatuses,
  onStatusChange,
  selectedPhases,
  onPhaseChange,
  availablePhases = [],
}: ProjectsFilterBarProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPropertyTypeDropdown, setShowPropertyTypeDropdown] =
    useState(false);
  const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const phaseDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setShowStatusDropdown(false);
      }
      if (
        phaseDropdownRef.current &&
        !phaseDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPhaseDropdown(false);
      }
    };

    if (showStatusDropdown || showPhaseDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showStatusDropdown, showPhaseDropdown]);

  const getStatusLabel = (status: ProjectStatus) => {
    const option = PROJECT_STATUS_OPTIONS.find((opt) => opt.value === status);
    return option?.label || status;
  };

  const phaseOptions =
    availablePhases.length > 0
      ? availablePhases.map((phase) => ({ value: phase, label: phase }))
      : [];

  // Render filter dropdown
  const renderFilterDropdown = (
    ref: React.RefObject<HTMLDivElement>,
    show: boolean,
    setShow: (show: boolean) => void,
    label: string,
    selectedValues: string[],
    onSelect: (values: string[]) => void,
    options: Array<{ value: string; label: string }>,
  ) => (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShow(!show)}
        className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-2 whitespace-nowrap"
      >
        {label}:{" "}
        {selectedValues.length === 0
          ? "All"
          : selectedValues.length === 1
            ? options.find((o) => o.value === selectedValues[0])?.label ||
              selectedValues[0]
            : `${selectedValues.length} selected`}
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform ${show ? "rotate-180" : ""}`}
        />
      </button>

      {show && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-56">
          <div className="p-2 max-h-64 overflow-y-auto">
            {/* Select All */}
            <button
              onClick={() => {
                onSelect(options.map((o) => o.value));
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm font-medium text-slate-700 flex items-center gap-2"
            >
              <CheckIcon
                className={`w-4 h-4 ${
                  selectedValues.length === options.length
                    ? "text-blue-600"
                    : "text-transparent"
                }`}
              />
              All
            </button>

            <div className="h-px bg-slate-200 my-1" />

            {/* Individual options */}
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSelect(
                    selectedValues.includes(option.value)
                      ? selectedValues.filter((v) => v !== option.value)
                      : [...selectedValues, option.value],
                  );
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm text-slate-700 flex items-center gap-2"
              >
                <CheckIcon
                  className={`w-4 h-4 ${
                    selectedValues.includes(option.value)
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
  );

  return (
    /*
     * One line, as the leads bar. Search first and flexible, the two filters
     * that earn their place beside it. Priority and Property Type came off:
     * both are on every row and the search finds them, and four dropdowns
     * under a search box made a second toolbar out of what should be one.
     */
    <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-3">
      <div className="relative flex-1 min-w-0">
        <input
          type="text"
          placeholder="Search client, project, property, stage, manager, activity…"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {renderFilterDropdown(
        statusDropdownRef as React.RefObject<HTMLDivElement>,
        showStatusDropdown,
        setShowStatusDropdown,
        "Status",
        selectedStatuses as string[],
        (values) => onStatusChange(values as ProjectStatus[]),
        PROJECT_STATUS_OPTIONS,
      )}

      {phaseOptions.length > 0 &&
        renderFilterDropdown(
          phaseDropdownRef as React.RefObject<HTMLDivElement>,
          showPhaseDropdown,
          setShowPhaseDropdown,
          "Stage",
          selectedPhases,
          onPhaseChange,
          phaseOptions,
        )}

      {(selectedStatuses.length < PROJECT_STATUS_OPTIONS.length ||
        selectedPhases.length > 0) && (
        <button
          onClick={() => {
            onStatusChange(
              PROJECT_STATUS_OPTIONS.map((opt) => opt.value as ProjectStatus),
            );
            onPhaseChange([]);
          }}
          className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-1 whitespace-nowrap"
        >
          <XMarkIcon className="w-4 h-4" />
          Clear
        </button>
      )}
    </div>
  );
}
