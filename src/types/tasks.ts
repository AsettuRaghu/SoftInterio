// ============================================================================
// Task Management Types
// ============================================================================

// Enums matching database types
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";
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
  critical: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  high: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  medium: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  low: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
};

export const TaskStatusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
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
  completed: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
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
  actual_hours?: number;
  assigned_to?: string;
  related_type?: TaskRelatedType;
  related_id?: string;
  is_recurring: boolean;
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
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  assigned_to?: string;
  related_type?: string | null;
  related_id?: string | null;
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
