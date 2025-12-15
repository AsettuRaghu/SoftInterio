"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  StatusBadge,
  PriorityBadge,
  AssigneeSelector,
  DatePicker,
  LinkedEntity,
  TaskStatus,
  TaskPriority,
} from "./ui";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface SubTask {
  id?: string;
  title: string;
  priority: TaskPriority;
  assigned_to: string | null;
  start_date: string;
  due_date: string;
  status: TaskStatus;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentTaskId?: string;
  parentTaskTitle?: string;
  /** Pre-set linked entity (e.g., when creating from lead/project detail page) */
  defaultLinkedEntity?: {
    type: string;
    id: string;
    name: string;
  };
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSuccess,
  parentTaskId,
  parentTaskTitle,
  defaultLinkedEntity,
}: CreateTaskModalProps) {
  const { user: currentUser } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [linkedEntities, setLinkedEntities] = useState<
    {
      type: string;
      id: string;
      name: string;
    }[]
  >([]);
  const [description, setDescription] = useState("");
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
      // Reset form with default linked entity
      setTitle("");
      setStatus("todo");
      setPriority(null);
      setAssignedTo(currentUser?.id || null);
      setStartDate("");
      setDueDate("");
      // Use default linked entity if provided
      setLinkedEntities(defaultLinkedEntity ? [defaultLinkedEntity] : []);
      setDescription("");
      setSubtasks([]);
      setNewSubtaskTitle("");
      setShowSubtaskForm(false);
      setError(null);
    }
  }, [isOpen, defaultLinkedEntity, currentUser]);

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch("/api/team/members");
      if (response.ok) {
        const data = await response.json();
        // API returns { success, data } with name field, map to expected format
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
    }
  };

  const resetForm = useCallback(() => {
    setTitle("");
    setStatus("todo");
    setPriority(null);
    setAssignedTo(currentUser?.id || null);
    setStartDate("");
    setDueDate("");
    // Use default linked entity if provided
    setLinkedEntities(defaultLinkedEntity ? [defaultLinkedEntity] : []);
    setDescription("");
    setSubtasks([]);
    setNewSubtaskTitle("");
    setShowSubtaskForm(false);
    setError(null);
  }, [defaultLinkedEntity, currentUser]);

  const addSubtask = useCallback(() => {
    if (!newSubtaskTitle.trim()) return;

    setSubtasks((prev) => [
      ...prev,
      {
        title: newSubtaskTitle.trim(),
        priority: null,
        assigned_to: null,
        start_date: "",
        due_date: "",
        status: "todo",
      },
    ]);
    setNewSubtaskTitle("");
  }, [newSubtaskTitle]);

  const updateSubtask = (index: number, updates: Partial<SubTask>) => {
    setSubtasks((prev) =>
      prev.map((st, i) => (i === index ? { ...st, ...updates } : st))
    );
  };

  const removeSubtask = (index: number) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Task name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Extract related_type and related_id from linkedEntities (use first one)
      const primaryLink = linkedEntities.length > 0 ? linkedEntities[0] : null;

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status: status || "todo",
          priority: priority || null,
          assigned_to: assignedTo || null,
          start_date: startDate || null,
          due_date: dueDate || null,
          related_type: primaryLink?.type || null,
          related_id: primaryLink?.id || null,
          description: description || null,
          parent_task_id: parentTaskId || null,
          subtasks: subtasks
            .filter((st) => st.title.trim())
            .map((st) => ({
              title: st.title,
              priority: st.priority || null,
              assigned_to: st.assigned_to || null,
              start_date: st.start_date || null,
              due_date: st.due_date || null,
              status: st.status || "todo",
            })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create task");
      }

      onSuccess();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[84vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              {parentTaskTitle
                ? `Add subtask to "${parentTaskTitle}"`
                : "Create Task"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Task Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full text-xl font-semibold text-slate-900 placeholder:text-slate-300 border-none outline-none p-0 bg-transparent"
                autoFocus
                required
              />
            </div>

            {/* Quick Properties Row */}
            <div className="flex flex-wrap items-center gap-2 py-3 border-y border-slate-100">
              <StatusBadge value={status} onChange={setStatus} />
              <PriorityBadge value={priority} onChange={setPriority} />
              <AssigneeSelector
                selected={assignedTo}
                onChange={setAssignedTo}
                teamMembers={teamMembers}
              />
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Start date"
              />
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Due date"
                minDate={startDate}
              />
              <LinkedEntity
                value={linkedEntities}
                onChange={(val) =>
                  setLinkedEntities(Array.isArray(val) ? val : val ? [val] : [])
                }
                multiple
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details about this task..."
                rows={3}
                className="w-full px-4 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Subtasks ({subtasks.length})
                </label>
                <button
                  type="button"
                  onClick={() => setShowSubtaskForm(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  + Add subtask
                </button>
              </div>

              {/* Subtask List */}
              {subtasks.length > 0 && (
                <div className="space-y-2 mb-3">
                  {subtasks.map((subtask, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl group"
                    >
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={subtask.title}
                          onChange={(e) =>
                            updateSubtask(index, { title: e.target.value })
                          }
                          className="w-full text-sm font-medium text-slate-900 bg-transparent border-none outline-none p-0"
                          placeholder="Subtask name"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                        <PriorityBadge
                          value={subtask.priority}
                          onChange={(val) =>
                            updateSubtask(index, { priority: val })
                          }
                          showLabel={false}
                          size="sm"
                        />
                        <AssigneeSelector
                          selected={subtask.assigned_to}
                          onChange={(val) =>
                            updateSubtask(index, { assigned_to: val })
                          }
                          teamMembers={teamMembers}
                        />
                        <DatePicker
                          value={subtask.due_date}
                          onChange={(val) =>
                            updateSubtask(index, { due_date: val })
                          }
                          placeholder="Due"
                        />
                        <button
                          type="button"
                          onClick={() => removeSubtask(index)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Subtask Input */}
              {showSubtaskForm && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <svg
                    className="w-4 h-4 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubtask();
                      } else if (e.key === "Escape") {
                        setShowSubtaskForm(false);
                        setNewSubtaskTitle("");
                      }
                    }}
                    placeholder="Enter subtask name and press Enter"
                    className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-blue-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={addSubtask}
                    disabled={!newSubtaskTitle.trim()}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubtaskForm(false);
                      setNewSubtaskTitle("");
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </span>
              ) : (
                "Create Task"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
