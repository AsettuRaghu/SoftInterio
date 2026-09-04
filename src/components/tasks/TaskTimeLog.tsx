"use client";

/**
 * Time log for a single task.
 *
 * Reads GET /api/tasks/[id]/timing, which returns the two event logs:
 *   work_sessions   - worked intervals (effort: who, from when, to when)
 *   status_history  - every status change (elapsed: how long in each state)
 *
 * Lazy: nothing is fetched until the section is expanded, so opening a task
 * does not pay for a log most people will not look at.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  formatDuration,
  TaskStatusLabels,
  type TaskStatus,
  type TaskStatusHistoryEntry,
  type TaskWorkSession,
} from "@/types/tasks";

interface Props {
  taskId: string;
  /** Re-fetch when this changes (e.g. after a transition). */
  refreshKey?: number;
}

interface EffortByUser {
  user_id: string;
  name: string;
  avatar_url?: string;
  seconds: number;
}

interface TimingResponse {
  summary: {
    live_active_seconds: number;
    live_held_seconds: number;
    is_clock_running: boolean;
    lead_time_seconds: number | null;
    cycle_time_seconds: number | null;
    time_in_status: Partial<Record<TaskStatus, number>>;
    effort_by_user: EffortByUser[];
  };
  status_history: (TaskStatusHistoryEntry & {
    changed_by_user?: { id: string; name: string };
  })[];
  work_sessions: (TaskWorkSession & { user?: { id: string; name: string } })[];
}

const dt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function TaskTimeLog({ taskId, refreshKey = 0 }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<TimingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/timing`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || "Could not load the time log");
        return;
      }
      setData(await response.json());
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load, refreshKey]);

  const summary = data?.summary;
  const sessions = data?.work_sessions ?? [];
  const history = data?.status_history ?? [];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Time Log
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {summary && (
            <span className="tabular-nums">
              {formatDuration(summary.live_active_seconds)} worked
            </span>
          )}
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="p-3 space-y-4 bg-white">
          {isLoading && (
            <p className="text-xs text-slate-400">Loading time log...</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}

          {summary && !isLoading && (
            <>
              {/* Headline numbers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Worked", value: formatDuration(summary.live_active_seconds) },
                  { label: "Held", value: formatDuration(summary.live_held_seconds) },
                  { label: "Lead time", value: formatDuration(summary.lead_time_seconds ?? undefined) },
                  { label: "Cycle time", value: formatDuration(summary.cycle_time_seconds ?? undefined) },
                ].map((tile) => (
                  <div
                    key={tile.label}
                    className="px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      {tile.label}
                    </p>
                    <p className="text-sm font-medium text-slate-700 tabular-nums">
                      {tile.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Who did the work - only interesting with more than one person */}
              {summary.effort_by_user.length > 1 && (
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                    Effort by person
                  </p>
                  <div className="space-y-1">
                    {summary.effort_by_user.map((u) => (
                      <div
                        key={u.user_id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-600">{u.name}</span>
                        <span className="text-slate-500 tabular-nums">
                          {formatDuration(u.seconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Work sessions - the "when did it start and stop" answer */}
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                  Work sessions ({sessions.length})
                </p>
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No work recorded yet. Pressing Start opens a session.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {[...sessions].reverse().map((s) => {
                      const running = !s.ended_at;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-slate-50 text-xs"
                        >
                          <span className="text-slate-600 tabular-nums">
                            {dt(s.started_at)}
                            <span className="text-slate-400"> → </span>
                            {running ? (
                              <span className="text-blue-600 font-medium">running</span>
                            ) : (
                              time(s.ended_at!)
                            )}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            {s.user?.name && (
                              <span className="text-slate-400">{s.user.name}</span>
                            )}
                            <span className="text-slate-700 font-medium tabular-nums">
                              {running ? "—" : formatDuration(s.duration_seconds)}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status changes - the "what happened" answer */}
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1.5">
                  Status changes ({history.length})
                </p>
                <div className="space-y-1">
                  {[...history].reverse().map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs">
                      <span className="text-slate-400 tabular-nums shrink-0 w-24">
                        {dt(h.changed_at)}
                      </span>
                      <span className="flex-1 text-slate-600">
                        {h.from_status ? (
                          <>
                            {TaskStatusLabels[h.from_status]}
                            <span className="text-slate-400"> → </span>
                          </>
                        ) : (
                          <span className="text-slate-400">created as </span>
                        )}
                        <span className="font-medium">
                          {TaskStatusLabels[h.to_status]}
                        </span>
                        {h.from_status && h.duration_seconds > 0 && (
                          <span className="text-slate-400">
                            {" "}
                            after {formatDuration(h.duration_seconds)}
                          </span>
                        )}
                        {h.reason && (
                          <span className="block text-slate-500 italic">
                            &ldquo;{h.reason}&rdquo;
                          </span>
                        )}
                      </span>
                      {h.changed_by_user?.name && (
                        <span className="text-slate-400 shrink-0">
                          {h.changed_by_user.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskTimeLog;
