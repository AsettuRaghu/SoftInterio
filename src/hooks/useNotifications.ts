"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  Notification,
  NotificationsResponse,
} from "@/types/notifications";

interface UseNotificationsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?limit=10");
      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data: NotificationsResponse = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
      setError(null);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_ids: notificationIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark as read");
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          notificationIds.includes(n.id)
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
    } catch (err) {
      console.error("Error marking notifications as read:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark all as read");
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchNotifications, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
