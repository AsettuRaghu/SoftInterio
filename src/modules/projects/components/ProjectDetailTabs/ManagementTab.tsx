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
  ProjectPhaseStatus,
} from "@/types/projects";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

interface ProjectMgmtTabProps {
  projectId: string;
  projectCategory?: string;
  phases: ProjectPhase[];
  initializingPhases?: boolean;
  onInitializePhases?: () => void;
  onResetPhases?: () => void;
  onRefresh: () => void | Promise<void>;
  onEditPhase?: (phase: ProjectPhase) => void;
  onEditSubPhase?: (subPhase: ProjectSubPhase, phaseId: string) => void;
  onSubPhaseClick?: (phaseId: string, subPhaseId: string) => void;
  onQuickAction?: (
    subPhaseId: string,
    phaseId: string,
    action: "start" | "hold" | "resume" | "complete" | "cancel",
    notes: string
  ) => Promise<ProjectSubPhase | null>;
  /**
   * A phase is a task too, so it can be started and completed like a step -
   * it just goes to a different endpoint. Before this the row that decides
   * when a stage begins could not be started from the screen showing it.
   */
  onPhaseQuickAction?: (
    phaseId: string,
    action: "start" | "hold" | "resume" | "complete" | "cancel",
    notes: string
  ) => Promise<unknown>;
  /**
   * What the server will allow on each row, supplied by the page so it arrives
   * with the plan. Fetching it here meant a second round trip AFTER the plan
   * had rendered, and the action column sat empty for about a second.
   */
  gates?: Record<string, PlanGate>;
  mayEdit?: boolean;
  gatesReady?: boolean;
}

// Status badge component
/**
 * Expected against actual effort.
 *
 * This is the pair the playbook is written for: hours are what a step is
 * estimated in, and hours are what the work log adds up to, so the difference
 * is where a process is quietly costing more than anyone planned. Shown amber
 * once it is over, because an overrun that reads the same as an underrun tells
 * nobody anything.
 */
function HoursSpent({
  estimated,
  actual,
}: {
  estimated?: number;
  actual?: number;
}) {
  if (estimated == null && actual == null) {
    return <span className="text-slate-400">—</span>;
  }
  const over = estimated != null && actual != null && actual > estimated;
  return (
    <span
      className={`whitespace-nowrap ${over ? "text-amber-600 font-medium" : ""}`}
      title={
        over
          ? `Over the estimate by ${Math.round((actual! - estimated!) * 10) / 10}h`
          : "Hours logged against hours expected"
      }
    >
      {actual != null ? `${actual}h` : "—"}
      <span className="text-slate-400"> / {estimated != null ? `${estimated}h` : "—"}</span>
    </span>
  );
}

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
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * The actions a row may take, and why it may not.
 *
 * Every button is drawn from a gate the server supplied - the same
 * can_start_task / can_complete_task the transition consults - so the screen
 * cannot offer something that will be refused. Before this, Start was drawn on
 * every not-started row regardless of whether its predecessors had finished,
 * the transition refused it, and the tooltip said only "Start".
 *
 * A disallowed action is shown disabled with the reason as its tooltip, rather
 * than hidden. Hiding it answers "can I start this?" with silence; showing it
 * greyed out with "Waiting for 2D Designs to start" answers the question and
 * says what to do about it.
 *
 * Used for phases and steps alike, because both are tasks.
 */
interface PlanGate {
  status: string;
  isPhase: boolean;
  canStart: boolean;
  startReason: string | null;
  canComplete: boolean;
  completeReason: string | null;
  canSkip: boolean;
  skipReason: string | null;
  skipNeedsReason: boolean;
  canHold: boolean;
  canResume: boolean;
}

type QuickAction = "start" | "hold" | "resume" | "complete" | "cancel";

interface QuickActionsProps {
  status: ProjectSubPhaseStatus | ProjectPhaseStatus;
  onAction: (action: QuickAction) => void;
  loading?: boolean;
  /** Server-supplied gate. Absent for a project on the older phase engine. */
  gate?: PlanGate;
  /** False when the viewer may not change the plan at all. */
  mayEdit?: boolean;
  /** False while the gates are still being fetched. */
  gatesReady?: boolean;
  /** Names the row in tooltips, so "Start Installation" reads as a sentence. */
  label?: string;
}

const QuickActions = ({
  status,
  onAction,
  loading,
  gate,
  mayEdit = true,
  gatesReady = true,
  label,
}: QuickActionsProps) => {
  if (loading) {
    return <ArrowPathIcon className="w-4 h-4 animate-spin text-slate-400" />;
  }

  // Hold everything until the answer is in. Drawing enabled buttons and then
  // switching some off a second later is worse than a brief wait.
  if (!gatesReady) {
    return (
      <div className="flex items-center gap-0.5 opacity-40" aria-busy="true">
        <span className="p-1.5 text-slate-300" title="Checking what is available…">
          <PlayIcon className="w-4 h-4" />
        </span>
        <span className="p-1.5 text-slate-300">
          <CheckCircleIcon className="w-4 h-4" />
        </span>
      </div>
    );
  }

  const of = label ? ` ${label}` : "";
  const buttonClass =
    "p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  if (!mayEdit) {
    return (
      <span
        className="text-[11px] text-slate-400"
        title="You do not have permission to change this plan"
      >
        view only
      </span>
    );
  }

  /**
   * Without a gate the row belongs to the older phase engine, which has no
   * per-row rules to ask about. Fall back to what the status alone allows -
   * the same behaviour this component had before gates existed.
   */
  const g: PlanGate =
    gate ??
    {
      status,
      isPhase: false,
      canStart: status === "not_started",
      startReason: status === "not_started" ? null : "Already under way",
      canComplete: status === "in_progress" || status === "not_started",
      completeReason: null,
      canSkip: status !== "completed",
      skipReason: null,
      skipNeedsReason: true,
      canHold: status === "in_progress",
      canResume: status === "on_hold" || status === "blocked",
    };

  const settled =
    status === "completed" || status === "skipped" || status === "cancelled";

  if (settled) {
    return (
      <span
        className="text-[11px] text-slate-400"
        title={
          status === "completed"
            ? `Completed${of ? " — " + label : ""}`
            : status === "skipped"
              ? "Skipped, with a reason recorded"
              : "Cancelled"
        }
      >
        {status === "completed" ? "done" : status}
      </span>
    );
  }

  const Btn = ({
    action,
    allowed,
    reason,
    tone,
    tip,
    children,
  }: {
    action: QuickAction;
    allowed: boolean;
    reason: string | null;
    tone: string;
    tip: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      disabled={!allowed}
      onClick={() => allowed && onAction(action)}
      // The reason is the tooltip when blocked, so the answer to "why can I
      // not press this" is on the button itself.
      title={allowed ? tip : (reason ?? tip)}
      aria-label={allowed ? tip : `${tip} — unavailable: ${reason ?? ""}`}
      // A disabled button must still look like a button. text-slate-300 on a
      // white row read as nothing there, so "Complete is missing" was really
      // "Complete is disabled because two steps are still open" - and the
      // reason was in a tooltip nobody knew to hover.
      className={`${buttonClass} ${
        allowed ? tone : "text-slate-400 bg-slate-100/70 border border-slate-200"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5">
      {/**
       * WHICH button appears is decided by the row's own status. WHETHER it is
       * allowed is decided by the gate.
       *
       * Letting the gate choose the button made it possible to show the wrong
       * one: the row's status updates optimistically the moment you act, while
       * the gate only catches up when the parent's refetch resolves. Putting a
       * step on hold therefore rendered a disabled Start - which reads as no
       * button at all - beside an enabled Complete, until the refresh landed.
       *
       * Status is always current; the gate can lag. So status picks the slot,
       * and the gate only ever disables and explains. Start is the one action
       * that can be refused outright, and it is the one that consults the gate.
       */}
      {status === "in_progress" ? (
        <Btn
          action="hold"
          allowed
          reason={null}
          tone="text-amber-600 hover:bg-amber-100"
          tip={`Pause${of} — records why it stopped`}
        >
          <PauseIcon className="w-4 h-4" />
        </Btn>
      ) : status === "on_hold" || status === "blocked" ? (
        <Btn
          action="resume"
          allowed
          reason={null}
          tone="text-blue-600 hover:bg-blue-100"
          tip={`Resume${of}`}
        >
          <PlayIcon className="w-4 h-4" />
        </Btn>
      ) : (
        <Btn
          action="start"
          allowed={g.canStart}
          reason={g.startReason}
          tone="text-blue-600 hover:bg-blue-100"
          tip={g.isPhase ? `Start${of} — opens this stage` : `Start${of}`}
        >
          <PlayIcon className="w-4 h-4" />
        </Btn>
      )}

      <Btn
        action="complete"
        allowed={g.canComplete}
        reason={g.completeReason}
        tone="text-green-600 hover:bg-green-100"
        tip={g.isPhase ? `Complete${of} — closes this stage` : `Mark${of} complete`}
      >
        <CheckCircleIcon className="w-4 h-4" />
      </Btn>

      <Btn
        action="cancel"
        allowed={g.canSkip}
        reason={g.skipReason}
        tone="text-slate-400 hover:bg-slate-100"
        tip={g.skipNeedsReason ? `Skip${of} — a reason is required` : `Skip${of}`}
      >
        <ForwardIcon className="w-4 h-4" />
      </Btn>
    </div>
  );
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

export default function ManagementTab({
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
  onPhaseQuickAction,
  gates = {},
  mayEdit = true,
  gatesReady = false,
}: ProjectMgmtTabProps) {
  // Local state for inline updates (optimistic UI)
  const [phases, setPhases] = useState<ProjectPhase[]>(initialPhases || []);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set((initialPhases || []).map((p) => p.id))
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Notes prompt modal state
  /** So the refresh icon shows it is working rather than looking inert. */
  const [refreshing, setRefreshing] = useState(false);

  const [notesPrompt, setNotesPrompt] = useState<{
    isOpen: boolean;
    subPhaseId: string;
    phaseId: string;
    subPhaseName: string;
    action: "start" | "hold" | "resume" | "complete" | "cancel";
    /** True when the row is a phase, which goes to a different endpoint. */
    isPhase?: boolean;
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

  /**
   * A phase goes through the same notes prompt as a step, so starting a stage
   * records why in the same place. phaseId is carried in both slots because
   * the prompt was written for sub-phases; executeQuickAction reads the flag.
   */
  const handlePhaseActionClick = (
    phaseId: string,
    phaseName: string,
    action: "start" | "hold" | "resume" | "complete" | "cancel"
  ) => {
    if (!needsReason(action, gates[phaseId])) {
      void runQuickAction({ subPhaseId: phaseId, phaseId, action, isPhase: true }, "");
      return;
    }
    setNotesPrompt({
      isOpen: true,
      subPhaseId: phaseId,
      phaseId,
      subPhaseName: phaseName,
      action,
      isPhase: true,
    });
  };

  /**
   * Which actions genuinely need a sentence from the person doing them.
   *
   * Every status change used to open a modal demanding notes, including Start -
   * so beginning a step took two clicks and an invented sentence. A reason is
   * only worth asking for when it explains a departure: why work paused, or why
   * a step was skipped. Starting and finishing are the expected path and the
   * timestamps already record them.
   */
  const needsReason = (
    action: "start" | "hold" | "resume" | "complete" | "cancel",
    gate?: PlanGate
  ) => {
    if (action === "hold") return true;
    if (action === "cancel") return gate?.skipNeedsReason !== false;
    return false;
  };

  const handleQuickActionClick = (
    subPhaseId: string,
    phaseId: string,
    subPhaseName: string,
    action: "start" | "hold" | "resume" | "complete" | "cancel"
  ) => {
    if (!needsReason(action, gates[subPhaseId])) {
      void runQuickAction({ subPhaseId, phaseId, action }, "");
      return;
    }
    setNotesPrompt({
      isOpen: true,
      subPhaseId,
      phaseId,
      subPhaseName,
      action,
    });
  };

  // Execute the action after notes are provided
  const executeQuickActionFromPrompt = async (notes: string) => {
    if (!notesPrompt) return;
    const { subPhaseId, phaseId, action, isPhase } = notesPrompt;
    setNotesPrompt(null);
    await runQuickAction({ subPhaseId, phaseId, action, isPhase }, notes);
  };

  /**
   * Performs the action. Split out from the modal so an action that needs no
   * reason can call it directly instead of opening a prompt to collect an
   * empty string.
   */
  const runQuickAction = async (
    target: {
      subPhaseId: string;
      phaseId: string;
      action: "start" | "hold" | "resume" | "complete" | "cancel";
      isPhase?: boolean;
    },
    notes: string
  ) => {
    const { subPhaseId, phaseId, action, isPhase } = target;

    // A phase takes a different route: its own endpoint, and no sub-phase
    // optimistic update to apply. The parent refreshes, which is what brings
    // the new gates back with it.
    if (isPhase) {
      if (!onPhaseQuickAction) return;
      setNotesPrompt(null);
      setActionLoading(phaseId);
      try {
        await onPhaseQuickAction(phaseId, action, notes);
      } finally {
        setActionLoading(null);
        onRefresh();
      }
      return;
    }

    if (!onQuickAction) return;

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
          className={cn(buttonVariants({ size: "sm" }), "gap-2")}
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
            onClick={async () => {
              if (refreshing) return;
              setRefreshing(true);
              try {
                await onRefresh();
              } finally {
                setRefreshing(false);
              }
            }}
            disabled={refreshing}
            title="Refresh the plan"
            className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 hover:bg-slate-100 rounded disabled:opacity-50"
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
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

      {/* Table.
          overflow-x-auto with a min-width on the rows, rather than
          overflow-hidden: starting a step fills the actual-dates column, the
          flexible columns grew to fit, and the Edit button was pushed past the
          right edge with no way to reach it. The card still fits the page; the
          columns keep their widths and the table scrolls under them. */}
      <div className="border border-slate-200 rounded-lg bg-white overflow-x-auto">
        {/* Table Header */}
        <div className="grid grid-cols-[32px_minmax(200px,1.5fr)_minmax(100px,1fr)_100px_100px_minmax(120px,1fr)_90px_minmax(120px,1fr)_90px] gap-3 min-w-[1080px] px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div></div>
          <div>Name</div>
          <div>Assignees</div>
          <div>Status</div>
          <div>Progress</div>
          <div>Planned Dates</div>
          <div title="Hours logged against hours expected">Hours</div>
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
                  className={`grid grid-cols-[32px_minmax(200px,1.5fr)_minmax(100px,1fr)_100px_100px_minmax(120px,1fr)_90px_minmax(120px,1fr)_90px] gap-3 min-w-[1080px] px-4 py-3 items-center border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
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
                      {/**
                       * Why this row cannot be completed, said out loud.
                       *
                       * The reason was only ever a tooltip on a disabled
                       * button, so "Complete is missing" was really "Complete
                       * is disabled because a meeting has not been confirmed" -
                       * and nothing on screen said so. Shown only when the row
                       * is under way, because "waiting for an earlier stage" on
                       * everything not yet started is noise.
                       */}
                      {gates[phase.id] &&
                        !gates[phase.id].canComplete &&
                        gates[phase.id].completeReason &&
                        (phase.status === "in_progress" ||
                          phase.status === "on_hold") && (
                          <a
                            href={`/dashboard/tasks/${phase.id}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Open this stage to deal with it"
                            className="block text-xs text-amber-700 hover:text-amber-900 hover:underline truncate"
                          >
                            {gates[phase.id].completeReason}
                          </a>
                        )}
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

                  {/* Hours: logged against expected */}
                  <div className="text-xs text-slate-600">
                    <HoursSpent
                      estimated={phase.estimated_hours}
                      actual={phase.actual_hours}
                    />
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

                  {/* Actions. A phase is a task, so it starts and completes
                      like a step - and it has to, because steps that wait for
                      their phase to start cannot begin until somebody opens
                      it. Previously there was only Edit here. */}
                  <div
                    className="flex justify-center items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onPhaseQuickAction && (
                      <QuickActions
                        status={phase.status}
                        loading={actionLoading === phase.id}
                        gate={gates[phase.id]}
                        mayEdit={mayEdit}
                        gatesReady={gatesReady}
                        label={phase.name}
                        onAction={(action) =>
                          handlePhaseActionClick(phase.id, phase.name, action)
                        }
                      />
                    )}
                    {onEditPhase && (
                      <button
                        onClick={() => onEditPhase(phase)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-1"
                        title={`Edit ${phase.name}`}
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
                          onClick={() =>
                            onSubPhaseClick?.(phase.id, subPhase.id)
                          }
                          className={`grid grid-cols-[32px_minmax(200px,1.5fr)_minmax(100px,1fr)_100px_100px_minmax(120px,1fr)_90px_minmax(120px,1fr)_90px] gap-3 min-w-[1080px] px-4 py-2.5 items-center border-b border-slate-100 hover:bg-white/80 cursor-pointer ${
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
                            <span className="min-w-0">
                              <span className="block text-sm text-slate-700 truncate">
                                {subPhase.name}
                              </span>
                              {/* Same reason line as a phase row: a blocked
                                  step should say what is holding it. */}
                              {gates[subPhase.id] &&
                                !gates[subPhase.id].canComplete &&
                                gates[subPhase.id].completeReason &&
                                (subPhase.status === "in_progress" ||
                                  subPhase.status === "on_hold") && (
                                  <span className="block text-xs text-amber-700 truncate">
                                    {gates[subPhase.id].completeReason}
                                  </span>
                                )}
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

                          {/* Hours: logged against expected */}
                          <div className="text-xs text-slate-600">
                            <HoursSpent
                              estimated={subPhase.estimated_hours}
                              actual={subPhase.actual_hours}
                            />
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

                          {/* Quick Actions. stopPropagation because the row
                              itself opens the task - without it, pressing
                              Complete also navigated away. The phase row's
                              cell already did this; this one did not. */}
                          <div
                            className="flex justify-center items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <QuickActions
                              status={subPhase.status}
                              loading={actionLoading === subPhase.id}
                              gate={gates[subPhase.id]}
                              mayEdit={mayEdit}
                              gatesReady={gatesReady}
                              label={subPhase.name}
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
          onSubmit={executeQuickActionFromPrompt}
          onCancel={() => setNotesPrompt(null)}
        />
      )}
    </div>
  );
}
