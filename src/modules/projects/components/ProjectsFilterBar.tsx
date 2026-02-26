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
  PROJECT_PRIORITY_OPTIONS,
} from "@/modules/projects/constants";

interface ProjectsFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedStatuses: ProjectStatus[];
  onStatusChange: (statuses: ProjectStatus[]) => void;
  selectedPriorities: string[];
  onPriorityChange: (priorities: string[]) => void;
  selectedPropertyTypes: string[];
  onPropertyTypeChange: (types: string[]) => void;
  selectedPhases: string[];
  onPhaseChange: (phases: string[]) => void;
  availablePhases?: string[];
  availablePropertyTypes?: string[];
}

const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "commercial", label: "Commercial" },
  { value: "office", label: "Office" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

export default function ProjectsFilterBar({
  searchValue,
  onSearchChange,
  selectedStatuses,
  onStatusChange,
  selectedPriorities,
  onPriorityChange,
  selectedPropertyTypes,
  onPropertyTypeChange,
  selectedPhases,
  onPhaseChange,
  availablePhases = [],
  availablePropertyTypes = [],
}: ProjectsFilterBarProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showPropertyTypeDropdown, setShowPropertyTypeDropdown] =
    useState(false);
  const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const propertyTypeDropdownRef = useRef<HTMLDivElement>(null);
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
        priorityDropdownRef.current &&
        !priorityDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPriorityDropdown(false);
      }
      if (
        propertyTypeDropdownRef.current &&
        !propertyTypeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPropertyTypeDropdown(false);
      }
      if (
        phaseDropdownRef.current &&
        !phaseDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPhaseDropdown(false);
      }
    };

    if (
      showStatusDropdown ||
      showPriorityDropdown ||
      showPropertyTypeDropdown ||
      showPhaseDropdown
    ) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    showStatusDropdown,
    showPriorityDropdown,
    showPropertyTypeDropdown,
    showPhaseDropdown,
  ]);

  const getStatusLabel = (status: ProjectStatus) => {
    const option = PROJECT_STATUS_OPTIONS.find((opt) => opt.value === status);
    return option?.label || status;
  };

  const getPriorityLabel = (priority: string) => {
    return (
      PROJECT_PRIORITY_OPTIONS.find((opt) => opt.value === priority)?.label ||
      priority
    );
  };

  const getPropertyTypeLabel = (type: string) => {
    return (
      PROPERTY_TYPE_OPTIONS.find((opt) => opt.value === type)?.label || type
    );
  };

  const propertyTypeOptions =
    availablePropertyTypes.length > 0
      ? availablePropertyTypes.map((type) => ({
          value: type.toLowerCase(),
          label: type.charAt(0).toUpperCase() + type.slice(1),
        }))
      : PROPERTY_TYPE_OPTIONS;

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
    <div className="p-4 bg-white border-b border-slate-200 space-y-3">
      {/* Search Input */}
      <div className="relative flex-1">
        <input
          type="text"
          placeholder="Search projects by name, client, property, or project number..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status Dropdown */}
        {renderFilterDropdown(
          statusDropdownRef as React.RefObject<HTMLDivElement>,
          showStatusDropdown,
          setShowStatusDropdown,
          "Status",
          selectedStatuses as string[],
          (values) => onStatusChange(values as ProjectStatus[]),
          PROJECT_STATUS_OPTIONS,
        )}

        {/* Priority Dropdown */}
        {renderFilterDropdown(
          priorityDropdownRef as React.RefObject<HTMLDivElement>,
          showPriorityDropdown,
          setShowPriorityDropdown,
          "Priority",
          selectedPriorities,
          onPriorityChange,
          PROJECT_PRIORITY_OPTIONS,
        )}

        {/* Property Type Dropdown */}
        {propertyTypeOptions.length > 0 &&
          renderFilterDropdown(
            propertyTypeDropdownRef as React.RefObject<HTMLDivElement>,
            showPropertyTypeDropdown,
            setShowPropertyTypeDropdown,
            "Property Type",
            selectedPropertyTypes,
            onPropertyTypeChange,
            propertyTypeOptions,
          )}

        {/* Phase Dropdown */}
        {phaseOptions.length > 0 &&
          renderFilterDropdown(
            phaseDropdownRef as React.RefObject<HTMLDivElement>,
            showPhaseDropdown,
            setShowPhaseDropdown,
            "Phase",
            selectedPhases,
            onPhaseChange,
            phaseOptions,
          )}

        {/* Clear All Filters Button */}
        {(selectedStatuses.length < PROJECT_STATUS_OPTIONS.length ||
          selectedPriorities.length > 0 ||
          selectedPropertyTypes.length > 0 ||
          selectedPhases.length > 0) && (
          <button
            onClick={() => {
              onStatusChange(
                PROJECT_STATUS_OPTIONS.map((opt) => opt.value as ProjectStatus),
              );
              onPriorityChange([]);
              onPropertyTypeChange([]);
              onPhaseChange([]);
            }}
            className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-1"
          >
            <XMarkIcon className="w-4 h-4" />
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
