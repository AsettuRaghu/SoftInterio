"use client";

import React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NotificationDropdown } from "@/components/ui/NotificationDropdown";
import { UserProfileDropdown } from "@/components/ui/UserProfileDropdown";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

function SubscriptionWarningInline() {
  const {
    warnings,
    isTrial,
    trialDaysRemaining,
    subscriptionDaysRemaining,
    isLoading,
  } = useSubscriptionStatus();

  // Don't show while loading or if no warning needed
  if (
    isLoading ||
    (!warnings.showTrialWarning &&
      !warnings.showSubscriptionWarning &&
      !warnings.isInGracePeriod)
  ) {
    return null;
  }

  const daysRemaining = isTrial
    ? trialDaysRemaining
    : subscriptionDaysRemaining;
  const isUrgent = daysRemaining !== null && daysRemaining <= 7;
  const isExpired = daysRemaining === 0;

  // Format days text
  const daysText =
    daysRemaining === null
      ? ""
      : daysRemaining === 0
      ? "today"
      : daysRemaining === 1
      ? "1 day"
      : `${daysRemaining} days`;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${
          isExpired
            ? "bg-red-100 text-red-700 border border-red-200"
            : isUrgent
            ? "bg-amber-100 text-amber-700 border border-amber-200"
            : "bg-blue-50 text-blue-700 border border-blue-200"
        }`}
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          {isTrial
            ? isExpired
              ? "Trial expired"
              : `Trial expires in ${daysText}`
            : isExpired
            ? "Subscription expired"
            : `Subscription expires in ${daysText}`}
        </span>
      </div>
      {warnings.showPayButton && (
        <Link
          href="/dashboard/settings/billing"
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow ${
            isExpired || isUrgent
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isTrial ? "Upgrade Now" : "Renew Now"}
        </Link>
      )}
    </div>
  );
}

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-white/98 backdrop-blur-lg border-b border-slate-200">
        {/* Vibrant gradient accent */}
        <div className="h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-blue-600"></div>

        <div className="flex items-center justify-between h-16 px-6 text-sm">
          {/* Logo Section - Left aligned */}
          <div className="flex items-center shrink-0">
            <Link href="/dashboard">
              <Logo size="lg" />
            </Link>
          </div>

          {/* Center Section - Subscription Warning */}
          <div className="flex-1 flex justify-center px-4">
            <SubscriptionWarningInline />
          </div>

          {/* Right Section - Notifications and User Profile */}
          <div className="flex items-center space-x-6 shrink-0">
            {/* Notifications */}
            <NotificationDropdown />

            {/* User Profile */}
            <UserProfileDropdown />
          </div>
        </div>

        {/* Enhanced separator with better definition */}
        <div className="relative">
          <div className="h-px bg-slate-200"></div>
          <div className="absolute inset-0 shadow-lg opacity-20"></div>
          <div className="absolute inset-x-0 bottom-0 h-4 bg-linear-to-b from-slate-50/80 via-slate-50/40 to-transparent"></div>
        </div>
      </div>
    </header>
  );
}
