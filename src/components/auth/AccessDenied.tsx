"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

interface AccessDeniedProps {
  /**
   * Title to display
   */
  title?: string;

  /**
   * Message to display
   */
  message?: string;

  /**
   * Whether to show the back button
   */
  showBackButton?: boolean;

  /**
   * Whether to show the home button
   */
  showHomeButton?: boolean;

  /**
   * Custom action button
   */
  action?: React.ReactNode;
}

/**
 * Access Denied component displayed when user doesn't have permission
 */
export function AccessDenied({
  title = "Access Denied",
  message = "You don't have permission to access this page or perform this action.",
  showBackButton = true,
  showHomeButton = true,
  action,
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h1>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          {showBackButton && (
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          )}

          {showHomeButton && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </Link>
          )}

          {action}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact access denied message for inline use
 */
export function AccessDeniedInline({
  message = "You don't have permission to perform this action.",
}: {
  message?: string;
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
