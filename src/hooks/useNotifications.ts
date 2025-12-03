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
        // If unauthorized, silently fail (user might not be logged in yet)
        if (response.status === 401) {
          setNotifications([]);
          setUnreadCount(0);
          setError(null);
          setIsLoading(false);
          return;
        }
        throw new Error("Failed to fetch notifications");
      }

      const data: NotificationsResponse = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
      setError(null);
    } catch (err) {
      // Silently handle network errors to avoid console spam
      // These can happen during page transitions or auth refresh
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setNotifications([]);
        setUnreadCount(0);
        setError(null);
      } else {
        console.error("Error fetching notifications:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
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

  // Initial fetch with small delay to allow auth to initialize
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 100); // 100ms delay to let auth initialize

    return () => clearTimeout(timer);
  }, [fetchNotifications]);

  // Auto-refresh with visibility awareness
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Only fetch if page is visible
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, refreshInterval);

    // Refetch when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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
