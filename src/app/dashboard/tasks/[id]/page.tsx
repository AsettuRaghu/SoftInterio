"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import type { TaskPriority, TaskStatus, TaskRelatedType } from "@/types/tasks";
import {
  TaskPriorityLabels,
  TaskPriorityColors,
  TaskStatusLabels,
  TaskStatusColors,
  TaskRelatedTypeLabels,
} from "@/types/tasks";
import {
  CreateTaskModal,
  InlineDropdown,
  InlineAssignee,
  InlineDatePicker,
  type TeamMember,
} from "@/components/tasks";

// Types
interface Task {
  id: string;
  task_number: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_email?: string;
  assigned_to_avatar?: string;
  related_type?: TaskRelatedType;
  related_id?: string;
  related_name?: string;
  parent_task_id?: string;
  template_id?: string;
  template_name?: string;
  subtask_count: number;
  completed_subtask_count: number;
  created_at: string;
  updated_at: string;
  tags?: Array<{ id: string; name: string; color: string }>;
}

interface Subtask {
  id: string;
  task_number: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_avatar?: string;
}

// Icons
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15l7-7 7 7"
    />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(true);
  const [isCreateSubtaskModalOpen, setIsCreateSubtaskModalOpen] =
    useState(false);

  // Editable fields
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEstimatedHours, setEditEstimatedHours] = useState("");
  const [editActualHours, setEditActualHours] = useState("");

  const statusOptions: TaskStatus[] = [
    "todo",
    "in_progress",
    "on_hold",
    "completed",
    "cancelled",
  ];
  const priorityOptions: TaskPriority[] = ["critical", "high", "medium", "low"];

  // Fetch task details
  const fetchTask = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch task");
      }

      const data = await response.json();
      setTask(data.task);
      setSubtasks(data.subtasks || []);
      setEditTitle(data.task.title);
      setEditDescription(data.task.description || "");
      setEditEstimatedHours(data.task.estimated_hours?.toString() || "");
      setEditActualHours(data.task.actual_hours?.toString() || "");
    } catch (err) {
      console.error("Error fetching task:", err);
      setError(err instanceof Error ? err.message : "Failed to load task");
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/team/members");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.data || data.members || []);
      }
    } catch (err) {
      console.error("Error fetching team members:", err);
    }
  }, []);

  useEffect(() => {
    fetchTask();
    fetchTeamMembers();
  }, [fetchTask, fetchTeamMembers]);

  // Update task field
  const updateTask = async (field: string, value: unknown) => {
    if (!task) return;

    try {
      setIsSaving(true);

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update task");
      }

      const data = await response.json();
      setTask((prev) => (prev ? { ...prev, ...data.task } : null));
      setEditingField(null);
    } catch (err) {
      console.error("Error updating task:", err);
      alert(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setIsSaving(false);
    }
  };

  // Update subtask
  const updateSubtask = async (
    subtaskId: string,
    field: string,
    value: unknown
  ) => {
    try {
      const response = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update subtask");
      }

      const data = await response.json();
      setSubtasks((prev) =>
        prev.map((st) => (st.id === subtaskId ? { ...st, ...data.task } : st))
      );
    } catch (err) {
      console.error("Error updating subtask:", err);
      alert(err instanceof Error ? err.message : "Failed to update subtask");
    }
  };

  // Delete task
  const deleteTask = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this task? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete task");
      }

      router.push("/dashboard/tasks");
    } catch (err) {
      console.error("Error deleting task:", err);
      alert(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Loading task...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96">
        <p className="text-sm text-red-600 mb-4">{error || "Task not found"}</p>
        <Link
          href="/dashboard/tasks"
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          Back to Tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/tasks")}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <Link href="/dashboard" className="hover:text-blue-600">
                Dashboard
              </Link>
              <span>/</span>
              <Link href="/dashboard/tasks" className="hover:text-blue-600">
                Tasks
              </Link>
              <span>/</span>
              <span className="text-slate-700">{task.task_number}</span>
            </div>
            <div className="flex items-center gap-3">
              {editingField === "title" ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => {
                    if (editTitle.trim() && editTitle !== task.title) {
                      updateTask("title", editTitle.trim());
                    } else {
                      setEditTitle(task.title);
                      setEditingField(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (editTitle.trim() && editTitle !== task.title) {
                        updateTask("title", editTitle.trim());
                      } else {
                        setEditTitle(task.title);
                        setEditingField(null);
                      }
                    }
                    if (e.key === "Escape") {
                      setEditTitle(task.title);
                      setEditingField(null);
                    }
                  }}
                  autoFocus
                  className="text-lg font-semibold text-slate-900 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                />
              ) : (
                <h1
                  onClick={() => setEditingField("title")}
                  className="text-lg font-semibold text-slate-900 cursor-pointer hover:text-blue-600"
                >
                  {task.title}
                </h1>
              )}
              <InlineDropdown
                value={task.status}
                options={statusOptions}
                labels={TaskStatusLabels}
                colors={TaskStatusColors}
                onChange={(value) => updateTask("status", value)}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={deleteTask}
            className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Main Content */}
        <div className="col-span-3 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">
              Description
            </h3>
            {editingField === "description" ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                onBlur={() => {
                  if (editDescription !== (task.description || "")) {
                    updateTask("description", editDescription || null);
                  } else {
                    setEditingField(null);
                  }
                }}
                rows={4}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Add a description..."
              />
            ) : (
              <div
                onClick={() => setEditingField("description")}
                className="text-sm text-slate-600 cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 min-h-20"
              >
                {task.description || (
                  <span className="text-slate-400 italic">
                    Click to add description...
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Subtasks Section */}
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="w-full px-4 py-3 flex items-center justify-between border-b border-slate-200">
              <button
                onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
                className="flex items-center gap-2 hover:text-blue-600 transition-colors"
              >
                <h3 className="text-sm font-medium text-slate-700">Subtasks</h3>
                {subtasks.length > 0 && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                    {subtasks.filter((s) => s.status === "completed").length}/
                    {subtasks.length}
                  </span>
                )}
                {isSubtasksExpanded ? (
                  <ChevronUpIcon className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 text-slate-500" />
                )}
              </button>
              <button
                onClick={() => setIsCreateSubtaskModalOpen(true)}
                className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>

            {isSubtasksExpanded && (
              <div className="divide-y divide-slate-100">
                {subtasks.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    No subtasks yet.{" "}
                    <button
                      onClick={() => setIsCreateSubtaskModalOpen(true)}
                      className="text-blue-600 hover:underline"
                    >
                      Add one
                    </button>
                  </div>
                ) : (
                  subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/dashboard/tasks/${subtask.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-blue-600"
                        >
                          {subtask.title}
                        </Link>
                        {subtask.task_number && (
                          <span className="ml-2 text-xs text-slate-400">
                            {subtask.task_number}
                          </span>
                        )}
                      </div>
                      <InlineDropdown
                        value={subtask.status}
                        options={statusOptions}
                        labels={TaskStatusLabels}
                        colors={TaskStatusColors}
                        onChange={(value) =>
                          updateSubtask(subtask.id, "status", value)
                        }
                      />
                      <InlineDropdown
                        value={subtask.priority}
                        options={priorityOptions}
                        labels={TaskPriorityLabels}
                        colors={TaskPriorityColors}
                        onChange={(value) =>
                          updateSubtask(subtask.id, "priority", value)
                        }
                      />
                      <InlineAssignee
                        value={subtask.assigned_to}
                        assigneeName={subtask.assigned_to_name}
                        assigneeAvatar={subtask.assigned_to_avatar}
                        teamMembers={teamMembers}
                        onChange={(value) =>
                          updateSubtask(subtask.id, "assigned_to", value)
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-2 space-y-4">
          {/* Details Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Details</h3>

            {/* Priority */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Priority</span>
              <InlineDropdown
                value={task.priority}
                options={priorityOptions}
                labels={TaskPriorityLabels}
                colors={TaskPriorityColors}
                onChange={(value) => updateTask("priority", value)}
                disabled={isSaving}
              />
            </div>

            {/* Assignee */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Assignee</span>
              <InlineAssignee
                value={task.assigned_to}
                assigneeName={task.assigned_to_name}
                assigneeAvatar={task.assigned_to_avatar}
                teamMembers={teamMembers}
                onChange={(value) => updateTask("assigned_to", value)}
                disabled={isSaving}
              />
            </div>

            {/* Start Date */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Start Date</span>
              <InlineDatePicker
                value={task.start_date}
                onChange={(value) => updateTask("start_date", value)}
                disabled={isSaving}
                placeholder="Not set"
              />
            </div>

            {/* Due Date */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Due Date</span>
              <InlineDatePicker
                value={task.due_date}
                onChange={(value) => updateTask("due_date", value)}
                disabled={isSaving}
              />
            </div>

            {/* Estimated Hours */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Estimated Hours</span>
              {editingField === "estimated_hours" ? (
                <input
                  type="number"
                  value={editEstimatedHours}
                  onChange={(e) => setEditEstimatedHours(e.target.value)}
                  onBlur={() => {
                    const newValue = editEstimatedHours
                      ? parseFloat(editEstimatedHours)
                      : null;
                    if (newValue !== task.estimated_hours) {
                      updateTask("estimated_hours", newValue);
                    } else {
                      setEditingField(null);
                    }
                  }}
                  min="0"
                  step="0.5"
                  autoFocus
                  className="w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <button
                  onClick={() => setEditingField("estimated_hours")}
                  className="text-sm text-slate-700 hover:text-blue-600 flex items-center gap-1"
                >
                  <ClockIcon className="w-4 h-4 text-slate-400" />
                  {task.estimated_hours
                    ? `${task.estimated_hours}h`
                    : "Not set"}
                </button>
              )}
            </div>

            {/* Actual Hours */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Actual Hours</span>
              {editingField === "actual_hours" ? (
                <input
                  type="number"
                  value={editActualHours}
                  onChange={(e) => setEditActualHours(e.target.value)}
                  onBlur={() => {
                    const newValue = editActualHours
                      ? parseFloat(editActualHours)
                      : null;
                    if (newValue !== task.actual_hours) {
                      updateTask("actual_hours", newValue);
                    } else {
                      setEditingField(null);
                    }
                  }}
                  min="0"
                  step="0.5"
                  autoFocus
                  className="w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <button
                  onClick={() => setEditingField("actual_hours")}
                  className="text-sm text-slate-700 hover:text-blue-600 flex items-center gap-1"
                >
                  <ClockIcon className="w-4 h-4 text-slate-400" />
                  {task.actual_hours ? `${task.actual_hours}h` : "Not set"}
                </button>
              )}
            </div>
          </div>

          {/* Linked Entity */}
          {task.related_type && task.related_id && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Linked To
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <LinkIcon className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">
                  {TaskRelatedTypeLabels[task.related_type]}:
                </span>
                <span className="font-medium text-slate-900">
                  {task.related_name || task.related_id}
                </span>
              </div>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-2 py-1 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Info</h3>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{formatDate(task.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{formatDate(task.updated_at)}</span>
              </div>
              {task.template_name && (
                <div className="flex justify-between">
                  <span>Template</span>
                  <span>{task.template_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Subtask Modal */}
      <CreateTaskModal
        isOpen={isCreateSubtaskModalOpen}
        onClose={() => setIsCreateSubtaskModalOpen(false)}
        onSuccess={() => {
          fetchTask();
          setIsCreateSubtaskModalOpen(false);
        }}
        parentTaskId={task.id}
        parentTaskTitle={task.title}
      />
    </div>
  );
}
