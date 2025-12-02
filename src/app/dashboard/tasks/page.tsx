"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TaskPriority, TaskStatus } from "@/types/tasks";
import {
  TaskPriorityLabels,
  TaskPriorityColors,
  TaskStatusLabels,
  TaskStatusColors,
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
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_email?: string;
  assigned_to_avatar?: string;
  related_type?: string;
  related_id?: string;
  related_name?: string;
  subtask_count: number;
  completed_subtask_count: number;
  created_at: string;
  tags?: Array<{ id: string; name: string; color: string }>;
}

// Icons
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

const SearchIcon = ({ className }: { className?: string }) => (
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
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
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
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      total: tasks.length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      overdue: tasks.filter((t) => {
        if (!t.due_date || t.status === "completed" || t.status === "cancelled")
          return false;
        const dueDate = new Date(t.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
      }).length,
    };
  }, [tasks]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("parent_only", "true");
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch tasks");
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter, searchQuery]);

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
    fetchTasks();
    fetchTeamMembers();
  }, [fetchTasks, fetchTeamMembers]);

  // Update task field
  const updateTask = async (taskId: string, field: string, value: unknown) => {
    try {
      setSavingTaskId(taskId);

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

      // Update local state
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...data.task,
                assigned_to_name: data.task.assigned_to_name,
                assigned_to_avatar: data.task.assigned_to_avatar,
              }
            : task
        )
      );
    } catch (err) {
      console.error("Error updating task:", err);
      alert(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setSavingTaskId(null);
    }
  };

  // Filter tasks locally
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.task_number?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  const statusOptions: TaskStatus[] = [
    "todo",
    "in_progress",
    "on_hold",
    "completed",
    "cancelled",
  ];
  const priorityOptions: TaskPriority[] = ["critical", "high", "medium", "low"];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
              <Link href="/dashboard" className="hover:text-blue-600">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-700">Tasks</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900">Tasks</h1>
          </div>

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-2 pl-6 border-l border-slate-200">
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
              <span className="font-medium">{stats.total}</span> Total
            </span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
              <span className="font-medium">{stats.inProgress}</span> In
              Progress
            </span>
            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">
              <span className="font-medium">{stats.completed}</span> Completed
            </span>
            {stats.overdue > 0 && (
              <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full">
                <span className="font-medium">{stats.overdue}</span> Overdue
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/tasks/templates"
            className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Templates
          </Link>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <PlusIcon className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {statusOptions.slice(0, 3).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === status
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {TaskStatusLabels[status]}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {priorityOptions.slice(0, 2).map((priority) => (
            <button
              key={priority}
              onClick={() =>
                setPriorityFilter(
                  priorityFilter === priority ? "all" : priority
                )
              }
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                priorityFilter === priority
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {TaskPriorityLabels[priority]}
            </button>
          ))}
        </div>

        <div className="flex-1 max-w-sm ml-auto">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Inline Edit Hint */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          Click on <strong>Status</strong>, <strong>Priority</strong>,{" "}
          <strong>Assignee</strong>, or <strong>Due Date</strong> to edit
          inline. Click the task title to view details.
        </span>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500">Loading tasks...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg
              className="w-12 h-12 mb-3 text-red-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm font-medium text-red-600 mb-1">{error}</p>
            <button
              onClick={fetchTasks}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <svg
              className="w-16 h-16 mb-4 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-base font-medium mb-1">No tasks found</p>
            <p className="text-sm text-slate-400 mb-4">
              {searchQuery
                ? "Try adjusting your search"
                : "Create your first task to get started"}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Create Task
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Task
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Assignee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Subtasks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.map((task) => {
                const isSaving = savingTaskId === task.id;
                return (
                  <tr
                    key={task.id}
                    onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      isSaving ? "opacity-70" : ""
                    }`}
                  >
                    {/* Task Title */}
                    <td className="px-4 py-3">
                      <div className="group">
                        <div className="flex items-center gap-2">
                          {task.task_number && (
                            <span className="text-xs text-slate-400 font-mono">
                              {task.task_number}
                            </span>
                          )}
                          <p className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                            {task.title}
                          </p>
                        </div>
                        {task.related_type && task.related_name && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Linked to: {task.related_name}
                          </p>
                        )}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {task.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                className="px-1.5 py-0.5 text-xs rounded"
                                style={{
                                  backgroundColor: `${tag.color}20`,
                                  color: tag.color,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <InlineDropdown
                        value={task.status}
                        options={statusOptions}
                        labels={TaskStatusLabels}
                        colors={TaskStatusColors}
                        onChange={(value) =>
                          updateTask(task.id, "status", value)
                        }
                        disabled={isSaving}
                      />
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3">
                      <InlineDropdown
                        value={task.priority}
                        options={priorityOptions}
                        labels={TaskPriorityLabels}
                        colors={TaskPriorityColors}
                        onChange={(value) =>
                          updateTask(task.id, "priority", value)
                        }
                        disabled={isSaving}
                      />
                    </td>

                    {/* Assignee */}
                    <td className="px-4 py-3">
                      <InlineAssignee
                        value={task.assigned_to}
                        assigneeName={task.assigned_to_name}
                        assigneeAvatar={task.assigned_to_avatar}
                        teamMembers={teamMembers}
                        onChange={(value) =>
                          updateTask(task.id, "assigned_to", value)
                        }
                        disabled={isSaving}
                      />
                    </td>

                    {/* Due Date */}
                    <td className="px-4 py-3">
                      <InlineDatePicker
                        value={task.due_date}
                        onChange={(value) =>
                          updateTask(task.id, "due_date", value)
                        }
                        disabled={isSaving}
                      />
                    </td>

                    {/* Subtasks */}
                    <td className="px-4 py-3 text-center">
                      {task.subtask_count > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                          {task.completed_subtask_count}/{task.subtask_count}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchTasks();
          setIsCreateModalOpen(false);
        }}
      />
    </div>
  );
}
