"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function UserProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useCurrentUser();

  const firstName = user?.firstName || "User";
  const lastName = user?.lastName || "";
  const email = user?.email || "";
  const role = user?.designation || user?.primaryRole || "Team Member";

  const initials = `${firstName.charAt(0)}${
    lastName.charAt(0) || firstName.charAt(1) || ""
  }`.toUpperCase();
  const fullName = `${firstName} ${lastName}`.trim();

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

  const handleSignOut = async () => {
    try {
      console.log("[LOGOUT] Signing out...");

      const response = await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        console.log("[LOGOUT] Sign out successful, redirecting to signin...");
        router.push("/auth/signin");
        router.refresh();
      } else {
        console.error("[LOGOUT] Sign out failed:", response.status);
        router.push("/auth/signin");
      }
    } catch (error) {
      console.error("[LOGOUT] Sign out error:", error);
      router.push("/auth/signin");
    }
  };

  const handleProfileClick = () => {
    setIsOpen(false);
    router.push("/dashboard/settings/profile");
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-3 p-2">
        <div className="hidden sm:block text-right">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
        </div>
        <div className="w-9 h-9 bg-gray-200 rounded-full animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
      >
        <div className="flex items-center space-x-3">
          <div className="hidden sm:block text-right">
            <div className="text-sm font-semibold text-gray-900">
              {fullName}
            </div>
            <div className="text-xs text-gray-500">{role}</div>
          </div>
          <div className="w-9 h-9 bg-linear-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center ring-2 ring-blue-100">
            <span className="text-sm font-semibold text-white">{initials}</span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-lg z-50">
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-linear-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-white">
                  {initials}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {fullName}
                </div>
                <div className="text-xs text-gray-500 truncate">{email}</div>
                <div className="text-xs text-blue-600">{role}</div>
              </div>
            </div>
          </div>

          {/* Menu Items Section */}
          <div className="py-2">
            <button
              onClick={handleProfileClick}
              className={`flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer ${
                pathname === "/dashboard/settings/profile" ? "bg-gray-50" : ""
              }`}
            >
              <svg
                className="w-4 h-4 mr-3 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              My Profile
            </button>
          </div>

          {/* Sign Out Section */}
          <div className="border-t border-gray-200 py-2">
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4 mr-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
