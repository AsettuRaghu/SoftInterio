import type { ProjectPhase, ProjectSubPhase } from "@/types/projects";

// Calculate phase progress percentage
export const calculatePhaseProgress = (
  phase: ProjectPhase
): number => {
  if (!phase.sub_phases || phase.sub_phases.length === 0) return 0;

  const completedCount = phase.sub_phases.filter(
    (sp) => sp.status === "completed"
  ).length;
  return Math.round(
    (completedCount / phase.sub_phases.length) * 100
  );
};

// Calculate total project progress
export const calculateTotalProgress = (phases: ProjectPhase[]): number => {
  if (!phases || phases.length === 0) return 0;

  let totalSubPhases = 0;
  let completedSubPhases = 0;

  phases.forEach((phase) => {
    if (phase.sub_phases) {
      totalSubPhases += phase.sub_phases.length;
      completedSubPhases += phase.sub_phases.filter(
        (sp) => sp.status === "completed"
      ).length;
    }
  });

  if (totalSubPhases === 0) return 0;
  return Math.round((completedSubPhases / totalSubPhases) * 100);
};

// Get phase status badge color
export const getPhaseStatusColor = (
  status: string
): { bg: string; text: string } => {
  const colors: Record<string, { bg: string; text: string }> = {
    not_started: { bg: "bg-slate-100", text: "text-slate-600" },
    in_progress: { bg: "bg-blue-100", text: "text-blue-600" },
    on_hold: { bg: "bg-amber-100", text: "text-amber-600" },
    completed: { bg: "bg-green-100", text: "text-green-600" },
    cancelled: { bg: "bg-red-100", text: "text-red-600" },
    blocked: { bg: "bg-orange-100", text: "text-orange-600" },
  };

  return colors[status] || colors.not_started;
};

// Get sub-phase status badge color
export const getSubPhaseStatusColor = (
  status: string
): { bg: string; text: string } => {
  const colors: Record<string, { bg: string; text: string }> = {
    not_started: { bg: "bg-slate-50", text: "text-slate-700" },
    in_progress: { bg: "bg-blue-50", text: "text-blue-700" },
    on_hold: { bg: "bg-amber-50", text: "text-amber-700" },
    completed: { bg: "bg-green-50", text: "text-green-700" },
    skipped: { bg: "bg-slate-100", text: "text-slate-600" },
  };

  return colors[status] || colors.not_started;
};

// Check if phase can be started
export const canStartPhase = (
  phase: ProjectPhase,
  previousPhase: ProjectPhase | null
): boolean => {
  // Can always start first phase if not started
  if (!previousPhase) return phase.status === "not_started";

  // Can start if previous phase is completed
  return previousPhase.status === "completed" && phase.status === "not_started";
};

// Estimate phase end date based on start date and duration
export const estimatePhaseEndDate = (
  startDate: string,
  durationDays: number
): string => {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays);
  return end.toISOString().split("T")[0];
};

// Check if phase is overdue
export const isPhaseOverdue = (
  phase: ProjectPhase
): boolean => {
  if (phase.status === "completed" || phase.status === "cancelled") {
    return false;
  }

  if (!phase.planned_end_date) return false;

  const endDate = new Date(phase.planned_end_date);
  return endDate < new Date();
};

// Get phase duration in days
export const getPhaseDurationDays = (phase: ProjectPhase): number => {
  if (!phase.planned_start_date || !phase.planned_end_date) return 0;

  const start = new Date(phase.planned_start_date);
  const end = new Date(phase.planned_end_date);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};
