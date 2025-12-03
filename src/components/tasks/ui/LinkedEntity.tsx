"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface ProjectLead {
  id: string;
  name: string;
  type: "project" | "lead";
}

interface LinkedEntityValue {
  type: string;
  id: string;
  name: string;
}

interface LinkedEntityProps {
  value: LinkedEntityValue[] | LinkedEntityValue | null;
  onChange: (value: LinkedEntityValue[] | LinkedEntityValue | null) => void;
  readOnly?: boolean;
  placeholder?: string;
  multiple?: boolean;
}

export function LinkedEntity({
  value,
  onChange,
  readOnly = false,
  placeholder = "Link",
  multiple = false,
}: LinkedEntityProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<ProjectLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize value to always be an array internally
  const selectedItems: LinkedEntityValue[] = Array.isArray(value)
    ? value
    : value
    ? [value]
    : [];

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 340;
      const dropdownWidth = 288; // 18rem = 288px

      // Determine if we should show above or below
      // Prefer below, but go above if not enough space below AND there's more space above
      let top: number;
      if (spaceBelow >= dropdownHeight) {
        // Enough space below
        top = rect.bottom + 4;
      } else if (spaceAbove >= dropdownHeight) {
        // Not enough space below, but enough above
        top = rect.top - dropdownHeight - 4;
      } else {
        // Not enough space either way, position to fit in viewport
        // If more space below, position at bottom of viewport
        // If more space above, position at top of viewport
        if (spaceBelow >= spaceAbove) {
          top = Math.max(8, window.innerHeight - dropdownHeight - 8);
        } else {
          top = 8;
        }
      }

      // Ensure top is within viewport bounds
      top = Math.max(8, Math.min(top, window.innerHeight - dropdownHeight - 8));

      // Align right edge of dropdown with right edge of button if near right edge
      const spaceRight = window.innerWidth - rect.right;
      const left =
        spaceRight < dropdownWidth ? rect.right - dropdownWidth : rect.left;

      return {
        top,
        left: Math.max(
          8,
          Math.min(left, window.innerWidth - dropdownWidth - 8)
        ),
        ready: true,
      };
    }
    return { top: 0, left: 0, ready: false };
  };

  const handleOpen = () => {
    if (!isOpen) {
      setPosition(calculatePosition());
      if (items.length === 0) {
        fetchItems();
      }
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

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      // Fetch active leads
      const leadsRes = await fetch("/api/sales/leads?status=active");
      const leads = leadsRes.ok ? await leadsRes.json() : {};

      // For projects, try to fetch but don't fail if endpoint doesn't exist
      let projects: { projects?: any[] } = {};
      try {
        const projectsRes = await fetch("/api/projects?status=active");
        if (projectsRes.ok) {
          projects = await projectsRes.json();
        }
      } catch {
        // Projects API might not exist yet
      }

      // Filter out closed leads (won, lost, disqualified)
      const closedStages = ["won", "lost", "disqualified"];
      const activeLeads = (leads.leads || []).filter(
        (l: any) => !closedStages.includes(l.stage?.toLowerCase())
      );

      const combined: ProjectLead[] = [
        ...(projects.projects || []).map((p: any) => ({
          id: p.id,
          name: p.name || p.title || "Unnamed Project",
          type: "project" as const,
        })),
        ...activeLeads.map((l: any) => ({
          id: l.id,
          name:
            l.client_name || l.company_name || l.contact_name || "Unnamed Lead",
          type: "lead" as const,
        })),
      ];

      setItems(combined);
    } catch (error) {
      console.error("Error fetching projects/leads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const projects = filteredItems.filter((i) => i.type === "project");
  const leads = filteredItems.filter((i) => i.type === "lead");

  const isSelected = (item: ProjectLead) =>
    selectedItems.some((s) => s.id === item.id && s.type === item.type);

  const toggleItem = (item: ProjectLead) => {
    if (multiple) {
      const alreadySelected = isSelected(item);
      if (alreadySelected) {
        const newValue = selectedItems.filter(
          (s) => !(s.id === item.id && s.type === item.type)
        );
        onChange(newValue.length > 0 ? newValue : []);
      } else {
        onChange([
          ...selectedItems,
          { type: item.type, id: item.id, name: item.name },
        ]);
      }
    } else {
      onChange({ type: item.type, id: item.id, name: item.name });
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const removeItem = (item: LinkedEntityValue) => {
    if (multiple) {
      const newValue = selectedItems.filter(
        (s) => !(s.id === item.id && s.type === item.type)
      );
      onChange(newValue.length > 0 ? newValue : []);
    } else {
      onChange(null);
    }
  };

  if (readOnly) {
    if (selectedItems.length === 0)
      return <span className="text-xs text-slate-400">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {selectedItems.map((item) => (
          <span
            key={`${item.type}-${item.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded"
          >
            {item.type === "project" ? (
              <svg
                className="w-3 h-3 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            ) : (
              <svg
                className="w-3 h-3 text-green-500"
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
            )}
            <span className="max-w-20 truncate">{item.name}</span>
          </span>
        ))}
      </div>
    );
  }

  const dropdownContent =
    isOpen && position.ready && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-9999 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
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
                  placeholder="Search projects or leads..."
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Selected items */}
            {selectedItems.length > 0 && (
              <div className="px-3 py-2 border-b border-slate-100 bg-blue-50/50">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Selected ({selectedItems.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedItems.map((item) => (
                    <span
                      key={`selected-${item.type}-${item.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
                    >
                      {item.type === "project" ? "📁" : "👤"}
                      <span className="max-w-[100px] truncate">
                        {item.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item);
                        }}
                        className="ml-0.5 hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* List */}
            <div className="max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="px-3 py-4 text-sm text-slate-500 text-center">
                  <svg
                    className="animate-spin h-5 w-5 mx-auto mb-2 text-blue-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500 text-center">
                  {items.length === 0
                    ? "No projects or leads available"
                    : "No results found"}
                </div>
              ) : (
                <>
                  {projects.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 sticky top-0">
                        Projects ({projects.length})
                      </div>
                      {projects.map((item) => {
                        const selected = isSelected(item);
                        return (
                          <div
                            key={`project-${item.id}`}
                            onClick={() => toggleItem(item)}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              selected
                                ? "bg-blue-50 hover:bg-blue-100"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            {multiple && (
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {}}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                            <svg
                              className={`w-4 h-4 shrink-0 ${
                                selected ? "text-blue-600" : "text-blue-500"
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                              />
                            </svg>
                            <span
                              className={`text-sm truncate flex-1 ${
                                selected
                                  ? "text-blue-900 font-medium"
                                  : "text-slate-700"
                              }`}
                            >
                              {item.name}
                            </span>
                            {selected && (
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
                      })}
                    </>
                  )}
                  {leads.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 sticky top-0">
                        Leads ({leads.length})
                      </div>
                      {leads.map((item) => {
                        const selected = isSelected(item);
                        return (
                          <div
                            key={`lead-${item.id}`}
                            onClick={() => toggleItem(item)}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              selected
                                ? "bg-blue-50 hover:bg-blue-100"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            {multiple && (
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {}}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                            <svg
                              className={`w-4 h-4 shrink-0 ${
                                selected ? "text-green-600" : "text-green-500"
                              }`}
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
                            <span
                              className={`text-sm truncate flex-1 ${
                                selected
                                  ? "text-blue-900 font-medium"
                                  : "text-slate-700"
                              }`}
                            >
                              {item.name}
                            </span>
                            {selected && (
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
                      })}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer with done button for multiple */}
            {multiple && selectedItems.length > 0 && (
              <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className="w-full px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
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
          selectedItems.length > 0
            ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        }`}
      >
        {selectedItems.length > 0 ? (
          <>
            {selectedItems[0].type === "project" ? (
              <svg
                className="w-3.5 h-3.5 text-blue-500 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 text-green-500 shrink-0"
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
            )}
            <span className="font-medium truncate max-w-[100px]">
              {selectedItems.length === 1
                ? selectedItems[0].name ||
                  (selectedItems[0].type === "lead" ? "Lead" : "Project")
                : `${selectedItems.length} linked`}
            </span>
          </>
        ) : (
          <>
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
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span className="font-medium">{placeholder}</span>
          </>
        )}
      </button>
      {dropdownContent}
    </>
  );
}
