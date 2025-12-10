"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";

// =====================================================
// SETTINGS BREADCRUMB - without Dashboard prefix
// =====================================================

interface SettingsBreadcrumbItem {
  label: string;
  href?: string;
}

interface SettingsBreadcrumbsProps {
  items: SettingsBreadcrumbItem[];
}

export function SettingsBreadcrumbs({ items }: SettingsBreadcrumbsProps) {
  // Always start with Settings
  const fullItems: SettingsBreadcrumbItem[] = [
    { label: "Settings", href: "/dashboard/settings" },
    ...items,
  ];

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
      {fullItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <svg
              className="w-3 h-3 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-slate-700 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-700 font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// =====================================================
// STATUS BADGE COMPONENT
// =====================================================

type StatusType =
  | "active"
  | "pending"
  | "pending_verification"
  | "invited"
  | "disabled"
  | "inactive";

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  active: { label: "Active", color: "text-green-700", bgColor: "bg-green-100" },
  pending: {
    label: "Pending",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  pending_verification: {
    label: "Pending",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  invited: { label: "Invited", color: "text-blue-700", bgColor: "bg-blue-100" },
  disabled: {
    label: "Inactive",
    color: "text-slate-700",
    bgColor: "bg-slate-100",
  },
  inactive: {
    label: "Inactive",
    color: "text-slate-700",
    bgColor: "bg-slate-100",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status || "Unknown",
    color: "text-slate-700",
    bgColor: "bg-slate-100",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full",
        config.bgColor,
        config.color,
        className
      )}
    >
      <span className="w-1 h-1 rounded-full bg-current" />
      {config.label}
    </span>
  );
}

// =====================================================
// SETTINGS PAGE HEADER COMPONENT
// =====================================================

interface SettingsPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: SettingsBreadcrumbItem[];
  icon: ReactNode;
  iconBgClass?: string;
  status?: string;
  actions?: ReactNode;
}

export function SettingsPageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  icon,
  iconBgClass = "from-violet-500 to-violet-600",
  status,
  actions,
}: SettingsPageHeaderProps) {
  return (
    <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
      {breadcrumbs.length > 0 && <SettingsBreadcrumbs items={breadcrumbs} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm",
              iconBgClass
            )}
          >
            {icon}
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800 leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] text-slate-500">{subtitle}</p>
            )}
          </div>
          {status && <StatusBadge status={status} className="ml-2" />}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// =====================================================
// SETTINGS PAGE LAYOUT COMPONENT
// =====================================================

interface SettingsPageLayoutProps {
  children: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  isSaving?: boolean;
  savingText?: string;
}

export function SettingsPageLayout({
  children,
  isLoading = false,
  loadingText = "Loading...",
  isSaving = false,
  savingText = "Saving changes...",
}: SettingsPageLayoutProps) {
  if (isLoading) {
    return (
      <div className="h-full bg-slate-50/50">
        <div className="h-full flex flex-col px-4 py-4">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">{loadingText}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50/50">
      {isSaving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-slate-700">
              {savingText}
            </span>
          </div>
        </div>
      )}
      <div className="h-full flex flex-col px-4 py-4">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// SETTINGS PAGE CONTENT COMPONENT
// =====================================================

interface SettingsPageContentProps {
  children: ReactNode;
  className?: string;
}

export function SettingsPageContent({
  children,
  className,
}: SettingsPageContentProps) {
  return (
    <div className={cn("flex-1 overflow-auto p-4", className)}>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
