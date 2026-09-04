"use client";

/**
 * Task lifecycle controls: Start / Pause / Block / Resume / Complete.
 *
 * Every action goes through POST /api/tasks/[id]/transition, which is the only
 * path that keeps status history and work sessions consistent. Nothing here
 * writes tasks.status directly.
 *
 * The clock shown while a task is running is a display convenience only - the
 * authoritative totals always come back from the server on each transition.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  canTransitionTask,
  formatDuration,
  TRANSITIONS_REQUIRING_REASON,
  type TaskStatus,
  type TaskTransitionResult,
  type TaskWithDetails,
} from "@/types/tasks";

interface TaskStatusControlsProps {
  task: Pick<
    TaskWithDetails,
    | "id"
    | "status"
    | "hold_reason"
    | "total_active_seconds"
    | "live_active_seconds"
    | "is_clock_running"
    | "estimated_hours"
    | "open_subtask_count"
    | "completion_count"
  >;
  /**
   * Called with the refreshed task after a successful transition. The second
   * argument carries the RPC result, which includes parent_reopened - the
   * caller needs that because reopening a subtask can silently move its
   * parent back to in_progress.
   */
  onTransitioned?: (
    task: TaskWithDetails,
    result?: TaskTransitionResult
  ) => void;
  size?: "sm" | "md";
  /** Hide the elapsed-time readout (e.g. in dense table rows). */
  hideTimer?: boolean;
  /**
   * "full"    - labelled buttons, Pause/Block prompt for a reason. For modals
   *             and detail views.
   * "compact" - two icon buttons (play/pause + complete) sized for a table
   *             row. Pausing here does NOT prompt for a reason; it is a quick
   *             action, and the reason is optional at the database level.
   */
  variant?: "full" | "compact";
  /** Disable all actions (e.g. closed project, read-only table). */
  disabled?: boolean;
}

interface ActionConfig {
  to: TaskStatus;
  label: string;
  icon: React.ReactNode;
}

const iconClass = "w-3.5 h-3.5";

const PLAY = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" />
  </svg>
);
const PAUSE = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4.5" height="16" rx="1.25" />
    <rect x="13.5" y="4" width="4.5" height="16" rx="1.25" />
  </svg>
);
const BLOCK = (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </svg>
);
const CHECK = (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

/**
 * Buttons are coloured by the status they move the task INTO, using the same
 * bg-50 / text-600 / border-200 language as StatusBadge, PriorityBadge and the
 * rest of the modal. So the colour is information, not decoration: blue always
 * means "this puts it in progress", amber "on hold", green "completed".
 *
 * The old Start button was a solid blue filled control, which shouted next to
 * the light pills it sits beside.
 */
const TARGET_STYLES: Record<string, { idle: string; hover: string }> = {
  in_progress: {
    idle: "bg-blue-50 text-blue-600 border-blue-200",
    hover: "hover:bg-blue-100 hover:border-blue-300",
  },
  on_hold: {
    idle: "bg-amber-50 text-amber-600 border-amber-200",
    hover: "hover:bg-amber-100 hover:border-amber-300",
  },
  blocked: {
    idle: "bg-orange-50 text-orange-600 border-orange-200",
    hover: "hover:bg-orange-100 hover:border-orange-300",
  },
  completed: {
    idle: "bg-green-50 text-green-600 border-green-200",
    hover: "hover:bg-green-100 hover:border-green-300",
  },
};

const styleFor = (to: TaskStatus) =>
  TARGET_STYLES[to] ?? {
    idle: "bg-slate-50 text-slate-600 border-slate-200",
    hover: "hover:bg-slate-100 hover:border-slate-300",
  };

/** Which buttons make sense from each status. */
function actionsFor(status: TaskStatus): ActionConfig[] {
  switch (status) {
    case "todo":
      return [
        { to: "in_progress", label: "Start", icon: PLAY },
        // Allowed without starting first - records zero worked time, which is
        // the honest answer for a task nobody tracked.
        { to: "completed", label: "Complete", icon: CHECK },
      ];
    case "in_progress":
      return [
        { to: "on_hold", label: "Pause", icon: PAUSE },
        { to: "blocked", label: "Block", icon: BLOCK },
        { to: "completed", label: "Complete", icon: CHECK },
      ];
    case "on_hold":
    case "blocked":
      return [
        { to: "in_progress", label: "Resume", icon: PLAY },
        { to: "completed", label: "Complete", icon: CHECK },
      ];
    case "completed":
    case "cancelled":
      return [{ to: "in_progress", label: "Reopen", icon: PLAY }];
    default:
      return [];
  }
}

export function TaskStatusControls({
  task,
  onTransitioned,
  size = "md",
  hideTimer = false,
  variant = "full",
  disabled = false,
}: TaskStatusControlsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionConfig | null>(null);
  const [reason, setReason] = useState("");
  const [tick, setTick] = useState(0);

  const isRunning = task.is_clock_running ?? task.status === "in_progress";

  // Baseline the elapsed counter whenever the server gives us fresh numbers,
  // then advance it locally so the readout doesn't sit frozen.
  const baseSeconds = task.live_active_seconds ?? task.total_active_seconds ?? 0;
  const [baseline, setBaseline] = useState({ seconds: baseSeconds, at: Date.now() });

  useEffect(() => {
    setBaseline({ seconds: baseSeconds, at: Date.now() });
  }, [baseSeconds, task.status]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const elapsed = useMemo(() => {
    if (!isRunning) return baseline.seconds;
    return baseline.seconds + Math.floor((Date.now() - baseline.at) / 1000);
    // tick is the heartbeat that forces this to recompute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline, isRunning, tick]);

  const transition = useCallback(
    async (to: TaskStatus, withReason?: string) => {
      setIsSaving(true);
      setError(null);
      try {
        const response = await fetch(`/api/tasks/${task.id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: to, reason: withReason }),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Could not update the task");
          return;
        }

        setPendingAction(null);
        setReason("");
        if (data.task) {
          onTransitioned?.(
            data.task as TaskWithDetails,
            data.transition as TaskTransitionResult
          );
        }
      } catch {
        setError("Could not reach the server");
      } finally {
        setIsSaving(false);
      }
    },
    [task.id, onTransitioned]
  );

  const handleAction = (action: ActionConfig) => {
    // Full variant asks why before pausing or blocking. Compact does not -
    // it is a one-click row action, and the reason is optional server-side.
    if (variant === "full" && TRANSITIONS_REQUIRING_REASON.includes(action.to)) {
      setPendingAction(action);
      setReason("");
      setError(null);
      return;
    }
    void transition(action.to);
  };

  const actions = actionsFor(task.status).filter((a) =>
    canTransitionTask(task.status, a.to)
  );

  // The database is the authority on this gate; this only lets the UI explain
  // itself before the round trip instead of after a rejection.
  const blockedBySubtasks = (task.open_subtask_count ?? 0) > 0;
  const blockedReason = blockedBySubtasks
    ? `${task.open_subtask_count} subtask${
        task.open_subtask_count === 1 ? "" : "s"
      } still open`
    : null;

  const overBudget =
    task.estimated_hours != null &&
    task.estimated_hours > 0 &&
    elapsed > task.estimated_hours * 3600;

  // ---------------------------------------------------------------
  // Compact: two icon buttons sized to sit inside a table row
  // ---------------------------------------------------------------
  if (variant === "compact") {
    // The play/pause toggle. Never offer Block here - it needs a reason to be
    // worth recording, and there is nowhere in a row to ask for one.
    const primary = isRunning
      ? actions.find((a) => a.to === "on_hold")
      : actions.find((a) => a.to === "in_progress");
    const complete = actions.find((a) => a.to === "completed");

    const iconButton =
      "w-7 h-7 flex items-center justify-center rounded-md border transition-all disabled:cursor-not-allowed";

    const primaryLabel = isRunning
      ? "Pause"
      : task.status === "completed" || task.status === "cancelled"
      ? "Reopen"
      : task.status === "todo"
      ? "Start"
      : "Resume";

    return (
      <div className="flex items-center gap-1">
        {primary ? (
          <Tooltip label={error || primaryLabel}>
            <button
              type="button"
              disabled={isSaving || disabled}
              aria-label={primaryLabel}
              onClick={(e) => {
                e.stopPropagation();
                handleAction(primary);
              }}
              className={`${iconButton} ${
                error
                  ? "bg-red-50 text-red-600 border-red-200"
                  : `${styleFor(primary.to).idle} ${styleFor(primary.to).hover}`
              } disabled:opacity-40`}
            >
              {primary.icon}
            </button>
          </Tooltip>
        ) : (
          <span className="w-7 h-7" />
        )}

        {complete ? (
          <Tooltip
            label={
              blockedReason ? `Cannot complete - ${blockedReason}` : "Mark complete"
            }
          >
            <button
              type="button"
              disabled={isSaving || disabled || blockedBySubtasks}
              aria-label="Mark complete"
              onClick={(e) => {
                e.stopPropagation();
                handleAction(complete);
              }}
              className={`${iconButton} ${
                blockedBySubtasks
                  ? "bg-slate-100 text-slate-400 border-slate-200"
                  : `${styleFor("completed").idle} ${styleFor("completed").hover}`
              } disabled:opacity-60`}
            >
              {CHECK}
            </button>
          </Tooltip>
        ) : (
          <span className="w-7 h-7" />
        )}

        {!hideTimer && (elapsed > 0 || isRunning) && (
          <span
            className={`text-[10px] tabular-nums whitespace-nowrap ${
              overBudget ? "text-red-600 font-medium" : "text-slate-400"
            }`}
            title={
              task.estimated_hours
                ? `Worked ${formatDuration(elapsed)} of ${task.estimated_hours}h estimated`
                : `Worked ${formatDuration(elapsed)}`
            }
          >
            {formatDuration(elapsed)}
          </span>
        )}
      </div>
    );
  }

  // Same sizing scale as StatusBadge so the controls sit level with the pills.
  const btnSize =
    size === "sm" ? "px-2 py-0.5 text-xs gap-1" : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {actions.map((action) => {
          const gated = action.to === "completed" && blockedBySubtasks;
          const style = styleFor(action.to);
          return (
            <Tooltip
              key={action.to}
              label={gated ? `Cannot complete - ${blockedReason}` : action.label}
            >
              <button
                type="button"
                disabled={isSaving || disabled || gated}
                onClick={() => handleAction(action)}
                className={`inline-flex items-center ${btnSize} font-medium rounded-md border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  style.idle
                } ${gated ? "" : style.hover} hover:shadow-sm`}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            </Tooltip>
          );
        })}

        {!hideTimer && (elapsed > 0 || isRunning) && (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium tabular-nums ${
              overBudget
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-slate-50 text-slate-600 border border-slate-200"
            }`}
            title={
              task.estimated_hours
                ? `Worked ${formatDuration(elapsed)} of ${task.estimated_hours}h estimated`
                : `Worked ${formatDuration(elapsed)}`
            }
          >
            {isRunning && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
              </span>
            )}
            {formatDuration(elapsed)}
          </span>
        )}
      </div>

      {blockedReason && task.status !== "completed" && (
        <p className="text-xs text-slate-500">
          {blockedReason} - complete or cancel them before finishing this task.
        </p>
      )}

      {(task.completion_count ?? 0) > 1 && (
        <p className="text-xs text-amber-600">
          Reworked - completed {task.completion_count} times.
        </p>
      )}

      {task.hold_reason && (task.status === "on_hold" || task.status === "blocked") && (
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-600">
            {task.status === "blocked" ? "Blocked" : "Paused"}:
          </span>{" "}
          {task.hold_reason}
        </p>
      )}

      {error && !pendingAction && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <Modal
        isOpen={!!pendingAction}
        onClose={() => {
          setPendingAction(null);
          setError(null);
        }}
        title={pendingAction?.to === "blocked" ? "Block task" : "Pause task"}
        subtitle={
          pendingAction?.to === "blocked"
            ? "What is this waiting on? Blocked time is tracked separately from paused time."
            : "Why is this being paused? This is recorded against the task's held time."
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingAction(null);
                setError(null);
              }}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || !reason.trim()}
              onClick={() =>
                pendingAction && void transition(pendingAction.to, reason.trim())
              }
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : pendingAction?.label}
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={
              pendingAction?.to === "blocked"
                ? "e.g. Waiting on client to confirm the shutter finish"
                : "e.g. Parked until the site is handed over"
            }
            className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}

export default TaskStatusControls;
