"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Icons
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

export interface InlineDropdownProps<T extends string> {
  value: T;
  options: T[];
  labels: Record<T, string>;
  colors: Record<T, { bg: string; text: string; dot?: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function InlineDropdown<T extends string>({
  value,
  options,
  labels,
  colors,
  onChange,
  disabled,
}: InlineDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [isOpen]);

  // Close on click outside
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

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const currentColors = colors[value];

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed z-9999 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1"
      style={{ top: position.top, left: position.left }}
    >
      {options.map((option) => {
        const optColors = colors[option];
        return (
          <button
            key={option}
            onClick={(e) => {
              e.stopPropagation();
              onChange(option);
              setIsOpen(false);
            }}
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-slate-50 ${
              value === option ? "bg-slate-50" : ""
            }`}
          >
            {optColors.dot && (
              <span className={`w-2 h-2 rounded-full ${optColors.dot}`} />
            )}
            <span className={optColors.text}>{labels[option]}</span>
            {value === option && (
              <CheckIcon className="w-4 h-4 ml-auto text-blue-600" />
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
          currentColors.bg
        } ${currentColors.text} ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:ring-2 hover:ring-offset-1 hover:ring-blue-300 cursor-pointer"
        }`}
      >
        {currentColors.dot && (
          <span className={`w-1.5 h-1.5 rounded-full ${currentColors.dot}`} />
        )}
        {labels[value]}
        {!disabled && <ChevronDownIcon className="w-3 h-3 ml-0.5" />}
      </button>

      {typeof window !== "undefined" &&
        createPortal(dropdownContent, document.body)}
    </>
  );
}
