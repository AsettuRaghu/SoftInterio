"use client";

import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/utils/cn";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
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
            "flex-1 min-h-screen pt-20 transition-all duration-300 ease-in-out",
            isSidebarExpanded ? "ml-52" : "ml-14"
          )}
        >
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
