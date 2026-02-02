"use client";

import React from "react";
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskStatusLabels,
  TaskPriorityLabels,
  TaskStatusColors,
  TaskPriorityColors,
} from "@/types/tasks";
import {
  ListBulletIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

export interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onTaskClick?: (task: Task) => void;
  onAddClick?: () => void;
  showHeader?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  expandable?: boolean;
  showSubtasks?: boolean;
  allowEdit?: boolean;
}

interface TaskListTask extends Task {
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    email: string;
  };
  subtasks?: TaskListTask[];
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

export default function TaskList({
  tasks,
  isLoading = false,
  error = null,
  emptyMessage = "No tasks found",
  onTaskClick,
  onAddClick,
  showHeader = true,
  headerTitle = "Tasks",
  headerSubtitle = "Manage and track your work",
  expandable = false,
  showSubtasks = false,
  allowEdit = true,
}: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = React.useState<Set<string>>(
    new Set()
  );

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const renderTaskRow = (task: TaskListTask, isSubtask = false, level = 0) => {
    const isExpanded = expandedTasks.has(task.id);
    const hasSubtasks =
      (task.subtasks && task.subtasks.length > 0) ||
      (task as any).subtask_count > 0;

    return (
      <React.Fragment key={task.id}>
        <tr
          onClick={() => allowEdit && onTaskClick?.(task)}
          className={`border-b border-slate-100 transition-colors ${
            allowEdit ? "hover:bg-slate-50/50 cursor-pointer" : ""
          } ${isSubtask ? "bg-slate-50/30" : ""}`}
        >
          {/* Task Name */}
          <td className={`px-3 py-2 ${isSubtask ? "pl-6" : ""}`}>
            <div className="flex items-center gap-2">
              {expandable && !isSubtask && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    hasSubtasks && toggleExpand(task.id);
                  }}
                  className={`w-5 h-5 flex items-center justify-center rounded transition-colors shrink-0 ${
                    hasSubtasks
                      ? "hover:bg-slate-200 text-slate-500"
                      : "text-transparent cursor-default"
                  }`}
                >
                  {hasSubtasks &&
                    (isExpanded ? (
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    ))}
                </button>
              )}
              {isSubtask && (
                <span className="w-4 h-4 flex items-center justify-center text-slate-300">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 0V8H10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {task.description}
                  </p>
                )}
              </div>
            </div>
          </td>

          {/* Status */}
          <td className="px-3 py-2">
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                TaskStatusColors[task.status as TaskStatus]?.bg ||
                "bg-slate-100"
              } ${
                TaskStatusColors[task.status as TaskStatus]?.text ||
                "text-slate-700"
              }`}
            >
              {TaskStatusLabels[task.status as TaskStatus] || task.status}
            </span>
          </td>

          {/* Priority */}
          <td className="px-3 py-2">
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                TaskPriorityColors[task.priority as TaskPriority]?.bg ||
                "bg-slate-100"
              } ${
                TaskPriorityColors[task.priority as TaskPriority]?.text ||
                "text-slate-700"
              }`}
            >
              {TaskPriorityLabels[task.priority as TaskPriority] ||
                task.priority}
            </span>
          </td>

          {/* Assignee */}
          <td className="px-3 py-2">
            {task.assigned_user ? (
              <div className="flex items-center gap-2">
                {task.assigned_user.avatar_url && (
                  <img
                    src={task.assigned_user.avatar_url}
                    alt={task.assigned_user.name}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="text-xs text-slate-600">
                  {task.assigned_user.name}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Unassigned</span>
            )}
          </td>

          {/* Due Date */}
          <td className="px-3 py-2">
            <span className="text-xs text-slate-600">
              {formatDate(task.due_date)}
            </span>
          </td>
        </tr>

        {/* Subtasks */}
        {expandable &&
          showSubtasks &&
          isExpanded &&
          task.subtasks &&
          task.subtasks.length > 0 && (
            <>
              {task.subtasks.map((subtask) =>
                renderTaskRow(subtask, true, level + 1)
              )}
            </>
          )}
      </React.Fragment>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Loading tasks...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-2">
          <svg
            className="w-5 h-5 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-red-600 mb-1">{error}</p>
      </div>
    );
  }

  // Empty state
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <ListBulletIcon className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700 mb-1">
          {emptyMessage}
        </p>
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 mt-3"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add Task
          </button>
        )}
      </div>
    );
  }

  // Tasks table
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Task
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Status
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Priority
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Assignee
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Due
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => renderTaskRow(task as TaskListTask))}
        </tbody>
      </table>
    </div>
  );
}
