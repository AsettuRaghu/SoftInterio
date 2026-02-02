"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  StatusBadge,
  PriorityBadge,
  DatePicker,
  LinkedEntity,
  AssigneeSelector,
  TaskStatus,
  TaskPriority,
  StatusFilterDropdown,
} from "./ui";
import { SearchBox } from "@/components/ui/SearchBox";
import { CreateTaskModal } from "./CreateTaskModal";
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListBulletIcon,
  ChatBubbleLeftIcon,
  PencilSquareIcon,
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

export interface TaskTableProps {
  // Optional: Filter by linked entity (lead, project, etc.)
  relatedType?: string;
  relatedId?: string;

  // Required: Current user ID for tab filtering
  currentUserId: string;

  // Team members for assignee selector
  teamMembers?: TeamMember[];
  externalTeamMembers?: TeamMember[]; // Alternative name for external team members

  // UI Configuration
  showHeader?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  compact?: boolean; // Embedded mode vs full page mode
  showTabs?: boolean; // Show My Tasks / Assigned by Me / All Tasks tabs
  defaultTab?: TabType;
  allowEdit?: boolean; // Enable/disable inline editing
  readOnly?: boolean; // Read-only mode (alternative to allowEdit)
  showCreateButton?: boolean; // Show/hide create task button (default: true if allowEdit)

  // Callbacks
  onTaskClick?: (task: Task) => void;
  onCreateTask?: () => void; // Custom create handler (if not provided, uses built-in modal)

  // Optional: External state control
  externalTasks?: Task[];
  onRefresh?: () => void;
}

export default function TaskTable({
  relatedType,
  relatedId,
  currentUserId,
  teamMembers: externalTeamMembersProp,
  externalTeamMembers,
  showHeader = true,
  headerTitle = "Tasks",
  headerSubtitle = "Manage and track your work",
  compact = false,
  showTabs = true,
  defaultTab = "my-tasks",
  allowEdit = true,
  readOnly = false,
  showCreateButton,
  onTaskClick,
  onCreateTask,
  externalTasks,
  onRefresh,
}: TaskTableProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [inlineSubtaskFor, setInlineSubtaskFor] = useState<string | null>(null);
  const [inlineSubtaskTitle, setInlineSubtaskTitle] = useState("");

  // Notes popover state
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

  // Create task modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Refs
  const titleInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const CACHE_DURATION = 30000; // 30 seconds cache

  // Generate cache key
  const getCacheKey = useCallback(() => {
    return `tasks_${relatedType || "all"}_${relatedId || "all"}`;
  }, [relatedType, relatedId]);

  // Fetch tasks with caching
  const fetchTasks = useCallback(
    async (forceRefresh: boolean = false) => {
      try {
        const cacheKey = getCacheKey();
        const now = Date.now();

        // Check if we have recent data in cache (unless force refresh)
        if (!forceRefresh && now - lastFetchTimeRef.current < CACHE_DURATION) {
          // Use cached data if available
          try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
              const cachedData = JSON.parse(cached);
              setTasks(cachedData);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            // Ignore cache errors
          }
        }

        setIsLoading(true);
        setError(null);

        // Build query params
        const params = new URLSearchParams();
        if (relatedType && relatedId) {
          params.append("related_type", relatedType);
          params.append("related_id", relatedId);
        }

        const response = await fetch(`/api/tasks?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch tasks");

        const data = await response.json();
        setTasks(data);

        // Cache the data
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
          lastFetchTimeRef.current = now;
        } catch (e) {
          // Ignore cache storage errors (e.g., quota exceeded)
        }
      } catch (err) {
        console.error("Error fetching tasks:", err);
        setError(err instanceof Error ? err.message : "Failed to load tasks");
      } finally {
        setIsLoading(false);
      }
    },
    [relatedType, relatedId, getCacheKey]
  );

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/team/members");
      if (!response.ok) throw new Error("Failed to fetch team members");
      const data = await response.json();
      // API returns { success: true, data: [...members] }
      if (data.success && data.data) {
        const members = data.data.map((m: any) => ({
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

  // Initial load
  useEffect(() => {
    if (externalTasks) {
      setTasks(externalTasks);
      setIsLoading(false);
    } else {
      // Try to load from cache immediately for instant display
      const cacheKey = getCacheKey();
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setTasks(cachedData);
          setIsLoading(false);

          // Fetch fresh data in background if cache is old
          const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
          if (timeSinceLastFetch > CACHE_DURATION) {
            fetchTasks(false);
          }
        } else {
          fetchTasks(false);
        }
      } catch (e) {
        // If cache fails, fetch normally
        fetchTasks(false);
      }
    }

    // Use external team members if provided
    const providedTeamMembers = externalTeamMembersProp || externalTeamMembers;
    if (providedTeamMembers && providedTeamMembers.length > 0) {
      setTeamMembers(providedTeamMembers);
    } else {
      fetchTeamMembers();
    }
  }, [
    externalTasks,
    fetchTasks,
    getCacheKey,
    fetchTeamMembers,
    externalTeamMembersProp,
    externalTeamMembers,
  ]);

  // Use external refresh if provided
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    } else {
      // Force refresh and clear cache
      try {
        sessionStorage.removeItem(getCacheKey());
      } catch (e) {
        // Ignore cache errors
      }
      lastFetchTimeRef.current = 0;
      fetchTasks(true);
    }
  }, [onRefresh, fetchTasks, getCacheKey]);

  // Helper to invalidate cache after data changes
  const invalidateCache = useCallback(() => {
    try {
      sessionStorage.removeItem(getCacheKey());
      lastFetchTimeRef.current = 0;
    } catch (e) {
      // Ignore cache errors
    }
  }, [getCacheKey]);

  // Determine if editing is allowed
  const isEditable = allowEdit && !readOnly;

  // Tab filtering logic
  const { myTasks, assignedByMe, allTasks } = useMemo(() => {
    const my: Task[] = [];
    const assigned: Task[] = [];
    const all: Task[] = [];

    tasks.forEach((task) => {
      all.push(task);
      if (task.assigned_to === currentUserId) {
        my.push(task);
      }
      if (task.created_by === currentUserId) {
        assigned.push(task);
      }
    });

    return { myTasks: my, assignedByMe: assigned, allTasks: all };
  }, [tasks, currentUserId]);

  // Search, filter & sort logic - as a regular function
  const getFilteredAndSortedTasks = (taskList: Task[]) => {
    let result = [...taskList]; // Create a copy to avoid mutating original

    // Status filter
    if (selectedStatuses.length > 0) {
      result = result.filter((task) => selectedStatuses.includes(task.status));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((task) => {
        // Search in basic fields
        if (
          task.title.toLowerCase().includes(query) ||
          task.task_number?.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.related_name?.toLowerCase().includes(query)
        ) {
          return true;
        }

        // Search in status
        if (task.status?.toLowerCase().includes(query)) {
          return true;
        }

        // Search in priority
        if (task.priority?.toLowerCase().includes(query)) {
          return true;
        }

        // Search in assignee name/email
        const assignee = teamMembers.find((m) => m.id === task.assigned_to);
        if (
          assignee?.full_name?.toLowerCase().includes(query) ||
          assignee?.email?.toLowerCase().includes(query) ||
          task.assigned_to_name?.toLowerCase().includes(query) ||
          task.assigned_to_email?.toLowerCase().includes(query)
        ) {
          return true;
        }

        // Search in creator name
        const creator = teamMembers.find((m) => m.id === task.created_by);
        if (
          creator?.full_name?.toLowerCase().includes(query) ||
          creator?.email?.toLowerCase().includes(query) ||
          task.created_by_name?.toLowerCase().includes(query)
        ) {
          return true;
        }

        return false;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";

      switch (sortField) {
        case "title":
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case "notes":
          aVal = (a.description || "").toLowerCase();
          bVal = (b.description || "").toLowerCase();
          break;
        case "status":
          const getStatusOrder = (
            status: TaskStatus | string | null
          ): number => {
            if (!status) return 999;
            switch (status) {
              case "todo":
                return 0;
              case "in-progress":
                return 1;
              case "completed":
                return 2;
              case "on-hold":
                return 3;
              case "cancelled":
                return 4;
              default:
                return 999;
            }
          };
          aVal = getStatusOrder(a.status);
          bVal = getStatusOrder(b.status);
          break;
        case "priority":
          const getPriorityOrder = (
            priority: TaskPriority | string | null
          ): number => {
            if (!priority) return 999;
            switch (priority) {
              case "critical":
                return 0;
              case "high":
                return 1;
              case "medium":
                return 2;
              case "low":
                return 3;
              default:
                return 999;
            }
          };
          aVal = getPriorityOrder(a.priority);
          bVal = getPriorityOrder(b.priority);
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
  };

  // Apply filtering and sorting to each tab
  const filteredMyTasks = useMemo(
    () => getFilteredAndSortedTasks(myTasks),
    [
      myTasks,
      selectedStatuses,
      searchQuery,
      teamMembers,
      sortField,
      sortDirection,
    ]
  );

  const filteredAssignedByMe = useMemo(
    () => getFilteredAndSortedTasks(assignedByMe),
    [
      assignedByMe,
      selectedStatuses,
      searchQuery,
      teamMembers,
      sortField,
      sortDirection,
    ]
  );

  const filteredAllTasks = useMemo(
    () => getFilteredAndSortedTasks(allTasks),
    [
      allTasks,
      selectedStatuses,
      searchQuery,
      teamMembers,
      sortField,
      sortDirection,
    ]
  );

  const activeTasks = useMemo(() => {
    if (!showTabs) return getFilteredAndSortedTasks(tasks);

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
  }, [
    showTabs,
    activeTab,
    filteredMyTasks,
    filteredAssignedByMe,
    filteredAllTasks,
    tasks,
    selectedStatuses,
    searchQuery,
    teamMembers,
    sortField,
    sortDirection,
  ]);

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

  // Expand/collapse logic
  const toggleExpand = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.subtask_count === 0) return;

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

  // Expand/collapse all tasks
  const expandAll = () => {
    const tasksWithSubtasks = activeTasks.filter((t) => t.subtask_count > 0);
    setExpandedTasks(new Set(tasksWithSubtasks.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedTasks(new Set());
  };

  const hasExpandableTasks = activeTasks.some((t) => t.subtask_count > 0);
  const allExpanded =
    hasExpandableTasks &&
    activeTasks.every((t) => t.subtask_count === 0 || expandedTasks.has(t.id));

  // Inline subtask creation
  const handleInlineSubtaskSubmit = async (parentTaskId: string) => {
    const title = inlineSubtaskTitle.trim();
    if (!title) {
      setInlineSubtaskFor(null);
      setInlineSubtaskTitle("");
      return;
    }

    // Get parent task to inherit its properties
    const parentTask = tasks.find((t) => t.id === parentTaskId);
    const inheritedAssignee = parentTask?.assigned_to || null;
    const inheritedRelatedType = parentTask?.related_type || relatedType;
    const inheritedRelatedId = parentTask?.related_id || relatedId;
    const inheritedRelatedName = parentTask?.related_name;

    const tempId = `temp-${Date.now()}`;
    const newSubtask: Task = {
      id: tempId,
      task_number: "",
      title,
      status: "todo" as TaskStatus,
      priority: "medium" as TaskPriority,
      created_by: currentUserId,
      assigned_to: inheritedAssignee || undefined,
      assigned_to_name: parentTask?.assigned_to_name,
      assigned_to_email: parentTask?.assigned_to_email,
      assigned_to_avatar: parentTask?.assigned_to_avatar,
      related_type: inheritedRelatedType,
      related_id: inheritedRelatedId,
      related_name: inheritedRelatedName,
      subtask_count: 0,
      completed_subtask_count: 0,
      created_at: new Date().toISOString(),
    };

    // Optimistic update
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

    // Save to database with inherited properties
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status: "todo",
          priority: "medium",
          parent_task_id: parentTaskId,
          assigned_to: inheritedAssignee,
          ...(inheritedRelatedType &&
            inheritedRelatedId && {
              related_type: inheritedRelatedType,
              related_id: inheritedRelatedId,
            }),
        }),
      });

      if (response.ok) {
        const savedTask = await response.json();
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
        handleRefresh();
      }
    } catch (err) {
      console.error("Error creating subtask:", err);
      // Rollback
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
    // Optimistic update - update UI immediately for instant feedback
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
    setEditingTaskId(null);
    setEditingField(null);

    // Then update on server in background
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        // If server update fails, revert the optimistic update
        console.error("Failed to update task on server");
        handleRefresh(); // Fetch fresh data to ensure consistency
      } else {
        // Invalidate cache on successful update
        invalidateCache();
        // Refresh if status completed
        if (field === "status" && value === "completed") {
          handleRefresh();
        }
      }
    } catch (err) {
      console.error("Error updating task:", err);
      // Revert on error
      handleRefresh();
    }
  };

  // Title editing
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

  // Notes popover
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
    // Update local state
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

  // Task Row Component
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
                onClick={() => isEditable && startEditingTitle(task)}
                className="text-left flex items-center gap-1.5 group/title"
                disabled={!isEditable}
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

            {!isSubtask && !isEditingTitle && isEditable && (
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

            {!isEditingTitle && (
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
        <td className="px-2 py-1.5 whitespace-nowrap">
          <button
            onClick={(e) => {
              if (isEditable) {
                openNotesPopover(task, e, isSubtask ? parentTaskId : undefined);
              }
            }}
            disabled={!isEditable}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
              task.description
                ? "text-blue-500 hover:bg-blue-50"
                : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
            } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
            title={
              task.description
                ? isEditable
                  ? "View/Edit notes"
                  : "View notes"
                : isEditable
                ? "Add notes"
                : "No notes"
            }
          >
            <ChatBubbleLeftIcon className="w-4 h-4" />
          </button>
        </td>

        {/* Status */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <StatusBadge
            value={task.status}
            onChange={(val) => {
              if (isEditable) {
                updateTaskInline(
                  task.id,
                  "status",
                  val,
                  isSubtask,
                  parentTaskId
                );
              }
            }}
            size="sm"
            readOnly={!isEditable}
          />
        </td>

        {/* Priority */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <PriorityBadge
            value={task.priority}
            onChange={(val) => {
              if (isEditable) {
                updateTaskInline(
                  task.id,
                  "priority",
                  val,
                  isSubtask,
                  parentTaskId
                );
              }
            }}
            size="sm"
            readOnly={!isEditable}
          />
        </td>

        {/* Assignee */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <AssigneeSelector
            selected={assigneeId}
            onChange={(val) => {
              if (isEditable) {
                updateTaskInline(
                  task.id,
                  "assigned_to",
                  val,
                  isSubtask,
                  parentTaskId
                );
              }
            }}
            teamMembers={teamMembers}
            readOnly={!isEditable}
          />
        </td>

        {/* Start Date */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <DatePicker
            value={task.start_date || ""}
            onChange={(val) => {
              if (isEditable) {
                updateTaskInline(
                  task.id,
                  "start_date",
                  val || null,
                  isSubtask,
                  parentTaskId
                );
              }
            }}
            placeholder="Start"
            readOnly={!isEditable}
          />
        </td>

        {/* Due Date */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <DatePicker
            value={task.due_date || ""}
            onChange={(val) => {
              if (isEditable) {
                updateTaskInline(
                  task.id,
                  "due_date",
                  val || null,
                  isSubtask,
                  parentTaskId
                );
              }
            }}
            placeholder="Due"
            minDate={task.start_date}
            readOnly={!isEditable}
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
              if (!isEditable) return;
              const entity = Array.isArray(val) ? val[0] : val;
              if (entity) {
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
                // Update related_name locally
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
            readOnly={!isEditable}
          />
        </td>
      </tr>
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-800 mb-1">
          Failed to load tasks
        </p>
        <p className="text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "h-full bg-slate-50/50"}>
      <div className={compact ? "" : "h-full flex flex-col px-4 py-4"}>
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
          {/* Header */}
          {showHeader && (
            <div className="px-4 py-3 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white">
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
                      {headerTitle}
                    </h1>
                    <p className="text-[11px] text-slate-500">
                      {headerSubtitle}
                    </p>
                  </div>
                </div>
                {/* Show create button based on showCreateButton prop (default: show if allowEdit) */}
                {showCreateButton !== false &&
                  (showCreateButton === true || allowEdit) &&
                  (onCreateTask ? (
                    <button
                      onClick={onCreateTask}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Create Task
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-blue-600 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Create Task
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Tabs & Filters */}
          {showTabs && (
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
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

              <div className="flex items-center gap-2 flex-1">
                {/* Search box takes up most space on left */}
                <div className="flex-1">
                  <SearchBox
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search tasks..."
                  />
                </div>
                {/* Status filter and Add Task on right */}
                <StatusFilterDropdown
                  selected={selectedStatuses}
                  onChange={(statuses) =>
                    setSelectedStatuses(statuses as TaskStatus[])
                  }
                />
                {/* Add Task button in compact/embedded mode - smaller version */}
                {!showHeader &&
                  showCreateButton !== false &&
                  (showCreateButton === true || allowEdit) &&
                  (onCreateTask ? (
                    <button
                      onClick={onCreateTask}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      Add Task
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      Add Task
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Table */}
          {activeTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <ListBulletIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-600 mb-1">
                  No tasks found
                </p>
                <p className="text-xs text-slate-400">
                  {searchQuery || selectedStatuses.length > 0
                    ? "Try adjusting your filters"
                    : "Create your first task to get started"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                  <tr>
                    <th
                      onClick={() => handleSort("title")}
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        {/* Expand/Collapse All icon at extreme left */}
                        {hasExpandableTasks && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              allExpanded ? collapseAll() : expandAll();
                            }}
                            className="p-0.5 hover:bg-slate-200 rounded transition-colors"
                            title={
                              allExpanded
                                ? "Collapse all subtasks"
                                : "Expand all subtasks"
                            }
                          >
                            {allExpanded ? (
                              <ChevronDownIcon className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <ChevronRightIcon className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </button>
                        )}
                        <span>Task</span>
                        <SortIndicator field="title" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("notes")}
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      Notes <SortIndicator field="notes" />
                    </th>
                    <th
                      onClick={() => handleSort("status")}
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      Status <SortIndicator field="status" />
                    </th>
                    <th
                      onClick={() => handleSort("priority")}
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      Priority <SortIndicator field="priority" />
                    </th>
                    <th
                      onClick={() => handleSort("assignee")}
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      Assignee <SortIndicator field="assignee" />
                    </th>
                    <th
                      onClick={() => handleSort("start_date")}
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      Start <SortIndicator field="start_date" />
                    </th>
                    <th
                      onClick={() => handleSort("due_date")}
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      Due <SortIndicator field="due_date" />
                    </th>
                    <th
                      onClick={() => handleSort("linked")}
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      Linked <SortIndicator field="linked" />
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {paginatedTasks.map((task) => (
                    <React.Fragment key={task.id}>
                      <TaskRow task={task} />
                      {/* Inline Subtask Input */}
                      {inlineSubtaskFor === task.id && (
                        <tr className="border-b border-slate-100 bg-blue-50/30">
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
                                autoFocus
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
                      {/* Subtasks */}
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

          {/* Pagination */}
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

      {/* Notes Popover Portal */}
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
          </>,
          document.body
        )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          handleRefresh();
        }}
        defaultLinkedEntity={
          relatedType && relatedId
            ? {
                type: relatedType,
                id: relatedId,
                name: "", // Will be populated by the modal from the selection
              }
            : undefined
        }
      />
    </div>
  );
}
