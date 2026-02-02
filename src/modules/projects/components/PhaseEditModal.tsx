"use client";

import React, { useState, useEffect } from "react";
import {
  XMarkIcon,
  CalendarIcon,
  UserCircleIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { Modal } from "@/components/ui/Modal";
import {
  ProjectPhase,
  ProjectPhaseStatus,
  ProjectPhaseStatusLabels,
} from "@/types/projects";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface PhaseEditModalProps {
  isOpen: boolean;
  phase: ProjectPhase | null;
  projectId: string;
  onClose: () => void;
  onSave: () => void;
}

// Status options for phase
const PHASE_STATUS_OPTIONS: {
  value: ProjectPhaseStatus;
  label: string;
  color: string;
}[] = [
  {
    value: "not_started",
    label: "Not Started",
    color: "bg-slate-100 text-slate-700",
  },
  {
    value: "in_progress",
    label: "In Progress",
    color: "bg-blue-100 text-blue-700",
  },
  {
    value: "on_hold",
    label: "On Hold",
    color: "bg-yellow-100 text-yellow-700",
  },
  {
    value: "completed",
    label: "Completed",
    color: "bg-green-100 text-green-700",
  },
  {
    value: "blocked",
    label: "Blocked",
    color: "bg-orange-100 text-orange-700",
  },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
];

export default function PhaseEditModal({
  isOpen,
  phase,
  projectId,
  onClose,
  onSave,
}: PhaseEditModalProps) {
  // Form state
  const [status, setStatus] = useState<ProjectPhaseStatus>("not_started");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [plannedStartDate, setPlannedStartDate] = useState<string>("");
  const [plannedEndDate, setPlannedEndDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [statusChangeNotes, setStatusChangeNotes] = useState<string>("");

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Submit state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if status changed (to require notes)
  const [originalStatus, setOriginalStatus] =
    useState<ProjectPhaseStatus>("not_started");
  const statusChanged = status !== originalStatus;

  // Load phase data when modal opens
  useEffect(() => {
    if (phase && isOpen) {
      setStatus(phase.status);
      setOriginalStatus(phase.status);
      // Load assignees - for now just the primary, later we'll load from multi-assignee table
      setAssignees(phase.assigned_to ? [phase.assigned_to] : []);
      setPlannedStartDate(phase.planned_start_date?.split("T")[0] || "");
      setPlannedEndDate(phase.planned_end_date?.split("T")[0] || "");
      setNotes(phase.notes || "");
      setStatusChangeNotes("");
      setError(null);
    }
  }, [phase, isOpen]);

  // Fetch team members
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
    }
  }, [isOpen]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phase) return;

    // VALIDATION: Cannot start without an assignee
    if (status === "in_progress" && assignees.length === 0) {
      setError(
        "Cannot start phase without an assignee. Please assign someone first."
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
        // For now, use first assignee as primary. API will handle multi-assignee separately
        assigned_to: assignees[0] || null,
        additional_assignees: assignees.slice(1),
        planned_start_date: plannedStartDate || null,
        planned_end_date: plannedEndDate || null,
        notes: notes || null,
        status_change_notes: statusChanged
          ? statusChangeNotes.trim()
          : undefined,
      };

      const response = await fetch(
        `/api/projects/${projectId}/phases/${phase.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update phase");
      }

      onSave();
      onClose();
    } catch (err) {
      console.error("Error updating phase:", err);
      setError(err instanceof Error ? err.message : "Failed to update phase");
    } finally {
      setSaving(false);
    }
  };

  if (!phase) return null;

  // Format date for display
  const formatDateDisplay = (dateStr: string | undefined) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Phase: ${phase.name}`}
      subtitle={`Phase ${phase.display_order} of project workflow`}
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
            form="phase-edit-form"
            disabled={saving || (statusChanged && !statusChangeNotes.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="phase-edit-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Status Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PHASE_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                  status === option.value
                    ? `${option.color} border-current`
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
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
              Please explain why you're changing the status from "
              {ProjectPhaseStatusLabels[originalStatus]}" to "
              {ProjectPhaseStatusLabels[status]}"
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
            Phase Assignees
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

        {/* Planned Dates */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Planned Schedule
          </label>
          <div className="grid grid-cols-2 gap-4">
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
                Planned End
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

        {/* Actual Dates - Read-only, calculated from sub-phases */}
        <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-slate-700">
              Actual Progress
            </label>
            <span className="text-xs text-slate-500">
              (auto-calculated from sub-phases)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Actual Start:</span>{" "}
              <span className="font-medium text-slate-700">
                {formatDateDisplay(phase.actual_start_date)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Actual End:</span>{" "}
              <span className="font-medium text-slate-700">
                {formatDateDisplay(phase.actual_end_date)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              Phase Notes
            </label>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <InformationCircleIcon className="w-3.5 h-3.5" />
              Local to this phase only
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this phase..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Phase Info Summary */}
        <div className="pt-4 border-t border-slate-200">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Phase Summary
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Sub-phases:</span>{" "}
              <span className="font-medium text-slate-700">
                {phase.sub_phases?.length || 0}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Progress:</span>{" "}
              <span className="font-medium text-slate-700">
                {phase.progress_percentage || 0}%
              </span>
              <span className="text-xs text-slate-400 ml-1">(auto)</span>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
