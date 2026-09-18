import type { NotificationKind } from "@/lib/notifications/kinds";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

/** A row of `notifications`, as the API returns it. */
export interface AppNotification {
  id: string;
  tenant_id: string;
  user_id: string;
  /** One of NOTIFICATION_KINDS, or an older value the table still holds. */
  type: NotificationKind | string;
  title: string;
  message: string;
  priority: NotificationPriority;
  entity_type: "task" | "lead" | "project" | "quotation" | string | null;
  entity_id: string | null;
  action_url: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  triggered_by: string | null;
  triggered_user?: { id: string; name: string; avatar_url: string | null } | null;
  dedupe_key: string;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unread_count: number;
  total_count: number;
  has_more: boolean;
  page: number;
  limit: number;
}
