"use client";

import React, { useState, useRef, useEffect } from "react";

/**
 * NotificationDropdown - TEMPORARILY DISABLED
 *
 * The notifications module is temporarily disabled to reduce API calls
 * during development. This component shows a placeholder "Coming Soon" state.
 *
 * When ready to enable:
 * 1. Restore the full component from git history
 * 2. Enable the useNotifications hook
 */
export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-all duration-200"
        title="Notifications (Coming Soon)"
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
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-lg z-50">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Notifications
            </h3>
          </div>

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
            <p className="font-medium text-gray-700">Coming Soon</p>
            <p className="text-sm mt-1 text-gray-500">
              Notifications will be available in a future update
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
