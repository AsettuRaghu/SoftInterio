"use client";

import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/SidebarNew";
import { cn } from "@/utils/cn";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";
import { NotificationSlider } from "@/components/notifications/NotificationSlider";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <NotificationsProvider>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <Header />

        {/* Main content area */}
        <div className="flex">
          {/* Sidebar */}
          <Sidebar
            isExpanded={isSidebarExpanded}
            setIsExpanded={setIsSidebarExpanded}
          />

          {/* Content */}
          <main
            className={cn(
              // Right under the 64px header; the p-3 below is the only gap the
              // content gets on every side. It was pt-20 over p-3 over the
              // page's own p-4 - 44px above and 28px beside every page.
              "flex-1 min-h-screen pt-16 transition-all duration-300 ease-in-out",
              isSidebarExpanded ? "ml-60" : "ml-14",
            )}
          >
            <div className="p-3">{children}</div>
          </main>
        </div>
        {/* Live notifications slide in here, wherever in the app you are. */}
        <NotificationSlider />
      </div>
    </NotificationsProvider>
  );
}
