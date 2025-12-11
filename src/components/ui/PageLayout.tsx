"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";

// =====================================================
// BREADCRUMB COMPONENT
// =====================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Base path for the module (e.g., "Sales", "Settings", "Projects") */
  basePath?: { label: string; href: string };
}

export function Breadcrumbs({ items, basePath }: BreadcrumbsProps) {
  // Build full breadcrumb items - basePath is always rendered as text (no link)
  const fullItems: BreadcrumbItem[] = basePath
    ? [{ label: basePath.label }, ...items]
    : items;

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
      {fullItems.map((item, index) => {
        const isLast = index === fullItems.length - 1;
        const hasLink = item.href && !isLast;

        return (
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
            {hasLink ? (
              <Link
                href={item.href!}
                className="text-slate-500 hover:text-blue-600 hover:underline transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  isLast ? "text-slate-700 font-medium" : "text-slate-500"
                )}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =====================================================
// PAGE LAYOUT COMPONENT
// =====================================================

interface PageLayoutProps {
  children: ReactNode;
  /** Show loading overlay */
  isLoading?: boolean;
  /** Loading text */
  loadingText?: string;
  /** Show saving indicator */
  isSaving?: boolean;
  /** Saving text */
  savingText?: string;
  /** Custom className for the container */
  className?: string;
}

export function PageLayout({
  children,
  isLoading = false,
  loadingText = "Loading...",
  isSaving = false,
  savingText = "Saving changes...",
  className,
}: PageLayoutProps) {
  if (isLoading) {
    return (
      <div className="h-full bg-slate-50/50">
        <div className="h-full flex flex-col px-4 py-4">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
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
    <div className={cn("h-full bg-slate-50/50", className)}>
      {/* Saving Overlay */}
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

      {/* Content */}
      <div className="h-full flex flex-col px-4 py-4">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// PAGE HEADER COMPONENT - Matches SettingsPageHeader style
// =====================================================

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Page subtitle/description */
  subtitle?: string;
  /** Breadcrumb items (after base path) */
  breadcrumbs?: BreadcrumbItem[];
  /** Base path for breadcrumbs */
  basePath?: { label: string; href: string };
  /** Icon to show next to title */
  icon?: ReactNode;
  /** Icon background gradient classes */
  iconBgClass?: string;
  /** Status badge text */
  status?: string;
  /** Action buttons to show on the right */
  actions?: ReactNode;
  /** Stats badges to show (alternative to status) */
  stats?: ReactNode;
  /** Additional className */
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  basePath,
  icon,
  iconBgClass = "from-blue-500 to-blue-600",
  status,
  actions,
  stats,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "px-4 py-2.5 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white shrink-0",
        className
      )}
    >
      {/* Breadcrumbs */}
      {(breadcrumbs.length > 0 || basePath) && (
        <Breadcrumbs items={breadcrumbs} basePath={basePath} />
      )}

      {/* Title Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Icon */}
          {icon && (
            <div
              className={cn(
                "w-8 h-8 rounded-lg bg-linear-to-br flex items-center justify-center shadow-sm",
                iconBgClass
              )}
            >
              {icon}
            </div>
          )}
          {/* Title & Subtitle */}
          <div>
            <h1 className="text-base font-semibold text-slate-800 leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] text-slate-500">{subtitle}</p>
            )}
          </div>
          {/* Status Badge */}
          {status && <StatusBadge status={status} className="ml-2" />}
          {/* Stats */}
          {stats && (
            <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
              {stats}
            </div>
          )}
        </div>

        {/* Actions */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// =====================================================
// PAGE CONTENT COMPONENT
// =====================================================

interface PageContentProps {
  children: ReactNode;
  /** Remove default padding */
  noPadding?: boolean;
  /** Additional className */
  className?: string;
}

export function PageContent({
  children,
  noPadding = false,
  className,
}: PageContentProps) {
  return (
    <div
      className={cn("flex-1 overflow-x-auto", !noPadding && "p-4", className)}
    >
      {children}
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
  | "inactive"
  | "new"
  | "qualified"
  | "won"
  | "lost"
  | "open"
  | "closed";

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
  size?: "sm" | "md";
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; dotColor?: string }
> = {
  // User/Account statuses
  active: {
    label: "Active",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    dotColor: "bg-emerald-500",
  },
  pending: {
    label: "Pending",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    dotColor: "bg-amber-500",
  },
  pending_verification: {
    label: "Pending",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    dotColor: "bg-amber-500",
  },
  invited: {
    label: "Invited",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    dotColor: "bg-blue-500",
  },
  disabled: {
    label: "Disabled",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    dotColor: "bg-slate-400",
  },
  inactive: {
    label: "Inactive",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    dotColor: "bg-slate-400",
  },

  // Lead/Sales statuses
  new: {
    label: "New",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    dotColor: "bg-blue-500",
  },
  qualified: {
    label: "Qualified",
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    dotColor: "bg-indigo-500",
  },
  won: {
    label: "Won",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    dotColor: "bg-emerald-500",
  },
  lost: {
    label: "Lost",
    color: "text-red-700",
    bgColor: "bg-red-50",
    dotColor: "bg-red-500",
  },

  // General statuses
  open: {
    label: "Open",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    dotColor: "bg-blue-500",
  },
  closed: {
    label: "Closed",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    dotColor: "bg-slate-400",
  },
};

export function StatusBadge({
  status,
  className,
  size = "sm",
}: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    dotColor: "bg-slate-400",
  };

  const sizeClasses =
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${
        config.bgColor
      } ${config.color} ${sizeClasses} ${className || ""}`}
    >
      {config.dotColor && (
        <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
      )}
      {config.label}
    </span>
  );
}

// =====================================================
// STAT BADGE COMPONENT (for header stats)
// =====================================================

interface StatBadgeProps {
  label: string;
  value: string | number;
  color?: "blue" | "green" | "amber" | "red" | "slate";
  className?: string;
}

const statColorConfig = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
};

export function StatBadge({
  label,
  value,
  color = "slate",
  className,
}: StatBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border",
        statColorConfig[color],
        className
      )}
    >
      <span className="text-slate-500">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

// =====================================================
// ALERT COMPONENT
// =====================================================

interface AlertProps {
  type: "error" | "success" | "warning" | "info";
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const alertConfig = {
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: "text-red-500",
  },
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: "text-emerald-500",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: "text-amber-500",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: "text-blue-500",
  },
};

export function Alert({ type, message, onDismiss, className }: AlertProps) {
  const config = alertConfig[type];

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border flex items-center justify-between",
        config.bg,
        config.border,
        config.text,
        className
      )}
    >
      <span className="text-sm">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn(
            "ml-4 p-1 rounded hover:bg-white/50 transition-colors",
            config.icon
          )}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// =====================================================
// EMPTY STATE COMPONENT
// =====================================================

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
