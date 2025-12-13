"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import type {
  Lead,
  LeadStage,
  LeadActivity,
  PropertyType,
  PropertyCategory,
  PropertySubtype,
  ServiceType,
  LeadSource,
  BudgetRange,
  LeadScore,
  DisqualificationReason,
  LostReason,
} from "@/types/leads";
import {
  LeadStageLabels as StageLabels,
  LeadStageColors as StageColors,
  PropertyTypeLabels as PropLabels,
  PropertyCategoryLabels as CatLabels,
  PropertySubtypeLabels as SubtypeLabels,
  PropertyTypesByCategory,
  PropertySubtypesByCategory,
  ServiceTypeLabels as SvcLabels,
  LeadSourceLabels as SrcLabels,
  BudgetRangeLabels,
  LeadScoreLabels,
  LeadScoreColors,
  ValidStageTransitions,
  getRequiredFieldsForTransition,
  DisqualificationReasonLabels,
  LostReasonLabels,
  LeadActivityTypeLabels,
} from "@/types/leads";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatBadge,
} from "@/components/ui/PageLayout";
import {
  AppTable,
  useAppTableSort,
  useAppTablePagination,
  useAppTableSearch,
  type ColumnDef,
  type FilterOption,
} from "@/components/ui/AppTable";
import { uiLogger } from "@/lib/logger";
import {
  UserGroupIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  XMarkIcon,
  CalendarIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

// Team member type for assignee dropdown
interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

// Stage filter tabs
const ACTIVE_STAGES: LeadStage[] = [
  "new",
  "qualified",
  "requirement_discussion",
  "proposal_discussion",
];

const STAGE_TABS: FilterOption[] = [
  { value: "active", label: "Active" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "disqualified", label: "Disqualified" },
];

// Lead Score options (formerly Priority)
const LEAD_SCORE_OPTIONS: {
  value: LeadScore;
  label: string;
  color: string;
}[] = [
  { value: "cold", label: "Cold", color: "bg-slate-100 text-slate-700" },
  { value: "warm", label: "Warm", color: "bg-amber-100 text-amber-700" },
  { value: "hot", label: "Hot", color: "bg-red-100 text-red-700" },
  { value: "on_hold", label: "On Hold", color: "bg-gray-100 text-gray-600" },
];

// Budget range options for inline editing
const BUDGET_OPTIONS: { value: BudgetRange; label: string }[] = [
  { value: "below_10l", label: "Below ₹10L" },
  { value: "around_10l", label: "~₹10 Lakhs" },
  { value: "around_20l", label: "~₹20 Lakhs" },
  { value: "around_30l", label: "~₹30 Lakhs" },
  { value: "around_40l", label: "~₹40 Lakhs" },
  { value: "around_50l", label: "~₹50 Lakhs" },
  { value: "above_50l", label: "₹50+ Lakhs" },
  { value: "not_disclosed", label: "Not Disclosed" },
];

// =====================================================
// HELPER: Use dropdown position hook with fixed positioning
// =====================================================
function useDropdownPosition(isOpen: boolean) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    openUpward: false,
  });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;

      setPosition({
        top: openUpward ? rect.top : rect.bottom,
        left: rect.left,
        openUpward,
      });
    }
  }, [isOpen]);

  return { triggerRef, position };
}

// =====================================================
// INLINE EDIT COMPONENTS
// =====================================================

// Inline Lead Score Editor with smart positioning
function InlineLeadScoreEditor({
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

  const handleSelect = async (value: LeadScore) => {
    if (value === lead.lead_score) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdate(lead.id, "lead_score", value);
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const currentOption = LEAD_SCORE_OPTIONS.find(
    (p) => p.value === lead.lead_score
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isUpdating}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all ${
          currentOption?.color || "bg-slate-100 text-slate-600"
        } ${isUpdating ? "opacity-50" : ""}`}
      >
        {isUpdating ? (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            {currentOption?.label || lead.lead_score || "Warm"}
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
          className="z-9999 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[100px]"
        >
          {LEAD_SCORE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(option.value);
              }}
              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center justify-between ${
                option.value === lead.lead_score ? "bg-blue-50" : ""
              }`}
            >
              <span className={`px-1.5 py-0.5 rounded ${option.color}`}>
                {option.label}
              </span>
              {option.value === lead.lead_score && (
                <CheckIcon className="w-3 h-3 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline Date Editor
function InlineDateEditor({
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
function InlineBudgetEditor({
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

// Inline Assignee Editor with smart positioning
function InlineAssigneeEditor({
  lead,
  teamMembers,
  onUpdate,
}: {
  lead: Lead;
  teamMembers: TeamMember[];
  onUpdate: (
    leadId: string,
    field: string,
    value: string | number | null
  ) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { triggerRef, position } = useDropdownPosition(isOpen);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (memberId: string | null) => {
    if (memberId === lead.assigned_to) {
      setIsOpen(false);
      setSearchTerm("");
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdate(lead.id, "assigned_to", memberId);
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
      setSearchTerm("");
    }
  };

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayUser = lead.assigned_user || lead.created_user;
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isUpdating}
        className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-all hover:bg-slate-100 ${
          isUpdating ? "opacity-50" : ""
        }`}
      >
        {isUpdating ? (
          <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        ) : displayUser ? (
          <>
            <div className="w-5 h-5 rounded-full bg-linear-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-[9px] font-medium">
              {getInitials(displayUser.name)}
            </div>
            <span className="text-slate-700 truncate max-w-[60px]">
              {displayUser.name.split(" ")[0]}
            </span>
            {position.openUpward && isOpen ? (
              <ChevronUpIcon className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronDownIcon className="w-3 h-3 text-slate-400" />
            )}
          </>
        ) : (
          <>
            <UserIcon className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 italic">Assign</span>
            {position.openUpward && isOpen ? (
              <ChevronUpIcon className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronDownIcon className="w-3 h-3 text-slate-400" />
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
          className="z-9999 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[180px]"
        >
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search members..."
              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {/* Options */}
          <div className="max-h-40 overflow-y-auto py-1">
            {/* Unassign option */}
            {lead.assigned_to && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(null);
                }}
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center gap-2 text-slate-500"
              >
                <XMarkIcon className="w-4 h-4" />
                Unassign
              </button>
            )}
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">
                No members found
              </div>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(member.id);
                  }}
                  className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center gap-2 ${
                    member.id === lead.assigned_to ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-linear-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-[9px] font-medium shrink-0">
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-700 truncate">
                      {member.name}
                    </div>
                  </div>
                  {member.id === lead.assigned_to && (
                    <CheckIcon className="w-3 h-3 text-blue-600 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Activity Dropdown - shows recent activities on hover/click
function ActivityDropdown({
  lead,
  formatDate,
}: {
  lead: Lead;
  formatDate: (date: string | null) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
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

  // Fetch activities when dropdown opens for the first time
  useEffect(() => {
    if (isOpen && !hasFetched) {
      setIsLoading(true);
      fetch(`/api/sales/leads/${lead.id}`)
        .then((res) => res.json())
        .then((data) => {
          setActivities(data.activities || []);
          setHasFetched(true);
        })
        .catch((err) => console.error("Error fetching activities:", err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, hasFetched, lead.id]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call_made":
      case "call_received":
        return (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        );
      case "call_missed":
        return (
          <svg
            className="w-3 h-3 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
            />
          </svg>
        );
      case "email_sent":
      case "email_received":
        return (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        );
      case "meeting_scheduled":
      case "meeting_completed":
        return (
          <svg
            className="w-3 h-3"
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
        );
      case "site_visit":
        return (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-slate-100 transition-all text-slate-600 hover:text-slate-900"
      >
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {lead.last_activity_at
          ? formatDate(lead.last_activity_at)
          : "No activity"}
        {position.openUpward && isOpen ? (
          <ChevronUpIcon className="w-3 h-3" />
        ) : (
          <ChevronDownIcon className="w-3 h-3" />
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
            left: `${Math.max(10, position.left - 100)}px`,
          }}
          className="z-9999 bg-white border border-slate-200 rounded-lg shadow-lg w-72"
        >
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Recent Activity
            </span>
            {lead.last_activity_type && (
              <span className="text-xs text-slate-500">
                {LeadActivityTypeLabels[lead.last_activity_type]}
              </span>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-slate-500 mt-2">
                  Loading activities...
                </p>
              </div>
            ) : activities.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No activities recorded yet
              </div>
            ) : (
              <div className="py-1">
                {activities.slice(0, 10).map((activity) => (
                  <div
                    key={activity.id}
                    className="px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">
                          {activity.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500">
                            {LeadActivityTypeLabels[activity.activity_type]}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDate(activity.created_at)}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                            {activity.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {activities.length > 10 && (
            <div className="px-3 py-2 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-500">
                +{activities.length - 10} more activities
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inline Stage Editor - opens stage transition modal directly on the list page
function InlineStageEditor({
  lead,
  onUpdate,
}: {
  lead: Lead;
  onUpdate: () => void;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedStage, setSelectedStage] = useState<LeadStage | null>(null);
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

  const validTransitions = ValidStageTransitions[lead.stage] || [];
  const colors = StageColors[lead.stage];

  // If no valid transitions, show static badge
  if (validTransitions.length === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
        {StageLabels[lead.stage]}
      </span>
    );
  }

  const handleStageSelect = (targetStage: LeadStage) => {
    setIsOpen(false);
    setSelectedStage(targetStage);
    setShowModal(true);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          ref={triggerRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all ${colors.bg} ${colors.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
          {StageLabels[lead.stage]}
          {position.openUpward && isOpen ? (
            <ChevronUpIcon className="w-3 h-3" />
          ) : (
            <ChevronDownIcon className="w-3 h-3" />
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
            className="z-9999 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-40"
          >
            <div className="px-3 py-1.5 text-xs text-slate-500 font-medium border-b border-slate-100">
              Change Stage to:
            </div>
            {validTransitions.map((stage) => {
              const stageColors = StageColors[stage];
              return (
                <button
                  key={stage}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStageSelect(stage);
                  }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 flex items-center gap-2"
                >
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${stageColors.bg} ${stageColors.text}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${stageColors.dot}`}
                    ></span>
                    {StageLabels[stage]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Stage Transition Modal */}
      {showModal && selectedStage && (
        <StageTransitionModal
          lead={lead}
          targetStage={selectedStage}
          onClose={() => {
            setShowModal(false);
            setSelectedStage(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedStage(null);
            onUpdate();
          }}
        />
      )}
    </>
  );
}

// Stage Transition Modal for inline stage changes
function StageTransitionModal({
  lead,
  targetStage,
  onClose,
  onSuccess,
}: {
  lead: Lead;
  targetStage: LeadStage;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showQuotationPrompt, setShowQuotationPrompt] = useState(false);
  const [formData, setFormData] = useState({
    // Lead-specific fields
    service_type: lead.service_type || "",
    lead_source: lead.lead_source || "",
    target_start_date: lead.target_start_date || "",
    target_end_date: lead.target_end_date || "",
    budget_range: lead.budget_range || "",
    project_scope: lead.project_scope || "",
    // Property fields from linked property
    property_name: lead.property?.property_name || "",
    property_category: lead.property?.category || "",
    property_type: lead.property?.property_type || "",
    property_subtype: lead.property?.property_subtype || "",
    unit_number: lead.property?.unit_number || "",
    carpet_area: lead.property?.carpet_area?.toString() || "",
    // Terminal stage fields
    disqualification_reason: "" as DisqualificationReason | "",
    disqualification_notes: "",
    lost_reason: "" as LostReason | "",
    lost_to_competitor: "",
    lost_notes: "",
    won_amount: "",
    contract_signed_date: "",
    expected_project_start: "",
    change_reason: "",
  });

  // Get available property types based on selected category
  const availablePropertyTypes = formData.property_category
    ? PropertyTypesByCategory[formData.property_category as PropertyCategory]
    : [];

  // Get available subtypes based on selected category
  const availableSubtypes = formData.property_category
    ? PropertySubtypesByCategory[formData.property_category as PropertyCategory]
    : [];

  // Cumulative validation helpers - later stages require all previous stage fields
  const isQualifiedFieldRequired = [
    "qualified",
    "requirement_discussion",
    "proposal_discussion",
  ].includes(targetStage);
  const isRequirementDiscussionFieldRequired = [
    "requirement_discussion",
    "proposal_discussion",
  ].includes(targetStage);
  const isProposalDiscussionFieldRequired =
    targetStage === "proposal_discussion";

  const getMinStartDate = () => {
    const today = new Date().toISOString().split("T")[0];
    if (lead.target_start_date) return lead.target_start_date;
    return today;
  };

  const getMinEndDate = () => {
    if (!formData.target_start_date) return "";
    const startDate = new Date(formData.target_start_date);
    startDate.setMonth(startDate.getMonth() + 1);
    return startDate.toISOString().split("T")[0];
  };

  const handleStartDateChange = (value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, target_start_date: value };
      if (value) {
        const minEnd = new Date(value);
        minEnd.setMonth(minEnd.getMonth() + 1);
        const minEndStr = minEnd.toISOString().split("T")[0];
        if (!prev.target_end_date || prev.target_end_date < minEndStr) {
          newData.target_end_date = minEndStr;
        }
      }
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/sales/leads/${lead.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_stage: targetStage,
          ...formData,
          carpet_area: formData.carpet_area
            ? parseFloat(formData.carpet_area)
            : undefined,
          won_amount: formData.won_amount
            ? parseFloat(formData.won_amount)
            : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to transition stage");
      }

      if (targetStage === "proposal_discussion") {
        const leadResponse = await fetch(`/api/sales/leads/${lead.id}`);
        if (leadResponse.ok) {
          const leadData = await leadResponse.json();
          const newQuotations = leadData.quotations || [];
          if (newQuotations.length > 0) {
            setSuccessMessage("Stage updated! A quotation has been created.");
            setShowQuotationPrompt(true);
            return;
          }
        }
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-10000 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Change Lead Stage
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {lead.client?.name || "Unknown"} • {lead.lead_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
              <CheckIcon className="w-4 h-4" />
              {successMessage}
            </div>
          )}

          {showQuotationPrompt && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-3">
                Would you like to view the quotation now?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const response = await fetch(`/api/sales/leads/${lead.id}`);
                    if (response.ok) {
                      const data = await response.json();
                      if (data.quotations?.length > 0) {
                        router.push(
                          `/dashboard/quotations/${data.quotations[0].id}`
                        );
                      }
                    }
                    onSuccess();
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Yes, open quotation
                </button>
                <button
                  type="button"
                  onClick={onSuccess}
                  className="px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                >
                  No, stay here
                </button>
              </div>
            </div>
          )}

          {!showQuotationPrompt && (
            <>
              {/* From / To Stage */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-slate-500 mb-1">From</p>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                      StageColors[lead.stage].bg
                    } ${StageColors[lead.stage].text}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        StageColors[lead.stage].dot
                      }`}
                    ></span>
                    {StageLabels[lead.stage]}
                  </span>
                </div>
                <svg
                  className="w-5 h-5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-xs text-slate-500 mb-1">To</p>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${StageColors[targetStage].bg} ${StageColors[targetStage].text}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${StageColors[targetStage].dot}`}
                    ></span>
                    {StageLabels[targetStage]}
                  </span>
                </div>
              </div>

              {/* Show all fields for non-terminal stages */}
              {!["disqualified", "lost", "won"].includes(targetStage) && (
                <>
                  {/* Property Details Section */}
                  <div className="border-t border-slate-200 pt-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      Property Details
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Category{" "}
                            {isQualifiedFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <select
                            required={isQualifiedFieldRequired}
                            value={formData.property_category}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                property_category: e.target
                                  .value as PropertyCategory,
                                property_type: "",
                                property_subtype: "",
                              })
                            }
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                          >
                            <option value="">Select</option>
                            {Object.entries(CatLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Property Type{" "}
                            {isQualifiedFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <select
                            required={isQualifiedFieldRequired}
                            value={formData.property_type}
                            disabled={!formData.property_category}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                property_type: e.target.value as PropertyType,
                              })
                            }
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm disabled:bg-slate-50"
                          >
                            <option value="">
                              {formData.property_category ? "Select" : "—"}
                            </option>
                            {availablePropertyTypes.map((type) => (
                              <option key={type} value={type}>
                                {PropLabels[type]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Community{" "}
                            {isQualifiedFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <select
                            required={isQualifiedFieldRequired}
                            value={formData.property_subtype}
                            disabled={!formData.property_category}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                property_subtype: e.target
                                  .value as PropertySubtype,
                              })
                            }
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm disabled:bg-slate-50"
                          >
                            <option value="">
                              {formData.property_category ? "Select" : "—"}
                            </option>
                            {availableSubtypes.map((subtype) => (
                              <option key={subtype} value={subtype}>
                                {SubtypeLabels[subtype]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Property Name{" "}
                          {isQualifiedFieldRequired && (
                            <span className="text-red-500">*</span>
                          )}
                        </label>
                        <input
                          type="text"
                          required={isQualifiedFieldRequired}
                          value={formData.property_name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              property_name: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="e.g., Prestige Lakeside Habitat"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Flat/Unit Number{" "}
                            {isRequirementDiscussionFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <input
                            type="text"
                            required={isRequirementDiscussionFieldRequired}
                            value={formData.unit_number}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                unit_number: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="e.g., A-1201"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Carpet Area (sq.ft){" "}
                            {isRequirementDiscussionFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <input
                            type="number"
                            required={isRequirementDiscussionFieldRequired}
                            value={formData.carpet_area}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                carpet_area: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="e.g., 1500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Project Details Section */}
                  <div className="border-t border-slate-200 pt-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      Project Details
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Service Type{" "}
                            {isQualifiedFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <select
                            required={isQualifiedFieldRequired}
                            value={formData.service_type}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                service_type: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                          >
                            <option value="">Select service type</option>
                            {Object.entries(SvcLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Budget Range{" "}
                            {isRequirementDiscussionFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <select
                            required={isRequirementDiscussionFieldRequired}
                            value={formData.budget_range}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                budget_range: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                          >
                            <option value="">Select budget range</option>
                            {Object.entries(BudgetRangeLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Target Start Date{" "}
                            {isQualifiedFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <input
                            type="date"
                            required={isQualifiedFieldRequired}
                            value={formData.target_start_date}
                            min={getMinStartDate()}
                            onChange={(e) =>
                              handleStartDateChange(e.target.value)
                            }
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Target End Date{" "}
                            {isQualifiedFieldRequired && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          <input
                            type="date"
                            required={isQualifiedFieldRequired}
                            value={formData.target_end_date}
                            min={getMinEndDate()}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                target_end_date: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="border-t border-slate-200 pt-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Notes{" "}
                      {targetStage === "proposal_discussion" && (
                        <span className="text-red-500">*</span>
                      )}
                    </h3>
                    <textarea
                      required={targetStage === "proposal_discussion"}
                      value={formData.change_reason}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          change_reason: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder={
                        targetStage === "proposal_discussion"
                          ? "Required: Notes for this transition..."
                          : "Optional: Add notes..."
                      }
                    />
                  </div>
                </>
              )}

              {/* Disqualified stage fields */}
              {targetStage === "disqualified" && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                    Disqualification Details
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.disqualification_reason}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          disqualification_reason: e.target
                            .value as DisqualificationReason,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    >
                      <option value="">Select reason</option>
                      {Object.entries(DisqualificationReasonLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={formData.disqualification_notes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          disqualification_notes: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>
              )}

              {/* Lost stage fields */}
              {targetStage === "lost" && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Lost Deal Details
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Lost Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.lost_reason}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lost_reason: e.target.value as LostReason,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    >
                      <option value="">Select reason</option>
                      {Object.entries(LostReasonLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Lost to Competitor
                    </label>
                    <input
                      type="text"
                      value={formData.lost_to_competitor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lost_to_competitor: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Competitor name (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      value={formData.lost_notes}
                      onChange={(e) =>
                        setFormData({ ...formData, lost_notes: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Details about why this lead was lost..."
                    />
                  </div>
                </div>
              )}

              {/* Won stage fields */}
              {targetStage === "won" && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Deal Won Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Won Amount <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.won_amount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            won_amount: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Amount in ₹"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Contract Signed <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.contract_signed_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contract_signed_date: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Expected Project Start{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.expected_project_start}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          expected_project_start: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      value={formData.change_reason}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          change_reason: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Notes about this deal closure..."
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Stage"
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("active");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Use AppTable hooks
  const { sortState, handleSort, sortData } = useAppTableSort<Lead>();
  const { searchValue, setSearchValue } = useAppTableSearch<Lead>([]);

  // Custom filter function for searching nested client/property data
  const filterData = useCallback((data: Lead[], searchTerm: string) => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(
      (lead) =>
        lead.lead_number?.toLowerCase().includes(term) ||
        lead.client?.name?.toLowerCase().includes(term) ||
        lead.client?.email?.toLowerCase().includes(term) ||
        lead.client?.phone?.toLowerCase().includes(term) ||
        lead.property?.property_name?.toLowerCase().includes(term) ||
        lead.property?.unit_number?.toLowerCase().includes(term) ||
        lead.property?.property_type?.toLowerCase().includes(term)
    );
  }, []);

  // Fetch ALL leads once
  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: "1", limit: "1000" });

      uiLogger.info("Fetching all leads...", {
        module: "LeadsPage",
        action: "fetch_leads",
      });
      const response = await fetch(`/api/sales/leads?${params}`);
      const data = await response.json();

      if (!response.ok) {
        uiLogger.error("API error fetching leads", data, {
          module: "LeadsPage",
        });
        throw new Error(data.error || "Failed to fetch leads");
      }

      uiLogger.info(`Received ${data.leads?.length || 0} leads`, {
        module: "LeadsPage",
        action: "leads_received",
      });
      setAllLeads(data.leads || []);

      if (data.warning) {
        uiLogger.warn(data.warning, { module: "LeadsPage" });
      }
    } catch (err) {
      uiLogger.error("Error fetching leads", err as Error, {
        module: "LeadsPage",
      });
      setError(err instanceof Error ? err.message : "An error occurred");
      setAllLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch team members for assignee dropdown
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/team/members");
      const data = await response.json();
      // API returns { success: true, data: [...members] }
      if (response.ok && data.success && data.data) {
        setTeamMembers(
          data.data.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchTeamMembers();
  }, [fetchLeads, fetchTeamMembers]);

  // Inline update handler for editable fields
  const handleInlineUpdate = useCallback(
    async (leadId: string, field: string, value: string | number | null) => {
      try {
        uiLogger.info(`Updating lead ${leadId} field ${field}`, {
          module: "LeadsPage",
          action: "inline_update",
        });

        const response = await fetch(`/api/sales/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update");
        }

        // Update local state
        setAllLeads((prev) =>
          prev.map((lead) => {
            if (lead.id !== leadId) return lead;

            // Special handling for assigned_to - update the user object too
            if (field === "assigned_to") {
              const assignedMember = value
                ? teamMembers.find((m) => m.id === value)
                : undefined;
              return {
                ...lead,
                assigned_to: value as string | null,
                assigned_user: assignedMember
                  ? {
                      id: assignedMember.id,
                      name: assignedMember.name,
                      avatar_url: assignedMember.avatar_url || null,
                    }
                  : undefined,
              };
            }

            return { ...lead, [field]: value };
          })
        );

        uiLogger.info(`Successfully updated lead ${leadId}`, {
          module: "LeadsPage",
          action: "inline_update_success",
        });
      } catch (err) {
        uiLogger.error("Error updating lead inline", err as Error, {
          module: "LeadsPage",
        });
        // Optionally show a toast or error message
        throw err; // Re-throw so the inline editor can handle it
      }
    },
    [teamMembers]
  );

  // Process leads: filter by stage, search, sort
  const processedLeads = useMemo(() => {
    let result = [...allLeads];

    // Filter by stage
    if (stageFilter === "active") {
      result = result.filter((lead) => ACTIVE_STAGES.includes(lead.stage));
    } else {
      result = result.filter((lead) => lead.stage === stageFilter);
    }

    // Apply search
    result = filterData(result, searchValue);

    // Apply sort with custom getValue functions
    if (sortState.column) {
      result = sortData(result, (item, col) => {
        switch (col) {
          case "client_name":
            return item.client?.name || "";
          case "property_name":
            return item.property?.property_name || "";
          case "property_type":
            return item.property?.property_type || "";
          case "lead_score":
            const scoreOrder: Record<string, number> = {
              hot: 4,
              warm: 3,
              cold: 2,
              on_hold: 1,
            };
            return scoreOrder[item.lead_score || "warm"] || 0;
          case "target_start_date":
            return item.target_start_date
              ? new Date(item.target_start_date).getTime()
              : 0;
          case "budget_range":
            const budgetOrder: Record<BudgetRange, number> = {
              below_10l: 1,
              around_10l: 2,
              around_20l: 3,
              around_30l: 4,
              around_40l: 5,
              around_50l: 6,
              above_50l: 7,
              not_disclosed: 0,
            };
            return item.budget_range ? budgetOrder[item.budget_range] : 0;
          case "estimated_value":
            return item.estimated_value || 0;
          case "stage":
            return item.stage || "";
          case "assigned_to":
            return item.assigned_user?.name || item.created_user?.name || "";
          case "last_activity_at":
            return item.last_activity_at
              ? new Date(item.last_activity_at).getTime()
              : 0;
          case "created_at":
            return item.created_at ? new Date(item.created_at).getTime() : 0;
          default:
            return "";
        }
      });
    }

    return result;
  }, [allLeads, stageFilter, filterData, sortData, sortState.column]);

  // Pagination
  const { paginatedData, pagination, setPage, setPageSize } =
    useAppTablePagination(processedLeads, 25);

  // Calculate tab counts
  const tabsWithCounts: FilterOption[] = useMemo(() => {
    return STAGE_TABS.map((tab) => ({
      ...tab,
      count:
        tab.value === "active"
          ? allLeads.filter((l) => ACTIVE_STAGES.includes(l.stage)).length
          : allLeads.filter((l) => l.stage === tab.value).length,
    }));
  }, [allLeads]);

  // Format helpers - using useCallback for stable references
  const formatDate = useCallback((dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  const getInitials = useCallback((name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, []);

  // Column definitions
  const columns: ColumnDef<Lead>[] = useMemo(
    () => [
      {
        key: "client_name",
        header: "Client",
        width: "18%",
        sortable: true,
        render: (lead) => (
          <div className="space-y-1">
            <p className="font-semibold text-sm text-slate-900">
              {lead.client?.name || "Unknown"}
            </p>
            {lead.client?.email && (
              <p className="text-xs text-slate-500 truncate">
                {lead.client.email}
              </p>
            )}
            {lead.target_start_date && (
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <CalendarIcon className="w-3 h-3" />
                {formatDate(lead.target_start_date)}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "property_name",
        header: "Property",
        width: "13%",
        sortable: true,
        render: (lead) => (
          <div>
            {lead.property?.property_name && (
              <p className="text-sm font-medium text-slate-900 truncate">
                {lead.property.property_name}
              </p>
            )}
            {(lead.property?.unit_number || lead.property?.carpet_area) && (
              <p className="text-xs text-slate-500">
                {lead.property?.unit_number &&
                  `Unit: ${lead.property.unit_number}`}
                {lead.property?.unit_number &&
                  lead.property?.carpet_area &&
                  " • "}
                {lead.property?.carpet_area &&
                  `${lead.property.carpet_area} sq.ft`}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "budget_range",
        header: "Budget",
        width: "11%",
        sortable: true,
        render: (lead) => (
          <div className="space-y-0.5">
            {lead.budget_range ? (
              <p className="text-sm text-slate-700">
                {BudgetRangeLabels[lead.budget_range]}
              </p>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
            {lead.estimated_value && (
              <p className="text-xs font-medium text-emerald-600">
                Est: ₹{(lead.estimated_value / 100000).toFixed(1)}L
              </p>
            )}
          </div>
        ),
      },
      {
        key: "lead_score",
        header: "Score",
        width: "10%",
        sortable: true,
        render: (lead) => (
          <InlineLeadScoreEditor lead={lead} onUpdate={handleInlineUpdate} />
        ),
      },
      {
        key: "stage",
        header: "Stage",
        width: "13%",
        sortable: true,
        render: (lead) => (
          <InlineStageEditor lead={lead} onUpdate={fetchLeads} />
        ),
      },
      {
        key: "last_activity_at",
        header: "Activity",
        width: "11%",
        sortable: true,
        render: (lead) => (
          <ActivityDropdown lead={lead} formatDate={formatDate} />
        ),
      },
      {
        key: "assigned_to",
        header: "Assigned",
        width: "12%",
        sortable: true,
        render: (lead) => (
          <InlineAssigneeEditor
            lead={lead}
            teamMembers={teamMembers}
            onUpdate={handleInlineUpdate}
          />
        ),
      },
    ],
    [handleInlineUpdate, formatDate, teamMembers, fetchLeads]
  );

  return (
    <PageLayout isLoading={isLoading} loadingText="Loading leads...">
      <PageHeader
        title="Leads Management"
        subtitle="Track and manage your sales leads"
        breadcrumbs={[{ label: "Leads" }]}
        basePath={{ label: "Sales", href: "/dashboard/sales" }}
        icon={<UserGroupIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        stats={
          allLeads.length > 0 ? (
            <>
              <StatBadge label="Total" value={allLeads.length} color="slate" />
              <StatBadge
                label="Pipeline"
                value={
                  allLeads.filter(
                    (l) => !["won", "lost", "disqualified"].includes(l.stage)
                  ).length
                }
                color="blue"
              />
              <StatBadge
                label="Won"
                value={allLeads.filter((l) => l.stage === "won").length}
                color="green"
              />
            </>
          ) : undefined
        }
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-medium flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Add Lead
          </button>
        }
      />

      <PageContent noPadding>
        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center px-4">
            <svg
              className="w-12 h-12 mb-3 text-red-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm font-medium text-red-600 mb-1">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchLeads();
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <AppTable
            data={paginatedData}
            columns={columns}
            keyExtractor={(lead) => lead.id}
            showToolbar={true}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search by name, email, property..."
            tabs={tabsWithCounts}
            activeTab={stageFilter}
            onTabChange={(tab) => {
              setStageFilter(tab);
              setPage(1);
            }}
            sortable={true}
            sortState={sortState}
            onSort={handleSort}
            pagination={pagination}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onRowClick={(lead) =>
              router.push(`/dashboard/sales/leads/${lead.id}`)
            }
            emptyState={{
              icon: <UserGroupIcon className="w-6 h-6 text-slate-400" />,
              title: "No leads found",
              description: searchValue
                ? "Try adjusting your search"
                : stageFilter !== "active"
                ? "No leads in this status"
                : "Create your first lead to get started",
              action:
                stageFilter === "active" && !searchValue ? (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    + Add Your First Lead
                  </button>
                ) : undefined,
            }}
            stickyHeader={true}
          />
        )}
      </PageContent>

      {/* Create Lead Modal */}
      {showCreateModal && (
        <CreateLeadModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchLeads();
          }}
        />
      )}
    </PageLayout>
  );
}

// Create Lead Modal Component
function CreateLeadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All form data in one state
  const [formData, setFormData] = useState({
    // Client Details (required fields marked)
    client_name: "", // Required at lead creation
    phone: "", // Required at lead creation
    email: "",
    // Lead Details
    service_type: "" as ServiceType | "",
    lead_source: "" as LeadSource | "",
    // Property Classification
    property_category: "" as PropertyCategory | "",
    property_type: "" as PropertyType | "",
    property_subtype: "" as PropertySubtype | "",
    // Property Details (optional at creation, required at later stages)
    property_name: "",
    unit_number: "",
    property_city: "",
    carpet_area: "",
    // Notes
    notes: "",
  });

  // Get available property types based on selected category
  const availablePropertyTypes = formData.property_category
    ? PropertyTypesByCategory[formData.property_category]
    : [];

  // Get available subtypes based on selected category
  const availableSubtypes = formData.property_category
    ? PropertySubtypesByCategory[formData.property_category]
    : [];

  const updateField = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Reset dependent fields when category changes
      if (field === "property_category") {
        updated.property_type = "" as PropertyType | "";
        updated.property_subtype = "" as PropertySubtype | "";
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate required fields for lead creation
    if (!formData.client_name.trim()) {
      setError("Client name is required");
      setIsSubmitting(false);
      return;
    }
    if (!formData.phone.trim()) {
      setError("Phone number is required");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/sales/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Client details
          client_name: formData.client_name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || undefined,
          // Lead details
          service_type: formData.service_type || undefined,
          lead_source: formData.lead_source || undefined,
          // Property classification
          property_category: formData.property_category || undefined,
          property_type: formData.property_type || undefined,
          property_subtype: formData.property_subtype || undefined,
          // Property details
          property_name: formData.property_name.trim() || undefined,
          unit_number: formData.unit_number.trim() || undefined,
          property_city: formData.property_city.trim() || undefined,
          carpet_area: formData.carpet_area
            ? Number(formData.carpet_area)
            : undefined,
          // Notes
          notes: formData.notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create lead");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Create New Lead
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter client and property details
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <svg
              className="w-5 h-5"
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
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Client Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center">
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Client Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.client_name}
                  onChange={(e) => updateField("client_name", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter client name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="client@email.com"
                />
              </div>
            </div>
          </div>

          {/* Lead Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Lead Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Service Type
                </label>
                <select
                  value={formData.service_type}
                  onChange={(e) => updateField("service_type", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select service type</option>
                  {Object.entries(SvcLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lead Source
                </label>
                <select
                  value={formData.lead_source}
                  onChange={(e) => updateField("lead_source", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select lead source</option>
                  {Object.entries(SrcLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Property Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center">
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Property Details</h3>
              <span className="text-xs text-slate-400">
                (can be added later)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.property_category}
                  onChange={(e) =>
                    updateField("property_category", e.target.value)
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select category</option>
                  {Object.entries(CatLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Type
                </label>
                <select
                  value={formData.property_type}
                  onChange={(e) => updateField("property_type", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={!formData.property_category}
                >
                  <option value="">
                    {formData.property_category
                      ? "Select type"
                      : "Select category first"}
                  </option>
                  {availablePropertyTypes.map((type) => (
                    <option key={type} value={type}>
                      {PropLabels[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Community Type
                </label>
                <select
                  value={formData.property_subtype}
                  onChange={(e) =>
                    updateField("property_subtype", e.target.value)
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={!formData.property_category}
                >
                  <option value="">
                    {formData.property_category
                      ? "Select subtype"
                      : "Select category first"}
                  </option>
                  {availableSubtypes.map((subtype) => (
                    <option key={subtype} value={subtype}>
                      {SubtypeLabels[subtype]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property/Project Name
                </label>
                <input
                  type="text"
                  value={formData.property_name}
                  onChange={(e) => updateField("property_name", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Prestige Lakeside"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Flat/Unit Number
                </label>
                <input
                  type="text"
                  value={formData.unit_number}
                  onChange={(e) => updateField("unit_number", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., A-1502"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.property_city}
                  onChange={(e) => updateField("property_city", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Bangalore"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carpet Area (sq.ft)
                </label>
                <input
                  type="number"
                  value={formData.carpet_area}
                  onChange={(e) => updateField("carpet_area", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 1500"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center">
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Notes</h3>
            </div>

            <textarea
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Any initial notes about this lead..."
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Lead"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
