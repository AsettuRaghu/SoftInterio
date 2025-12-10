"use client";

import { useState, useCallback } from "react";
import type {
  Notification,
} from "@/types/notifications";

interface UseNotificationsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

/**
 * Notifications Hook - TEMPORARILY DISABLED
 * 
 * This hook is disabled to reduce unnecessary API calls during development.
 * The notifications module will be implemented later.
 * 
 * When ready to enable:
 * 1. Uncomment the useEffect blocks
 * 2. Remove the early return in fetchNotifications
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { autoRefresh = false, refreshInterval = 30000 } = options;

  const [notifications] = useState<Notification[]>([]);
  const [unreadCount] = useState(0);
  const [isLoading] = useState(false); // Set to false since we're not loading
  const [error] = useState<string | null>(null);

  // DISABLED: No API calls until notifications module is implemented
  const fetchNotifications = useCallback(async () => {
    // Notifications temporarily disabled
    return;
  }, []);

  // DISABLED: No API calls until notifications module is implemented
  const markAsRead = useCallback(async (_notificationIds: string[]) => {
    // Notifications temporarily disabled
    return;
  }, []);

  // DISABLED: No API calls until notifications module is implemented
  const markAllAsRead = useCallback(async () => {
    // Notifications temporarily disabled
    return;
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
