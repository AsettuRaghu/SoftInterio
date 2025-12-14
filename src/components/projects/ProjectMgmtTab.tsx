"use client";

import React, { useState, useCallback } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  PencilIcon,
  StopIcon,
  ForwardIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  ProjectPhase,
  ProjectSubPhase,
  ProjectSubPhaseStatus,
} from "@/types/projects";

interface ProjectMgmtTabProps {
  projectId: string;
  projectCategory?: string;
  phases: ProjectPhase[];
  initializingPhases?: boolean;
  onInitializePhases?: () => void;
  onResetPhases?: () => void;
  onRefresh: () => void;
  onEditPhase?: (phase: ProjectPhase) => void;
  onEditSubPhase?: (subPhase: ProjectSubPhase, phaseId: string) => void;
  onSubPhaseClick?: (phaseId: string, subPhaseId: string) => void;
  onQuickAction?: (
    subPhaseId: string,
    phaseId: string,
    action: "start" | "hold" | "resume" | "complete" | "cancel",
    notes: string
  ) => Promise<ProjectSubPhase | null>;
}

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    not_started: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      label: "Not Started",
    },
    in_progress: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      label: "In Progress",
    },
    completed: {
      bg: "bg-green-100",
      text: "text-green-700",
      label: "Completed",
    },
    on_hold: { bg: "bg-yellow-100", text: "text-yellow-700", label: "On Hold" },
    blocked: { bg: "bg-orange-100", text: "text-orange-700", label: "Blocked" },
    cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
    skipped: { bg: "bg-slate-100", text: "text-slate-500", label: "Skipped" },
  };
  const c = config[status] || config.not_started;
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
};

// Progress bar component
const ProgressBar = ({ percentage }: { percentage: number }) => {
  const getColor = () => {
    if (percentage === 100) return "bg-green-500";
    if (percentage >= 50) return "bg-blue-500";
    if (percentage > 0) return "bg-amber-500";
    return "bg-slate-200";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden min-w-[60px]">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-slate-600 font-medium tabular-nums">
        {percentage}%
      </span>
    </div>
  );
};

// Format date helper
const formatDate = (date: string | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

// Assignees display
const AssigneesCell = ({
  assignees,
}: {
  assignees?: { id: string; name: string }[] | { id: string; name: string };
}) => {
  if (!assignees)
    return <span className="text-slate-400 text-xs">Unassigned</span>;

  const assigneeList = Array.isArray(assignees) ? assignees : [assignees];

  if (assigneeList.length === 0)
    return <span className="text-slate-400 text-xs">Unassigned</span>;

  if (assigneeList.length === 1) {
    return (
      <span className="text-xs text-slate-700 truncate block max-w-[120px]">
        {assigneeList[0].name}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-slate-700 truncate max-w-[90px]">
        {assigneeList[0].name}
      </span>
      <span className="text-xs text-blue-600 font-medium">
        +{assigneeList.length - 1}
      </span>
    </div>
  );
};

// Notes prompt modal for quick actions
interface NotesPromptModalProps {
  isOpen: boolean;
  action: string;
  subPhaseName: string;
  onSubmit: (notes: string) => void;
  onCancel: () => void;
}

const NotesPromptModal = ({
  isOpen,
  action,
  subPhaseName,
  onSubmit,
  onCancel,
}: NotesPromptModalProps) => {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const actionLabels: Record<string, { title: string; placeholder: string }> = {
    start: {
      title: "Start Sub-Phase",
      placeholder: "e.g., Starting work on this task...",
    },
    hold: {
      title: "Put On Hold",
      placeholder: "Reason for putting on hold...",
    },
    resume: { title: "Resume Work", placeholder: "Resuming because..." },
    complete: {
      title: "Mark Complete",
      placeholder: "Summary of work completed...",
    },
    cancel: { title: "Skip/Cancel", placeholder: "Reason for skipping..." },
  };

  const config = actionLabels[action] || {
    title: "Update Status",
    placeholder: "Add notes...",
  };

  const handleSubmit = () => {
    if (!notes.trim()) {
      setError("Notes are required for status changes");
      return;
    }
    onSubmit(notes.trim());
    setNotes("");
    setError("");
  };

  const handleCancel = () => {
    setNotes("");
    setError("");
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{config.title}</h3>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-slate-100 rounded"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm text-slate-600 mb-3">
              Updating:{" "}
              <span className="font-medium text-slate-900">{subPhaseName}</span>
            </p>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (error) setError("");
              }}
              placeholder={config.placeholder}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${
                error ? "border-red-300" : "border-slate-300"
              }`}
              autoFocus
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            <p className="text-xs text-slate-400 mt-1">
              This note will be saved to the activity log and cannot be edited
              later.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// Quick action buttons for sub-phases
interface QuickActionsProps {
  status: ProjectSubPhaseStatus;
  onAction: (
    action: "start" | "hold" | "resume" | "complete" | "cancel"
  ) => void;
  loading?: boolean;
}

const QuickActions = ({ status, onAction, loading }: QuickActionsProps) => {
  if (loading) {
    return <ArrowPathIcon className="w-4 h-4 animate-spin text-slate-400" />;
  }

  const buttonClass =
    "p-1.5 rounded hover:bg-opacity-20 transition-colors disabled:opacity-50";

  switch (status) {
    case "not_started":
      return (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onAction("start")}
            className={`${buttonClass} text-blue-600 hover:bg-blue-100`}
            title="Start"
          >
            <PlayIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onAction("cancel")}
            className={`${buttonClass} text-slate-400 hover:bg-slate-100`}
            title="Skip"
          >
            <ForwardIcon className="w-4 h-4" />
          </button>
        </div>
      );
    case "in_progress":
      return (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onAction("complete")}
            className={`${buttonClass} text-green-600 hover:bg-green-100`}
            title="Complete"
          >
            <CheckCircleIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onAction("hold")}
            className={`${buttonClass} text-yellow-600 hover:bg-yellow-100`}
            title="Put On Hold"
          >
            <PauseIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onAction("cancel")}
            className={`${buttonClass} text-red-500 hover:bg-red-100`}
            title="Cancel"
          >
            <StopIcon className="w-4 h-4" />
          </button>
        </div>
      );
    case "on_hold":
      return (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onAction("resume")}
            className={`${buttonClass} text-blue-600 hover:bg-blue-100`}
            title="Resume"
          >
            <PlayIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onAction("cancel")}
            className={`${buttonClass} text-red-500 hover:bg-red-100`}
            title="Cancel"
          >
            <StopIcon className="w-4 h-4" />
          </button>
        </div>
      );
    case "completed":
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
    case "skipped":
      return <span className="text-xs text-slate-400 italic">Skipped</span>;
    default:
      return null;
  }
};

// Assuming ProjectMgmtTabProps is defined elsewhere, adding onSubPhaseClick to its structure
// For the purpose of this edit, we'll add it to the destructuring and usage.
// If the interface was provided, it would look like this:
// interface ProjectMgmtTabProps {
//   projectId: string;
//   projectCategory: string;
//   phases: ProjectPhase[];
//   initializingPhases?: boolean;
//   onInitializePhases: () => void;
//   onResetPhases: () => void;
//   onRefresh: () => void;
//   onEditPhase: (phase: ProjectPhase) => void;
//   onEditSubPhase?: (subPhase: ProjectSubPhase, phaseId: string) => void;
//   onSubPhaseClick?: (phaseId: string, subPhaseId: string) => void; // Added this line
//   onQuickAction?: (
//     subPhaseId: string,
//     phaseId: string,
//     action: "start" | "hold" | "resume" | "complete" | "cancel",
//     notes: string
//   ) => Promise<ProjectSubPhase | null>;
// }

export default function ProjectMgmtTab({
  projectId,
  projectCategory,
  phases: initialPhases = [],
  initializingPhases = false,
  onInitializePhases,
  onResetPhases,
  onRefresh,
  onEditPhase,
  onEditSubPhase,
  onSubPhaseClick,
  onQuickAction,
}: ProjectMgmtTabProps) {
  // Local state for inline updates (optimistic UI)
  const [phases, setPhases] = useState<ProjectPhase[]>(initialPhases || []);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set((initialPhases || []).map((p) => p.id))
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Notes prompt modal state
  const [notesPrompt, setNotesPrompt] = useState<{
    isOpen: boolean;
    subPhaseId: string;
    phaseId: string;
    subPhaseName: string;
    action: "start" | "hold" | "resume" | "complete" | "cancel";
  } | null>(null);

  // Sync with parent when initialPhases change
  React.useEffect(() => {
    setPhases(initialPhases);
  }, [initialPhases]);

  const togglePhaseExpanded = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId);
      } else {
        newSet.add(phaseId);
      }
      return newSet;
    });
  };

  // Calculate stats
  const totalSubPhases = phases.reduce(
    (sum, p) => sum + (p.sub_phases?.length || 0),
    0
  );
  const completedSubPhases = phases.reduce(
    (sum, p) =>
      sum +
      (p.sub_phases?.filter((sp) => sp.status === "completed").length || 0),
    0
  );
  const overallProgress =
    phases.length > 0
      ? Math.round(
          phases.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) /
            phases.length
        )
      : 0;

  // Handle quick action - shows notes prompt
  const handleQuickActionClick = (
    subPhaseId: string,
    phaseId: string,
    subPhaseName: string,
    action: "start" | "hold" | "resume" | "complete" | "cancel"
  ) => {
    setNotesPrompt({
      isOpen: true,
      subPhaseId,
      phaseId,
      subPhaseName,
      action,
    });
  };

  // Execute the action after notes are provided
  const executeQuickAction = async (notes: string) => {
    if (!notesPrompt || !onQuickAction) return;

    const { subPhaseId, phaseId, action } = notesPrompt;

    // Close modal immediately
    setNotesPrompt(null);
    setActionLoading(subPhaseId);

    // Map action to new status
    const statusMap: Record<string, ProjectSubPhaseStatus> = {
      start: "in_progress",
      hold: "on_hold",
      resume: "in_progress",
      complete: "completed",
      cancel: "skipped",
    };
    const newStatus = statusMap[action];

    // Optimistic update - update local state immediately
    setPhases((prevPhases) =>
      prevPhases.map((phase) => {
        if (phase.id !== phaseId) return phase;

        const updatedSubPhases = phase.sub_phases?.map((sp) => {
          if (sp.id !== subPhaseId) return sp;

          return {
            ...sp,
            status: newStatus,
            actual_start_date:
              action === "start"
                ? new Date().toISOString().split("T")[0]
                : sp.actual_start_date,
            actual_end_date:
              action === "complete"
                ? new Date().toISOString().split("T")[0]
                : sp.actual_end_date,
          };
        });

        // Recalculate phase progress
        const completedCount =
          updatedSubPhases?.filter((sp) => sp.status === "completed").length ||
          0;
        const totalCount = updatedSubPhases?.length || 1;
        const newProgress = Math.round((completedCount / totalCount) * 100);

        return {
          ...phase,
          sub_phases: updatedSubPhases,
          progress_percentage: newProgress,
        };
      })
    );

    try {
      // Call the API
      const result = await onQuickAction(subPhaseId, phaseId, action, notes);

      // If API returns updated data, use it
      if (result) {
        setPhases((prevPhases) =>
          prevPhases.map((phase) => {
            if (phase.id !== phaseId) return phase;
            return {
              ...phase,
              sub_phases: phase.sub_phases?.map((sp) =>
                sp.id === subPhaseId ? { ...sp, ...result } : sp
              ),
            };
          })
        );
      }
    } catch (error) {
      // Revert on error - refresh from server
      console.error("Quick action failed:", error);
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  };

  // No phases - show initialize button
  if (phases.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ClockIcon className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          No Phases Set Up
        </h3>
        <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
          Initialize project phases to start tracking progress through the
          project workflow.
        </p>
        <button
          onClick={onInitializePhases}
          disabled={initializingPhases}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initializingPhases ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Initializing...
            </>
          ) : (
            <>
              <PlayIcon className="w-4 h-4" />
              Initialize Phases
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Project Phases
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              <span className="font-medium text-green-600">
                {completedSubPhases}
              </span>
              <span className="text-slate-400">/{totalSubPhases}</span> tasks
            </span>
            <span className="text-slate-300">•</span>
            <span
              className={`font-medium ${
                overallProgress === 100 ? "text-green-600" : "text-blue-600"
              }`}
            >
              {overallProgress}% complete
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
            title="Refresh"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          {onResetPhases && (
            <button
              onClick={onResetPhases}
              disabled={initializingPhases}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 hover:bg-slate-100 rounded"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        {/* Table Header */}
        <div className="grid grid-cols-[32px_minmax(200px,1.5fr)_minmax(100px,1fr)_100px_100px_minmax(120px,1fr)_minmax(120px,1fr)_90px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div></div>
          <div>Name</div>
          <div>Assignees</div>
          <div>Status</div>
          <div>Progress</div>
          <div>Planned Dates</div>
          <div>Actual Dates</div>
          <div className="text-center">Actions</div>
        </div>

        {/* Phase Rows */}
        {phases
          .sort((a, b) => a.display_order - b.display_order)
          .map((phase) => {
            const isExpanded = expandedPhases.has(phase.id);
            const subPhases = phase.sub_phases || [];
            const completedCount = subPhases.filter(
              (sp) => sp.status === "completed"
            ).length;

            return (
              <div key={phase.id}>
                {/* Phase Row */}
                <div
                  className={`grid grid-cols-[32px_minmax(200px,1.5fr)_minmax(100px,1fr)_100px_100px_minmax(120px,1fr)_minmax(120px,1fr)_90px] gap-3 px-4 py-3 items-center border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
                    phase.status === "in_progress"
                      ? "bg-blue-50/30"
                      : phase.status === "completed"
                      ? "bg-green-50/30"
                      : ""
                  }`}
                  onClick={() => togglePhaseExpanded(phase.id)}
                >
                  {/* Expand Icon */}
                  <div className="flex justify-center">
                    {subPhases.length > 0 ? (
                      isExpanded ? (
                        <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}
                  </div>

                  {/* Phase Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        phase.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : phase.status === "in_progress"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {phase.status === "completed" ? (
                        <CheckCircleIcon className="w-4 h-4" />
                      ) : (
                        phase.display_order
                      )}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium text-sm text-slate-900 truncate block">
                        {phase.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {completedCount}/{subPhases.length} sub-phases
                      </span>
                    </div>
                  </div>

                  {/* Assignees */}
                  <div>
                    <AssigneesCell assignees={phase.assigned_user} />
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge status={phase.status} />
                  </div>

                  {/* Progress */}
                  <div>
                    <ProgressBar percentage={phase.progress_percentage || 0} />
                  </div>

                  {/* Planned Dates */}
                  <div className="text-xs text-slate-600">
                    {phase.planned_start_date || phase.planned_end_date ? (
                      <span className="whitespace-nowrap">
                        {formatDate(phase.planned_start_date)} →{" "}
                        {formatDate(phase.planned_end_date)}
                      </span>
                    ) : (
                      <span className="text-slate-400">Not planned</span>
                    )}
                  </div>

                  {/* Actual Dates */}
                  <div className="text-xs text-slate-600">
                    {phase.actual_start_date || phase.actual_end_date ? (
                      <span className="whitespace-nowrap">
                        {formatDate(phase.actual_start_date)} →{" "}
                        {formatDate(phase.actual_end_date)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="flex justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onEditPhase && (
                      <button
                        onClick={() => onEditPhase(phase)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit Phase"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-Phase Rows */}
                {isExpanded && subPhases.length > 0 && (
                  <div className="bg-slate-50/50">
                    {subPhases
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((subPhase) => (
                        <div
                          key={subPhase.id}
                          onClick={() => onSubPhaseClick?.(phase.id, subPhase.id)}
                          className={`grid grid-cols-[32px_minmax(200px,1.5fr)_minmax(100px,1fr)_100px_100px_minmax(120px,1fr)_minmax(120px,1fr)_90px] gap-3 px-4 py-2.5 items-center border-b border-slate-100 hover:bg-white/80 cursor-pointer ${
                            subPhase.status === "completed"
                              ? "bg-green-50/20"
                              : subPhase.status === "in_progress"
                              ? "bg-blue-50/20"
                              : ""
                          }`}
                        >
                          {/* Indent */}
                          <div></div>

                          {/* Sub-Phase Name */}
                          <div className="flex items-center gap-2 pl-8 min-w-0">
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                subPhase.status === "completed"
                                  ? "bg-green-500"
                                  : subPhase.status === "in_progress"
                                  ? "bg-blue-500"
                                  : subPhase.status === "on_hold"
                                  ? "bg-yellow-500"
                                  : subPhase.status === "skipped"
                                  ? "bg-slate-300"
                                  : "bg-slate-300"
                              }`}
                            />
                            <span className="text-sm text-slate-700 truncate">
                              {subPhase.name}
                            </span>
                          </div>

                          {/* Assignees */}
                          <div>
                            <AssigneesCell assignees={subPhase.assigned_user} />
                          </div>

                          {/* Status */}
                          <div>
                            <StatusBadge status={subPhase.status} />
                          </div>

                          {/* Progress (for sub-phases, show checklist progress if available) */}
                          <div>
                            {subPhase.checklist_items &&
                            subPhase.checklist_items.length > 0 ? (
                              <span className="text-xs text-slate-500">
                                {
                                  subPhase.checklist_items.filter(
                                    (i) => i.is_completed
                                  ).length
                                }
                                /{subPhase.checklist_items.length} items
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>

                          {/* Planned Dates */}
                          <div className="text-xs text-slate-600">
                            {subPhase.planned_start_date ||
                            subPhase.planned_end_date ? (
                              <span className="whitespace-nowrap">
                                {formatDate(subPhase.planned_start_date)} →{" "}
                                {formatDate(subPhase.planned_end_date)}
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                Not planned
                              </span>
                            )}
                          </div>

                          {/* Actual Dates */}
                          <div className="text-xs text-slate-600">
                            {subPhase.actual_start_date ||
                            subPhase.actual_end_date ? (
                              <span className="whitespace-nowrap">
                                {formatDate(subPhase.actual_start_date)} →{" "}
                                {formatDate(subPhase.actual_end_date)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex justify-center items-center gap-0.5">
                            <QuickActions
                              status={subPhase.status}
                              loading={actionLoading === subPhase.id}
                              onAction={(action) =>
                                handleQuickActionClick(
                                  subPhase.id,
                                  phase.id,
                                  subPhase.name,
                                  action
                                )
                              }
                            />
                            {onEditSubPhase && (
                              <button
                                onClick={() =>
                                  onEditSubPhase(subPhase, phase.id)
                                }
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-1"
                                title="Edit"
                              >
                                <PencilIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Notes Prompt Modal */}
      {notesPrompt && (
        <NotesPromptModal
          isOpen={notesPrompt.isOpen}
          action={notesPrompt.action}
          subPhaseName={notesPrompt.subPhaseName}
          onSubmit={executeQuickAction}
          onCancel={() => setNotesPrompt(null)}
        />
      )}
    </div>
  );
}
