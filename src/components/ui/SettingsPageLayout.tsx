"use client";

/**
 * SettingsPageLayout - Backward Compatibility Exports
 *
 * This file re-exports components from PageLayout with Settings-specific aliases
 * for backward compatibility. All new code should import directly from PageLayout.
 *
 * Usage (legacy):
 *   import { SettingsPageLayout, SettingsPageHeader } from "@/components/ui/SettingsPageLayout";
 *
 * Usage (recommended):
 *   import { PageLayout, PageHeader } from "@/components/ui/PageLayout";
 *   // Use basePath={{ label: "Settings", href: "/dashboard/settings" }}
 */

import React, { ReactNode } from "react";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatusBadge,
  Breadcrumbs,
  type BreadcrumbItem,
} from "./PageLayout";

// =====================================================
// RE-EXPORT TYPES
// =====================================================

export type SettingsBreadcrumbItem = BreadcrumbItem;

// =====================================================
// SETTINGS-SPECIFIC WRAPPER COMPONENTS
// These wrap the generic PageLayout components with Settings defaults
// =====================================================

interface SettingsPageLayoutProps {
  children?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  isSaving?: boolean;
  savingText?: string;
}

/**
 * @deprecated Use PageLayout directly instead
 */
export function SettingsPageLayout({
  children,
  isLoading = false,
  loadingText = "Loading...",
  isSaving = false,
  savingText = "Saving changes...",
}: SettingsPageLayoutProps) {
  return (
    <PageLayout
      isLoading={isLoading}
      loadingText={loadingText}
      isSaving={isSaving}
      savingText={savingText}
    >
      {children}
    </PageLayout>
  );
}

interface SettingsPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  icon: ReactNode;
  iconBgClass?: string;
  status?: string;
  actions?: ReactNode;
}

/**
 * @deprecated Use PageHeader directly with basePath={{ label: "Settings", href: "/dashboard/settings" }}
 */
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
    <PageHeader
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      basePath={{ label: "Settings", href: "/dashboard/settings" }}
      icon={icon}
      iconBgClass={iconBgClass}
      status={status}
      actions={actions}
    />
  );
}

interface SettingsPageContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * @deprecated Use PageContent directly instead
 */
export function SettingsPageContent({
  children,
  className,
}: SettingsPageContentProps) {
  return (
    <PageContent className={className}>
      <div className="space-y-4">{children}</div>
    </PageContent>
  );
}

// =====================================================
// RE-EXPORT SHARED COMPONENTS
// =====================================================

/**
 * @deprecated Use Breadcrumbs from PageLayout with basePath={{ label: "Settings", href: "/dashboard/settings" }}
 */
export function SettingsBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <Breadcrumbs
      items={items}
      basePath={{ label: "Settings", href: "/dashboard/settings" }}
    />
  );
}

// Re-export StatusBadge for backward compatibility
export { StatusBadge };
