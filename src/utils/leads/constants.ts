/**
 * Leads Module Constants
 * Shared constants used across leads pages and components
 */

import type { LeadStage, BudgetRange } from "@/types/leads";

/**
 * Active lead stages for filtering
 */
export const ACTIVE_LEAD_STAGES: LeadStage[] = [
  "new",
  "qualified",
  "requirement_discussion",
  "proposal_discussion",
];

/**
 * Terminal lead stages (lead is closed)
 */
export const TERMINAL_LEAD_STAGES: LeadStage[] = ["won", "lost", "disqualified"];

/**
 * Budget range options for inline editing and creation
 */
export const BUDGET_OPTIONS: Array<{
  value: BudgetRange;
  label: string;
}> = [
  { value: "below_10l", label: "Below ₹10L" },
  { value: "around_10l", label: "~₹10 Lakhs" },
  { value: "around_20l", label: "~₹20 Lakhs" },
  { value: "around_30l", label: "~₹30 Lakhs" },
  { value: "around_40l", label: "~₹40 Lakhs" },
  { value: "around_50l", label: "~₹50 Lakhs" },
  { value: "above_50l", label: "₹50+ Lakhs" },
  { value: "not_disclosed", label: "Not Disclosed" },
];

/**
 * Stage transition configuration
 * Maps current stages to allowed next stages
 */
export const STAGE_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  new: ["qualified", "disqualified"],
  qualified: ["requirement_discussion", "lost"],
  requirement_discussion: ["proposal_discussion", "lost"],
  proposal_discussion: ["won", "lost", "disqualified"],
  won: [],
  lost: [],
  disqualified: [],
};

/**
 * Lead stage colors for visual display
 */
export const LEAD_STAGE_COLORS: Record<
  LeadStage,
  { bg: string; text: string; dot: string }
> = {
  new: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  qualified: {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
  },
  requirement_discussion: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  proposal_discussion: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  won: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  lost: {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  disqualified: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-500",
  },
};

/**
 * Modal styling configuration
 */
export const MODAL_CONFIG = {
  OVERLAY_CLASS: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",
  LARGE_CONTAINER_CLASS: "bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col",
  MEDIUM_CONTAINER_CLASS: "bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto",
} as const;
