import type { LeadStage } from "@/types/leads";

export type TabType =
  | "overview"
  | "spaces"
  | "timeline"
  | "calendar"
  | "tasks"
  | "documents"
  | "notes"
  | "quotations";

export const LEAD_DETAIL_TABS: TabType[] = [
  "overview",
  "spaces",
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

// Section icons and colors
