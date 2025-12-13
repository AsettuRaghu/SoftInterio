"use client";

import React from "react";
import {
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  multiple?: boolean;
}

interface FilterBarProps {
  filters: FilterConfig[];
  activeFilters: Record<string, string | string[]>;
  onFilterChange: (key: string, value: string | string[] | null) => void;
  onClearAll?: () => void;
  className?: string;
}

export function FilterBar({
  filters,
  activeFilters,
  onFilterChange,
  onClearAll,
  className = "",
}: FilterBarProps) {
  const hasActiveFilters = Object.values(activeFilters).some(
    (v) => v && (Array.isArray(v) ? v.length > 0 : v !== "")
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1 text-slate-500 text-sm">
        <FunnelIcon className="w-4 h-4" />
        <span>Filters:</span>
      </div>

      {filters.map((filter) => (
        <FilterDropdown
          key={filter.key}
          filter={filter}
          value={activeFilters[filter.key]}
          onChange={(value) => onFilterChange(filter.key, value)}
        />
      ))}

      {hasActiveFilters && onClearAll && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
        >
          <XMarkIcon className="w-3 h-3" />
          Clear all
        </button>
      )}
    </div>
  );
}

interface FilterDropdownProps {
  filter: FilterConfig;
  value: string | string[] | undefined;
  onChange: (value: string | string[] | null) => void;
}

function FilterDropdown({ filter, value, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
  const hasSelection = selectedValues.length > 0;

  const getDisplayLabel = () => {
    if (!hasSelection) return filter.label;
    if (selectedValues.length === 1) {
      const option = filter.options.find((o) => o.value === selectedValues[0]);
      return option?.label || selectedValues[0];
    }
    return `${filter.label} (${selectedValues.length})`;
  };

  const handleSelect = (optionValue: string) => {
    if (filter.multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(newValues.length > 0 ? newValues : null);
    } else {
      onChange(optionValue === value ? null : optionValue);
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
          hasSelection
            ? "bg-blue-50 border-blue-200 text-blue-700"
            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
        }`}
      >
        <span>{getDisplayLabel()}</span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-auto">
          {filter.options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-50 ${
                  isSelected ? "bg-blue-50 text-blue-700" : "text-slate-700"
                }`}
              >
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-slate-400">{option.count}</span>
                )}
                {isSelected && filter.multiple && (
                  <svg
                    className="w-4 h-4 text-blue-600"
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
        </div>
      )}
    </div>
  );
}

// Quick filter pills for common use cases
interface QuickFilterPillsProps {
  options: Array<{ value: string; label: string; count?: number }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function QuickFilterPills({
  options,
  value,
  onChange,
  className = "",
}: QuickFilterPillsProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            value === option.value
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={`ml-1.5 text-xs ${
                value === option.value ? "text-blue-200" : "text-slate-400"
              }`}
            >
              ({option.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
