"use client";

import React, { useState, useRef, useEffect } from "react";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface AssigneeMultiSelectProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  teamMembers: TeamMember[];
  className?: string;
}

export function AssigneeMultiSelect({
  selected,
  onChange,
  teamMembers,
  className = "",
}: AssigneeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

  const toggleAssignee = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMembers = teamMembers.filter((m) => selected.includes(m.id));

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors"
      >
        {selectedMembers.length === 0 ? (
          <span className="text-sm text-slate-400">Select assignees...</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedMembers.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded"
              >
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt=""
                    className="w-4 h-4 rounded-full"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-semibold">
                    {member.full_name?.[0] || member.email[0].toUpperCase()}
                  </div>
                )}
                <span>{member.full_name || member.email}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAssignee(member.id);
                  }}
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-slate-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team members..."
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                No members found
              </div>
            ) : (
              filteredMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(member.id)}
                    onChange={() => toggleAssignee(member.id)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold">
                      {member.full_name?.[0] || member.email[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-slate-700">
                    {member.full_name || member.email}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
