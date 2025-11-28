"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

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

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current auth user
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      console.log("[useCurrentUser] Auth user:", authUser?.id, authUser?.email);
      console.log("[useCurrentUser] Auth metadata:", authUser?.user_metadata);

      if (authError || !authUser) {
        console.log("[useCurrentUser] No auth user found");
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Get user details from users table
      // Use !inner to specify the foreign key relationship explicitly
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select(
          `
          id,
          email,
          name,
          avatar_url,
          tenant_id
        `
        )
        .eq("id", authUser.id)
        .single();

      // Fetch tenant name separately to avoid relationship ambiguity
      let tenantName = null;
      if (userData?.tenant_id) {
        const { data: tenantData, error: tenantError } = await supabase
          .from("tenants")
          .select("company_name")
          .eq("id", userData.tenant_id)
          .single();

        if (tenantError) {
          console.error("[useCurrentUser] Tenant fetch error:", tenantError);
        }
        tenantName = tenantData?.company_name || null;
      }

      console.log("[useCurrentUser] User data from DB:", userData);
      console.log("[useCurrentUser] User error:", userError);
      console.log("[useCurrentUser] Tenant name:", tenantName);

      // Get user's roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select(
          `
          roles (
            name,
            slug,
            hierarchy_level
          )
        `
        )
        .eq("user_id", authUser.id);

      console.log("[useCurrentUser] Roles data:", rolesData);

      // Sort roles by hierarchy_level (lower = higher priority)
      const sortedRoles =
        rolesData
          ?.map((r: any) => r.roles)
          .filter(Boolean)
          .sort(
            (a: any, b: any) =>
              (a.hierarchy_level || 99) - (b.hierarchy_level || 99)
          ) || [];

      const roles = sortedRoles.map((r: any) => r.name);
      const primaryRole = roles[0] || "Team Member";

      // Get metadata
      const metadata = authUser.user_metadata || {};

      // Determine name - try multiple sources
      let fullName = "";
      let firstName = "";
      let lastName = "";

      // Priority 1: Database name field
      if (userData?.name && userData.name.trim()) {
        fullName = userData.name.trim();
        const nameParts = fullName.split(" ");
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      }
      // Priority 2: Auth metadata full_name
      else if (metadata.full_name && metadata.full_name.trim()) {
        fullName = metadata.full_name.trim();
        const nameParts = fullName.split(" ");
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      }
      // Priority 3: Auth metadata name (used during signup)
      else if (metadata.name && metadata.name.trim()) {
        fullName = metadata.name.trim();
        const nameParts = fullName.split(" ");
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      }
      // Priority 4: Auth metadata first_name + last_name
      else if (metadata.first_name) {
        firstName = metadata.first_name;
        lastName = metadata.last_name || "";
        fullName = `${firstName} ${lastName}`.trim();
      }
      // Priority 5: Email prefix
      else {
        const emailName = (authUser.email || "").split("@")[0];
        firstName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        lastName = "";
        fullName = firstName;
      }

      // Determine designation
      const designation = metadata.designation || primaryRole;

      console.log("[useCurrentUser] Final values:", {
        firstName,
        lastName,
        fullName,
        designation,
        primaryRole,
      });

      setUser({
        id: userData?.id || authUser.id,
        email: userData?.email || authUser.email || "",
        firstName,
        lastName,
        fullName,
        designation,
        avatarUrl: userData?.avatar_url || null,
        tenantId: userData?.tenant_id || null,
        tenantName: null, // Removed tenants join to avoid relationship ambiguity
        roles,
        primaryRole,
      });
    } catch (err: any) {
      console.error("[useCurrentUser] Error:", err);
      setError(err.message || "Failed to fetch user");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchUser();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUser, supabase.auth]);

  return {
    user,
    isLoading,
    error,
    refetch: fetchUser,
  };
}
