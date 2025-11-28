"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface UserPermissionsState {
  permissions: string[];
  roles: string[];
  hierarchyLevel: number;
  isLoading: boolean;
  error: string | null;
}

interface UseUserPermissionsReturn extends UserPermissionsState {
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isAdminOrHigher: boolean;
  refetch: () => Promise<void>;
}

export function useUserPermissions(): UseUserPermissionsReturn {
  const [state, setState] = useState<UserPermissionsState>({
    permissions: [],
    roles: [],
    hierarchyLevel: 999,
    isLoading: true,
    error: null,
  });

  const supabase = createClient();

  const fetchPermissions = useCallback(async () => {
    console.log("[useUserPermissions] Starting to fetch permissions...");

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Get current user
      console.log("[useUserPermissions] Getting current user...");
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("[useUserPermissions] Auth error:", userError);
      }

      if (!user) {
        console.log("[useUserPermissions] No user found - not authenticated");
        setState({
          permissions: [],
          roles: [],
          hierarchyLevel: 999,
          isLoading: false,
          error: userError?.message || "Not authenticated",
        });
        return;
      }

      console.log("[useUserPermissions] Current user ID:", user.id);
      console.log("[useUserPermissions] Current user email:", user.email);

      // Fetch user's roles with hierarchy
      console.log("[useUserPermissions] Fetching user roles...");
      const { data: userRolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select(
          `
          role_id,
          roles (
            id,
            slug,
            name,
            hierarchy_level
          )
        `
        )
        .eq("user_id", user.id);

      console.log("[useUserPermissions] User roles query result:", {
        data: userRolesData,
        error: rolesError,
      });

      if (rolesError) {
        console.error(
          "[useUserPermissions] Roles query error:",
          JSON.stringify(rolesError, null, 2)
        );
        throw rolesError;
      }

      // Extract role slugs and find minimum hierarchy level
      const roles: string[] = [];
      let minHierarchy = 999;

      userRolesData?.forEach((ur: any) => {
        if (ur.roles) {
          console.log(
            "[useUserPermissions] Found role:",
            ur.roles.name,
            ur.roles.slug
          );
          roles.push(ur.roles.slug);
          if (ur.roles.hierarchy_level < minHierarchy) {
            minHierarchy = ur.roles.hierarchy_level;
          }
        }
      });

      console.log("[useUserPermissions] Extracted roles:", roles);
      console.log("[useUserPermissions] Min hierarchy level:", minHierarchy);

      // Fetch permissions for user's roles
      const roleIds = userRolesData?.map((ur: any) => ur.role_id) || [];
      console.log(
        "[useUserPermissions] Role IDs for permission lookup:",
        roleIds
      );

      if (roleIds.length === 0) {
        console.log(
          "[useUserPermissions] No roles found for user - returning empty permissions"
        );
        setState({
          permissions: [],
          roles: [],
          hierarchyLevel: 999,
          isLoading: false,
          error: null,
        });
        return;
      }

      console.log("[useUserPermissions] Fetching permissions for roles...");
      const { data: permissionsData, error: permissionsError } = await supabase
        .from("role_permissions")
        .select(
          `
          granted,
          permissions (
            key
          )
        `
        )
        .in("role_id", roleIds)
        .eq("granted", true);

      console.log("[useUserPermissions] Permissions query result:", {
        data: permissionsData,
        error: permissionsError,
        count: permissionsData?.length,
      });

      if (permissionsError) {
        console.error(
          "[useUserPermissions] Permissions query error:",
          JSON.stringify(permissionsError, null, 2)
        );
        throw permissionsError;
      }

      // Extract unique permission keys
      const permissionSet = new Set(
        permissionsData
          ?.filter((rp: any) => rp.granted && rp.permissions)
          .map((rp: any) => rp.permissions.key) || []
      );
      const permissions = Array.from(permissionSet) as string[];

      console.log(
        "[useUserPermissions] Final permissions count:",
        permissions.length
      );
      console.log(
        "[useUserPermissions] Sample permissions:",
        permissions.slice(0, 5)
      );

      setState({
        permissions,
        roles,
        hierarchyLevel: minHierarchy,
        isLoading: false,
        error: null,
      });

      console.log("[useUserPermissions] Successfully loaded permissions");
    } catch (error: any) {
      console.error("[useUserPermissions] Error fetching permissions:", error);
      console.error(
        "[useUserPermissions] Error details:",
        JSON.stringify(error, null, 2)
      );
      console.error("[useUserPermissions] Error message:", error?.message);
      console.error("[useUserPermissions] Error code:", error?.code);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error?.message || "Failed to fetch permissions",
      }));
    }
  }, [supabase]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Permission check functions
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return state.permissions.includes(permission);
    },
    [state.permissions]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      return permissions.some((p) => state.permissions.includes(p));
    },
    [state.permissions]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      return permissions.every((p) => state.permissions.includes(p));
    },
    [state.permissions]
  );

  // Role-based checks
  const isOwner = useMemo(() => state.roles.includes("owner"), [state.roles]);

  const isAdmin = useMemo(() => state.roles.includes("admin"), [state.roles]);

  const isAdminOrHigher = useMemo(
    () => state.hierarchyLevel <= 1,
    [state.hierarchyLevel]
  );

  return {
    ...state,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isOwner,
    isAdmin,
    isAdminOrHigher,
    refetch: fetchPermissions,
  };
}
