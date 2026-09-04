// ============================================================================
// Task Management Types
// ============================================================================

// Enums matching database types
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "on_hold"
  | "blocked"
  | "completed"
  | "skipped"
  | "cancelled";

// Statuses where the work clock is running
export const ACTIVE_TASK_STATUSES: TaskStatus[] = ["in_progress"];
// Statuses where the task is parked and accruing held time
export const PARKED_TASK_STATUSES: TaskStatus[] = ["on_hold", "blocked"];
// Statuses where the task is finished and no longer accrues anything
export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  "completed",
  "skipped",
  "cancelled",
];
export type TaskRelatedType = "lead" | "quotation" | "project" | "client";
export type TaskTemplateCategory =
  | "project"
  | "carpentry"
  | "sales"
  | "design"
  | "installation"
  | "general";

// Display helpers
export const TaskPriorityLabels: Record<TaskPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const TaskPriorityColors: Record<
  TaskPriority,
  { bg: string; text: string; dot: string }
> = {
  critical: { bg: "bg-red-100", text: "text-red-900", dot: "bg-red-600" },
  high: { bg: "bg-orange-100", text: "text-orange-900", dot: "bg-orange-600" },
  medium: {
    bg: "bg-blue-100",
    text: "text-blue-900",
    dot: "bg-blue-600",
  },
  low: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
};

export const TaskStatusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  on_hold: "On Hold",
  blocked: "Blocked",
  completed: "Completed",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

export const TaskStatusColors: Record<
  TaskStatus,
  { bg: string; text: string; dot: string }
> = {
  todo: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  on_hold: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  blocked: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  completed: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  // Settled but not done - deliberately passed over, which is a different
  // outcome from cancelled and worth seeing as such.
  skipped: { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" },
  cancelled: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

export const TaskRelatedTypeLabels: Record<TaskRelatedType, string> = {
  lead: "Lead",
  quotation: "Quotation",
  project: "Project",
  client: "Client",
};

export const TaskTemplateCategoryLabels: Record<TaskTemplateCategory, string> =
  {
    project: "Project Management",
    carpentry: "Carpentry",
    sales: "Sales",
    design: "Design",
    installation: "Installation",
    general: "General",
  };

export const TaskTemplateCategoryColors: Record<
  TaskTemplateCategory,
  { bg: string; text: string }
> = {
  project: { bg: "bg-blue-100", text: "text-blue-700" },
  carpentry: { bg: "bg-amber-100", text: "text-amber-700" },
  sales: { bg: "bg-green-100", text: "text-green-700" },
  design: { bg: "bg-purple-100", text: "text-purple-700" },
  installation: { bg: "bg-teal-100", text: "text-teal-700" },
  general: { bg: "bg-slate-100", text: "text-slate-700" },
};

// ============================================================================
// Task Tag
// ============================================================================

export interface TaskTag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Task Template
// ============================================================================

export interface TaskTemplateItem {
  id: string;
  template_id: string;
  parent_item_id?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  relative_due_days?: number;
  estimated_hours?: number;
  assign_to_role?: string;
  assign_to_user_id?: string;
  sort_order: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Nested for UI
  children?: TaskTemplateItem[];
}

export interface TaskTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  category: TaskTemplateCategory;
  is_active: boolean;
  is_protected: boolean;
  default_priority: TaskPriority;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  // Related data
  items?: TaskTemplateItem[];
  item_count?: number;
  created_by_name?: string;
}

// ============================================================================
// Main Task
// ============================================================================

export interface Task {
  id: string;
  tenant_id: string;
  task_number: string;
  parent_task_id?: string;
  template_id?: string;
  template_item_id?: string;
  is_from_template: boolean;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  estimated_hours?: number;
  /** Derived from task_work_sessions by the DB. Do not set by hand. */
  actual_hours?: number;
  // --- lifecycle timing (see task_status_history / task_work_sessions) ---
  /** Most recent transition into in_progress. Resets on every resume. */
  started_at?: string;
  /** First ever start. Never overwritten, so cycle time survives a reopen. */
  first_started_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  /** The ORIGINAL completion. Never overwritten - survives a reopen. */
  first_completed_at?: string;
  /** Times completed. > 1 means rework. */
  completion_count?: number;
  /** Why the task is currently on_hold or blocked. */
  hold_reason?: string;
  /** Settled worked seconds. Excludes any running session. */
  total_active_seconds: number;
  /** Accumulated seconds spent on_hold or blocked. */
  total_held_seconds: number;
  assigned_to?: string;
  related_type?: TaskRelatedType;
  related_id?: string;
  /**
   * NOT IMPLEMENTED. These three columns exist in the database but nothing
   * reads or writes them - there is no recurrence engine, no scheduler and no
   * UI. They are typed as optional so no code can assume a recurring task will
   * ever actually recur. Either build the feature or drop the columns; do not
   * treat these as working.
   */
  is_recurring?: boolean;
  recurrence_rule?: string;
  recurrence_end_date?: string;
  created_by?: string;
  updated_by?: string;
  completed_by?: string;
  created_at: string;
  updated_at: string;
}

// Task with joined data from view
export interface TaskWithDetails extends Task {
  // Assigned user
  assigned_to_name?: string;
  assigned_to_email?: string;
  assigned_to_avatar?: string;
  // Created by
  created_by_name?: string;
  created_by_email?: string;
  // Completed by
  completed_by_name?: string;
  // Template info
  template_name?: string;
  template_category?: TaskTemplateCategory;
  // Counts
  subtask_count: number;
  completed_subtask_count: number;
  comment_count: number;
  attachment_count: number;
  // Tags (fetched separately or joined)
  tags?: TaskTag[];
  // Subtasks (for hierarchical display)
  subtasks?: TaskWithDetails[];
  // Related entity name (fetched separately)
  related_name?: string;
  // --- live timing, from the tasks_with_timing view ---
  /** total_active_seconds plus any session running right now. */
  live_active_seconds?: number;
  /** total_held_seconds plus the current hold, if parked. */
  live_held_seconds?: number;
  /** True while at least one work session is open. */
  is_clock_running?: boolean;
  /** created_at -> completed_at */
  lead_time_seconds?: number;
  /** first_started_at -> completed_at */
  cycle_time_seconds?: number;
  /** Every entry into in_progress. 0 = never started. */
  start_count?: number;
  /** Entries into in_progress after the first. 0 = started once, never paused. */
  resume_count?: number;
  /** created_at -> first_completed_at. Stable across reopens, unlike lead_time_seconds. */
  original_lead_time_seconds?: number;
  /** Completed more than once. */
  is_rework?: boolean;
  /** Subtasks not yet completed or cancelled. These block completion. */
  open_subtask_count?: number;
}

// ============================================================================
// Task Timing
// ============================================================================

/**
 * One worked interval. Effort, not elapsed time - several people can have
 * concurrent open sessions against the same task.
 */
export interface TaskWorkSession {
  id: string;
  task_id: string;
  tenant_id: string;
  user_id?: string;
  started_at: string;
  ended_at?: string;
  /** 0 while the session is still open. */
  duration_seconds: number;
  source: "status" | "manual" | "timer";
  note?: string;
  created_at: string;
}

/**
 * One status change. Elapsed time, not effort.
 * duration_seconds is how long the task sat in from_status before this row.
 */
export interface TaskStatusHistoryEntry {
  id: string;
  task_id: string;
  tenant_id: string;
  from_status?: TaskStatus;
  to_status: TaskStatus;
  duration_seconds: number;
  reason?: string;
  changed_by?: string;
  changed_at: string;
}

/** Result of the task_transition() RPC. */
export interface TaskTransitionResult {
  success: boolean;
  error?: string;
  /** Titles of subtasks blocking completion, when the gate refuses. */
  open_subtasks?: string[];
  /** True when reopening this subtask also reopened its parent. */
  parent_reopened?: boolean;
  status?: TaskStatus;
  from?: TaskStatus;
  to?: TaskStatus;
  started_at?: string | null;
  first_started_at?: string | null;
  completed_at?: string | null;
  total_active_seconds?: number;
  total_held_seconds?: number;
}

/**
 * Allowed status transitions. Mirrors is_valid_task_transition() in the DB -
 * kept here so the UI can grey out impossible actions before a round trip.
 * The DB remains the authority.
 */
export const ValidTaskTransitions: Record<TaskStatus, TaskStatus[]> = {
  // todo -> completed is allowed: ticking off a task nobody formally started
  // is normal, and it simply records zero worked time.
  todo: ["in_progress", "completed", "cancelled", "skipped"],
  in_progress: ["on_hold", "blocked", "completed", "cancelled", "skipped"],
  on_hold: ["in_progress", "blocked", "completed", "cancelled", "skipped"],
  blocked: ["in_progress", "on_hold", "completed", "cancelled", "skipped"],
  completed: ["in_progress", "todo"],
  skipped: ["todo", "in_progress"],
  cancelled: ["todo"],
};

/** Pausing or blocking requires a reason - the DB rejects it otherwise. */
export const TRANSITIONS_REQUIRING_REASON: TaskStatus[] = ["on_hold", "blocked"];

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  return ValidTaskTransitions[from]?.includes(to) ?? false;
}

/**
 * Past its due date and still open. Settled work is never overdue - a task
 * completed late is finished, not outstanding.
 */
export function isOverdue(task: {
  due_date?: string | null;
  status: TaskStatus;
}): boolean {
  if (!task.due_date) return false;
  if (TERMINAL_TASK_STATUSES.includes(task.status)) return false;
  const due = new Date(task.due_date);
  due.setHours(23, 59, 59, 999); // due "on" a day means end of that day
  return due.getTime() < Date.now();
}

/** Compact duration for table cells and badges: "3h 42m", "12m", "45s". */
export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds < 0) return "—";
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (hours < 24) return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours === 0 ? `${days}d` : `${days}d ${remainingHours}h`;
}

// ============================================================================
// Task Comment
// ============================================================================

export interface TaskComment {
  id: string;
  task_id: string;
  content: string;
  parent_comment_id?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  is_deleted: boolean;
  deleted_at?: string;
  // Joined data
  created_by_name?: string;
  created_by_avatar?: string;
  // Nested replies
  replies?: TaskComment[];
}

// ============================================================================
// Task Attachment
// ============================================================================

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  uploaded_by: string;
  created_at: string;
  // Joined data
  uploaded_by_name?: string;
}

// ============================================================================
// Task Activity
// ============================================================================

export interface TaskActivity {
  id: string;
  task_id: string;
  activity_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  description?: string;
  created_by?: string;
  created_at: string;
  // Joined data
  created_by_name?: string;
  created_by_avatar?: string;
}

// ============================================================================
// API Input Types
// ============================================================================

export interface CreateSubtaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority | null;
  status?: TaskStatus;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  assigned_to?: string;
  /**
   * Usually omitted - a subtask inherits its parent's linked entity via a
   * database trigger. Only set these to deliberately point a subtask at a
   * different lead/project than its parent.
   */
  related_type?: TaskRelatedType | null;
  related_id?: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority | null;
  status?: TaskStatus;
  parent_task_id?: string;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  assigned_to?: string;
  related_type?: TaskRelatedType;
  related_id?: string;
  tag_ids?: string[];
  subtasks?: CreateSubtaskInput[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  /** Required when status is on_hold or blocked. */
  hold_reason?: string | null;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  assigned_to?: string;
  related_type?: string | null;
  related_id?: string | null;
  /** Full replacement of the tag set. [] clears all tags. */
  tag_ids?: string[];
}

export interface CreateTaskTemplateInput {
  name: string;
  description?: string;
  category: TaskTemplateCategory;
  default_priority?: TaskPriority;
  is_protected?: boolean;
  items?: CreateTaskTemplateItemInput[];
}

export interface CreateTaskTemplateItemInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  relative_due_days?: number;
  estimated_hours?: number;
  assign_to_role?: string;
  assign_to_user_id?: string;
  sort_order?: number;
  children?: CreateTaskTemplateItemInput[];
}

export interface UpdateTaskTemplateInput {
  name?: string;
  description?: string;
  category?: TaskTemplateCategory;
  default_priority?: TaskPriority;
  is_active?: boolean;
  is_protected?: boolean;
}

// ============================================================================
// Filter & Query Types
// ============================================================================

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assigned_to?: string;
  created_by?: string;
  related_type?: TaskRelatedType;
  related_id?: string;
  tag_ids?: string[];
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
  include_subtasks?: boolean;
  parent_only?: boolean; // Only fetch top-level tasks
}

export interface TaskSortOptions {
  field:
    | "created_at"
    | "due_date"
    | "priority"
    | "status"
    | "title"
    | "task_number";
  direction: "asc" | "desc";
}

// ============================================================================
// UI Helper Types
// ============================================================================

export interface TaskQuickFilter {
  id: string;
  label: string;
  count?: number;
  filter: Partial<TaskFilters>;
}

export const DEFAULT_QUICK_FILTERS: TaskQuickFilter[] = [
  { id: "my-tasks", label: "My Tasks", filter: {} }, // assigned_to will be set dynamically
  {
    id: "overdue",
    label: "Overdue",
    filter: { status: ["todo", "in_progress"] },
  }, // due_date_to will be set
  { id: "due-today", label: "Due Today", filter: {} }, // dates will be set dynamically
  { id: "due-this-week", label: "Due This Week", filter: {} },
  { id: "unassigned", label: "Unassigned", filter: {} }, // assigned_to: null
  { id: "completed", label: "Completed", filter: { status: "completed" } },
];

// ============================================================================
// Permission Helpers
// ============================================================================

export const TASK_PERMISSIONS = {
  VIEW: "tasks.view",
  VIEW_ALL: "tasks.view_all",
  CREATE: "tasks.create",
  EDIT: "tasks.edit",
  EDIT_ALL: "tasks.edit_all",
  DELETE: "tasks.delete",
  ASSIGN: "tasks.assign",
  COMMENT: "tasks.comment",
  TEMPLATES_VIEW: "tasks.templates.view",
  TEMPLATES_CREATE: "tasks.templates.create",
  TEMPLATES_EDIT: "tasks.templates.edit",
  TEMPLATES_DELETE: "tasks.templates.delete",
  TEMPLATES_MANAGE_PROTECTED: "tasks.templates.manage_protected",
} as const;

// Check if user can edit a task based on template protection
export function canEditTask(
  task: Task | TaskWithDetails,
  userId: string,
  hasPermission: (permission: string) => boolean
): boolean {
  // If task is from a protected template, need special permission
  if (task.is_from_template && task.template_id) {
    // For now, check if user has edit_all or manage_protected permission
    if (hasPermission(TASK_PERMISSIONS.TEMPLATES_MANAGE_PROTECTED)) {
      return true;
    }
    // Template tasks can only be status-updated by assignee, not fully edited
    return false;
  }

  // Regular task: can edit if own task or has edit_all
  if (hasPermission(TASK_PERMISSIONS.EDIT_ALL)) {
    return true;
  }

  if (hasPermission(TASK_PERMISSIONS.EDIT)) {
    return task.created_by === userId || task.assigned_to === userId;
  }

  return false;
}

// Check if user can update task status
export function canUpdateTaskStatus(
  task: Task | TaskWithDetails,
  userId: string,
  hasPermission: (permission: string) => boolean
): boolean {
  // Assignee can always update status
  if (task.assigned_to === userId) {
    return true;
  }

  // Or if user has edit_all permission
  return hasPermission(TASK_PERMISSIONS.EDIT_ALL);
}
