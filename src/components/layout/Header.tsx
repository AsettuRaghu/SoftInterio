"use client";

import React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NotificationDropdown } from "@/components/ui/NotificationDropdown";
import { UserProfileDropdown } from "@/components/ui/UserProfileDropdown";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-lg border-b border-slate-200">
      {/* Vibrant gradient accent */}
      <div className="h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-blue-600"></div>

      <div className="flex items-center justify-between h-16 px-6 text-sm">
        {/* Logo Section - Left aligned */}
        <div className="flex items-center">
          <Link href="/dashboard">
            <Logo size="lg" />
          </Link>
        </div>

        {/* Right Section - Notifications and User Profile */}
        <div className="flex items-center space-x-6">
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
    </header>
  );
}
