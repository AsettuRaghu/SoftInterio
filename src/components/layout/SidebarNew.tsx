"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  navigationConfig,
  filterNavigationByPermissions,
  Icons,
  NavigationItem,
  NavigationSubItem,
} from "@/config/navigation";

// Extended types with disabled flag (matching filterNavigationByPermissions return type)
type FilteredSubItem = NavigationSubItem & { disabled: boolean };
type FilteredNavItem = NavigationItem & {
  disabled: boolean;
  subItems?: FilteredSubItem[];
};

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export function Sidebar({ isExpanded, setIsExpanded }: SidebarProps) {
  const pathname = usePathname();
  const { hasPermission, permissions } = useUserPermissions();

  // Check if permissions have actually loaded
  const permissionsLoaded = permissions.length > 0;

  // Track which menus are expanded (for sub-menus)
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // Track previous expanded state to detect collapse/expand
  const [wasExpanded, setWasExpanded] = useState(isExpanded);

  // Get filtered navigation items
  const navigationItems = filterNavigationByPermissions(
    navigationConfig,
    hasPermission,
    true // Show disabled items as greyed out
  );

  // Toggle sub-menu expansion
  const toggleSubMenu = (menuName: string) => {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(menuName)) {
        newSet.delete(menuName);
      } else {
        newSet.add(menuName);
      }
      return newSet;
    });
  };

  // Find the active parent menu name (for auto-expanding on sidebar open)
  const getActiveParentMenu = (): string | null => {
    for (const item of navigationItems) {
      if (item.subItems) {
        const isSubItemActive = item.subItems.some(
          (sub) => pathname === sub.href || pathname.startsWith(sub.href + "/")
        );
        if (isSubItemActive) {
          return item.name;
        }
      }
    }
    return null;
  };

  // When sidebar expands after being collapsed, only expand the active menu
  useEffect(() => {
    if (isExpanded && !wasExpanded) {
      // Sidebar just expanded - collapse all and only expand active
      const activeMenu = getActiveParentMenu();
      if (activeMenu) {
        setExpandedMenus(new Set([activeMenu]));
      } else {
        setExpandedMenus(new Set());
      }
    }
    setWasExpanded(isExpanded);
  }, [isExpanded, pathname]);

  // Check if a menu item is directly active (exact match only)
  const isMenuDirectlyActive = (
    item: NavigationItem & { disabled: boolean }
  ) => {
    // Only highlight if we're EXACTLY on that href
    // This prevents Dashboard (/dashboard) from being highlighted on /dashboard/sales etc.
    return pathname === item.href;
  };

  // Check if any sub-item is active (for showing expanded state)
  const hasActiveSubItem = (item: NavigationItem & { disabled: boolean }) => {
    if (!item.subItems) return false;
    return item.subItems.some((sub) => isSubItemActive(sub.href));
  };

  // Check if a sub-item is active - exact match or child route
  // Special handling: /dashboard/quotations should NOT match /dashboard/quotations/templates
  const isSubItemActive = (href: string) => {
    if (pathname === href) return true;
    // For sub-items, only match if pathname starts with href followed by /
    // But NOT if there's another sub-item that's a better match
    if (pathname.startsWith(href + "/")) {
      // Check if there's a more specific sub-item that matches
      // e.g., if we're at /dashboard/quotations/templates, don't match /dashboard/quotations
      const currentItem = navigationItems.find((item) =>
        item.subItems?.some((sub) => sub.href === href)
      );
      if (currentItem?.subItems) {
        // Check if any other sub-item is a more specific match
        const moreSpecificMatch = currentItem.subItems.find(
          (sub) =>
            sub.href !== href &&
            (pathname === sub.href || pathname.startsWith(sub.href + "/"))
        );
        if (moreSpecificMatch) return false;
      }
      return true;
    }
    return false;
  };

  // Render a menu item
  const renderMenuItem = (item: FilteredNavItem) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isSubMenuExpanded = expandedMenus.has(item.name);
    const hasActiveSub = hasActiveSubItem(item);

    // Highlight parent if:
    // 1. Sidebar is collapsed AND any sub-item is active (so user knows which section they're in)
    // 2. OR it's directly active (exact match on parent href)
    const isParentHighlighted =
      isMenuDirectlyActive(item) || (!isExpanded && hasActiveSub);

    // Only show disabled state if permissions have loaded AND item is disabled
    // This prevents the flash of disabled icons when switching tabs
    const isActuallyDisabled = permissionsLoaded && item.disabled;

    // Determine icon CSS class for immediate render (no flash)
    const iconClass = isActuallyDisabled
      ? "sidebar-icon-disabled"
      : isParentHighlighted
      ? "sidebar-icon-active"
      : "sidebar-icon-default";

    return (
      <div key={item.name}>
        {/* Main menu item */}
        {hasSubItems ? (
          // Expandable menu with sub-items
          <button
            onClick={() => !isActuallyDisabled && toggleSubMenu(item.name)}
            disabled={isActuallyDisabled}
            className={cn(
              "group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 relative",
              !isExpanded && "px-2 justify-center",
              isActuallyDisabled
                ? "text-slate-400 cursor-not-allowed opacity-50"
                : isParentHighlighted
                ? "text-blue-600"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {/* Icon with CSS class for immediate render */}
            <div
              className={cn(
                "shrink-0 w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5",
                iconClass
              )}
            >
              {item.icon}
            </div>

            {/* Text and Chevron */}
            {isExpanded && (
              <div className="flex items-center justify-between flex-1 ml-3 overflow-hidden">
                <span className="truncate whitespace-nowrap">{item.name}</span>
                <span
                  className={cn(
                    "transition-transform duration-200 ml-2 shrink-0",
                    isSubMenuExpanded ? "rotate-180" : "",
                    iconClass
                  )}
                >
                  {Icons.chevronDown}
                </span>
              </div>
            )}

            {/* Tooltip for collapsed state */}
            {!isExpanded && (
              <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                {item.name}
                {isActuallyDisabled && (
                  <span className="ml-2 text-slate-400">(No access)</span>
                )}
              </div>
            )}
          </button>
        ) : (
          // Regular link menu
          <Link
            href={isActuallyDisabled ? "#" : item.href}
            onClick={(e) => isActuallyDisabled && e.preventDefault()}
            className={cn(
              "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 relative",
              !isExpanded && "px-2 justify-center",
              isActuallyDisabled
                ? "text-slate-400 cursor-not-allowed opacity-50"
                : isParentHighlighted
                ? "text-blue-600"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {/* Icon with CSS class for immediate render */}
            <div
              className={cn(
                "shrink-0 w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5",
                iconClass
              )}
            >
              {item.icon}
            </div>

            {/* Text and Badge */}
            {isExpanded && (
              <div className="flex items-center justify-between flex-1 ml-3 overflow-hidden">
                <span className="truncate whitespace-nowrap">{item.name}</span>
                {item.badge && !isActuallyDisabled && (
                  <span className="ml-auto shrink-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                    {item.badge}
                  </span>
                )}
              </div>
            )}

            {/* Tooltip for collapsed state */}
            {!isExpanded && (
              <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                {item.name}
                {item.badge && !isActuallyDisabled && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-xs rounded-full">
                    {item.badge}
                  </span>
                )}
                {isActuallyDisabled && (
                  <span className="ml-2 text-slate-400">(No access)</span>
                )}
              </div>
            )}
          </Link>
        )}

        {/* Sub-menu items */}
        {hasSubItems && isExpanded && isSubMenuExpanded && (
          <div className="mt-1 ml-4 pl-4 border-l border-slate-200 space-y-0.5">
            {(item.subItems as FilteredSubItem[]).map((subItem) => {
              const isSubActive = isSubItemActive(subItem.href);
              const isSubItemActuallyDisabled =
                permissionsLoaded && subItem.disabled;
              return (
                <Link
                  key={subItem.name}
                  href={isSubItemActuallyDisabled ? "#" : subItem.href}
                  onClick={(e) =>
                    isSubItemActuallyDisabled && e.preventDefault()
                  }
                  className={cn(
                    "block px-3 py-1.5 text-sm rounded-md transition-colors duration-150 whitespace-nowrap overflow-hidden text-ellipsis",
                    isSubItemActuallyDisabled
                      ? "text-slate-400 cursor-not-allowed opacity-50"
                      : isSubActive
                      ? "text-blue-600 font-medium"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {subItem.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 bottom-0 bg-slate-50 border-r border-slate-200 overflow-hidden transition-all duration-300 ease-in-out z-40",
        isExpanded ? "w-60" : "w-14"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="h-full flex flex-col overflow-y-auto">
        {/* Navigation */}
        <div className="flex-1 px-2 pt-4 pb-4 space-y-0.5">
          {navigationItems.map(renderMenuItem)}
        </div>

        {/* Help Section */}
        <div className="px-2 pb-3 relative z-10">
          <button
            className={cn(
              "group flex items-center py-2 text-sm font-medium rounded-md transition-all duration-200 relative w-full z-10",
              isExpanded ? "px-2" : "px-2 justify-center",
              "text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            )}
          >
            {/* Help Icon - explicit stroke to prevent flash */}
            <div className="shrink-0 w-5 h-5 flex items-center justify-center">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#2563eb"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            {/* Help Text */}
            {isExpanded && (
              <div className="flex items-center justify-between flex-1 ml-2">
                <span className="truncate text-sm">Get Help</span>
              </div>
            )}

            {/* Tooltip for collapsed state */}
            {!isExpanded && (
              <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Get Help
              </div>
            )}
          </button>
        </div>

        {/* Debug: Show permission count (remove in production) */}
        {isExpanded && process.env.NODE_ENV === "development" && (
          <div className="px-3 pb-2 text-xs text-slate-400">
            {permissions.length} permissions loaded
          </div>
        )}
      </div>
    </aside>
  );
}
