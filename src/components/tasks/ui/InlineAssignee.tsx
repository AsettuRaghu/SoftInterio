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

const UserIcon = ({ className }: { className?: string }) => (
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
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface InlineAssigneeProps {
  value?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  teamMembers: TeamMember[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
  showUnassigned?: boolean;
}

export function InlineAssignee({
  value,
  assigneeName,
  assigneeAvatar,
  teamMembers,
  onChange,
  disabled,
  showUnassigned = true,
}: InlineAssigneeProps) {
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

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 max-h-64 overflow-auto"
      style={{ top: position.top, left: position.left }}
    >
      {showUnassigned && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
            setIsOpen(false);
          }}
          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 ${
            !value ? "bg-slate-50" : ""
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
            <UserIcon className="w-3 h-3 text-slate-500" />
          </div>
          <span className="text-slate-600">Unassigned</span>
          {!value && <CheckIcon className="w-4 h-4 ml-auto text-blue-600" />}
        </button>
      )}
      {teamMembers.map((member) => (
        <button
          key={member.id}
          onClick={(e) => {
            e.stopPropagation();
            onChange(member.id);
            setIsOpen(false);
          }}
          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 ${
            value === member.id ? "bg-slate-50" : ""
          }`}
        >
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt=""
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
              {member.name?.charAt(0) || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 truncate">{member.name}</p>
            <p className="text-xs text-slate-500 truncate">{member.email}</p>
          </div>
          {value === member.id && (
            <CheckIcon className="w-4 h-4 text-blue-600 shrink-0" />
          )}
        </button>
      ))}
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
        className={`inline-flex items-center gap-2 px-2 py-1 text-sm rounded-lg transition-all ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-slate-100 cursor-pointer"
        }`}
      >
        {assigneeAvatar ? (
          <img
            src={assigneeAvatar}
            alt=""
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : assigneeName ? (
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
            {assigneeName.charAt(0)}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
            <UserIcon className="w-3 h-3 text-slate-500" />
          </div>
        )}
        <span className="text-slate-700 truncate max-w-24">
          {assigneeName || "Unassigned"}
        </span>
        {!disabled && <ChevronDownIcon className="w-3 h-3 text-slate-400" />}
      </button>

      {typeof window !== "undefined" &&
        createPortal(dropdownContent, document.body)}
    </>
  );
}
