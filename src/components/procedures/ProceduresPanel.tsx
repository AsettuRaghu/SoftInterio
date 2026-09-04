"use client";

/**
 * Procedures attached to one entity: what is running, how far along, and a
 * way to start another.
 *
 * Steps are ordinary tasks, so this panel deliberately does NOT reimplement
 * task controls - it shows progress and gate state, and the work itself is
 * done from the Tasks tab or the task modal like anything else.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { isOverdue, TaskStatusLabels, type TaskRelatedType } from "@/types/tasks";
import {
  ProcedureActionColors,
  ProcedureActionLabels,
  type ProcedureDefinition,
  type ProcedureRun,
  type ProcedureRunStep,
} from "@/types/procedures";

interface Props {
  relatedType: TaskRelatedType;
  relatedId: string;
  /** Closed lead/project - show state but do not allow changes. */
  readOnly?: boolean;
  onRunChange?: () => void;
}

const settled = new Set(["completed", "cancelled", "skipped"]);

export function ProceduresPanel({
  relatedType,
  relatedId,
  readOnly = false,
  onRunChange,
}: Props) {
  const [runs, setRuns] = useState<ProcedureRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [available, setAvailable] = useState<ProcedureDefinition[]>([]);
  const [starting, setStarting] = useState<string | null>(null);

  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProcedureRunStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);

  const loadRuns = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/procedures/runs?related_type=${relatedType}&related_id=${relatedId}`
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || "Could not load procedures");
        return;
      }
      const data = await response.json();
      setRuns(data.runs || []);
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsLoading(false);
    }
  }, [relatedType, relatedId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const openPicker = async () => {
    setIsPickerOpen(true);
    const response = await fetch(`/api/procedures?applies_to=${relatedType}`);
    if (response.ok) {
      const data = await response.json();
      setAvailable(data.procedures || []);
    }
  };

  const start = async (definitionId: string) => {
    setStarting(definitionId);
    setError(null);
    try {
      const response = await fetch(`/api/procedures/${definitionId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          related_type: relatedType,
          related_id: relatedId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not start the procedure");
        return;
      }
      setIsPickerOpen(false);
      await loadRuns();
      onRunChange?.();
    } catch {
      setError("Could not reach the server");
    } finally {
      setStarting(null);
    }
  };

  const toggleRun = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);
    setStepsLoading(true);
    try {
      const response = await fetch(`/api/procedures/runs/${runId}`);
      if (response.ok) {
        const data = await response.json();
        setSteps(data.steps || []);
      }
    } finally {
      setStepsLoading(false);
    }
  };

  const cancelRun = async (runId: string) => {
    const reason = window.prompt("Why is this procedure being cancelled?");
    if (reason === null) return;
    const response = await fetch(`/api/procedures/runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", reason }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not cancel the run");
      return;
    }
    await loadRuns();
    if (expandedRun === runId) void toggleRun(runId);
    onRunChange?.();
  };

  return (
    <div className="space-y-3">
      <Toast message={error} onDismiss={() => setError(null)} />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Procedures</h3>
        {!readOnly && (
          <button
            type="button"
            onClick={() => void openPicker()}
            className="px-2.5 py-1 text-xs font-medium rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            Start a procedure
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400">Loading procedures...</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-slate-400">
          No procedures running. Starting one creates its steps as tasks.
        </p>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const isOpen = expandedRun === run.id;
            return (
              <div
                key={run.id}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => void toggleRun(run.id)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">
                      {run.definition_name}
                      <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                        v{run.definition_version}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500">
                      {run.settled_steps ?? 0} of {run.total_steps ?? 0} steps
                      {run.skipped_steps ? ` · ${run.skipped_steps} skipped` : ""}
                    </span>
                  </span>

                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      run.status === "completed"
                        ? "bg-green-50 text-green-600"
                        : run.status === "cancelled"
                        ? "bg-red-50 text-red-600"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {run.status}
                  </span>

                  <span className="shrink-0 w-16">
                    <span className="block h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <span
                        className="block h-full bg-blue-500 transition-all"
                        style={{ width: `${run.progress_percent ?? 0}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400 tabular-nums w-8 text-right">
                    {run.progress_percent ?? 0}%
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-white">
                    {stepsLoading ? (
                      <p className="px-3 py-2 text-xs text-slate-400">
                        Loading steps...
                      </p>
                    ) : (
                      <>
                        <div className="divide-y divide-slate-50">
                          {steps.map((step) => {
                            const colors = ProcedureActionColors[step.action_type];
                            const isSettled = settled.has(step.status);
                            return (
                              <div
                                key={step.id}
                                className={`px-3 py-2 flex items-center gap-2 ${
                                  step.parent_task_id ? "pl-8" : ""
                                }`}
                              >
                                <span
                                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
                                >
                                  {ProcedureActionLabels[step.action_type]}
                                </span>
                                <span
                                  className={`flex-1 min-w-0 text-xs truncate ${
                                    isSettled
                                      ? "text-slate-400 line-through"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {step.title}
                                </span>
                                {isOverdue(step) && (
                                  <span
                                    className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200"
                                    title={`Due ${step.due_date}`}
                                  >
                                    overdue
                                  </span>
                                )}
                                {step.unmet_requirements > 0 && !isSettled && (
                                  <span
                                    className="shrink-0 text-[10px] text-amber-600"
                                    title="This step cannot complete until its requirements are met"
                                  >
                                    {step.unmet_requirements} outstanding
                                  </span>
                                )}
                                {!step.assigned_to && !isSettled && (
                                  <span className="shrink-0 text-[10px] text-slate-400">
                                    unassigned
                                  </span>
                                )}
                                <span className="shrink-0 text-[10px] text-slate-400 w-20 text-right">
                                  {TaskStatusLabels[step.status]}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {!readOnly && run.status === "active" && (
                          <div className="px-3 py-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => void cancelRun(run.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Cancel this run
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title="Start a procedure"
        subtitle="Its steps are created as tasks against this record."
        size="lg"
      >
        {available.length === 0 ? (
          <p className="text-sm text-slate-400">
            No procedures defined for {relatedType}s yet.
          </p>
        ) : (
          <div className="space-y-2">
            {available.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!!starting}
                onClick={() => void start(p.id)}
                className="w-full px-3 py-2.5 text-left rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors disabled:opacity-50"
              >
                <span className="block text-sm font-medium text-slate-800">
                  {p.name}
                  {starting === p.id && (
                    <span className="ml-2 text-xs text-blue-600">
                      starting...
                    </span>
                  )}
                </span>
                <span className="block text-xs text-slate-500">
                  {p.step_count ?? 0} steps
                  {p.description ? ` · ${p.description}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ProceduresPanel;
