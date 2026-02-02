import type { LeadStage, BudgetRange } from "@/types/leads";
import type { FilterOption } from "@/components/ui/AppTable";

// Team member type for assignee dropdown
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

// Priority ordering for sorting
export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// Priority labels for display
export const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

// Budget ordering for sorting
export const BUDGET_ORDER: Record<BudgetRange, number> = {
  below_10l: 1,
  around_10l: 2,
  around_20l: 3,
  around_30l: 4,
  around_40l: 5,
  around_50l: 6,
  above_50l: 7,
  not_disclosed: 0,
};

// Status label helper
export function getLeadStatusLabel(stage: LeadStage): string {
  if (ACTIVE_STAGES.includes(stage)) return "Active";
  if (stage === "won") return "Won";
  if (stage === "lost") return "Lost";
  if (stage === "disqualified") return "Disqualified";
  return stage;
}

// Status background color helper
export function getLeadStatusColor(stage: LeadStage): string {
  if (ACTIVE_STAGES.includes(stage)) return "bg-blue-100 text-blue-700";
  if (stage === "won") return "bg-green-100 text-green-700";
  if (stage === "lost") return "bg-red-100 text-red-700";
  if (stage === "disqualified") return "bg-gray-100 text-gray-700";
  return "bg-slate-100 text-slate-700";
}

// Stage filter tabs
export const ACTIVE_STAGES: LeadStage[] = [
  "new",
  "qualified",
  "requirement_discussion",
  "proposal_discussion",
];

export const STAGE_TABS: FilterOption[] = [
  { value: "active", label: "Active" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "disqualified", label: "Disqualified" },
];

// Budget range options for inline editing
export const BUDGET_OPTIONS: { value: BudgetRange; label: string }[] = [
  { value: "below_10l", label: "Below ₹10L" },
  { value: "around_10l", label: "~₹10 Lakhs" },
  { value: "around_20l", label: "~₹20 Lakhs" },
  { value: "around_30l", label: "~₹30 Lakhs" },
  { value: "around_40l", label: "~₹40 Lakhs" },
  { value: "around_50l", label: "~₹50 Lakhs" },
  { value: "above_50l", label: "₹50+ Lakhs" },
  { value: "not_disclosed", label: "Not Disclosed" },
];
