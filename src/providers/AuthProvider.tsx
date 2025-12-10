/**
 * Authentication Context Provider
 *
 * Centralizes authentication state to prevent:
 * - Multiple identical API calls from different components
 * - Duplicate state management across hooks
 * - Re-fetching on every component mount
 *
 * Features:
 * - Single source of truth for auth state
 * - Shared across all components via context
 * - Efficient caching with manual refetch option
 * - Proper cleanup of subscriptions
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { authLogger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  designation: string | null;
  avatarUrl: string | null;
  tenantId: string | null;
  tenantName: string | null;
  roles: string[];
  primaryRole: string;
}

interface UserPermissions {
  permissions: string[];
  roles: string[];
  hierarchyLevel: number;
}

interface AuthContextState {
  // User data
  user: CurrentUser | null;
  // Permissions data
  permissions: string[];
  roles: string[];
  hierarchyLevel: number;
  // State flags
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  // Permission helpers
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  // Role helpers
  isOwner: boolean;
  isAdmin: boolean;
  isAdminOrHigher: boolean;
  // Actions
  refetch: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextState | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Use refs to prevent duplicate fetches
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);
  const supabaseRef = useRef(createClient());

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [permissionsState, setPermissionsState] = useState<UserPermissions>({
    permissions: [],
    roles: [],
    hierarchyLevel: 999,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = supabaseRef.current;

  /**
   * Fetch all user data and permissions in a single coordinated call
   */
  const fetchAuthData = useCallback(async () => {
    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      authLogger.debug("Fetch already in progress, skipping", {
        action: "FETCH_AUTH",
      });
      return;
    }

    isFetchingRef.current = true;
    authLogger.info("Fetching auth data", { action: "FETCH_AUTH" });

    try {
      setIsLoading(true);
      setError(null);

      // Get current auth user
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        authLogger.debug("No authenticated user found", {
          action: "FETCH_AUTH",
        });
        setUser(null);
        setPermissionsState({
          permissions: [],
          roles: [],
          hierarchyLevel: 999,
        });
        setIsLoading(false);
        hasFetchedRef.current = true;
        isFetchingRef.current = false;
        return;
      }

      authLogger.debug("Auth user found", {
        action: "FETCH_AUTH",
        userId: authUser.id,
      });

      // Fetch all data in parallel for efficiency
      const [userResult, rolesResult] = await Promise.all([
        // User details
        supabase
          .from("users")
          .select("id, email, name, avatar_url, tenant_id")
          .eq("id", authUser.id)
          .single(),
        // User roles with permissions
        supabase
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
          .eq("user_id", authUser.id),
      ]);

      const userData = userResult.data;
      const userRolesData = rolesResult.data;

      // Fetch tenant name if available
      let tenantName = null;
      if (userData?.tenant_id) {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("company_name")
          .eq("id", userData.tenant_id)
          .single();
        tenantName = tenantData?.company_name || null;
      }

      // Process roles
      const rolesList: string[] = [];
      let minHierarchy = 999;
      const roleIds: string[] = [];

      userRolesData?.forEach((ur: any) => {
        if (ur.roles) {
          rolesList.push(ur.roles.slug);
          roleIds.push(ur.role_id);
          if (ur.roles.hierarchy_level < minHierarchy) {
            minHierarchy = ur.roles.hierarchy_level;
          }
        }
      });

      // Fetch permissions for roles
      let permissions: string[] = [];
      if (roleIds.length > 0) {
        const { data: permissionsData } = await supabase
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

        const permissionSet = new Set(
          permissionsData
            ?.filter((rp: any) => rp.granted && rp.permissions)
            .map((rp: any) => rp.permissions.key) || []
        );
        permissions = Array.from(permissionSet) as string[];
      }

      // Process user name
      const metadata = authUser.user_metadata || {};
      let fullName = "";
      let firstName = "";
      let lastName = "";

      if (userData?.name?.trim()) {
        fullName = userData.name.trim();
        const nameParts = fullName.split(" ");
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      } else if (metadata.full_name?.trim()) {
        fullName = metadata.full_name.trim();
        const nameParts = fullName.split(" ");
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      } else if (metadata.name?.trim()) {
        fullName = metadata.name.trim();
        const nameParts = fullName.split(" ");
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      } else {
        const emailName = (authUser.email || "").split("@")[0];
        firstName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        fullName = firstName;
      }

      // Sort roles by hierarchy for primary role
      const sortedRoles =
        userRolesData
          ?.map((r: any) => r.roles)
          .filter(Boolean)
          .sort(
            (a: any, b: any) =>
              (a.hierarchy_level || 99) - (b.hierarchy_level || 99)
          ) || [];
      const roleNames = sortedRoles.map((r: any) => r.name);
      const primaryRole = roleNames[0] || "Team Member";
      const designation = metadata.designation || primaryRole;

      // Update state
      setUser({
        id: userData?.id || authUser.id,
        email: userData?.email || authUser.email || "",
        firstName,
        lastName,
        fullName,
        designation,
        avatarUrl: userData?.avatar_url || null,
        tenantId: userData?.tenant_id || null,
        tenantName,
        roles: roleNames,
        primaryRole,
      });

      setPermissionsState({
        permissions,
        roles: rolesList,
        hierarchyLevel: minHierarchy,
      });

      authLogger.info("Auth data loaded successfully", {
        action: "FETCH_AUTH",
        permissionCount: permissions.length,
        roleCount: rolesList.length,
      });

      hasFetchedRef.current = true;
    } catch (err: any) {
      authLogger.error("Failed to fetch auth data", err, {
        action: "FETCH_AUTH",
      });
      setError(err.message || "Failed to fetch user data");
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [supabase]);

  /**
   * Sign out and clear state
   */
  const handleSignOut = useCallback(async () => {
    authLogger.info("Signing out", { action: "SIGNOUT" });

    try {
      await supabase.auth.signOut();
      setUser(null);
      setPermissionsState({ permissions: [], roles: [], hierarchyLevel: 999 });
      hasFetchedRef.current = false;
    } catch (err) {
      authLogger.error("Sign out error", err, { action: "SIGNOUT" });
      // Still clear local state even if server-side fails
      setUser(null);
      setPermissionsState({ permissions: [], roles: [], hierarchyLevel: 999 });
    }
  }, [supabase]);

  // Initial fetch and auth state listener
  useEffect(() => {
    // Only fetch once on mount
    if (!hasFetchedRef.current) {
      fetchAuthData();
    }

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      authLogger.debug("Auth state changed", {
        action: "AUTH_STATE_CHANGE",
        event,
      });

      if (event === "SIGNED_IN" && !hasFetchedRef.current) {
        fetchAuthData();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setPermissionsState({
          permissions: [],
          roles: [],
          hierarchyLevel: 999,
        });
        hasFetchedRef.current = false;
      } else if (event === "TOKEN_REFRESHED") {
        // Token refreshed, optionally refetch if needed
        // Usually not necessary unless permissions might have changed
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAuthData, supabase.auth]);

  // Permission check functions - memoized for performance
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return permissionsState.permissions.includes(permission);
    },
    [permissionsState.permissions]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      return permissions.some((p) => permissionsState.permissions.includes(p));
    },
    [permissionsState.permissions]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      return permissions.every((p) => permissionsState.permissions.includes(p));
    },
    [permissionsState.permissions]
  );

  // Role checks - memoized
  const isOwner = useMemo(
    () => permissionsState.roles.includes("owner"),
    [permissionsState.roles]
  );

  const isAdmin = useMemo(
    () => permissionsState.roles.includes("admin"),
    [permissionsState.roles]
  );

  const isAdminOrHigher = useMemo(
    () => permissionsState.hierarchyLevel <= 1,
    [permissionsState.hierarchyLevel]
  );

  // Context value - memoized to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextState>(
    () => ({
      user,
      permissions: permissionsState.permissions,
      roles: permissionsState.roles,
      hierarchyLevel: permissionsState.hierarchyLevel,
      isLoading,
      isAuthenticated: !!user,
      error,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      isOwner,
      isAdmin,
      isAdminOrHigher,
      refetch: fetchAuthData,
      signOut: handleSignOut,
    }),
    [
      user,
      permissionsState,
      isLoading,
      error,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      isOwner,
      isAdmin,
      isAdminOrHigher,
      fetchAuthData,
      handleSignOut,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access auth context
 * Must be used within AuthProvider
 */
export function useAuth(): AuthContextState {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

/**
 * Backwards-compatible hook for current user data
 * @deprecated Use useAuth() instead for better performance
 */
export function useCurrentUserFromContext() {
  const { user, isLoading, error, refetch } = useAuth();

  return {
    user,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Backwards-compatible hook for permissions
 * @deprecated Use useAuth() instead for better performance
 */
export function usePermissionsFromContext() {
  const auth = useAuth();

  return {
    permissions: auth.permissions,
    roles: auth.roles,
    hierarchyLevel: auth.hierarchyLevel,
    isLoading: auth.isLoading,
    error: auth.error,
    hasPermission: auth.hasPermission,
    hasAnyPermission: auth.hasAnyPermission,
    hasAllPermissions: auth.hasAllPermissions,
    isOwner: auth.isOwner,
    isAdmin: auth.isAdmin,
    isAdminOrHigher: auth.isAdminOrHigher,
    refetch: auth.refetch,
  };
}

export default AuthProvider;
