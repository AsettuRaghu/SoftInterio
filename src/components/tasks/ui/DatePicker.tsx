"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  readOnly?: boolean;
  showIcon?: boolean;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  readOnly = false,
  showIcon = true,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 340;

      return {
        top:
          spaceBelow > dropdownHeight
            ? rect.bottom + 4
            : rect.top - dropdownHeight - 4,
        left: Math.min(rect.left, window.innerWidth - 300),
        ready: true,
      };
    }
    return { top: 0, left: 0, ready: false };
  };

  const handleOpen = () => {
    if (!isOpen) {
      setPosition(calculatePosition());
      if (value) setViewDate(new Date(value));
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

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  const isOverdue =
    value && new Date(value) < new Date(new Date().setHours(0, 0, 0, 0));

  // Calendar calculations
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: (number | null)[] = [];

    // Empty slots before first day
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  }, [viewDate]);

  const selectDate = (day: number) => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    // Format as YYYY-MM-DD in local time to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayStr = String(date.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const goToPrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const isDateDisabled = (day: number) => {
    if (!minDate) return false;
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return date < new Date(minDate);
  };

  const isSelectedDate = (day: number) => {
    if (!value) return false;
    const selectedDate = new Date(value);
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewDate.getMonth() &&
      selectedDate.getFullYear() === viewDate.getFullYear()
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewDate.getMonth() &&
      today.getFullYear() === viewDate.getFullYear()
    );
  };

  if (readOnly) {
    if (!value) return <span className="text-xs text-slate-400">—</span>;
    return (
      <span
        className={`text-xs font-medium ${
          isOverdue ? "text-red-600" : "text-slate-600"
        }`}
      >
        {formatDisplayDate(value)}
      </span>
    );
  }

  const dropdownContent =
    isOpen && position.ready && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-9999 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-[280px] animate-in fade-in slide-in-from-top-1 duration-150"
            style={{ top: position.top, left: position.left }}
          >
            {/* Quick options */}
            <div className="flex gap-1 mb-3">
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  onChange(today);
                  setIsOpen(false);
                }}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  onChange(tomorrow.toISOString().split("T")[0]);
                  setIsOpen(false);
                }}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  onChange(nextWeek.toISOString().split("T")[0]);
                  setIsOpen(false);
                }}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                Next Week
              </button>
            </div>

            {/* Calendar header */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={goToPrevMonth}
                className="p-1 hover:bg-slate-100 rounded-md transition-colors"
              >
                <svg
                  className="w-4 h-4 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-sm font-semibold text-slate-900">
                {viewDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                type="button"
                onClick={goToNextMonth}
                className="p-1 hover:bg-slate-100 rounded-md transition-colors"
              >
                <svg
                  className="w-4 h-4 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div
                  key={day}
                  className="text-center text-[10px] font-medium text-slate-400 py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((day, idx) => (
                <div key={idx} className="aspect-square">
                  {day !== null && (
                    <button
                      type="button"
                      onClick={() => selectDate(day)}
                      disabled={isDateDisabled(day)}
                      className={`w-full h-full flex items-center justify-center text-xs rounded-md transition-colors ${
                        isSelectedDate(day)
                          ? "bg-blue-600 text-white font-semibold"
                          : isToday(day)
                          ? "bg-blue-100 text-blue-700 font-semibold"
                          : isDateDisabled(day)
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {day}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Clear button */}
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="w-full mt-2 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors border-t border-slate-100 pt-2"
              >
                Clear Date
              </button>
            )}
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
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors text-xs ${
          value
            ? isOverdue
              ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        }`}
      >
        {showIcon && (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        )}
        <span className="font-medium">
          {formatDisplayDate(value) || placeholder}
        </span>
      </button>
      {dropdownContent}
    </>
  );
}
