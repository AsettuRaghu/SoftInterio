"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { authLogger } from "@/lib/logger";

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

interface UseCurrentUserReturn {
  user: CurrentUser | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Track if we've already fetched to avoid duplicate calls
let globalFetchPromise: Promise<void> | null = null;
let globalUser: CurrentUser | null = null;
let globalIsLoading = true;
let globalError: string | null = null;
let hasFetched = false;
let subscribers: Set<() => void> = new Set();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

export function useCurrentUser(): UseCurrentUserReturn {
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

  const fetchUser = useCallback(async () => {
    // Return existing promise if already fetching
    if (globalFetchPromise) {
      return globalFetchPromise;
    }

    globalFetchPromise = (async () => {
      try {
        globalIsLoading = true;
        globalError = null;
        notifySubscribers();

        authLogger.info("Fetching current user data", { action: "FETCH_USER" });

        // Get current auth user
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          authLogger.debug("No authenticated user found", { action: "FETCH_USER" });
          globalUser = null;
          globalIsLoading = false;
          notifySubscribers();
          return;
        }

        // Get user details from users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select(`
            id,
            email,
            name,
            avatar_url,
            tenant_id
          `)
          .eq("id", authUser.id)
          .single();

        // Fetch tenant name separately
        let tenantName = null;
        if (userData?.tenant_id) {
          const { data: tenantData } = await supabase
            .from("tenants")
            .select("company_name")
            .eq("id", userData.tenant_id)
            .single();
          tenantName = tenantData?.company_name || null;
        }

        // Get user's roles
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select(`
            roles (
              name,
              slug,
              hierarchy_level
            )
          `)
          .eq("user_id", authUser.id);

        // Sort roles by hierarchy_level
        const sortedRoles =
          rolesData
            ?.map((r: any) => r.roles)
            .filter(Boolean)
            .sort((a: any, b: any) => (a.hierarchy_level || 99) - (b.hierarchy_level || 99)) || [];

        const roles = sortedRoles.map((r: any) => r.name);
        const primaryRole = roles[0] || "Team Member";

        // Get metadata
        const metadata = authUser.user_metadata || {};

        // Determine name
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
        } else if (metadata.first_name) {
          firstName = metadata.first_name;
          lastName = metadata.last_name || "";
          fullName = `${firstName} ${lastName}`.trim();
        } else {
          const emailName = (authUser.email || "").split("@")[0];
          firstName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
          lastName = "";
          fullName = firstName;
        }

        const designation = metadata.designation || primaryRole;

        globalUser = {
          id: userData?.id || authUser.id,
          email: userData?.email || authUser.email || "",
          firstName,
          lastName,
          fullName,
          designation,
          avatarUrl: userData?.avatar_url || null,
          tenantId: userData?.tenant_id || null,
          tenantName,
          roles,
          primaryRole,
        };

        hasFetched = true;

        authLogger.info("User data loaded successfully", {
          action: "FETCH_USER",
          userId: globalUser.id,
          roles: roles.join(", "),
        });
      } catch (err: any) {
        authLogger.error("Failed to fetch user data", err, { action: "FETCH_USER" });
        globalError = err.message || "Failed to fetch user";
      } finally {
        globalIsLoading = false;
        globalFetchPromise = null;
        notifySubscribers();
      }
    })();

    return globalFetchPromise;
  }, [supabase]);

  useEffect(() => {
    // Only fetch if we haven't already
    if (!hasFetched && !globalFetchPromise) {
      fetchUser();
    }

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      authLogger.debug("Auth state changed", { action: "AUTH_STATE", event });

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Only refetch if we already had data (actual re-auth, not initial load)
        if (hasFetched) {
          // Don't clear globalUser for TOKEN_REFRESHED - just refetch in background
          // This prevents UI flashing when switching browser tabs
          globalFetchPromise = null;
          fetchUser();
        }
        // If !hasFetched, the initial useEffect fetch is already handling it
      } else if (event === "SIGNED_OUT") {
        authLogger.info("User signed out, clearing state", { action: "SIGNOUT" });
        globalUser = null;
        globalIsLoading = false;
        globalError = null;
        hasFetched = false;
        notifySubscribers();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUser, supabase.auth]);

  return {
    user: globalUser,
    isLoading: globalIsLoading,
    error: globalError,
    refetch: fetchUser,
  };
}
