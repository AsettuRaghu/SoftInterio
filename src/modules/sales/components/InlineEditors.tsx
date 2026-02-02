"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Lead, BudgetRange } from "@/types/leads";
import { BudgetRangeLabels } from "@/types/leads";
import {
  CheckIcon,
  XMarkIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { BUDGET_OPTIONS } from "@/modules/sales/constants/leadsConstants";
import { useDropdownPosition } from "@/modules/sales/hooks/useDropdownPosition";

// Inline Date Editor
export function InlineDateEditor({
  lead,
  field,
  onUpdate,
}: {
  lead: Lead;
  field: "target_start_date";
  onUpdate: (
    leadId: string,
    field: string,
    value: string | number | null
  ) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(lead[field] || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (value === (lead[field] || "")) {
      setIsEditing(false);
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdate(lead.id, field, value || null);
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setValue(lead[field] || "");
    setIsEditing(false);
  };

  const formatDisplayDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  if (isEditing) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isUpdating}
          className="w-28 px-1.5 py-1 text-xs border border-blue-300 rounded focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
        />
        <button
          onClick={handleSave}
          disabled={isUpdating}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
        >
          {isUpdating ? (
            <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckIcon className="w-3 h-3" />
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={isUpdating}
          className="p-1 text-slate-400 hover:bg-slate-100 rounded"
        >
          <XMarkIcon className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors group"
    >
      <CalendarIcon className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
      <span>{formatDisplayDate(lead[field])}</span>
    </button>
  );
}

// Inline Budget Editor with smart positioning
export function InlineBudgetEditor({
  lead,
  onUpdate,
}: {
  lead: Lead;
  onUpdate: (
    leadId: string,
    field: string,
    value: string | number | null
  ) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { triggerRef, position } = useDropdownPosition(isOpen);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (value: BudgetRange) => {
    if (value === lead.budget_range) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdate(lead.id, "budget_range", value);
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const displayLabel = lead.budget_range
    ? BudgetRangeLabels[lead.budget_range]
    : "Set Budget";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isUpdating}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-all ${
          lead.budget_range
            ? "text-slate-700 hover:bg-slate-100"
            : "text-slate-400 hover:bg-slate-100 italic"
        } ${isUpdating ? "opacity-50" : ""}`}
      >
        {isUpdating ? (
          <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            {displayLabel}
            {position.openUpward && isOpen ? (
              <ChevronUpIcon className="w-3 h-3" />
            ) : (
              <ChevronDownIcon className="w-3 h-3" />
            )}
          </>
        )}
      </button>
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: position.openUpward ? "auto" : `${position.top + 4}px`,
            bottom: position.openUpward
              ? `${window.innerHeight - position.top + 4}px`
              : "auto",
            left: `${position.left}px`,
          }}
          className="z-9999 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[120px] max-h-48 overflow-y-auto"
        >
          {BUDGET_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(option.value);
              }}
              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center justify-between ${
                option.value === lead.budget_range ? "bg-blue-50" : ""
              }`}
            >
              <span>{option.label}</span>
              {option.value === lead.budget_range && (
                <CheckIcon className="w-3 h-3 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
