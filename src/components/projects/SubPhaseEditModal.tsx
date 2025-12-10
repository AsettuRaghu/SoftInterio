"use client";

import React, { useState, useEffect } from "react";
import {
  XMarkIcon,
  CalendarIcon,
  UserCircleIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  CheckCircleIcon,
  PauseIcon,
  ForwardIcon,
  InformationCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { Modal } from "@/components/ui/Modal";
import {
  ProjectSubPhase,
  ProjectSubPhaseStatus,
  ProjectSubPhaseStatusLabels,
} from "@/types/projects";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface StatusLog {
  id: string;
  previous_status: string | null;
  new_status: string;
  notes: string;
  changed_at: string;
  changed_by_user?: { id: string; name: string };
}

interface SubPhaseEditModalProps {
  isOpen: boolean;
  subPhase: ProjectSubPhase | null;
  phaseId: string;
  phaseName?: string;
  projectId: string;
  onClose: () => void;
  onSave: () => void;
}

// Status options for sub-phase (now includes on_hold)
const SUB_PHASE_STATUS_OPTIONS: {
  value: ProjectSubPhaseStatus;
  label: string;
  color: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "not_started",
    label: "Not Started",
    color: "bg-slate-100 text-slate-700",
    icon: null,
  },
  {
    value: "in_progress",
    label: "In Progress",
    color: "bg-blue-100 text-blue-700",
    icon: <PlayIcon className="w-4 h-4" />,
  },
  {
    value: "on_hold",
    label: "On Hold",
    color: "bg-yellow-100 text-yellow-700",
    icon: <PauseIcon className="w-4 h-4" />,
  },
  {
    value: "completed",
    label: "Completed",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircleIcon className="w-4 h-4" />,
  },
  {
    value: "skipped",
    label: "Skipped",
    color: "bg-slate-100 text-slate-500",
    icon: <ForwardIcon className="w-4 h-4" />,
  },
];

export default function SubPhaseEditModal({
  isOpen,
  subPhase,
  phaseId,
  phaseName,
  projectId,
  onClose,
  onSave,
}: SubPhaseEditModalProps) {
  // Form state
  const [status, setStatus] = useState<ProjectSubPhaseStatus>("not_started");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [plannedStartDate, setPlannedStartDate] = useState<string>("");
  const [plannedEndDate, setPlannedEndDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [statusChangeNotes, setStatusChangeNotes] = useState<string>("");

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Status logs (audit trail)
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [showStatusLogs, setShowStatusLogs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Submit state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if status changed (to require notes)
  const [originalStatus, setOriginalStatus] =
    useState<ProjectSubPhaseStatus>("not_started");
  const statusChanged = status !== originalStatus;

  // Load sub-phase data when modal opens
  useEffect(() => {
    if (subPhase && isOpen) {
      setStatus(subPhase.status);
      setOriginalStatus(subPhase.status);
      // Load primary + additional assignees
      const allAssignees = subPhase.assigned_to ? [subPhase.assigned_to] : [];
      // TODO: Load additional assignees from the multi-assignee table when API supports it
      setAssignees(allAssignees);
      setPlannedStartDate(subPhase.planned_start_date?.split("T")[0] || "");
      setPlannedEndDate(
        subPhase.planned_end_date?.split("T")[0] ||
          subPhase.due_date?.split("T")[0] ||
          ""
      );
      setNotes(subPhase.notes || "");
      setStatusChangeNotes("");
      setError(null);
    }
  }, [subPhase, isOpen]);

  // Fetch team members
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
    }
  }, [isOpen]);

  // Fetch status logs when expanded
  useEffect(() => {
    if (isOpen && showStatusLogs && subPhase) {
      fetchStatusLogs();
    }
  }, [isOpen, showStatusLogs, subPhase?.id]);

  const fetchTeamMembers = async () => {
    setLoadingMembers(true);
    try {
      const response = await fetch("/api/team/members");
      if (response.ok) {
        const data = await response.json();
        const members = (data.data || []).map((m: any) => ({
          id: m.id,
          full_name: m.name || m.email,
          email: m.email,
          avatar_url: m.avatar_url,
        }));
        setTeamMembers(members);
      }
    } catch (err) {
      console.error("Error fetching team members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchStatusLogs = async () => {
    if (!subPhase) return;
    setLoadingLogs(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhase.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setStatusLogs(data.subPhase?.status_logs || []);
      }
    } catch (err) {
      console.error("Error fetching status logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleAddAssignee = (memberId: string) => {
    if (memberId && !assignees.includes(memberId)) {
      setAssignees([...assignees, memberId]);
    }
  };

  const handleRemoveAssignee = (memberId: string) => {
    setAssignees(assignees.filter((id) => id !== memberId));
  };

  const getAvailableMembers = () => {
    return teamMembers.filter((m) => !assignees.includes(m.id));
  };

  const getMemberById = (id: string) => {
    return teamMembers.find((m) => m.id === id);
  };

  // Quick action handlers
  const handleStart = () => {
    if (status === "not_started") {
      // Check if assignee is set
      if (assignees.length === 0) {
        setError("Please assign someone before starting this sub-phase");
        return;
      }
      setStatus("in_progress");
      setStatusChangeNotes("Starting work on this sub-phase");
      setError(null);
    }
  };

  const handleComplete = () => {
    if (status === "in_progress" || status === "on_hold") {
      setStatus("completed");
      setStatusChangeNotes("Work completed");
    }
  };

  const handlePause = () => {
    if (status === "in_progress") {
      setStatus("on_hold");
      // Don't auto-fill notes, let user explain why they're pausing
    }
  };

  const handleResume = () => {
    if (status === "on_hold") {
      setStatus("in_progress");
      setStatusChangeNotes("Resuming work");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subPhase) return;

    // VALIDATION: Cannot start without an assignee
    if (status === "in_progress" && assignees.length === 0) {
      setError(
        "Cannot start sub-phase without an assignee. Please assign someone first."
      );
      return;
    }

    // Validate status change notes
    if (statusChanged && !statusChangeNotes.trim()) {
      setError("Please provide notes explaining the status change");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Prepare update payload
      const updates: Record<string, any> = {
        status,
        assigned_to: assignees[0] || null,
        additional_assignees: assignees.slice(1),
        planned_start_date: plannedStartDate || null,
        planned_end_date: plannedEndDate || null,
        due_date: plannedEndDate || null, // Keep due_date in sync for backwards compatibility
        notes: notes || null,
      };

      // If status changed, append status change notes to sub-phase notes
      if (statusChanged && statusChangeNotes.trim()) {
        // Send status_change_notes for logging to status_logs table
        updates.status_change_notes = statusChangeNotes.trim();
      }

      // Set actual dates based on status transitions
      if (status === "in_progress" && originalStatus === "not_started") {
        updates.actual_start_date = new Date().toISOString().split("T")[0];
      }
      if (status === "completed" && originalStatus !== "completed") {
        updates.actual_end_date = new Date().toISOString().split("T")[0];
        updates.completed_at = new Date().toISOString();
      }

      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/sub-phases/${subPhase.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update sub-phase");
      }

      onSave();
      onClose();
    } catch (err) {
      console.error("Error updating sub-phase:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update sub-phase"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!subPhase) return null;

  // Format date for display
  const formatDateDisplay = (dateStr: string | undefined) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Determine which quick actions to show based on current status
  const showStartButton = status === "not_started";
  const showCompleteButton = status === "in_progress" || status === "on_hold";
  const showPauseButton = status === "in_progress";
  const showResumeButton = status === "on_hold";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={subPhase.name}
      subtitle={phaseName ? `Part of ${phaseName}` : undefined}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="subphase-edit-form"
            disabled={saving || (statusChanged && !statusChangeNotes.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <form
        id="subphase-edit-form"
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Quick Actions - Prominent buttons at top */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Quick Actions
          </label>
          <div className="flex flex-wrap gap-2">
            {showStartButton && (
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlayIcon className="w-4 h-4" />
                Start Work
              </button>
            )}
            {showPauseButton && (
              <button
                type="button"
                onClick={handlePause}
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <PauseIcon className="w-4 h-4" />
                Put On Hold
              </button>
            )}
            {showResumeButton && (
              <button
                type="button"
                onClick={handleResume}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlayIcon className="w-4 h-4" />
                Resume Work
              </button>
            )}
            {showCompleteButton && (
              <button
                type="button"
                onClick={handleComplete}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Mark Complete
              </button>
            )}
            {status === "completed" && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                <CheckCircleIcon className="w-4 h-4" />
                Completed
              </span>
            )}
            {status === "skipped" && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 text-sm font-medium rounded-lg">
                <ForwardIcon className="w-4 h-4" />
                Skipped
              </span>
            )}
          </div>
        </div>

        {/* Status Selection - Advanced */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <div className="grid grid-cols-5 gap-2">
            {SUB_PHASE_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`px-2 py-2 text-xs font-medium rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                  status === option.value
                    ? `${option.color} border-current`
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Change Notes - Required when status changes */}
        {statusChanged && (
          <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700">
              <ExclamationTriangleIcon className="w-4 h-4" />
              <label className="text-sm font-medium">
                Status Change Notes <span className="text-red-500">*</span>
              </label>
            </div>
            <p className="text-xs text-amber-600 mb-2">
              Please explain why you're changing from "
              {ProjectSubPhaseStatusLabels[originalStatus]}" to "
              {ProjectSubPhaseStatusLabels[status]}"
            </p>
            <textarea
              value={statusChangeNotes}
              onChange={(e) => setStatusChangeNotes(e.target.value)}
              placeholder="Enter reason for status change..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>
        )}

        {/* Assignees - Multi-select */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <UsersIcon className="w-4 h-4" />
            Assignees
          </label>

          {/* Current assignees */}
          {assignees.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {assignees.map((id) => {
                const member = getMemberById(id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    <UserCircleIcon className="w-4 h-4" />
                    <span>{member?.full_name || "Unknown"}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAssignee(id)}
                      className="p-0.5 hover:bg-blue-100 rounded-full"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Add assignee dropdown */}
          {getAvailableMembers().length > 0 ? (
            <select
              onChange={(e) => {
                handleAddAssignee(e.target.value);
                e.target.value = "";
              }}
              disabled={loadingMembers}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
              defaultValue=""
            >
              <option value="" disabled>
                {assignees.length === 0
                  ? "Select team member..."
                  : "Add another team member..."}
              </option>
              {getAvailableMembers().map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name} ({member.email})
                </option>
              ))}
            </select>
          ) : assignees.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              No team members available
            </p>
          ) : (
            <p className="text-xs text-slate-500">All team members assigned</p>
          )}
        </div>

        {/* Dates Section */}
        <div className="grid grid-cols-2 gap-4">
          {/* Planned Dates */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Planned Schedule
            </label>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="block text-xs text-slate-500">
                  Planned Start
                </label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={plannedStartDate}
                    onChange={(e) => setPlannedStartDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-500">
                  Planned End / Due Date
                </label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={plannedEndDate}
                    onChange={(e) => setPlannedEndDate(e.target.value)}
                    min={plannedStartDate || undefined}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actual Dates - Read-only */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-slate-700">
                Actual Progress
              </label>
              <span className="text-xs text-slate-400">(auto)</span>
            </div>
            <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Started:</span>
                <span className="font-medium text-slate-700">
                  {formatDateDisplay(subPhase.actual_start_date)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Completed:</span>
                <span
                  className={`font-medium ${
                    subPhase.actual_end_date
                      ? "text-green-600"
                      : "text-slate-700"
                  }`}
                >
                  {formatDateDisplay(subPhase.actual_end_date)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              Notes
            </label>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <InformationCircleIcon className="w-3.5 h-3.5" />
              Local to this sub-phase
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this sub-phase..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Sub-Phase Info Summary */}
        <div className="pt-4 border-t border-slate-200">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Sub-Phase Info
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Progress:</span>{" "}
              <span className="font-medium text-slate-700">
                {subPhase.progress_percentage || 0}%
              </span>
            </div>
            <div>
              <span className="text-slate-500">Checklist:</span>{" "}
              <span className="font-medium text-slate-700">
                {subPhase.checklist_items?.filter((i) => i.is_completed)
                  .length || 0}
                /{subPhase.checklist_items?.length || 0} items
              </span>
            </div>
          </div>
        </div>

        {/* Status Change History (Audit Trail) */}
        <div className="pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowStatusLogs(!showStatusLogs)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Status Change History
              </h4>
            </div>
            {showStatusLogs ? (
              <ChevronUpIcon className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showStatusLogs && (
            <div className="mt-3 space-y-2">
              {loadingLogs ? (
                <div className="text-center py-4">
                  <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full mx-auto"></div>
                  <p className="text-xs text-slate-500 mt-2">
                    Loading history...
                  </p>
                </div>
              ) : statusLogs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-lg">
                  No status changes recorded yet
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {statusLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600">
                            {log.previous_status ? (
                              <>
                                <span className="text-slate-400">
                                  {ProjectSubPhaseStatusLabels[
                                    log.previous_status as ProjectSubPhaseStatus
                                  ] || log.previous_status}
                                </span>
                                <span className="mx-1 text-slate-400">→</span>
                                <span
                                  className={
                                    log.new_status === "completed"
                                      ? "text-green-600"
                                      : log.new_status === "in_progress"
                                      ? "text-blue-600"
                                      : log.new_status === "on_hold"
                                      ? "text-yellow-600"
                                      : "text-slate-600"
                                  }
                                >
                                  {ProjectSubPhaseStatusLabels[
                                    log.new_status as ProjectSubPhaseStatus
                                  ] || log.new_status}
                                </span>
                              </>
                            ) : (
                              <span
                                className={
                                  log.new_status === "completed"
                                    ? "text-green-600"
                                    : log.new_status === "in_progress"
                                    ? "text-blue-600"
                                    : log.new_status === "on_hold"
                                    ? "text-yellow-600"
                                    : "text-slate-600"
                                }
                              >
                                Set to{" "}
                                {ProjectSubPhaseStatusLabels[
                                  log.new_status as ProjectSubPhaseStatus
                                ] || log.new_status}
                              </span>
                            )}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(log.changed_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{log.notes}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        by {log.changed_by_user?.name || "Unknown"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
