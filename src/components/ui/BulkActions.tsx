"use client";

import React from "react";
import {
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

export interface BulkAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "danger" | "success";
  requireConfirmation?: boolean;
  confirmMessage?: string;
}

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  actions: BulkAction[];
  onAction: (actionKey: string) => void;
  onSelectAll?: () => void;
  onClearSelection: () => void;
  className?: string;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  actions,
  onAction,
  onSelectAll,
  onClearSelection,
  className = "",
}: BulkActionsBarProps) {
  const [confirmAction, setConfirmAction] = React.useState<string | null>(null);

  if (selectedCount === 0) return null;

  const handleAction = (action: BulkAction) => {
    if (action.requireConfirmation) {
      setConfirmAction(action.key);
    } else {
      onAction(action.key);
    }
  };

  const confirmAndExecute = () => {
    if (confirmAction) {
      onAction(confirmAction);
      setConfirmAction(null);
    }
  };

  const getActionStyles = (variant: BulkAction["variant"]) => {
    switch (variant) {
      case "danger":
        return "text-red-600 hover:bg-red-50";
      case "success":
        return "text-green-600 hover:bg-green-50";
      default:
        return "text-slate-600 hover:bg-slate-100";
    }
  };

  const actionToConfirm = actions.find((a) => a.key === confirmAction);

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-blue-700">
          {selectedCount} of {totalCount} selected
        </span>
        {onSelectAll && selectedCount < totalCount && (
          <button
            onClick={onSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Select all {totalCount}
          </button>
        )}
        <button
          onClick={onClearSelection}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
      </div>

      <div className="flex items-center gap-1">
        {confirmAction && actionToConfirm ? (
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200">
            <span className="text-sm text-slate-600">
              {actionToConfirm.confirmMessage ||
                `${actionToConfirm.label} ${selectedCount} items?`}
            </span>
            <button
              onClick={confirmAndExecute}
              className="px-2 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              className="px-2 py-1 text-sm text-slate-600 bg-slate-100 rounded hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          actions.map((action) => (
            <button
              key={action.key}
              onClick={() => handleAction(action)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${getActionStyles(
                action.variant
              )}`}
            >
              {action.icon}
              {action.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// Checkbox component for table rows
interface SelectCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function SelectCheckbox({
  checked,
  indeterminate,
  onChange,
  className = "",
}: SelectCheckboxProps) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate || false;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={`w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer ${className}`}
    />
  );
}

// Status change dropdown for bulk updates
interface StatusDropdownProps {
  options: Array<{ value: string; label: string; color?: string }>;
  onSelect: (status: string) => void;
  buttonLabel?: string;
  className?: string;
}

export function StatusDropdown({
  options,
  onSelect,
  buttonLabel = "Change Status",
  className = "",
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
      >
        <ArrowPathIcon className="w-4 h-4" />
        {buttonLabel}
        <ChevronDownIcon className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 min-w-[160px] bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50"
            >
              {option.color && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: option.color }}
                />
              )}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
