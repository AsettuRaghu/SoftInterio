"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { useNotifications } from "@/hooks/useNotifications";
import type { Notification, NotificationType } from "@/types/notifications";
import { NotificationTypeColors } from "@/types/notifications";

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

// Get icon for notification type
function getTypeIcon(type: NotificationType) {
  const colors = NotificationTypeColors[type] || NotificationTypeColors.other;
  
  switch (type) {
    case "lead_won":
      return (
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colors.bg)}>
          <svg className={cn("w-4 h-4", colors.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
      );
    case "lead_lost":
      return (
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colors.bg)}>
          <svg className={cn("w-4 h-4", colors.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case "lead_assigned":
      return (
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colors.bg)}>
          <svg className={cn("w-4 h-4", colors.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
      );
    case "lead_stage_changed":
      return (
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colors.bg)}>
          <svg className={cn("w-4 h-4", colors.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      );
    case "lead_task_assigned":
    case "lead_task_due":
    case "lead_task_overdue":
      return (
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colors.bg)}>
          <svg className={cn("w-4 h-4", colors.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
      );
    case "subscription_warning":
    case "subscription_expired":
      return (
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colors.bg)}>
          <svg className={cn("w-4 h-4", colors.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colors.bg)}>
          <svg className={cn("w-4 h-4", colors.icon)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
  }
}

export function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead([notification.id]);
    }
    
    // Navigate to action URL if available
    if (notification.action_url) {
      router.push(notification.action_url);
      setIsOpen(false);
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    markAsRead([notificationId]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-3.5-3.5A5.002 5.002 0 0015 9V6a3 3 0 00-3-3v0a3 3 0 00-3 3v3a5.002 5.002 0 00-1.5 4.5L4 17h5m6 0v1a3 3 0 01-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full ring-2 ring-white flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-4 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-3.5-3.5A5.002 5.002 0 0015 9V6a3 3 0 00-3-3v0a3 3 0 00-3 3v3a5.002 5.002 0 00-1.5 4.5L4 17h5m6 0v1a3 3 0 01-6 0v-1m6 0H9"
                  />
                </svg>
                <p className="font-medium">No notifications yet</p>
                <p className="text-sm mt-1">We&apos;ll notify you when something happens</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer",
                    !notification.is_read && "bg-blue-50/50"
                  )}
                >
                  <div className="flex items-start space-x-3">
                    {getTypeIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-sm",
                              notification.is_read
                                ? "text-gray-900 font-medium"
                                : "text-gray-900 font-semibold"
                            )}
                          >
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {formatRelativeTime(notification.created_at)}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <button
                            onClick={(e) => handleMarkAsRead(e, notification.id)}
                            className="ml-2 p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                            title="Mark as read"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200">
              <button 
                onClick={() => {
                  router.push("/dashboard/notifications");
                  setIsOpen(false);
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
