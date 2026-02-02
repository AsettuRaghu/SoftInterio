import type { ProjectStatus } from "@/types/projects";

export type ProjectDetailTab =
  | "project-mgmt"
  | "rooms"
  | "overview"
  | "quotations"
  | "tasks"
  | "notes"
  | "documents"
  | "calendar"
  | "lead-history"
  | "procurement"
  | "payments";

export const PROJECT_DETAIL_TABS: ProjectDetailTab[] = [
  "project-mgmt",
  "rooms",
  "overview",
  "quotations",
  "tasks",
  "notes",
  "documents",
  "calendar",
  "lead-history",
  "procurement",
  "payments",
];

// Check if project is in a terminal status (completed, cancelled)
export const isProjectClosed = (status: ProjectStatus): boolean => {
  return ["completed", "cancelled"].includes(status);
};

// Status-related helpers
export const getProjectStatusColor = (status: ProjectStatus) => {
  const colors: Record<ProjectStatus, { bg: string; text: string; border: string }> = {
    new: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    in_progress: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
    },
    on_hold: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    cancelled: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    },
    completed: {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    },
  };
  return colors[status] || colors.new;
};
