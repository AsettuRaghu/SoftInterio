"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { CreateTaskModal, EditTaskModal } from "@/components/tasks";
import { SearchBox } from "@/components/ui/SearchBox";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  StatusBadge,
  PriorityBadge,
  DatePicker,
  LinkedEntity,
  UserAvatar,
  AssigneeSelector,
  TaskStatus,
  TaskPriority,
  StatusFilterDropdown,
} from "@/components/tasks/ui";
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListBulletIcon,
  ChatBubbleLeftIcon,
  XMarkIcon,
  PencilSquareIcon,
  Bars3BottomLeftIcon,
} from "@heroicons/react/24/outline";

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
  created_by?: string;
  created_by_name?: string;
  related_type?: string;
  related_id?: string;
  related_name?: string;
  subtask_count: number;
  completed_subtask_count: number;
  created_at: string;
  subtasks?: Task[];
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

type TabType = "my-tasks" | "assigned-by-me" | "all-tasks";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>("my-tasks");

  // Get current user
  const { user: currentUser } = useCurrentUser();

  // Inline subtask creation
  const [inlineSubtaskFor, setInlineSubtaskFor] = useState<string | null>(null);
  const [inlineSubtaskTitle, setInlineSubtaskTitle] = useState("");
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [notesPopoverTask, setNotesPopoverTask] = useState<Task | null>(null);
  const [notesPopoverParentId, setNotesPopoverParentId] = useState<
    string | null
  >(null);
  const [notesPopoverPosition, setNotesPopoverPosition] = useState({
    top: 0,
    left: 0,
  });
  const [notesText, setNotesText] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  // Sorting
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    "todo",
    "in_progress",
    "on_hold",
    "review",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all"); // all, lead, project, unlinked

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/tasks?parent_only=true");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load tasks");
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTeamMembers = useCallback(async () => {
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
  }, []);

  // Fetch full task data with subtasks when opening edit modal
  const fetchTaskWithSubtasks = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (response.ok) {
        const data = await response.json();
        // API returns { task, subtasks, ... }
        const fullTask = {
          ...data.task,
          subtasks: data.subtasks || [],
        };
        setEditingTask(fullTask);
      } else {
        console.error("Failed to fetch task details");
      }
    } catch (err) {
      console.error("Error fetching task with subtasks:", err);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchTeamMembers();
  }, [fetchTasks, fetchTeamMembers]);

  // Focus inline input when it appears
  useEffect(() => {
    if (inlineSubtaskFor && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [inlineSubtaskFor]);

  // Filter tasks into categories
  const { myTasks, assignedByMe, allTasks } = useMemo(() => {
    const currentUserId = currentUser?.id;

    if (!currentUserId) {
      return { myTasks: tasks, assignedByMe: [], allTasks: tasks };
    }

    // My Tasks: Tasks assigned TO me (from anyone)
    const my = tasks.filter((task) => {
      const assignedTo = task.assigned_to;
      return Array.isArray(assignedTo)
        ? assignedTo.includes(currentUserId)
        : assignedTo === currentUserId;
    });

    // Assigned by Me: Tasks I created and assigned to OTHERS (not me)
    const delegated = tasks.filter((task) => {
      const assignedTo = task.assigned_to;
      const createdByMe = task.created_by === currentUserId;
      const assignedToMe = Array.isArray(assignedTo)
        ? assignedTo.includes(currentUserId)
        : assignedTo === currentUserId;
      const hasAssignees =
        assignedTo &&
        (Array.isArray(assignedTo) ? assignedTo.length > 0 : true);

      return createdByMe && hasAssignees && !assignedToMe;
    });

    // All Tasks: Everything I have visibility to (created by me OR assigned to me)
    const all = tasks.filter((task) => {
      const assignedTo = task.assigned_to;
      const createdByMe = task.created_by === currentUserId;
      const assignedToMe = Array.isArray(assignedTo)
        ? assignedTo.includes(currentUserId)
        : assignedTo === currentUserId;

      return createdByMe || assignedToMe;
    });

    return { myTasks: my, assignedByMe: delegated, allTasks: all };
  }, [tasks, currentUser?.id]);

  // Apply filters and sorting
  const getFilteredTasks = useCallback(
    (taskList: Task[]) => {
      let result = taskList;

      // Status filter
      if (selectedStatuses.length > 0) {
        result = result.filter((task) =>
          selectedStatuses.includes(task.status)
        );
      }

      // Source filter (Lead/Project/Unlinked)
      if (selectedSource !== "all") {
        if (selectedSource === "unlinked") {
          result = result.filter((task) => !task.related_type);
        } else {
          result = result.filter(
            (task) => task.related_type === selectedSource
          );
        }
      }

      // Search filter - search across ALL visible fields
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter((task) => {
          // Get assignee name from team members
          const assigneeMember = task.assigned_to
            ? teamMembers.find((m) => m.id === task.assigned_to)
            : null;
          const assigneeName = assigneeMember?.full_name?.toLowerCase() || "";
          const startDateStr = task.start_date
            ? new Date(task.start_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "";
          const dueDateStr = task.due_date
            ? new Date(task.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "";

          return Boolean(
            task.title.toLowerCase().includes(query) ||
              task.task_number?.toLowerCase().includes(query) ||
              task.description?.toLowerCase().includes(query) ||
              task.status.toLowerCase().replace("_", " ").includes(query) ||
              task.priority?.toLowerCase().includes(query) ||
              assigneeName.includes(query) ||
              task.assigned_to_name?.toLowerCase().includes(query) ||
              startDateStr.toLowerCase().includes(query) ||
              dueDateStr.toLowerCase().includes(query) ||
              task.related_name?.toLowerCase().includes(query) ||
              task.related_type?.toLowerCase().includes(query)
          );
        });
      }

      // Sort by selected field
      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortField) {
          case "title":
            aVal = a.title?.toLowerCase() || "";
            bVal = b.title?.toLowerCase() || "";
            break;
          case "status":
            const statusOrder: Record<string, number> = {
              todo: 0,
              in_progress: 1,
              on_hold: 2,
              completed: 3,
              cancelled: 4,
            };
            aVal = a.status ? statusOrder[a.status] ?? 5 : 5;
            bVal = b.status ? statusOrder[b.status] ?? 5 : 5;
            break;
          case "priority":
            const priorityOrder: Record<string, number> = {
              critical: 0,
              high: 1,
              medium: 2,
              low: 3,
              none: 4,
            };
            aVal = a.priority ? priorityOrder[a.priority] ?? 5 : 5;
            bVal = b.priority ? priorityOrder[b.priority] ?? 5 : 5;
            break;
          case "assignee":
            const aAssignee = a.assigned_to
              ? teamMembers.find((m) => m.id === a.assigned_to)?.full_name || ""
              : "";
            const bAssignee = b.assigned_to
              ? teamMembers.find((m) => m.id === b.assigned_to)?.full_name || ""
              : "";
            aVal = aAssignee.toLowerCase();
            bVal = bAssignee.toLowerCase();
            break;
          case "start_date":
            aVal = a.start_date || "9999-12-31";
            bVal = b.start_date || "9999-12-31";
            break;
          case "due_date":
            aVal = a.due_date || "9999-12-31";
            bVal = b.due_date || "9999-12-31";
            break;
          case "linked":
            aVal = a.related_name?.toLowerCase() || "";
            bVal = b.related_name?.toLowerCase() || "";
            break;
          default: // created_at
            aVal = a.created_at || "";
            bVal = b.created_at || "";
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });

      return result;
    },
    [
      selectedStatuses,
      selectedSource,
      searchQuery,
      teamMembers,
      sortField,
      sortDirection,
    ]
  );

  const filteredMyTasks = useMemo(
    () => getFilteredTasks(myTasks),
    [getFilteredTasks, myTasks]
  );
  const filteredAssignedByMe = useMemo(
    () => getFilteredTasks(assignedByMe),
    [getFilteredTasks, assignedByMe]
  );
  const filteredAllTasks = useMemo(
    () => getFilteredTasks(allTasks),
    [getFilteredTasks, allTasks]
  );

  const activeTasks = useMemo(() => {
    switch (activeTab) {
      case "my-tasks":
        return filteredMyTasks;
      case "assigned-by-me":
        return filteredAssignedByMe;
      case "all-tasks":
        return filteredAllTasks;
      default:
        return filteredMyTasks;
    }
  }, [activeTab, filteredMyTasks, filteredAssignedByMe, filteredAllTasks]);

  // Pagination
  const totalPages = Math.ceil(activeTasks.length / pageSize);
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return activeTasks.slice(startIndex, startIndex + pageSize);
  }, [activeTasks, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatuses, searchQuery, activeTab]);

  // Sort handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: string }) => (
    <span className="ml-1 inline-flex">
      {sortField === field ? (
        sortDirection === "asc" ? (
          <svg
            className="w-3 h-3"
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
        ) : (
          <svg
            className="w-3 h-3"
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
        )
      ) : (
        <svg
          className="w-3 h-3 opacity-0 group-hover:opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      )}
    </span>
  );

  const toggleExpand = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.subtask_count === 0) return;

    // Toggle expansion instantly - subtasks are already prefetched from API
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleInlineSubtaskSubmit = async (parentTaskId: string) => {
    const title = inlineSubtaskTitle.trim();
    if (!title) {
      setInlineSubtaskFor(null);
      setInlineSubtaskTitle("");
      return;
    }

    // Optimistically add subtask to local state immediately
    const tempId = `temp-${Date.now()}`;
    const newSubtask: Task = {
      id: tempId,
      task_number: "",
      title,
      status: "todo" as TaskStatus,
      priority: "medium" as TaskPriority,
      created_by: currentUser?.id,
      subtask_count: 0,
      completed_subtask_count: 0,
      created_at: new Date().toISOString(),
    };

    // Add to local state and expand parent
    setTasks((prev) =>
      prev.map((t) =>
        t.id === parentTaskId
          ? {
              ...t,
              subtasks: [...(t.subtasks || []), newSubtask],
              subtask_count: t.subtask_count + 1,
            }
          : t
      )
    );
    setExpandedTasks((prev) => new Set(prev).add(parentTaskId));
    setInlineSubtaskFor(null);
    setInlineSubtaskTitle("");

    // Save to database in background
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
        const savedTask = await response.json();
        // Replace temp subtask with real one from server
        setTasks((prev) =>
          prev.map((t) =>
            t.id === parentTaskId
              ? {
                  ...t,
                  subtasks: t.subtasks?.map((st) =>
                    st.id === tempId ? { ...st, id: savedTask.id } : st
                  ),
                }
              : t
          )
        );
      }
    } catch (err) {
      console.error("Error creating subtask:", err);
      // Rollback on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === parentTaskId
            ? {
                ...t,
                subtasks: t.subtasks?.filter((st) => st.id !== tempId),
                subtask_count: t.subtask_count - 1,
              }
            : t
        )
      );
    }
  };

  // Inline update task function
  const updateTaskInline = async (
    taskId: string,
    field: string,
    value: unknown,
    isSubtask: boolean = false,
    parentTaskId?: string
  ) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        // Update local state immediately for better UX
        if (isSubtask && parentTaskId) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === parentTaskId
                ? {
                    ...t,
                    subtasks: t.subtasks?.map((st) =>
                      st.id === taskId ? { ...st, [field]: value } : st
                    ),
                  }
                : t
            )
          );
        } else {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))
          );
        }
        // Clear editing state
        setEditingTaskId(null);
        setEditingField(null);
      } else {
        console.error("Failed to update task");
      }
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  // Handle title edit
  const startEditingTitle = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingField("title");
    setEditingTitle(task.title);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const saveTitle = async (
    taskId: string,
    isSubtask: boolean = false,
    parentTaskId?: string
  ) => {
    if (editingTitle.trim()) {
      await updateTaskInline(
        taskId,
        "title",
        editingTitle.trim(),
        isSubtask,
        parentTaskId
      );
    }
    setEditingTaskId(null);
    setEditingField(null);
  };

  // Handle notes popover
  const openNotesPopover = (
    task: Task,
    event: React.MouseEvent,
    parentTaskId?: string
  ) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setNotesPopoverPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 320),
    });
    setNotesPopoverTask(task);
    setNotesPopoverParentId(parentTaskId || null);
    setNotesText(task.description || "");
    setTimeout(() => notesInputRef.current?.focus(), 50);
  };

  const saveNotes = async () => {
    if (!notesPopoverTask) return;
    setIsSavingNotes(true);
    const isSubtask = !!notesPopoverParentId;
    await updateTaskInline(
      notesPopoverTask.id,
      "description",
      notesText,
      isSubtask,
      notesPopoverParentId || undefined
    );
    // Update local state for the task's description
    if (isSubtask && notesPopoverParentId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === notesPopoverParentId
            ? {
                ...t,
                subtasks: t.subtasks?.map((st) =>
                  st.id === notesPopoverTask.id
                    ? { ...st, description: notesText }
                    : st
                ),
              }
            : t
        )
      );
    }
    setIsSavingNotes(false);
    setNotesPopoverTask(null);
    setNotesPopoverParentId(null);
  };

  const TaskRow = ({
    task,
    isSubtask = false,
    parentTaskId,
  }: {
    task: Task;
    isSubtask?: boolean;
    parentTaskId?: string;
  }) => {
    const isExpanded = expandedTasks.has(task.id);
    const hasSubtasks = task.subtask_count > 0;
    const isEditingTitle =
      editingTaskId === task.id && editingField === "title";

    // Handle assigned_to as string (single assignee)
    const assigneeId =
      typeof task.assigned_to === "string" ? task.assigned_to : null;

    return (
      <tr
        className={`group border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
          isSubtask ? "bg-slate-50/30" : ""
        }`}
      >
        {/* Task Name */}
        <td className={`px-2 py-1.5 ${isSubtask ? "pl-4" : ""}`}>
          <div className="flex items-center gap-1">
            {isSubtask && (
              <div className="flex items-center gap-1 pl-4">
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
              </div>
            )}
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

            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => saveTitle(task.id, isSubtask, parentTaskId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveTitle(task.id, isSubtask, parentTaskId);
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
                onClick={() => startEditingTitle(task)}
                className="text-left flex items-center gap-1.5 group/title"
              >
                <span className="text-xs font-medium text-slate-800 hover:text-blue-600 transition-colors">
                  {task.title}
                </span>
                {hasSubtasks && !isSubtask && (
                  <span className="flex items-center gap-0.5 text-[9px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded shrink-0">
                    <ListBulletIcon className="w-2.5 h-2.5" />
                    {task.completed_subtask_count}/{task.subtask_count}
                  </span>
                )}
              </button>
            )}

            {!isSubtask && !isEditingTitle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInlineSubtaskFor(task.id);
                }}
                className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-all opacity-0 group-hover:opacity-100"
                title="Add subtask"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Edit button - opens Edit Task Modal */}
            {!isEditingTitle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTask(task);
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
        <td className="px-2 py-1.5 whitespace-nowrap">
          <button
            onClick={(e) =>
              openNotesPopover(task, e, isSubtask ? parentTaskId : undefined)
            }
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
        <td className="px-2 py-1.5 whitespace-nowrap">
          <StatusBadge
            value={task.status}
            onChange={(val) =>
              updateTaskInline(task.id, "status", val, isSubtask, parentTaskId)
            }
            size="sm"
          />
        </td>

        {/* Priority */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <PriorityBadge
            value={task.priority}
            onChange={(val) =>
              updateTaskInline(
                task.id,
                "priority",
                val,
                isSubtask,
                parentTaskId
              )
            }
            size="sm"
          />
        </td>

        {/* Assignee */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <AssigneeSelector
            selected={assigneeId}
            onChange={(val) =>
              updateTaskInline(
                task.id,
                "assigned_to",
                val,
                isSubtask,
                parentTaskId
              )
            }
            teamMembers={teamMembers}
          />
        </td>

        {/* Start Date */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <DatePicker
            value={task.start_date || ""}
            onChange={(val) =>
              updateTaskInline(
                task.id,
                "start_date",
                val || null,
                isSubtask,
                parentTaskId
              )
            }
            placeholder="Start"
          />
        </td>

        {/* Due Date */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <DatePicker
            value={task.due_date || ""}
            onChange={(val) =>
              updateTaskInline(
                task.id,
                "due_date",
                val || null,
                isSubtask,
                parentTaskId
              )
            }
            placeholder="Due"
            minDate={task.start_date}
          />
        </td>

        {/* Linked */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <LinkedEntity
            value={
              task.related_type && task.related_id
                ? {
                    type: task.related_type,
                    id: task.related_id,
                    name: task.related_name || "",
                  }
                : null
            }
            onChange={(val) => {
              const entity = Array.isArray(val) ? val[0] : val;
              if (entity) {
                // Update both API and local state with name
                updateTaskInline(
                  task.id,
                  "related_type",
                  entity.type,
                  isSubtask,
                  parentTaskId
                );
                updateTaskInline(
                  task.id,
                  "related_id",
                  entity.id,
                  isSubtask,
                  parentTaskId
                );
                // Also update related_name locally (not in API as it's computed)
                if (isSubtask && parentTaskId) {
                  setTasks((prev) =>
                    prev.map((t) =>
                      t.id === parentTaskId
                        ? {
                            ...t,
                            subtasks: t.subtasks?.map((st) =>
                              st.id === task.id
                                ? { ...st, related_name: entity.name }
                                : st
                            ),
                          }
                        : t
                    )
                  );
                } else {
                  setTasks((prev) =>
                    prev.map((t) =>
                      t.id === task.id ? { ...t, related_name: entity.name } : t
                    )
                  );
                }
              } else {
                updateTaskInline(
                  task.id,
                  "related_type",
                  null,
                  isSubtask,
                  parentTaskId
                );
                updateTaskInline(
                  task.id,
                  "related_id",
                  null,
                  isSubtask,
                  parentTaskId
                );
                if (isSubtask && parentTaskId) {
                  setTasks((prev) =>
                    prev.map((t) =>
                      t.id === parentTaskId
                        ? {
                            ...t,
                            subtasks: t.subtasks?.map((st) =>
                              st.id === task.id
                                ? { ...st, related_name: undefined }
                                : st
                            ),
                          }
                        : t
                    )
                  );
                } else {
                  setTasks((prev) =>
                    prev.map((t) =>
                      t.id === task.id ? { ...t, related_name: undefined } : t
                    )
                  );
                }
              }
            }}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="h-full bg-slate-50/50">
      <div className="h-full flex flex-col px-4 py-4">
        {/* Main Card - Full Height with integrated header */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
          {/* Elegant Header inside the card */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
              <span className="hover:text-slate-700 cursor-pointer">
                Dashboard
              </span>
              <svg
                className="w-3 h-3 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span className="hover:text-slate-700 cursor-pointer">Tasks</span>
              <svg
                className="w-3 h-3 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span className="text-slate-700 font-medium">Task List</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-base font-semibold text-slate-800 leading-tight">
                    Tasks
                  </h1>
                  <p className="text-[11px] text-slate-500">
                    Manage and track your work
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
              >
                <PlusIcon className="w-4 h-4" />
                Create Task
              </button>
            </div>
          </div>

          {/* Tabs & Filters Bar */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
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
                    activeTab === "my-tasks"
                      ? "text-blue-200"
                      : "text-slate-400"
                  }`}
                >
                  {filteredMyTasks.length}
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
                  {filteredAssignedByMe.length}
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
                    activeTab === "all-tasks"
                      ? "text-blue-200"
                      : "text-slate-400"
                  }`}
                >
                  {filteredAllTasks.length}
                </span>
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              {/* Expand/Collapse All Button */}
              {paginatedTasks.some((t) => t.subtask_count > 0) && (
                <button
                  onClick={() => {
                    const tasksWithSubtasks = paginatedTasks
                      .filter((t) => t.subtask_count > 0)
                      .map((t) => t.id);
                    const allExpanded = tasksWithSubtasks.every((id) =>
                      expandedTasks.has(id)
                    );
                    if (allExpanded) {
                      setExpandedTasks(new Set());
                    } else {
                      setExpandedTasks(new Set(tasksWithSubtasks));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  title={expandedTasks.size > 0 ? "Collapse all" : "Expand all"}
                >
                  <Bars3BottomLeftIcon className="w-4 h-4" />
                  {expandedTasks.size > 0 ? "Collapse" : "Expand"}
                </button>
              )}

              {/* Source Filter (Lead/Project) */}
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Sources</option>
                <option value="lead">Leads Only</option>
                <option value="project">Projects Only</option>
                <option value="unlinked">Unlinked</option>
              </select>

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
          {isLoading || !currentUser ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-500">Loading tasks...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center">
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
              <button
                onClick={fetchTasks}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                Try Again
              </button>
            </div>
          ) : paginatedTasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
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
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Create Task
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full table-auto">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200">
                    <th
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 group"
                      onClick={() => handleSort("title")}
                    >
                      <span className="inline-flex items-center">
                        Task
                        <SortIndicator field="title" />
                      </span>
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Notes
                    </th>
                    <th
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 group"
                      onClick={() => handleSort("status")}
                    >
                      <span className="inline-flex items-center">
                        Status
                        <SortIndicator field="status" />
                      </span>
                    </th>
                    <th
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 group"
                      onClick={() => handleSort("priority")}
                    >
                      <span className="inline-flex items-center">
                        Priority
                        <SortIndicator field="priority" />
                      </span>
                    </th>
                    <th
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 group"
                      onClick={() => handleSort("assignee")}
                    >
                      <span className="inline-flex items-center">
                        Assignee
                        <SortIndicator field="assignee" />
                      </span>
                    </th>
                    <th
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 group"
                      onClick={() => handleSort("start_date")}
                    >
                      <span className="inline-flex items-center">
                        Start
                        <SortIndicator field="start_date" />
                      </span>
                    </th>
                    <th
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 group"
                      onClick={() => handleSort("due_date")}
                    >
                      <span className="inline-flex items-center">
                        Due
                        <SortIndicator field="due_date" />
                      </span>
                    </th>
                    <th
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 group"
                      onClick={() => handleSort("linked")}
                    >
                      <span className="inline-flex items-center">
                        Linked
                        <SortIndicator field="linked" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTasks.map((task) => (
                    <React.Fragment key={task.id}>
                      <TaskRow key={`task-${task.id}`} task={task} />
                      {/* Inline Subtask Input - inlined directly to prevent focus loss */}
                      {inlineSubtaskFor === task.id && (
                        <tr
                          key={`inline-${task.id}`}
                          className="border-b border-slate-100 bg-blue-50/30"
                        >
                          <td className="px-2 py-1.5 pl-8" colSpan={8}>
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4 flex items-center justify-center text-blue-400">
                                <PlusIcon className="w-3 h-3" />
                              </div>
                              <input
                                ref={inlineInputRef}
                                type="text"
                                value={inlineSubtaskTitle}
                                onChange={(e) =>
                                  setInlineSubtaskTitle(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleInlineSubtaskSubmit(task.id);
                                  } else if (e.key === "Escape") {
                                    setInlineSubtaskFor(null);
                                    setInlineSubtaskTitle("");
                                  }
                                }}
                                placeholder="Type subtask name and press Enter..."
                                className="flex-1 text-xs bg-transparent border-none outline-none placeholder:text-blue-400"
                              />
                              <button
                                onClick={() =>
                                  handleInlineSubtaskSubmit(task.id)
                                }
                                disabled={!inlineSubtaskTitle.trim()}
                                className="px-2 py-0.5 text-[10px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => {
                                  setInlineSubtaskFor(null);
                                  setInlineSubtaskTitle("");
                                }}
                                className="p-0.5 text-slate-400 hover:text-slate-600"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
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
                          </td>
                        </tr>
                      )}
                      {/* Expanded Subtasks - also rendered outside TaskRow */}
                      {expandedTasks.has(task.id) &&
                        task.subtasks?.map((subtask, index) => (
                          <TaskRow
                            key={`subtask-${task.id}-${subtask.id || index}`}
                            task={subtask}
                            isSubtask
                            parentTaskId={task.id}
                          />
                        ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Compact Pagination */}
          {activeTasks.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">
                    <span className="font-medium">
                      {Math.min(
                        (currentPage - 1) * pageSize + 1,
                        activeTasks.length
                      )}
                    </span>
                    {"-"}
                    <span className="font-medium">
                      {Math.min(currentPage * pageSize, activeTasks.length)}
                    </span>
                    {" of "}
                    <span className="font-medium">{activeTasks.length}</span>
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-1.5 py-0.5 text-[10px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>

                  <div className="flex items-center gap-0.5 mx-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5) {
                        if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2)
                          pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-6 h-6 text-[10px] font-medium rounded transition-colors ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchTasks();
          setIsCreateModalOpen(false);
        }}
      />

      <EditTaskModal
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onUpdate={() => {
          fetchTasks();
          setEditingTask(null);
        }}
      />

      {/* Inline Notes Popover */}
      {notesPopoverTask && (
        <>
          {/* Invisible overlay to close popover on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setNotesPopoverTask(null)}
          />
          {/* Popover */}
          <div
            className="fixed z-50 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
            style={{
              top: notesPopoverPosition.top,
              left: notesPopoverPosition.left,
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
        </>
      )}
    </div>
  );
}
