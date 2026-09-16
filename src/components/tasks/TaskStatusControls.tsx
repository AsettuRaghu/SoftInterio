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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useDelayReasons } from "@/lib/tasks/use-delay-reasons";
import { DelayOwnerLabels, type DelayOwner } from "@/types/tasks";
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
    | "hold_owner"
    | "hold_reason_code"
    | "hold_expected_until"
    | "hold_counterpart"
    | "procedure_run_id"
    | "playbook_step"
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
  /** Why Start would be refused right now (from plan gates). Disables it. */
  startBlockedReason?: string | null;
  /** Why Complete would be refused right now. Disables it. */
  completeBlockedReason?: string | null;
  /** Surface a refusal here (a toast) instead of turning the button red. */
  onError?: (message: string) => void;
  /**
   * Called the moment a button is pressed with the status the row is about to
   * take, and again with the previous status if the server refuses. Lets the
   * table move its status badge in step with the buttons instead of waiting
   * for the round trip.
   */
  onOptimistic?: (status: TaskStatus) => void;
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

/** h:mm:ss, hours unbounded - a step can run for days. */
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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
/**
 * Reopening is not starting, and must not look like it.
 *
 * Reopen used to carry the PLAY icon. These buttons are icon-only, so a
 * completed task showed the same triangle as an untouched one - which reads as
 * "not started yet" on a task that is finished. A u-turn says what it does.
 */
const REOPEN = (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h11a4 4 0 1 1 0 8h-3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 6.5L3 10l3.5 3.5" />
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
      // Reopen, not Start: the task has been done, and pressing this undoes
      // that. Its own icon, because these buttons carry no text.
      return [{ to: "in_progress", label: "Reopen", icon: REOPEN }];
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
  startBlockedReason = null,
  completeBlockedReason = null,
  onError,
  onOptimistic,
}: TaskStatusControlsProps) {
  // What the row is showing while a transition is in flight.
  const [optimistic, setOptimistic] = useState<TaskStatus | null>(null);
  useEffect(() => {
    setOptimistic(null);
  }, [task.status]);
  // The dialog can also open AFTER a pause, to add who/why to a hold that is
  // already in effect. Same fields, saved with a PATCH instead of a transition.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionConfig | null>(null);
  const [reason, setReason] = useState("");
  // Who we are waiting on, why, and until when. Asked whenever a plan step
  // is held; optional on an ad-hoc task.
  const [holdOwner, setHoldOwner] = useState<DelayOwner | "">("");
  const [holdCode, setHoldCode] = useState("");
  const [holdUntil, setHoldUntil] = useState("");
  const [holdWho, setHoldWho] = useState("");
  const reasons = useDelayReasons();
  const [tick, setTick] = useState(0);
  const isPlanStep = !!task.procedure_run_id;

  const isRunning = optimistic
    ? optimistic === "in_progress"
    : (task.is_clock_running ?? task.status === "in_progress");

  // Baseline the elapsed counter whenever the server gives us fresh numbers,
  // then advance it locally so the readout doesn't sit frozen.
  const baseSeconds = task.live_active_seconds ?? task.total_active_seconds ?? 0;
  const [baseline, setBaseline] = useState({ seconds: baseSeconds, at: Date.now() });
  const wasRunning = useRef(isRunning);

  /**
   * Re-baseline without a visible jump.
   *
   * The server's figure arrives a fetch or two after a click, and it can sit a
   * second or two either side of what the row has been counting locally. It
   * used to be adopted blindly, so the clock lurched on every Start and Pause.
   * Now: the locally counted value carries on unless the server disagrees by
   * more than a few seconds (a session logged elsewhere, a page left open),
   * and pausing freezes the clock at exactly what it showed.
   */
  useEffect(() => {
    const now = Date.now();
    setBaseline((prev) => {
      const local = wasRunning.current
        ? prev.seconds + Math.floor((now - prev.at) / 1000)
        : prev.seconds;
      const seconds = Math.abs(baseSeconds - local) > 3 ? baseSeconds : local;
      return { seconds, at: now };
    });
    wasRunning.current = isRunning;
  }, [baseSeconds, isRunning]);

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
    async (
      to: TaskStatus,
      withReason?: string,
      afterwards?: () => void,
      // State set in the same tick is not yet visible here; an immediate
      // pause passes the owner and reason it just chose.
      hold?: { owner: DelayOwner | ""; code: string },
    ) => {
      const previous = task.status;
      setIsSaving(true);
      setError(null);
      setOptimistic(to);
      onOptimistic?.(to);
      try {
        const response = await fetch(`/api/tasks/${task.id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: to,
            reason: withReason,
            hold_owner: (hold ? hold.owner : holdOwner) || undefined,
            hold_reason_code: (hold ? hold.code : holdCode) || undefined,
            hold_expected_until: holdUntil || undefined,
            hold_counterpart: holdWho || undefined,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          const message = data.error || "Could not update the task";
          setOptimistic(null);
          onOptimistic?.(previous);
          if (onError && !pendingAction) onError(message);
          else setError(message);
          return;
        }

        setPendingAction(null);
        setReason("");
        setHoldOwner("");
        setHoldCode("");
        setHoldUntil("");
        setHoldWho("");
        if (data.task) {
          onTransitioned?.(
            data.task as TaskWithDetails,
            data.transition as TaskTransitionResult
          );
        }
        afterwards?.();
      } catch {
        setOptimistic(null);
        onOptimistic?.(previous);
        setError("Could not reach the server");
      } finally {
        setIsSaving(false);
      }
    },
    [task.id, task.status, onTransitioned, onOptimistic, holdOwner, holdCode, holdUntil, holdWho, onError, pendingAction]
  );

  /** Add who/why/until to a hold already in effect (no status change). */
  const saveHoldDetails = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hold_owner: holdOwner || null,
          hold_reason_code: holdCode || null,
          hold_expected_until: holdUntil || null,
          hold_counterpart: holdWho || null,
          hold_reason: reason.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not save");
        return;
      }
      setDetailsOpen(false);
      setReason("");
      if (data.task) onTransitioned?.(data.task as TaskWithDetails);
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = (action: ActionConfig) => {
    // In a table row a plan step pauses the moment you press it - the same
    // feel as the tasks page - and asks who we are waiting on AFTERWARDS,
    // only when the playbook has not already said. A client or vendor step
    // carries its owner and usual reason, so those pause silently and
    // correctly; an internal step pauses and then shows a small amber
    // "who are we waiting on?" until it is answered.
    if (variant === "compact" && isPlanStep && action.to === "on_hold") {
      const stepOwner = task.playbook_step?.owner_type;
      const known = !!stepOwner && stepOwner !== "internal";
      const owner: DelayOwner | "" = known ? (stepOwner as DelayOwner) : "";
      const code = known ? task.playbook_step?.default_delay_reason ?? "" : "";
      setHoldOwner(owner);
      setHoldCode(code);
      setHoldUntil("");
      setHoldWho("");
      void transition("on_hold", undefined, undefined, { owner, code });
      return;
    }

    // The full variant (task page, edit modal) still asks first: there is
    // room for the question there, and it is where a deliberate hold is made.
    if (
      TRANSITIONS_REQUIRING_REASON.includes(action.to) &&
      variant === "full"
    ) {
      setPendingAction(action);
      setReason("");
      // A client/vendor step is, by definition, waiting on them; open the
      // dialog already saying so, with the step's usual reason.
      const stepOwner = task.playbook_step?.owner_type;
      setHoldOwner(stepOwner && stepOwner !== "internal" ? stepOwner : "");
      setHoldCode(stepOwner && stepOwner !== "internal" ? task.playbook_step?.default_delay_reason ?? "" : "");
      setHoldUntil("");
      setHoldWho("");
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
  // The pause / block / skip dialog, shared by every variant. It used to be
  // rendered only by the full variant, so a plan step paused from a table row
  // set the dialog up and never showed it.
  const dialog = (
  <Modal
    isOpen={!!pendingAction || detailsOpen}
    onClose={() => {
      setPendingAction(null);
      setDetailsOpen(false);
      setError(null);
    }}
    title={
      detailsOpen
        ? "Paused - who are we waiting on?"
        : pendingAction?.to === "skipped"
          ? "Skip this step"
          : pendingAction?.to === "blocked"
            ? "Block task"
            : "Pause task"
    }
    subtitle={
      detailsOpen
        ? "The step is already paused. This is what the delay is counted against; you can also fill it in later from the row."
        : pendingAction?.to === "skipped"
          ? "The playbook asks for a reason when this step is skipped."
          : isPlanStep
            ? "Who are we waiting on, and why? This is what the delay is counted against."
            : "Why is this being paused? This is recorded against the task's held time."
    }
    size="md"
    footer={
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setPendingAction(null);
            setDetailsOpen(false);
            setError(null);
          }}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          {detailsOpen ? "Later" : "Cancel"}
        </button>
        <button
          type="button"
          disabled={
            isSaving ||
            (detailsOpen
              ? !holdOwner || !holdCode
              : pendingAction?.to === "skipped"
                ? !reason.trim()
                : isPlanStep
                  ? !holdOwner || !holdCode
                  : !reason.trim())
          }
          onClick={() =>
            detailsOpen
              ? void saveHoldDetails()
              : pendingAction && void transition(pendingAction.to, reason.trim())
          }
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : detailsOpen ? "Save" : pendingAction?.label}
        </button>
      </div>
    }
  >
    <div className="space-y-3">
      {/* Who we are waiting on, why, and until when. This is what the
          delay log is built from; the free text below is the detail. */}
      {pendingAction?.to !== "skipped" && (
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-600">
          Waiting on
          <select
            value={holdOwner}
            onChange={(e) => {
              setHoldOwner(e.target.value as DelayOwner | "");
              setHoldCode("");
            }}
            className={`mt-1 w-full px-2 py-1.5 text-sm rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              isPlanStep && !holdOwner ? "border-amber-300" : "border-slate-200"
            }`}
          >
            <option value="">{isPlanStep ? "Choose…" : "Not recorded"}</option>
            {(Object.keys(DelayOwnerLabels) as DelayOwner[]).map((o) => (
              <option key={o} value={o}>
                {DelayOwnerLabels[o]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Reason
          <select
            value={holdCode}
            disabled={!holdOwner}
            onChange={(e) => setHoldCode(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
          >
            <option value="">{holdOwner ? "Choose…" : "Pick who first"}</option>
            {reasons
              .filter((r) => r.owner === holdOwner)
              .map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Expected until
          <input
            type="date"
            value={holdUntil}
            onChange={(e) => setHoldUntil(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="text-xs text-slate-600">
          Who exactly
          <input
            type="text"
            value={holdWho}
            onChange={(e) => setHoldWho(e.target.value)}
            placeholder="e.g. Mr Rao / Hettich"
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>
      )}
      {pendingAction?.to !== "skipped" && isPlanStep && holdUntil && (
        <p className="text-[11px] text-slate-500">
          If this is later than the step's due date, every step that waits on it moves by the same
          number of days. The agreed plan stays as it was.
        </p>
      )}
      <textarea
        autoFocus={pendingAction?.to === "skipped" || !isPlanStep}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder={
          pendingAction?.to === "skipped"
            ? "Why this step is being skipped"
            : isPlanStep
              ? "Anything else worth noting (optional)"
              : pendingAction?.to === "blocked"
                ? "e.g. Waiting on client to confirm the shutter finish"
                : "e.g. Parked until the site is handed over"
        }
        className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  </Modal>
  );

  if (variant === "compact") {
    // Two small round buttons, always: the one that moves the clock (Start,
    // Pause or Resume - whichever applies) and Complete. They react the
    // moment they are pressed: the row takes the new state optimistically,
    // the buttons swap, and the server's answer either confirms it or puts it
    // back with a toast saying why. The clock beside them runs by the second.
    const shown = optimistic ?? task.status;
    const settled = shown === "completed" || shown === "cancelled";
    // From status alone. is_clock_running is a separate flag that arrives a
    // fetch later than the status does, and reading it here flashed Start
    // between the optimistic Pause and the refetched one.
    const running = shown === "in_progress";
    const paused = shown === "on_hold" || shown === "blocked";
    const completeGate = blockedReason ?? completeBlockedReason;
    const startBlocked = shown === "todo" && !!startBlockedReason;

    const round =
      "w-7 h-7 rounded-full flex items-center justify-center border transition-all disabled:cursor-not-allowed disabled:opacity-40";

    const primaryTo: TaskStatus = running ? "on_hold" : "in_progress";
    const primaryLabel = running ? "Pause" : shown === "todo" ? "Start" : "Resume";
    const primaryIcon = running ? PAUSE : PLAY;
    const primaryClass = running
      ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
      : paused
        ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
        : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700";

    return (
      <>
        <div className="flex items-center gap-1.5">
          {settled ? (
            // Finished: the word and the time it took, green when it came in
            // within the estimate and red when it ran over - the same nudge
            // the due-date chip gives, for effort rather than dates.
            <span
              className={`text-[11px] font-medium tabular-nums whitespace-nowrap ${
                shown !== "completed"
                  ? "text-slate-400"
                  : !task.estimated_hours
                    ? "text-slate-500"
                    : elapsed <= task.estimated_hours * 3600
                      ? "text-emerald-600"
                      : "text-red-600"
              }`}
              title={
                shown === "completed" && task.estimated_hours
                  ? `${formatDuration(elapsed)} worked of ${task.estimated_hours}h estimated`
                  : undefined
              }
            >
              {shown === "completed" ? `Done ${formatClock(elapsed)}` : "Cancelled"}
            </span>
          ) : (
            <>
              <Tooltip label={startBlocked ? startBlockedReason! : primaryLabel}>
                <button
                  type="button"
                  disabled={isSaving || disabled || startBlocked}
                  aria-label={primaryLabel}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction({ to: primaryTo, label: primaryLabel, icon: primaryIcon });
                  }}
                  className={`${round} ${primaryClass}`}
                >
                  {primaryIcon}
                </button>
              </Tooltip>
              <Tooltip label={completeGate ? `Cannot complete yet - ${completeGate}` : "Complete"}>
                <button
                  type="button"
                  disabled={isSaving || disabled || !!completeGate}
                  aria-label="Complete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction({ to: "completed", label: "Complete", icon: CHECK });
                  }}
                  className={`${round} ${
                    completeGate
                      ? "bg-slate-100 text-slate-400 border-slate-200"
                      : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  {CHECK}
                </button>
              </Tooltip>
            </>
          )}

          {!hideTimer && !settled && (elapsed > 0 || running) && (
            <span
              className={`text-[11px] tabular-nums whitespace-nowrap ${
                overBudget ? "text-red-600 font-medium" : "text-slate-500"
              }`}
              title={
                task.estimated_hours
                  ? `Worked ${formatDuration(elapsed)} of ${task.estimated_hours}h estimated`
                  : `Worked ${formatDuration(elapsed)}`
              }
            >
              {formatClock(elapsed)}
            </span>
          )}
        </div>
        {dialog}
      </>
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

      {(task.status === "on_hold" || task.status === "blocked") &&
        (task.hold_reason || task.hold_owner) && (
          <p className="text-xs text-slate-500">
            <span className="font-medium text-amber-700">
              {task.hold_owner
                ? `Waiting on ${DelayOwnerLabels[task.hold_owner].toLowerCase()}`
                : task.status === "blocked"
                  ? "Blocked"
                  : "Paused"}
              {task.hold_expected_until
                ? ` until ${new Date(task.hold_expected_until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                : ""}
              :
            </span>{" "}
            {task.hold_reason_code
              ? (reasons.find((r) => r.code === task.hold_reason_code)?.label ?? task.hold_reason_code)
              : null}
            {task.hold_reason_code && task.hold_reason ? " — " : ""}
            {task.hold_reason}
          </p>
        )}

      {error && !pendingAction && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {dialog}
    </div>
  );
}

export default TaskStatusControls;
