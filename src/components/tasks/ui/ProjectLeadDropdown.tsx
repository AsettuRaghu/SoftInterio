"use client";

import React, { useState, useRef, useEffect } from "react";

interface ProjectLead {
  id: string;
  name: string;
  type: "project" | "lead";
}

interface ProjectLeadDropdownProps {
  value: { type: string; id: string; name: string } | null;
  onChange: (value: { type: string; id: string; name: string } | null) => void;
  className?: string;
}

export function ProjectLeadDropdown({
  value,
  onChange,
  className = "",
}: ProjectLeadDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<ProjectLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  useEffect(() => {
    if (isOpen && items.length === 0) {
      fetchItems();
    }
  }, [isOpen]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      // Fetch projects
      const projectsRes = await fetch("/api/projects?status=active");
      const projects = projectsRes.ok ? await projectsRes.json() : [];

      // Fetch leads
      const leadsRes = await fetch("/api/sales/leads?status=active");
      const leads = leadsRes.ok ? await leadsRes.json() : [];

      const combined: ProjectLead[] = [
        ...(projects.projects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          type: "project" as const,
        })),
        ...(leads.leads || []).map((l: any) => ({
          id: l.id,
          name: l.company_name || l.contact_name,
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
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 border border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors"
      >
        {value ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-900">
              <span className="text-xs text-slate-500 mr-1.5">
                {value.type === "project" ? "Project:" : "Lead:"}
              </span>
              {value.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        ) : (
          <span className="text-sm text-slate-400">
            Select project or lead...
          </span>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-slate-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects or leads..."
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-slate-500">Loading...</div>
            ) : filteredItems.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                No projects or leads found
              </div>
            ) : (
              <>
                {filteredItems.filter((i) => i.type === "project").length >
                  0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50">
                      Projects
                    </div>
                    {filteredItems
                      .filter((i) => i.type === "project")
                      .map((item) => (
                        <div
                          key={`project-${item.id}`}
                          onClick={() => {
                            onChange({
                              type: "project",
                              id: item.id,
                              name: item.name,
                            });
                            setIsOpen(false);
                          }}
                          className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          {item.name}
                        </div>
                      ))}
                  </>
                )}
                {filteredItems.filter((i) => i.type === "lead").length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50">
                      Leads
                    </div>
                    {filteredItems
                      .filter((i) => i.type === "lead")
                      .map((item) => (
                        <div
                          key={`lead-${item.id}`}
                          onClick={() => {
                            onChange({
                              type: "lead",
                              id: item.id,
                              name: item.name,
                            });
                            setIsOpen(false);
                          }}
                          className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          {item.name}
                        </div>
                      ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
