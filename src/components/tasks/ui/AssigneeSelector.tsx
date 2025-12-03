"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface AssigneeSelectorProps {
  selected: string | null;
  onChange: (selected: string | null) => void;
  teamMembers: TeamMember[];
  readOnly?: boolean;
}

const UserAvatar = ({
  member,
  size = "md",
  showTooltip = false,
}: {
  member: TeamMember;
  size?: "xs" | "sm" | "md" | "lg";
  showTooltip?: boolean;
}) => {
  const sizeClasses = {
    xs: "w-4 h-4 text-[7px]",
    sm: "w-5 h-5 text-[9px]",
    md: "w-6 h-6 text-[10px]",
    lg: "w-8 h-8 text-xs",
  };

  const initials = member.full_name
    ? member.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : member.email[0].toUpperCase();

  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-cyan-500",
    "bg-amber-500",
    "bg-rose-500",
  ];
  const colorIndex = member.id.charCodeAt(0) % colors.length;

  return (
    <div className="relative group">
      {member.avatar_url ? (
        <img
          src={member.avatar_url}
          alt={member.full_name || member.email}
          className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-white`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full ${colors[colorIndex]} text-white flex items-center justify-center font-semibold ring-2 ring-white`}
        >
          {initials}
        </div>
      )}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {member.full_name || member.email}
        </div>
      )}
    </div>
  );
};

export function AssigneeSelector({
  selected,
  onChange,
  teamMembers,
  readOnly = false,
}: AssigneeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedMember = selected
    ? teamMembers.find((m) => m.id === selected)
    : null;
  const filteredMembers = teamMembers.filter(
    (m) =>
      m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 280;

      return {
        top:
          spaceBelow > dropdownHeight
            ? rect.bottom + 4
            : rect.top - dropdownHeight - 4,
        left: Math.min(rect.left, window.innerWidth - 260),
        ready: true,
      };
    }
    return { top: 0, left: 0, ready: false };
  };

  const handleOpen = () => {
    if (!isOpen) {
      setPosition(calculatePosition());
      setTimeout(() => searchInputRef.current?.focus(), 50);
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
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectAssignee = (id: string | null) => {
    onChange(id);
    setIsOpen(false);
    setSearchQuery("");
  };

  const dropdownContent =
    isOpen && position.ready && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-9999 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
            style={{ top: position.top, left: position.left }}
          >
            {/* Search */}
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search people..."
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Unassign option */}
            {selected && (
              <div
                onClick={() => selectAssignee(null)}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer border-b border-slate-100 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Unassign
              </div>
            )}

            {/* List */}
            <div className="max-h-52 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500 text-center">
                  No team members found
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const isSelected = selected === member.id;
                  return (
                    <div
                      key={member.id}
                      onClick={() => selectAssignee(member.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50 hover:bg-blue-100"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <UserAvatar member={member} size="md" />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium truncate ${
                            isSelected ? "text-blue-900" : "text-slate-900"
                          }`}
                        >
                          {member.full_name || "No name"}
                        </div>
                        <div
                          className={`text-xs truncate ${
                            isSelected ? "text-blue-600" : "text-slate-500"
                          }`}
                        >
                          {member.email}
                        </div>
                      </div>
                      {isSelected && (
                        <svg
                          className="w-5 h-5 text-blue-600 shrink-0"
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
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  if (readOnly) {
    if (!selectedMember) {
      return <span className="text-xs text-slate-400">Unassigned</span>;
    }

    return (
      <div className="flex items-center gap-1.5">
        <UserAvatar member={selectedMember} size="sm" showTooltip />
        <span className="text-xs text-slate-700 truncate max-w-20">
          {selectedMember.full_name || selectedMember.email}
        </span>
      </div>
    );
  }

  return (
    <>
      <div
        ref={buttonRef}
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors min-w-20"
      >
        {!selectedMember ? (
          <>
            <svg
              className="w-4 h-4 text-slate-400"
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
            <span className="text-xs text-slate-500">Assign</span>
          </>
        ) : (
          <>
            <UserAvatar member={selectedMember} size="sm" />
            <span className="text-xs text-slate-700 truncate max-w-[100px]">
              {selectedMember.full_name || selectedMember.email.split("@")[0]}
            </span>
          </>
        )}
        <svg
          className="w-3 h-3 text-slate-400 ml-auto shrink-0"
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
      </div>
      {dropdownContent}
    </>
  );
}

export { UserAvatar };
