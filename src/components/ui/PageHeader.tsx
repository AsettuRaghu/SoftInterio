"use client";

import React from "react";

// =====================================================
// BREADCRUMB COMPONENT
// =====================================================

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span>/</span>}
          {/* All breadcrumb items are now displayed as plain text without links */}
          <span
            className={
              index === items.length - 1 ? "text-slate-700" : "text-slate-500"
            }
          >
            {item.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

// =====================================================
// PAGE HEADER COMPONENT - Compact Design
// =====================================================

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = "",
}) => {
  return (
    <div
      className={`flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-4">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumbs items={breadcrumbs} />
          )}
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};

// =====================================================
// STATS CARD COMPONENT
// =====================================================

interface StatCardProps {
  value: string | number;
  label: string;
  color?: "default" | "green" | "amber" | "blue" | "red";
}

const colorClasses = {
  default: "text-slate-900",
  green: "text-green-600",
  amber: "text-amber-600",
  blue: "text-blue-600",
  red: "text-red-600",
};

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  color = "default",
}) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
      <p className={`text-xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
};

// =====================================================
// STATS ROW COMPONENT
// =====================================================

interface StatsRowProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const gridClasses = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

export const StatsRow: React.FC<StatsRowProps> = ({
  children,
  columns = 4,
  className = "",
}) => {
  return (
    <div className={`grid ${gridClasses[columns]} gap-3 ${className}`}>
      {children}
    </div>
  );
};

// =====================================================
// ALERT COMPONENT
// =====================================================

interface AlertProps {
  type: "error" | "success" | "warning" | "info";
  message: string;
  onDismiss?: () => void;
}

const alertClasses = {
  error: "bg-red-50 border-red-200 text-red-700",
  success: "bg-green-50 border-green-200 text-green-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  info: "bg-blue-50 border-blue-200 text-blue-700",
};

export const Alert: React.FC<AlertProps> = ({ type, message, onDismiss }) => {
  return (
    <div
      className={`border px-4 py-2.5 rounded-lg text-sm flex items-center justify-between ${alertClasses[type]}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-4 hover:opacity-70 transition-opacity"
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
};

// Export types
export type {
  PageHeaderProps,
  BreadcrumbItem,
  StatCardProps,
  StatsRowProps,
  AlertProps,
};
