import type { LeadStage } from "@/types/leads";

export type TabType =
  | "overview"
  | "timeline"
  | "calendar"
  | "tasks"
  | "documents"
  | "notes"
  | "quotations";

export const LEAD_DETAIL_TABS: TabType[] = [
  "overview",
  "quotations",
  "tasks",
  "notes",
  "documents",
  "calendar",
  "timeline",
];

// Check if lead is in a terminal stage (won, lost, disqualified)
export const isLeadClosed = (stage: LeadStage): boolean => {
  return ["won", "lost", "disqualified"].includes(stage);
};

// Stage-related helpers
export const getLeadStageColor = (stage: LeadStage) => {
  const colors: Record<LeadStage, { bg: string; text: string; border: string }> = {
    new: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    qualified: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
    },
    requirement_discussion: {
      bg: "bg-cyan-50",
      text: "text-cyan-700",
      border: "border-cyan-200",
    },
    proposal_discussion: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    won: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    lost: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    disqualified: {
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
    },
  };
  return colors[stage];
};

// Section icons and colors
export const DETAIL_SECTIONS = {
  client: {
    color: "bg-blue-100 text-blue-700",
    icon: "person",
  },
  property: {
    color: "bg-purple-100 text-purple-700",
    icon: "building",
  },
  lead: {
    color: "bg-green-100 text-green-700",
    icon: "check",
  },
};
