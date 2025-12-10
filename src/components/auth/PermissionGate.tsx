"use client";

import React from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import type { PermissionKey, RoleSlug } from "@/types/roles-permissions";

interface PermissionGateProps {
  /**
   * Required permission(s) to render children
   * If array, user must have at least one (OR logic)
   */
  permission?: PermissionKey | PermissionKey[];

  /**
   * Required permissions - ALL must be present (AND logic)
   */
  allPermissions?: PermissionKey[];

  /**
   * Required role(s) to render children
   * If array, user must have at least one (OR logic)
   */
  role?: RoleSlug | RoleSlug[];

  /**
   * Minimum hierarchy level required (lower = more privileged)
   * 0 = Owner, 1 = Admin, 2 = Manager, 4 = Staff, 5 = Limited
   */
  minHierarchyLevel?: number;

  /**
   * Content to render if user doesn't have permission
   */
  fallback?: React.ReactNode;

  /**
   * Children to render if user has permission
   */
  children: React.ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 *
 * @example
 * // Single permission
 * <PermissionGate permission="leads.create">
 *   <CreateLeadButton />
 * </PermissionGate>
 *
 * @example
 * // Multiple permissions (OR logic - needs any one)
 * <PermissionGate permission={["leads.edit", "leads.edit_own"]}>
 *   <EditLeadButton />
 * </PermissionGate>
 *
 * @example
 * // All permissions required (AND logic)
 * <PermissionGate allPermissions={["leads.view", "leads.export"]}>
 *   <ExportButton />
 * </PermissionGate>
 *
 * @example
 * // Role-based
 * <PermissionGate role="sales_manager">
 *   <ManagerOnlySection />
 * </PermissionGate>
 *
 * @example
 * // Hierarchy-based (managers and above)
 * <PermissionGate minHierarchyLevel={2}>
 *   <ManagerContent />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  allPermissions,
  role,
  minHierarchyLevel,
  fallback = null,
  children,
}: PermissionGateProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hierarchyLevel,
    isLoading,
  } = useUserPermissions();

  // While loading, don't render anything (or render a loader if preferred)
  if (isLoading) {
    return null;
  }

  // Check permission
  if (permission) {
    const permissions = Array.isArray(permission) ? permission : [permission];
    if (!hasAnyPermission(permissions)) {
      return <>{fallback}</>;
    }
  }

  // Check all permissions
  if (allPermissions && allPermissions.length > 0) {
    if (!hasAllPermissions(allPermissions)) {
      return <>{fallback}</>;
    }
  }

  // Check role
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!hasAnyRole(roles)) {
      return <>{fallback}</>;
    }
  }

  // Check hierarchy level
  if (minHierarchyLevel !== undefined) {
    if (hierarchyLevel > minHierarchyLevel) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

/**
 * Hook to check if user can perform an action
 * Returns a boolean and handles loading state
 */
export function useCanAccess(options: {
  permission?: PermissionKey | PermissionKey[];
  allPermissions?: PermissionKey[];
  role?: RoleSlug | RoleSlug[];
  minHierarchyLevel?: number;
}): { canAccess: boolean; isLoading: boolean } {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hierarchyLevel,
    isLoading,
  } = useUserPermissions();

  if (isLoading) {
    return { canAccess: false, isLoading: true };
  }

  let canAccess = true;

  // Check permission
  if (options.permission) {
    const permissions = Array.isArray(options.permission)
      ? options.permission
      : [options.permission];
    canAccess = canAccess && hasAnyPermission(permissions);
  }

  // Check all permissions
  if (options.allPermissions && options.allPermissions.length > 0) {
    canAccess = canAccess && hasAllPermissions(options.allPermissions);
  }

  // Check role
  if (options.role) {
    const roles = Array.isArray(options.role) ? options.role : [options.role];
    canAccess = canAccess && hasAnyRole(roles);
  }

  // Check hierarchy level
  if (options.minHierarchyLevel !== undefined) {
    canAccess = canAccess && hierarchyLevel <= options.minHierarchyLevel;
  }

  return { canAccess, isLoading: false };
}

/**
 * Higher-order component to wrap a component with permission check
 *
 * @example
 * const ProtectedComponent = withPermission(MyComponent, {
 *   permission: 'leads.create',
 *   fallback: <AccessDenied />
 * });
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    permission?: PermissionKey | PermissionKey[];
    allPermissions?: PermissionKey[];
    role?: RoleSlug | RoleSlug[];
    minHierarchyLevel?: number;
    fallback?: React.ReactNode;
  }
) {
  return function PermissionProtectedComponent(props: P) {
    return (
      <PermissionGate {...options}>
        <WrappedComponent {...props} />
      </PermissionGate>
    );
  };
}
