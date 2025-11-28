/**
 * Roles API Route
 * GET /api/team/roles
 * Get all available roles for inviting users
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  console.log("[ROLES API] GET /api/team/roles - Request received");

  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[ROLES API] Not authenticated:", authError);
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    console.log("[ROLES API] Auth user ID:", authUser.id);

    // Get user's tenant - simple query
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("id, tenant_id, is_super_admin")
      .eq("id", authUser.id)
      .single();

    if (userError) {
      console.error("[ROLES API] Failed to get user:", userError);
      return NextResponse.json(
        { success: false, error: "User not found", details: userError.message },
        { status: 404 }
      );
    }

    if (!currentUser) {
      console.error("[ROLES API] No user record found");
      return NextResponse.json(
        { success: false, error: "User record not found" },
        { status: 404 }
      );
    }

    console.log(
      "[ROLES API] Current user tenant:",
      currentUser.tenant_id,
      "Super admin:",
      currentUser.is_super_admin
    );

    // Get the current user's role hierarchy level (separate query to avoid RLS issues)
    let minHierarchyLevel = 1; // Default: can assign all except owner (level 1)

    if (!currentUser.is_super_admin) {
      const { data: userRoles, error: userRolesError } = await supabase
        .from("user_roles")
        .select("role_id")
        .eq("user_id", authUser.id);

      if (!userRolesError && userRoles && userRoles.length > 0) {
        const roleIds = userRoles.map((ur) => ur.role_id);

        const { data: roles, error: rolesError } = await supabase
          .from("roles")
          .select("hierarchy_level")
          .in("id", roleIds)
          .order("hierarchy_level", { ascending: true })
          .limit(1);

        if (!rolesError && roles && roles.length > 0) {
          minHierarchyLevel = roles[0].hierarchy_level;
        }
      }
    }

    console.log(
      "[ROLES API] Min hierarchy level for assignment:",
      minHierarchyLevel
    );

    // Determine the minimum hierarchy level for roles that can be assigned:
    // - Owner (level 0) can assign Admin (level 1) and below
    // - Admin (level 1) can assign Manager (level 1) and below, but NOT other Admins
    // - Manager and below can only assign their level and below
    // Owner (level 0) should never be assignable via invite
    let minAssignableLevel: number;

    if (currentUser.is_super_admin || minHierarchyLevel === 0) {
      // Owner can assign Admin and below (level >= 1)
      minAssignableLevel = 1;
    } else {
      // Others can only assign roles at their level or below
      // But never Admin (level 1) - that's Owner-only
      minAssignableLevel = Math.max(minHierarchyLevel, 2);
    }

    // Get system roles that can be assigned
    const { data: systemRoles, error: systemRolesError } = await supabase
      .from("roles")
      .select("id, name, slug, description, hierarchy_level, is_default")
      .eq("is_system_role", true)
      .gte("hierarchy_level", minAssignableLevel)
      .order("hierarchy_level", { ascending: true });

    if (systemRolesError) {
      console.error(
        "[ROLES API] Failed to get system roles:",
        systemRolesError
      );
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get roles",
          details: systemRolesError.message,
        },
        { status: 500 }
      );
    }

    // Also get tenant-specific custom roles
    let customRoles: any[] = [];
    if (currentUser.tenant_id) {
      const { data: tenantRoles, error: customRolesError } = await supabase
        .from("roles")
        .select("id, name, slug, description, hierarchy_level, is_default")
        .eq("tenant_id", currentUser.tenant_id)
        .eq("is_system_role", false)
        .order("hierarchy_level", { ascending: true });

      if (customRolesError) {
        console.error(
          "[ROLES API] Failed to get custom roles:",
          customRolesError
        );
      } else {
        customRoles = tenantRoles || [];
      }
    }

    // Combine system and custom roles
    const allRoles = [...(systemRoles || []), ...customRoles];

    console.log("[ROLES API] Found", allRoles.length, "roles");

    return NextResponse.json({
      success: true,
      data: allRoles,
    });
  } catch (error: any) {
    console.error("[ROLES API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get roles" },
      { status: 500 }
    );
  }
}
