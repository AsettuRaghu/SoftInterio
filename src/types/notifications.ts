// =====================================================
// Notification Module Types
// =====================================================

export type NotificationType =
  // Lead notifications
  | "lead_assigned"
  | "lead_won"
  | "lead_lost"
  | "lead_stage_changed"
  | "lead_note_added"
  | "lead_task_assigned"
  | "lead_task_due"
  | "lead_task_overdue"
  // Project notifications (future)
  | "project_created"
  | "project_assigned"
  | "project_milestone"
  | "project_completed"
  // Team notifications
  | "team_member_added"
  | "team_member_removed"
  // System notifications
  | "system_announcement"
  | "subscription_warning"
  | "subscription_expired"
  // General
  | "mention"
  | "comment"
  | "reminder"
  | "other";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;

  // Content
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;

  // Related entity (for deep linking)
  entity_type?: string | null; // 'lead', 'project', 'task', etc.
  entity_id?: string | null;
  action_url?: string | null;

  // Metadata
  metadata?: Record<string, unknown>;

  // Status
  is_read: boolean;
  read_at?: string | null;

  // Sender
  triggered_by?: string | null;
  triggered_user?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  } | null;

  // Timestamps
  created_at: string;
  expires_at?: string | null;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  in_app: boolean;
  email: boolean;
  push: boolean;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
  total_count: number;
  has_more: boolean;
}

export interface NotificationCountResponse {
  unread_count: number;
}

// Display labels for notification types
export const NotificationTypeLabels: Record<NotificationType, string> = {
  lead_assigned: "Lead Assigned",
  lead_won: "Lead Won",
  lead_lost: "Lead Lost",
  lead_stage_changed: "Lead Stage Changed",
  lead_note_added: "Note Added",
  lead_task_assigned: "Task Assigned",
  lead_task_due: "Task Due",
  lead_task_overdue: "Task Overdue",
  project_created: "Project Created",
  project_assigned: "Project Assigned",
  project_milestone: "Project Milestone",
  project_completed: "Project Completed",
  team_member_added: "Team Member Added",
  team_member_removed: "Team Member Removed",
  system_announcement: "System Announcement",
  subscription_warning: "Subscription Warning",
  subscription_expired: "Subscription Expired",
  mention: "Mention",
  comment: "Comment",
  reminder: "Reminder",
  other: "Other",
};

// Icons for notification types (use with Lucide or similar)
export const NotificationTypeIcons: Record<NotificationType, string> = {
  lead_assigned: "user-plus",
  lead_won: "trophy",
  lead_lost: "x-circle",
  lead_stage_changed: "git-branch",
  lead_note_added: "file-text",
  lead_task_assigned: "check-square",
  lead_task_due: "clock",
  lead_task_overdue: "alert-circle",
  project_created: "folder-plus",
  project_assigned: "users",
  project_milestone: "flag",
  project_completed: "check-circle",
  team_member_added: "user-plus",
  team_member_removed: "user-minus",
  system_announcement: "megaphone",
  subscription_warning: "alert-triangle",
  subscription_expired: "x-octagon",
  mention: "at-sign",
  comment: "message-circle",
  reminder: "bell",
  other: "info",
};

// Colors for notification types
export const NotificationTypeColors: Record<
  NotificationType,
  { bg: string; text: string; icon: string }
> = {
  lead_assigned: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: "text-blue-600",
  },
  lead_won: {
    bg: "bg-green-100",
    text: "text-green-700",
    icon: "text-green-600",
  },
  lead_lost: { bg: "bg-red-100", text: "text-red-700", icon: "text-red-600" },
  lead_stage_changed: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    icon: "text-purple-600",
  },
  lead_note_added: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    icon: "text-slate-600",
  },
  lead_task_assigned: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    icon: "text-indigo-600",
  },
  lead_task_due: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    icon: "text-amber-600",
  },
  lead_task_overdue: {
    bg: "bg-red-100",
    text: "text-red-700",
    icon: "text-red-600",
  },
  project_created: {
    bg: "bg-teal-100",
    text: "text-teal-700",
    icon: "text-teal-600",
  },
  project_assigned: {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    icon: "text-cyan-600",
  },
  project_milestone: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    icon: "text-orange-600",
  },
  project_completed: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    icon: "text-emerald-600",
  },
  team_member_added: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    icon: "text-sky-600",
  },
  team_member_removed: {
    bg: "bg-rose-100",
    text: "text-rose-700",
    icon: "text-rose-600",
  },
  system_announcement: {
    bg: "bg-violet-100",
    text: "text-violet-700",
    icon: "text-violet-600",
  },
  subscription_warning: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    icon: "text-yellow-600",
  },
  subscription_expired: {
    bg: "bg-red-100",
    text: "text-red-700",
    icon: "text-red-600",
  },
  mention: { bg: "bg-blue-100", text: "text-blue-700", icon: "text-blue-600" },
  comment: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    icon: "text-slate-600",
  },
  reminder: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    icon: "text-amber-600",
  },
  other: { bg: "bg-gray-100", text: "text-gray-700", icon: "text-gray-600" },
};
