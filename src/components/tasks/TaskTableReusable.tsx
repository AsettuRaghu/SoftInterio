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
  TagChips,
} from "./ui";
import { isOverdue } from "@/types/tasks";

/** Whole days from `actual` back to `planned`: positive = early, negative = late, 0 = on the day. */
function daysAhead(planned?: string | null, actual?: string | null): number | null {
  if (!planned || !actual) return null;
  const p = new Date(planned); p.setHours(0, 0, 0, 0);
  const a = new Date(actual); a.setHours(0, 0, 0, 0);
  return Math.round((p.getTime() - a.getTime()) / 86400000);
}

/**
 * The planned-versus-actual chip: the same nudge on both date columns.
 * Green early or on the day, red late; the tooltip carries the planned date.
 */
function PlannedChip({
  planned,
  actual,
  what,
  agreedVersion,
}: {
  planned?: string | null;
  actual?: string | null;
  what: "started" | "finished";
  agreedVersion?: number | null;
}) {
  const d = daysAhead(planned, actual);
  if (d === null) return null;
  const plannedText = new Date(planned!).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const cls = d >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
  const text = d > 0 ? `${d}d early` : d === 0 ? "on time" : `${-d}d late`;
  const source = agreedVersion ? `agreed plan v${agreedVersion}` : "the plan at the time";
  return (
    <span
      className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}
      title={`${what === "started" ? "Start" : "Finish"} was ${plannedText} in the ${source}`}
    >
      {text}
    </span>
  );
}

/** A step yet to begin whose current date has drifted from the agreed one says so, quietly. */
function AgreedHint({ agreed, current, version }: { agreed?: string | null; current?: string | null; version?: number | null }) {
  if (!agreed || !current || agreed.slice(0, 10) === current.slice(0, 10)) return null;
  const d = daysAhead(agreed, current);
  const txt = new Date(agreed).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <span
      className="shrink-0 text-[10px] text-slate-400 whitespace-nowrap"
      title={`Agreed plan${version ? ` v${version}` : ""}: ${txt}${d !== null ? ` (now ${d > 0 ? d + "d later" : -d + "d earlier"})` : ""}`}
    >
      agreed {txt}
    </span>
  );
}

/** A finished task, against the due date planned when it began. */
function daysEarly(task: { status: string; due_date?: string | null; planned_due_date?: string | null; completed_at?: string | null }): number | null {
  if (task.status !== "completed") return null;
  return daysAhead(task.planned_due_date ?? task.due_date, task.completed_at);
}

/** Whole days between a due date and today. Used only for overdue tasks. */
function daysLate(dueDate?: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return Math.max(1, Math.ceil((Date.now() - due.getTime()) / 86400000));
}
import { SearchBox } from "@/components/ui/SearchBox";
import { Toast } from "@/components/ui/Toast";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskStatusControls } from "./TaskStatusControls";
import { defaultTaskOrder } from "@/lib/tasks/order";
import type { TaskWithDetails, TaskTransitionResult } from "@/types/tasks";
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListBulletIcon,
  ChatBubbleLeftIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

// Types
export interface PlanGate {
  canStart: boolean;
  startReason: string | null;
  canComplete: boolean;
  completeReason: string | null;
  canSkip?: boolean;
  skipReason?: string | null;
  skipNeedsReason?: boolean;
}

/**
 * Hours worked so far, including a running clock. The API stamps
 * live_active_seconds at fetch time; the table's own tick keeps it moving.
 */
function elapsedHours(t: { total_active_seconds?: number; live_active_seconds?: number }): number {
  return Math.round(((t.live_active_seconds ?? t.total_active_seconds ?? 0) / 3600) * 10) / 10;
}

/**
 * Slate under three quarters of the estimate, amber up to it, red past it -
 * and, once the work is finished, green when it came in under.
 */
function hoursTone(used: number, est: number, done = false): string {
  if (!est) return "text-slate-600";
  const r = used / est;
  if (r > 1) return "text-red-600 font-medium";
  if (done) return "text-emerald-600 font-medium";
  if (r >= 0.75) return "text-amber-700 font-medium";
  return "text-slate-600";
}

interface Task {
  /** Plan fields. Present on every task; only the Plan tab renders them. */
  actual_hours?: number;
  procedure_run_id?: string | null;
  procedure_step_id?: string | null;
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
  tags?: Array<{ id: string; name: string; color: string }>;
  // Lifecycle timing (see task_work_sessions / task_status_history)
  estimated_hours?: number;
  hold_reason?: string;
  hold_owner?: "client" | "vendor" | "internal" | "third_party" | null;
  hold_reason_code?: string | null;
  hold_expected_until?: string | null;
  hold_counterpart?: string | null;
  /** Dates set by a person; the scheduler lays the plan around them. */
  dates_pinned?: boolean;
  /** The plan as it stood when the task began; what early/late is measured against. */
  planned_start_date?: string | null;
  planned_due_date?: string | null;
  /** From the API: a playbook step, the stage it belongs to, its place in the playbook. */
  is_plan_step?: boolean;
  stage_title?: string | null;
  plan_order?: number | null;
  /** The agreed plan (latest baseline) - preferred over planned_* when the project has one. */
  agreed_start_date?: string | null;
  agreed_due_date?: string | null;
  agreed_version?: number | null;
  first_started_at?: string | null;
  completed_at?: string | null;
  total_active_seconds?: number;
  live_active_seconds?: number;
  is_clock_running?: boolean;
  open_subtask_count?: number;
  completion_count?: number;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

type TabType = "my-tasks" | "assigned-by-me" | "all-tasks";

export interface TaskTableProps {
  /**
   * Show the "Linked" column naming the lead or project a task belongs to.
   *
   * Off by default because both current callers are entity tabs, where every
   * row links to the page you are already looking at. The generic tasks list
   * at /dashboard/tasks has its own separate table and is unaffected.
   */
  showLinkedColumn?: boolean;
  /**
   * Show the expected-vs-logged hours and progress columns.
   *
   * The Plan tab needs them; the tasks list does not, and adding them there
   * would be noise. Same opt-in shape as showLinkedColumn.
   */
  showPlanColumns?: boolean;
  /**
   * Render `externalTasks` in the order given, instead of sorting.
   *
   * The plan's order is the playbook's - phase one, then its steps, then phase
   * two - and that is not recoverable from any column. Sorting by created_at
   * (the default) scattered the phases among their own steps.
   */
  preserveOrder?: boolean;
  /**
   * What the server would accept on each plan row, keyed by task id - from
   * /api/projects/[id]/plan-gates. A Start the server would refuse is drawn
   * disabled with the reason printed on the row, rather than turning red
   * after the round trip.
   */
  gates?: Record<string, PlanGate>;
  /**
   * "given": keep the caller's order until the user clicks a column - unlike
   * preserveOrder, sorting stays available. The project Tasks tab hands its
   * stages in playbook order and wants them shown that way by default.
   */
  defaultSort?: "created_at" | "given";
  /** Starting page size. A plan is read whole, not 25 rows at a time. */
  initialPageSize?: number;
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
  showPlanColumns = false,
  preserveOrder = false,
  defaultSort = "created_at",
  gates,
  initialPageSize,
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
  showLinkedColumn = false,
}: TaskTableProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  /** all · plan steps only · ad-hoc tasks only. */
  const [kindFilter, setKindFilter] = useState<"all" | "plan" | "adhoc">("all");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [sortField, setSortField] = useState<string>(defaultSort === "given" ? "" : "created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize ?? 25);

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
  // Feedback for inline edits, which have no form to report errors into.
  const [actionError, setActionError] = useState<string | null>(null);

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
              // Older builds cached the { tasks, pagination } envelope.
              setTasks(Array.isArray(cachedData) ? cachedData : cachedData.tasks || []);
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

        // GET /api/tasks responds with { tasks, pagination }, not a bare
        // array. This used to store the whole envelope in state, so any
        // caller that did not pass externalTasks crashed on tasks.forEach.
        const data = await response.json();
        const taskList: Task[] = Array.isArray(data) ? data : data.tasks || [];
        setTasks(taskList);

        // Cache the data
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(taskList));
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
      setTasks((prev) => reconcile(externalTasks, prev));
      setIsLoading(false);
    } else {
      // Try to load from cache immediately for instant display
      const cacheKey = getCacheKey();
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setTasks(Array.isArray(cachedData) ? cachedData : cachedData.tasks || []);
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
  /**
   * Fields this table changed itself, per row, and the value it gave them.
   *
   * A sync from the parent (externalTasks) is not allowed to move such a field
   * back to an older value. The Plan tab refreshes its structure and its task
   * list in parallel, and when the structure came back first the table
   * rebuilt its rows from the not-yet-refreshed list - so a step just started
   * flashed back to To Do, and an assignee just cleared flashed back to the
   * old name, for a beat before the fresh list arrived. This is the general
   * rule, for every field: once the incoming value agrees the entry is
   * dropped, and it expires after a while so a genuine server-side change is
   * never hidden for long.
   */
  const recentLocal = useRef<Map<string, Map<string, { value: unknown; at: number }>>>(new Map());
  /** The fields a transition's answer settles for the row. */
  const PINNED_AFTER_TRANSITION = [
    "status",
    "start_date",
    "due_date",
    "started_at",
    "completed_at",
    "first_started_at",
    "first_completed_at",
    "hold_owner",
    "hold_reason_code",
    "hold_expected_until",
    "hold_reason",
    "actual_hours",
    "dates_pinned",
  ] as const;
  const noteLocal = (id: string, field: string, value: unknown) => {
    const row = recentLocal.current.get(id) ?? new Map();
    row.set(field, { value, at: Date.now() });
    recentLocal.current.set(id, row);
  };
  const noteLocalStatus = (id: string, status: string) => noteLocal(id, "status", status);
  const reconcile = (incoming: Task[], previous: Task[]): Task[] => {
    const all = recentLocal.current;
    if (all.size === 0) return incoming;
    const same = (x: unknown, y: unknown) => (x ?? null) === (y ?? null);
    const localById = new Map<string, Task>();
    for (const t of previous) {
      localById.set(t.id, t);
      for (const st of t.subtasks ?? []) localById.set(st.id, st);
    }
    const fix = (row: Task): Task => {
      const mine = all.get(row.id);
      if (!mine) return row;
      let out: Task = row;
      let held = false;
      for (const [field, { value, at }] of mine) {
        const current = (row as unknown as Record<string, unknown>)[field];
        if (same(current, value) || Date.now() - at > 15000) {
          mine.delete(field);
          continue;
        }
        held = true;
        out = { ...out, [field]: value } as Task;
        if (field === "status") out = { ...out, is_clock_running: value === "in_progress" };
      }
      if (mine.size === 0) all.delete(row.id);
      // An incoming row we are holding a field against is a stale one, so its
      // clock is stale too: keep the seconds the row already has rather than
      // snapping back to an older count and forward again a moment later.
      if (held) {
        const local = localById.get(row.id);
        if (local) {
          out = {
            ...out,
            live_active_seconds: local.live_active_seconds,
            total_active_seconds: local.total_active_seconds,
          };
        }
      }
      return out;
    };
    return incoming.map((t) => {
      const fixed = fix(t);
      return fixed.subtasks ? { ...fixed, subtasks: fixed.subtasks.map(fix) } : fixed;
    });
  };

  // Running clocks in the Hours column advance without a refetch.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const anyRunning = tasks.some(
      (t) => t.is_clock_running || t.subtasks?.some((st) => st.is_clock_running),
    );
    if (!anyRunning) return;
    const id = setInterval(() => setClockTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [tasks]);

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
    // The caller's order is meaningful and not derivable from a column.
    if (preserveOrder || sortField === "") return result;

    // The default column is the shared order - plan steps in playbook order,
    // grouped by project, then ad-hoc newest first - the same as every other
    // task table. Clicking the column again just reverses it.
    if (sortField === "created_at") {
      const ordered = defaultTaskOrder(result);
      return sortDirection === "desc" ? ordered : ordered.reverse();
    }

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

  const tasksInTab = useMemo(() => {
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

  // How much of the current tab is late. Shown as a count the user can click,
  // so overdue work is something you find rather than something you have to
  // notice while scrolling.
  const overdueCount = useMemo(
    () => tasksInTab.filter((t) => isOverdue(t)).length,
    [tasksInTab]
  );

  const activeTasks = useMemo(
    () => {
      let list = showOverdueOnly ? tasksInTab.filter((t) => isOverdue(t)) : tasksInTab;
      if (kindFilter === "plan") list = list.filter((t) => !!t.procedure_run_id);
      if (kindFilter === "adhoc") list = list.filter((t) => !t.procedure_run_id);
      return list;
    },
    [tasksInTab, showOverdueOnly, kindFilter]
  );

  // Pagination
  const totalPages = Math.ceil(activeTasks.length / pageSize);
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return activeTasks.slice(startIndex, startIndex + pageSize);
  }, [activeTasks, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatuses, searchQuery, activeTab, showOverdueOnly, kindFilter]);

  // Nothing left to show once the last one is dealt with - drop the filter
  // rather than leaving the user on a deliberately empty list.
  useEffect(() => {
    if (showOverdueOnly && overdueCount === 0) setShowOverdueOnly(false);
  }, [showOverdueOnly, overdueCount]);

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
        const data = await response.json();
        // Same envelope mistake as the tasks page had: the route replies
        // { task }, so .id off the top level was undefined and the optimistic
        // subtask kept its placeholder id.
        const savedId = data.task?.id;
        if (savedId) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === parentTaskId
                ? {
                    ...t,
                    subtasks: t.subtasks?.map((st) =>
                      st.id === tempId ? { ...st, id: savedId } : st
                    ),
                  }
                : t
            )
          );
        }
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
    // Work in progress always has an owner - the same rule the server
    // enforces, said here before the row changes rather than after it snaps
    // back.
    if (field === "assigned_to" && !value) {
      const row = isSubtask && parentTaskId
        ? tasks.find((t) => t.id === parentTaskId)?.subtasks?.find((st) => st.id === taskId)
        : tasks.find((t) => t.id === taskId);
      if (row?.status === "in_progress") {
        setActionError("This task is in progress - assign it to someone else, or pause it before unassigning.");
        return;
      }
    }

    noteLocal(taskId, field, value);

    // A plan step held from the status dropdown carries what the playbook
    // knows about who it waits on, the same as the pause button does.
    let extra: Record<string, unknown> = {};
    if (field === "status" && (value === "on_hold" || value === "blocked")) {
      const row = isSubtask && parentTaskId
        ? tasks.find((t) => t.id === parentTaskId)?.subtasks?.find((st) => st.id === taskId)
        : tasks.find((t) => t.id === taskId);
      const step = (row as any)?.playbook_step;
      if (row?.procedure_run_id && step?.owner_type && step.owner_type !== "internal") {
        extra = { hold_owner: step.owner_type, hold_reason_code: step.default_delay_reason ?? undefined };
      }
    }

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
        body: JSON.stringify({ [field]: value, ...extra }),
      });

      if (!response.ok) {
        // Some refusals are deliberate (completing a parent with open
        // subtasks, invalid status jumps). Surface the server's reason -
        // otherwise the optimistic update silently snaps back and the user
        // has no idea why.
        const data = await response.json().catch(() => ({}));
        setActionError(data.error || "Could not update the task");
        handleRefresh(); // Revert the optimistic update
      } else {
        // Invalidate cache on successful update
        invalidateCache();
        // The row takes the server's answer at once - a status set from the
        // dropdown comes back with the dates the scheduler moved and the
        // stamps the transition wrote - and those fields are pinned so a
        // stale sync cannot undo them. The parent's refresh then brings the
        // OTHER rows in line in one render.
        const answered = (await response.json().catch(() => ({})))?.task as Record<string, unknown> | undefined;
        if (answered) {
          const patch: Record<string, unknown> = {};
          for (const f of PINNED_AFTER_TRANSITION) {
            if (f in answered) {
              patch[f] = answered[f];
              noteLocal(taskId, f, answered[f]);
            }
          }
          const apply = (t: Task) =>
            ({ ...t, ...patch, is_clock_running: (patch.status ?? t.status) === "in_progress" }) as Task;
          setTasks((prev) =>
            prev.map((t) =>
              isSubtask && parentTaskId
                ? t.id === parentTaskId
                  ? { ...t, subtasks: t.subtasks?.map((st) => (st.id === taskId ? apply(st) : st)) }
                  : t
                : t.id === taskId
                  ? apply(t)
                  : t,
            ),
          );
        }
        // Refresh if status completed - and on any status change in plan
        // mode, so the Timer buttons follow what the dropdown set.
        if (field === "status" && (value === "completed" || externalTasks)) {
          handleRefresh();
        }
        // A date changed on a plan step pins it and re-lays everything after
        // it; the other rows have moved, so read them back. An assignee change
        // re-reads too, because Start is gated on having one.
        if (field === "start_date" || field === "due_date" || field === "assigned_to") {
          const row = isSubtask && parentTaskId
            ? tasks.find((t) => t.id === parentTaskId)?.subtasks?.find((st) => st.id === taskId)
            : tasks.find((t) => t.id === taskId);
          if (row?.procedure_run_id) handleRefresh();
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

  /**
   * One row, as a render function - called as `TaskRow({ task })`, NEVER as
   * `<TaskRow />`.
   *
   * It closes over the table's state and handlers, so it is re-created on
   * every render. Used as a JSX element that made it a new component TYPE
   * each time, and React answers a changed type by unmounting the old row
   * and mounting a fresh one: every row's DOM was replaced on every render,
   * the timer controls lost their optimistic and clock state, chips blinked
   * as their nodes were swapped, a hovered tooltip was orphaned (its element
   * vanished without a mouseleave) and reappeared under the cursor, and the
   * focused button lost focus. Called as a function the rows are ordinary
   * children of the table, keyed and kept.
   *
   * It must therefore hold no hooks of its own.
   */
  const TaskRow = ({
    task,
    isSubtask = false,
    parentTaskId,
  }: {
    task: Task;
    isSubtask?: boolean;
    parentTaskId?: string;
  }) => {
    // One set of props for both instances of the controls on this row: the
    // Timer cell (start / pause / resume) and the Actions cell (complete, more).
    const controlProps = {
      variant: "compact" as const,
      task: { ...task, total_active_seconds: task.total_active_seconds ?? 0 },
      // No assignee is decided here, from the row as it is right now, so the
      // Start button follows an assignee change the instant it is made rather
      // than a gate refetch later. Everything else still comes from the gates.
      startBlockedReason:
        task.status !== "in_progress" && !task.assigned_to
          ? "Assign someone first"
          : task.status === "todo" && gates?.[task.id] && !gates[task.id].canStart
            ? gates[task.id].startReason || "Cannot start yet"
            : null,
      completeBlockedReason: !task.assigned_to
        ? "Assign someone first"
        : gates?.[task.id] && !gates[task.id].canComplete
          ? gates[task.id].completeReason
          : null,
      onError: (message: string) => setActionError(message),
      // The badge moves with the buttons, before the server answers.
      onOptimistic: (status: TaskStatus) => {
        noteLocalStatus(task.id, status);
        // The stamps the transition is about to write, so the early/late
        // chip that reads them appears with the click rather than a round
        // trip later. The server's own values replace these on answer.
        const now = new Date().toISOString();
        const stamps: Partial<Task> =
          status === "completed"
            ? { completed_at: now }
            : status === "in_progress" && !task.first_started_at
              ? { first_started_at: now }
              : {};
        const apply = (t: Task): Task => ({ ...t, status, ...stamps });
        setTasks((prev) =>
          prev.map((t) => {
            if (isSubtask && parentTaskId) {
              if (t.id !== parentTaskId) return t;
              return { ...t, subtasks: t.subtasks?.map((st) => (st.id === task.id ? apply(st) : st)) };
            }
            return t.id === task.id ? apply(t) : t;
          }),
        );
      },
      disabled: !isEditable,
      onTransitioned: (updated: TaskWithDetails, result?: TaskTransitionResult) => {
              // A subtask transition changes its PARENT's gating state too:
              // completing the last open child unblocks the parent's tick, and
              // reopening a child pushes a completed parent back to
              // in_progress (the DB does this - see task_transition). Patching
              // only the row that moved left the parent stale, so its Complete
              // button stayed disabled after its subtasks were finished.
              if (isSubtask && parentTaskId) {
                setTasks((prev) =>
                  prev.map((t) => {
                    if (t.id !== parentTaskId) return t;
                    const subtasks = (t.subtasks || []).map((st) =>
                      st.id === task.id
                        ? { ...st, ...updated, is_clock_running: updated.status === "in_progress" }
                        : st
                    );
                    const settled = (st: { status: string }) =>
                      st.status === "completed" || st.status === "cancelled";
                    return {
                      ...t,
                      subtasks,
                      open_subtask_count: subtasks.filter((st) => !settled(st))
                        .length,
                      completed_subtask_count: subtasks.filter(
                        (st) => st.status === "completed"
                      ).length,
                      status: result?.parent_reopened
                        ? ("in_progress" as typeof t.status)
                        : t.status,
                    };
                  })
                );
              } else {
                setTasks((prev) =>
                  prev.map((t) =>
                    t.id === task.id
                      ? { ...t, ...updated, is_clock_running: updated.status === "in_progress" }
                      : t
                  )
                );
              }
              invalidateCache();
              // The server's answer is the truth for this row now - status,
              // the dates the scheduler moved, the stamps, the hold. Note
              // every one of them, not just status, so a sync from the parent
              // that was read a beat earlier cannot flash the row back to
              // what it was before the click. (The parent now reads its
              // data in one batch, but this row must be right regardless of
              // which of its readers answers first.)
              for (const field of PINNED_AFTER_TRANSITION) {
                if (field in updated) noteLocal(task.id, field, (updated as unknown as Record<string, unknown>)[field]);
              }
              // When the rows come from a parent (the Plan tab), the parent's
              // copy is what the next render draws from - the sync effect puts
              // it back over the local patch. So ask the parent to re-read:
              // badge, buttons, gates and hours move together, and stay moved.
              if (externalTasks) handleRefresh();
            },
    };
    const isExpanded = expandedTasks.has(task.id);
    const hasSubtasks = task.subtask_count > 0;
    const isEditingTitle =
      editingTaskId === task.id && editingField === "title";
    const assigneeId =
      typeof task.assigned_to === "string" ? task.assigned_to : null;

    /**
     * A finished task is read-only until it is reopened.
     *
     * isEditable is a property of the TABLE - allowEdit && !readOnly - and says
     * nothing about the row, so every field on a completed task stayed editable
     * inline: status, priority, assignee and dates could all be changed while
     * it read as done. Completing something should settle it.
     *
     * The way back is deliberate and still there: the Reopen control in the
     * timer column, or the edit modal.
     */
    const isSettled =
      task.status === "completed" ||
      task.status === "cancelled" ||
      task.status === "skipped";
    const rowEditable = isEditable && !isSettled;

    return (
      <tr
        className={`group border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
          isSubtask ? "bg-slate-50/30" : ""
        }`}
      >
        {/* Task Name */}
        <td className={`px-2 py-1.5 ${isSubtask ? "pl-4" : ""}`}>
          <div className="flex items-center gap-1 min-w-0">
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
                // A plan step's name is the playbook's; it is not renamed here.
                onClick={() => rowEditable && !showPlanColumns && startEditingTitle(task)}
                className="text-left flex items-center gap-1.5 group/title"
                disabled={!rowEditable || showPlanColumns}
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
                {/* A playbook step says so, quietly: it obeys the plan's
                    rules and its dates come from the schedule, which a plain
                    task's do not. Not on the Plan tab itself, where every row
                    is one. */}
                {task.procedure_run_id && !showPlanColumns && (
                  <span
                    className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-blue-700"
                    title={`Playbook step${task.stage_title ? ` · stage: ${task.stage_title}` : ""}${task.related_name ? ` · ${task.related_name}` : ""}`}
                  >
                    plan
                  </span>
                )}
                {/* Inline rather than a 9th column - this table is already
                    dense and tags are a scan aid, not a sortable field. */}
                <TagChips tags={task.tags} max={3} size="xs" />
              </button>
            )}


            {/* Not on a plan: a step comes from the playbook with its owner,
                hours, gates and "waits for"; a task typed here would have
                none of that. One-off work belongs on the Tasks tab. */}
            {!isSubtask && !isEditingTitle && rowEditable && !showPlanColumns && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInlineSubtaskFor(task.id);
                }}
                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                title="Add subtask"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            )}

          </div>
        </td>

        {/* Timer - start/pause + complete, with live elapsed time */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <TaskStatusControls {...controlProps} />
        </td>

        {/* Notes */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <button
            onClick={(e) => {
              if (rowEditable) {
                openNotesPopover(task, e, isSubtask ? parentTaskId : undefined);
              }
            }}
            disabled={!rowEditable}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
              task.description
                ? "text-blue-500 hover:bg-blue-50"
                : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
            } ${!rowEditable ? "opacity-50 cursor-not-allowed" : ""}`}
            title={
              task.description
                ? rowEditable
                  ? "View/Edit notes"
                  : "View notes"
                : rowEditable
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
              if (rowEditable) {
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
            readOnly={!rowEditable}
          />
        </td>

        {/* Priority */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <PriorityBadge
            value={task.priority}
            onChange={(val) => {
              if (rowEditable) {
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
            readOnly={!rowEditable}
          />
        </td>

        {/* Assignee */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <AssigneeSelector
            selected={assigneeId}
            onChange={(val) => {
              if (rowEditable) {
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
            readOnly={!rowEditable}
          />
        </td>

        {/* Start Date. Once a task has begun this is the day it began - a
            fact, so an absolute date - with a chip saying how that compared
            to what was planned when it started. */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <DatePicker
              value={task.start_date || ""}
              onChange={(val) => {
                if (rowEditable) {
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
              readOnly={!rowEditable}
              absolute={task.status !== "todo"}
            />
            {task.status !== "todo" ? (
              <PlannedChip
                planned={task.agreed_start_date ?? task.planned_start_date}
                actual={task.first_started_at ?? task.start_date}
                what="started"
                agreedVersion={task.agreed_start_date ? task.agreed_version : null}
              />
            ) : (
              <AgreedHint agreed={task.agreed_start_date} current={task.start_date} version={task.agreed_version} />
            )}
          </div>
        </td>

        {/* Due Date. A faint cell tint alone was too easy to miss, so an
            overdue task also carries an explicit badge saying how late it is.
            Only dated, unfinished work can be overdue. */}
        <td
          className={`px-2 py-1.5 whitespace-nowrap ${
            isOverdue(task) ? "bg-red-50/60" : ""
          }`}
        >
          <div className="flex items-center gap-1.5">
            <DatePicker
              value={task.due_date || ""}
              onChange={(val) => {
                if (rowEditable) {
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
              readOnly={!rowEditable}
              // Without this the picker decides on the date alone, and a task
              // completed after its due date still showed red.
              overdue={isOverdue(task)}
              absolute={task.status !== "todo"}
            />

            {isOverdue(task) && (
              <span
                className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700"
                title={`Overdue by ${daysLate(task.due_date)} day${
                  daysLate(task.due_date) === 1 ? "" : "s"
                }`}
              >
                {daysLate(task.due_date)}d late
              </span>
            )}
            {task.status === "completed" ? (
              <PlannedChip
                planned={task.agreed_due_date ?? task.planned_due_date ?? task.due_date}
                actual={task.completed_at}
                what="finished"
                agreedVersion={task.agreed_due_date ? task.agreed_version : null}
              />
            ) : task.status === "todo" ? (
              <AgreedHint agreed={task.agreed_due_date} current={task.due_date} version={task.agreed_version} />
            ) : null}
          </div>
        </td>

        {/* Hours and progress, for the plan view.
            A playbook step is written in expected hours and measured in logged
            ones, and the difference is the whole point of the Plan tab - it is
            where a process quietly costs more than anyone planned. Off by
            default: on the tasks list these columns are noise. */}
        {showPlanColumns && (
          <td className="px-2 py-1.5 whitespace-nowrap text-xs tabular-nums">
            {(() => {
              // A stage's hours are its steps' hours. Its own estimate is
              // ignored, the same way the scheduler ignores it: a stage lasts
              // as long as its steps do. Logged time on the stage row itself
              // still counts - it was worked.
              const kids = task.subtasks ?? [];
              const est = kids.length
                ? kids.reduce((sum: number, k: any) => sum + Number(k.estimated_hours ?? 0), 0)
                : Number(task.estimated_hours ?? 0);
              // Hours spent so far, running clocks included - actual_hours
              // only settles when a session ends, so a step in progress read
              // 0h until it was paused.
              const act = Math.round(
                (kids.reduce((sum: number, k: any) => sum + elapsedHours(k), 0) + elapsedHours(task)) * 10,
              ) / 10;
              if (!est && !act) return <span className="text-slate-300">—</span>;
              const over = est > 0 && act > est;
              return (
                <span
                  className={hoursTone(act, est, task.status === "completed")}
                  title={
                    over
                      ? `${act}h spent against ${est}h expected — over by ${Math.round((act - est) * 10) / 10}h`
                      : est
                        ? `${act}h spent of ${est}h expected (${Math.round((act / est) * 100)}%)`
                        : `${act}h spent`
                  }
                >
                  {act}h <span className="text-slate-400 font-normal">/ {est}h</span>
                </span>
              );
            })()}
          </td>
        )}
        {showPlanColumns && (
          <td className="px-2 py-1.5 whitespace-nowrap">
            {(() => {
              // Progress is earned in hours: a finished step is worth its whole
              // estimate, a step under way is worth the hours spent on it (up to
              // its estimate), a stage is the sum of its steps. Falls back to
              // counting steps where no hours were written.
              const settledSet = ["completed", "skipped", "cancelled"];
              const earned = (t: any) => {
                const e = Number(t.estimated_hours ?? 0);
                if (settledSet.includes(t.status)) return e;
                return Math.min(e, elapsedHours(t));
              };
              const kidsForHours = task.subtasks ?? [];
              const estTotal = kidsForHours.length
                ? kidsForHours.reduce((s: number, k: any) => s + Number(k.estimated_hours ?? 0), 0)
                : Number(task.estimated_hours ?? 0);
              if (estTotal > 0) {
                const got = kidsForHours.length
                  ? kidsForHours.reduce((s: number, k: any) => s + earned(k), 0)
                  : settledSet.includes(task.status)
                    ? estTotal
                    : earned(task);
                const pctH = Math.min(100, Math.round((got / estTotal) * 100));
                return (
                  <span className="flex items-center gap-1.5" title={`${Math.round(got * 10) / 10}h of ${estTotal}h earned`}>
                    <span className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <span
                        className={`block h-full rounded-full ${pctH >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${pctH}%` }}
                      />
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums">{pctH}%</span>
                  </span>
                );
              }
              // A parent reports its children; a leaf is all or nothing, since
              // there is nothing finer to count.
              const kids = task.subtasks ?? [];
              const done = kids.filter((k: any) =>
                ["completed", "skipped", "cancelled"].includes(k.status),
              ).length;
              const pct = kids.length
                ? Math.round((done / kids.length) * 100)
                : ["completed", "skipped"].includes(task.status)
                  ? 100
                  : task.status === "in_progress"
                    ? 50
                    : 0;
              return (
                <span className="flex items-center gap-1.5" title={`${pct}% complete`}>
                  <span className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <span
                      className={`block h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">{pct}%</span>
                </span>
              );
            })()}
          </td>
        )}

        {/* Linked - hidden by default: inside a lead or project tab
            every task links to that same entity, so the column only repeats
            the page you are already on. */}
        {showLinkedColumn && (
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
              if (!rowEditable) return;
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
            readOnly={!rowEditable}
          />
          </td>
        )}

        {/* Actions. Always visible and colour-coded, matching the notes and
            calendar tables - the edit button used to live inside the title
            cell and only appeared on row hover, which made the affordance easy
            to miss entirely. */}
        <td className="px-2 py-1.5 whitespace-nowrap text-right">
          <span className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTaskClick?.(task);
              }}
              title="Edit task details"
              className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
            </button>
          </span>
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
      <Toast message={actionError} onDismiss={() => setActionError(null)} />
      <div className={compact ? "" : "h-full flex flex-col px-4 py-4"}>
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
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

              {/* Plan steps or plain tasks. Only where both kinds can meet -
                  the Plan tab is all steps and needs no switch. */}
              {!showPlanColumns && tasksInTab.some((t) => t.procedure_run_id) && tasksInTab.some((t) => !t.procedure_run_id) && (
                <span className="shrink-0 inline-flex rounded-md border border-slate-200 overflow-hidden text-xs">
                  {(["all", "plan", "adhoc"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKindFilter(k)}
                      className={`px-2.5 py-1.5 font-medium transition-colors ${
                        kindFilter === k ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {k === "all" ? "All" : k === "plan" ? "Plan steps" : "Ad hoc"}
                    </button>
                  ))}
                </span>
              )}
              {/* Only appears when something is actually late, so it reads as
                  an alert rather than a permanently empty filter. */}
              {overdueCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOverdueOnly((v) => !v)}
                  title={
                    showOverdueOnly
                      ? "Show all tasks"
                      : "Show only overdue tasks"
                  }
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    showOverdueOnly
                      ? "bg-red-600 border-red-600 text-white"
                      : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  }`}
                >
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  {overdueCount} overdue
                </button>
              )}

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
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                      Timer
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
                    {showPlanColumns && (
                      <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                        Hours
                      </th>
                    )}
                    {showPlanColumns && (
                      <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                        Progress
                      </th>
                    )}
                    {showLinkedColumn && (
                    <th
                      onClick={() => handleSort("linked")}
                      className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      Linked <SortIndicator field="linked" />
                    </th>
                    )}
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {paginatedTasks.map((task) => (
                    <React.Fragment key={task.id}>
                      {TaskRow({ task })}
                      {/* Inline Subtask Input */}
                      {inlineSubtaskFor === task.id && (
                        <tr className="border-b border-slate-100 bg-blue-50/30">
                          {/* Tracks the header, which is 10 columns with Linked and 9 without.
                              This was hard-coded at 9 while the table had 10,
                              so the inline subtask row stopped one short. */}
                          <td
                            className="px-2 py-1.5 pl-8"
                            colSpan={
                              10 +
                              (showLinkedColumn ? 1 : 0) +
                              (showPlanColumns ? 2 : 0)
                            }
                          >
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
                          <React.Fragment key={`subtask-${task.id}-${subtask.id || index}`}>
                            {TaskRow({ task: subtask, isSubtask: true, parentTaskId: task.id })}
                          </React.Fragment>
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
