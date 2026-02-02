"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
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
  StatusBadge,
  PriorityBadge,
  DatePicker,
  AssigneeSelector,
  LinkedEntity,
  StatusFilterDropdown,
} from "./ui";
import { SearchBox } from "@/components/ui/SearchBox";
import {
  ListBulletIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChatBubbleLeftIcon,
  PencilSquareIcon,
  Bars3BottomLeftIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface TaskListInteractiveProps {
  tasks: Task[];
  teamMembers?: TeamMember[];
  currentUserId?: string;
  isLoading?: boolean;
  error?: string | null;
  onTaskClick?: (task: Task) => void;
  onAddClick?: () => void;
  onTaskUpdate?: (taskId: string, field: string, value: any) => Promise<void>;
  showHeader?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  allowEdit?: boolean;
  allowInlineEdit?: boolean;
}

interface TaskWithUser extends Task {
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    email: string;
  };
  subtasks?: TaskWithUser[];
  subtask_count?: number;
  completed_subtask_count?: number;
  related_name?: string;
}

type TabType = "my-tasks" | "assigned-by-me" | "all-tasks";

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

export default function TaskListInteractive({
  tasks,
  teamMembers = [],
  currentUserId,
  isLoading = false,
  error = null,
  onTaskClick,
  onAddClick,
  onTaskUpdate,
  showHeader = true,
  headerTitle = "Tasks",
  headerSubtitle = "Manage and track your work",
  allowEdit = true,
  allowInlineEdit = true,
}: TaskListInteractiveProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>("my-tasks");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [notesPopoverTask, setNotesPopoverTask] = useState<TaskWithUser | null>(
    null
  );
  const [notesText, setNotesText] = useState("");
  const [notesPopoverPosition, setNotesPopoverPosition] = useState({
    top: 0,
    left: 0,
  });
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [inlineSubtaskFor, setInlineSubtaskFor] = useState<string | null>(null);
  const [inlineSubtaskTitle, setInlineSubtaskTitle] = useState("");

  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inlineSubtaskInputRef = useRef<HTMLInputElement>(null);

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleTaskUpdate = async (
    taskId: string,
    field: string,
    value: any
  ) => {
    try {
      await onTaskUpdate?.(taskId, field, value);
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  const openNotesPopover = (task: TaskWithUser, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setNotesPopoverPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 320),
    });
    setNotesPopoverTask(task);
    setNotesText(task.description || "");
    setTimeout(() => notesInputRef.current?.focus(), 50);
  };

  const saveNotes = async () => {
    if (!notesPopoverTask) return;
    setIsSavingNotes(true);
    await handleTaskUpdate(notesPopoverTask.id, "description", notesText);
    setIsSavingNotes(false);
    setNotesPopoverTask(null);
  };

  // Focus inline subtask input when shown
  React.useEffect(() => {
    if (inlineSubtaskFor && inlineSubtaskInputRef.current) {
      inlineSubtaskInputRef.current.focus();
    }
  }, [inlineSubtaskFor]);

  const handleInlineSubtaskSubmit = async (parentTaskId: string) => {
    const title = inlineSubtaskTitle.trim();
    if (!title) {
      setInlineSubtaskFor(null);
      setInlineSubtaskTitle("");
      return;
    }

    setInlineSubtaskFor(null);
    setInlineSubtaskTitle("");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status: "todo",
          priority: "medium",
          parent_task_id: parentTaskId,
        }),
      });

      if (response.ok) {
        // Trigger refresh to reload tasks with new subtask
        await onTaskUpdate?.(parentTaskId, "refresh", true);
      }
    } catch (err) {
      console.error("Error creating subtask:", err);
    }
  };

  // Filter tasks based on tab and search
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigned_to === currentUserId),
    [tasks, currentUserId]
  );

  const assignedByMe = useMemo(
    () => tasks.filter((t) => t.created_by === currentUserId),
    [tasks, currentUserId]
  );

  const filteredTasks = useMemo(() => {
    let filtered =
      activeTab === "my-tasks"
        ? myTasks
        : activeTab === "assigned-by-me"
        ? assignedByMe
        : tasks;

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((t) => selectedStatuses.includes(t.status));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activeTab, tasks, myTasks, assignedByMe, selectedStatuses, searchQuery]);

  const TaskRow = ({
    task,
    isSubtask = false,
  }: {
    task: TaskWithUser;
    isSubtask?: boolean;
  }) => {
    const isExpanded = expandedTasks.has(task.id);
    const hasSubtasks = (task.subtask_count || 0) > 0;
    const isEditingTitle =
      editingTaskId === task.id && editingField === "title";

    return (
      <React.Fragment key={task.id}>
        <tr
          className={`group border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
            isSubtask ? "bg-slate-50/30" : ""
          }`}
        >
          {/* Task Name */}
          <td className="px-3 py-2">
            <div className="flex items-center gap-1">
              {!isSubtask && (
                <button
                  onClick={() => hasSubtasks && toggleExpand(task.id)}
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
                <span className="w-4 h-4 flex items-center justify-center text-slate-300 pl-4">
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
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => {
                    if (editingTitle.trim()) {
                      handleTaskUpdate(task.id, "title", editingTitle.trim());
                    }
                    setEditingTaskId(null);
                    setEditingField(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (editingTitle.trim()) {
                        handleTaskUpdate(task.id, "title", editingTitle.trim());
                      }
                      setEditingTaskId(null);
                      setEditingField(null);
                    } else if (e.key === "Escape") {
                      setEditingTaskId(null);
                      setEditingField(null);
                    }
                  }}
                  className="flex-1 text-xs font-medium text-slate-800 bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingTaskId(task.id);
                    setEditingField("title");
                    setEditingTitle(task.title);
                  }}
                  className="text-left flex items-center gap-1.5 group/title"
                >
                  <span className="text-xs font-medium text-slate-800 hover:text-blue-600 transition-colors">
                    {task.title}
                  </span>
                  {hasSubtasks && !isSubtask && (
                    <span className="flex items-center gap-0.5 text-[9px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded shrink-0">
                      <ListBulletIcon className="w-2.5 h-2.5" />
                      {task.completed_subtask_count || 0}/{task.subtask_count}
                    </span>
                  )}
                </button>
              )}

              {/* Add Subtask Button - Only for parent tasks, shows on hover */}
              {!isSubtask && !isEditingTitle && allowInlineEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInlineSubtaskFor(task.id);
                    if (!isExpanded) {
                      toggleExpand(task.id);
                    }
                  }}
                  className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-all opacity-0 group-hover:opacity-100"
                  title="Add subtask"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Edit button - opens Edit Task Modal */}
              {!isEditingTitle && allowInlineEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick?.(task);
                  }}
                  className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-all opacity-0 group-hover:opacity-100"
                  title="Edit task details"
                >
                  <PencilSquareIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </td>

          {/* Notes */}
          <td className="px-3 py-2 whitespace-nowrap">
            <button
              onClick={(e) => openNotesPopover(task, e)}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                task.description
                  ? "text-blue-500 hover:bg-blue-50"
                  : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
              }`}
              title={task.description ? "View/Edit notes" : "Add notes"}
            >
              <ChatBubbleLeftIcon className="w-4 h-4" />
            </button>
          </td>

          {/* Status */}
          <td className="px-3 py-2 whitespace-nowrap">
            {allowInlineEdit ? (
              <StatusBadge
                value={task.status as TaskStatus}
                onChange={(val) => handleTaskUpdate(task.id, "status", val)}
                size="sm"
              />
            ) : (
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
            )}
          </td>

          {/* Priority */}
          <td className="px-3 py-2 whitespace-nowrap">
            {allowInlineEdit ? (
              <PriorityBadge
                value={task.priority as TaskPriority}
                onChange={(val) => handleTaskUpdate(task.id, "priority", val)}
                size="sm"
              />
            ) : (
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
            )}
          </td>

          {/* Assignee */}
          <td className="px-3 py-2 whitespace-nowrap">
            {allowInlineEdit ? (
              <AssigneeSelector
                selected={
                  typeof task.assigned_to === "string" ? task.assigned_to : null
                }
                onChange={(val) =>
                  handleTaskUpdate(task.id, "assigned_to", val)
                }
                teamMembers={teamMembers.map((m) => ({
                  ...m,
                  full_name: m.name,
                }))}
              />
            ) : task.assigned_user ? (
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

          {/* Start Date */}
          <td className="px-3 py-2 whitespace-nowrap">
            {allowInlineEdit ? (
              <DatePicker
                value={task.start_date || ""}
                onChange={(val) =>
                  handleTaskUpdate(task.id, "start_date", val || null)
                }
                placeholder="Start"
              />
            ) : (
              <span className="text-xs text-slate-600">
                {formatDate(task.start_date)}
              </span>
            )}
          </td>

          {/* Due Date */}
          <td className="px-3 py-2 whitespace-nowrap">
            {allowInlineEdit ? (
              <DatePicker
                value={task.due_date || ""}
                onChange={(val) =>
                  handleTaskUpdate(task.id, "due_date", val || null)
                }
                placeholder="Due"
                minDate={task.start_date}
              />
            ) : (
              <span className="text-xs text-slate-600">
                {formatDate(task.due_date)}
              </span>
            )}
          </td>

          {/* Linked */}
          <td className="px-3 py-2 whitespace-nowrap">
            {task.related_name ? (
              <span className="text-xs text-slate-600">
                {task.related_name}
              </span>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </td>
        </tr>

        {/* Subtasks */}
        {isExpanded && task.subtasks && task.subtasks.length > 0 && (
          <>
            {task.subtasks.map((subtask) => (
              <TaskRow key={subtask.id} task={subtask} isSubtask={true} />
            ))}
          </>
        )}

        {/* Inline Subtask Creation - only show when + button clicked */}
        {inlineSubtaskFor === task.id && !isSubtask && (
          <tr className="border-b border-slate-100 bg-slate-50/30">
            <td colSpan={8} className="px-3 py-2 pl-12">
              <div className="flex items-center gap-2">
                <input
                  ref={inlineSubtaskInputRef}
                  type="text"
                  value={inlineSubtaskTitle}
                  onChange={(e) => setInlineSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleInlineSubtaskSubmit(task.id);
                    } else if (e.key === "Escape") {
                      setInlineSubtaskFor(null);
                      setInlineSubtaskTitle("");
                    }
                  }}
                  onBlur={() => {
                    if (inlineSubtaskTitle.trim()) {
                      handleInlineSubtaskSubmit(task.id);
                    } else {
                      setInlineSubtaskFor(null);
                      setInlineSubtaskTitle("");
                    }
                  }}
                  placeholder="Subtask title..."
                  className="flex-1 text-xs px-2 py-1 border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </td>
          </tr>
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
  if (filteredTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <ListBulletIcon className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700 mb-1">
          No tasks found
        </p>
        <p className="text-xs text-slate-500 mb-3">
          {searchQuery
            ? "Try adjusting your search or filters"
            : "Create your first task to get started"}
        </p>
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Create Task
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tabs & Filters Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab("my-tasks")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "my-tasks"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            My Tasks
            <span
              className={`ml-1 text-[10px] ${
                activeTab === "my-tasks" ? "text-blue-200" : "text-slate-400"
              }`}
            >
              {myTasks.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("assigned-by-me")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "assigned-by-me"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            Assigned by Me
            <span
              className={`ml-1 text-[10px] ${
                activeTab === "assigned-by-me"
                  ? "text-blue-200"
                  : "text-slate-400"
              }`}
            >
              {assignedByMe.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("all-tasks")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "all-tasks"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            All Tasks
            <span
              className={`ml-1 text-[10px] ${
                activeTab === "all-tasks" ? "text-blue-200" : "text-slate-400"
              }`}
            >
              {tasks.length}
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <StatusFilterDropdown
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search all fields..."
            className="w-52"
          />
        </div>
      </div>

      {/* Tasks Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                Task
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                Notes
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                Priority
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                Assignee
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                Start
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                Due
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                Linked
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center">
                  <div className="text-slate-400 text-sm">
                    {tasks.length === 0 ? (
                      <div>
                        <ListBulletIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium">No tasks yet</p>
                        <p className="text-xs mt-1">
                          Create a task to get started
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">No tasks found</p>
                        <p className="text-xs mt-1">
                          Try adjusting your filters or search query
                        </p>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <TaskRow key={task.id} task={task as TaskWithUser} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Notes Popover */}
      {notesPopoverTask &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setNotesPopoverTask(null)}
            />
            <div
              className="fixed z-50 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
              style={{
                top: `${notesPopoverPosition.top}px`,
                left: `${notesPopoverPosition.left}px`,
              }}
            >
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <textarea
                    ref={notesInputRef}
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                    className="flex-1 px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-400"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        saveNotes();
                      }
                      if (e.key === "Escape") {
                        setNotesPopoverTask(null);
                      }
                    }}
                  />
                  <button
                    onClick={saveNotes}
                    disabled={isSavingNotes}
                    className="p-2 text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    title="Save (⌘+Enter)"
                  >
                    {isSavingNotes ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
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
                    ) : (
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
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
