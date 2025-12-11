"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { authLogger } from "@/lib/logger";
import type { PermissionKey, RoleSlug } from "@/types/roles-permissions";

interface UserPermissionsState {
  permissions: string[];
  roles: string[];
  hierarchyLevel: number;
  isLoading: boolean;
  error: string | null;
}

interface UseUserPermissionsReturn extends UserPermissionsState {
  hasPermission: (permission: PermissionKey | string) => boolean;
  hasAnyPermission: (permissions: (PermissionKey | string)[]) => boolean;
  hasAllPermissions: (permissions: (PermissionKey | string)[]) => boolean;
  hasRole: (role: RoleSlug | string) => boolean;
  hasAnyRole: (roles: (RoleSlug | string)[]) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isAdminOrHigher: boolean;
  isManager: boolean;
  refetch: () => Promise<void>;
}

// Global state to share across all hook instances - prevents duplicate fetches
let globalState: UserPermissionsState = {
  permissions: [],
  roles: [],
  hierarchyLevel: 999,
  isLoading: true,
  error: null,
};
let globalFetchPromise: Promise<void> | null = null;
let hasFetched = false;
let subscribers: Set<() => void> = new Set();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

export function useUserPermissions(): UseUserPermissionsReturn {
  const [, forceUpdate] = useState({});

  // Subscribe to global state changes
  useEffect(() => {
    const callback = () => forceUpdate({});
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  }, []);

  const supabase = createClient();

  const fetchPermissions = useCallback(async () => {
    // Return existing promise if already fetching
    if (globalFetchPromise) {
      return globalFetchPromise;
    }

    globalFetchPromise = (async () => {
      try {
        // Only show loading if we don't have any cached data
        // This prevents UI flash on background token refresh
        if (globalState.permissions.length === 0 && globalState.roles.length === 0) {
          globalState = { ...globalState, isLoading: true, error: null };
          notifySubscribers();
        }

        authLogger.info("Fetching user permissions", { action: "FETCH_PERMISSIONS" });

        // Get current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!user) {
          authLogger.debug("No user found for permissions", { action: "FETCH_PERMISSIONS" });
          globalState = {
            permissions: [],
            roles: [],
            hierarchyLevel: 999,
            isLoading: false,
            error: userError?.message || "Not authenticated",
          };
          hasFetched = true;
          notifySubscribers();
          return;
        }

        // Fetch user's roles with hierarchy
        const { data: userRolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select(`
            role_id,
            roles (
              id,
              slug,
              name,
              hierarchy_level
            )
          `)
          .eq("user_id", user.id);

        if (rolesError) {
          throw rolesError;
        }

        // Extract role slugs and find minimum hierarchy level
        const roles: string[] = [];
        let minHierarchy = 999;

        userRolesData?.forEach((ur: any) => {
          if (ur.roles) {
            roles.push(ur.roles.slug);
            if (ur.roles.hierarchy_level < minHierarchy) {
              minHierarchy = ur.roles.hierarchy_level;
            }
          }
        });

        // Fetch permissions for user's roles
        const roleIds = userRolesData?.map((ur: any) => ur.role_id) || [];

        if (roleIds.length === 0) {
          globalState = {
            permissions: [],
            roles: [],
            hierarchyLevel: 999,
            isLoading: false,
            error: null,
          };
          hasFetched = true;
          notifySubscribers();
          return;
        }

        const { data: permissionsData, error: permissionsError } = await supabase
          .from("role_permissions")
          .select(`
            granted,
            permissions (
              key
            )
          `)
          .in("role_id", roleIds)
          .eq("granted", true);

        if (permissionsError) {
          throw permissionsError;
        }

        // Extract unique permission keys
        const permissionSet = new Set(
          permissionsData
            ?.filter((rp: any) => rp.granted && rp.permissions)
            .map((rp: any) => rp.permissions.key) || []
        );
        const permissions = Array.from(permissionSet) as string[];

        globalState = {
          permissions,
          roles,
          hierarchyLevel: minHierarchy,
          isLoading: false,
          error: null,
        };
        hasFetched = true;

        authLogger.info("Permissions loaded successfully", {
          action: "FETCH_PERMISSIONS",
          permissionCount: permissions.length,
          roles: roles.join(", "),
        });
        notifySubscribers();
      } catch (error: any) {
        authLogger.error("Failed to fetch permissions", error, { action: "FETCH_PERMISSIONS" });
        globalState = {
          ...globalState,
          isLoading: false,
          error: error?.message || "Failed to fetch permissions",
        };
        hasFetched = true;
        notifySubscribers();
      } finally {
        globalFetchPromise = null;
      }
    })();

    return globalFetchPromise;
  }, [supabase]);

  useEffect(() => {
    // Only fetch if we haven't successfully loaded yet
    if (!hasFetched && !globalFetchPromise) {
      fetchPermissions();
    }

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        // Only refetch on actual sign-in (not token refresh)
        if (hasFetched) {
          authLogger.debug("User signed in, refetching permissions", {
            action: "AUTH_STATE",
            event,
          });
          // Reset and refetch
          globalState = {
            permissions: [],
            roles: [],
            hierarchyLevel: 999,
            isLoading: true,
            error: null,
          };
          hasFetched = false;
          globalFetchPromise = null;
          fetchPermissions();
        }
        // If !hasFetched, the initial useEffect fetch is already handling it
      } else if (event === "TOKEN_REFRESHED") {
        // On token refresh, silently refetch without showing loading state
        // This prevents the sidebar flash when switching browser tabs
        if (hasFetched) {
          authLogger.debug("Token refreshed, silently refetching permissions", {
            action: "AUTH_STATE",
            event,
          });
          // Keep existing data visible while refetching in background
          hasFetched = false;
          globalFetchPromise = null;
          // Don't reset globalState - keep showing current data
          fetchPermissions();
        }
      } else if (event === "SIGNED_OUT") {
        authLogger.debug("User signed out, clearing permissions", { action: "AUTH_STATE" });
        globalState = {
          permissions: [],
          roles: [],
          hierarchyLevel: 999,
          isLoading: false,
          error: null,
        };
        hasFetched = false;
        notifySubscribers();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchPermissions, supabase.auth]);

  // Permission check functions - use current globalState
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return globalState.permissions.includes(permission);
    },
    []
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      return permissions.some((p) => globalState.permissions.includes(p));
    },
    []
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      return permissions.every((p) => globalState.permissions.includes(p));
    },
    []
  );

  // Role check functions
  const hasRole = useCallback(
    (role: string): boolean => {
      return globalState.roles.includes(role);
    },
    []
  );

  const hasAnyRole = useCallback(
    (roles: string[]): boolean => {
      return roles.some((r) => globalState.roles.includes(r));
    },
    []
  );

  // Role-based checks - these need to update when globalState changes
  const isOwner = globalState.roles.includes("owner");
  const isAdmin = globalState.roles.includes("admin");
  const isAdminOrHigher = globalState.hierarchyLevel <= 1;
  const isManager = globalState.hierarchyLevel <= 2;

  return {
    ...globalState,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isOwner,
    isAdmin,
    isAdminOrHigher,
    isManager,
    refetch: fetchPermissions,
  };
}
