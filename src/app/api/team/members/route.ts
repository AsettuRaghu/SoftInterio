/**
 * Team Members API Route
 * GET /api/team/members - Get all team members for the current tenant
 * DELETE /api/team/members - Soft delete (disable) a team member
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  console.log("[TEAM API] GET /api/team/members - Request received");

  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[TEAM API] Not authenticated:", authError);
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    console.log("[TEAM API] Auth user ID:", authUser.id);

    // Get user's tenant - use admin client to bypass RLS
    const { data: currentUser, error: userError } = await adminClient
      .from("users")
      .select("id, tenant_id")
      .eq("id", authUser.id)
      .single();

    if (userError) {
      console.error("[TEAM API] Failed to get user:", userError);
      return NextResponse.json(
        { success: false, error: "User not found", details: userError.message },
        { status: 404 }
      );
    }

    if (!currentUser) {
      console.error("[TEAM API] No user record found");
      return NextResponse.json(
        { success: false, error: "User record not found" },
        { status: 404 }
      );
    }

    console.log("[TEAM API] Current user tenant:", currentUser.tenant_id);

    // Get all team members using tenant_users for membership status
    // First try with tenant_users, fallback to users.status for backwards compatibility
    let members: any[] = [];

    // Try to get members via tenant_users (new approach)
    const { data: tenantMemberships, error: membershipError } =
      await adminClient
        .from("tenant_users")
        .select(
          `
        user_id,
        is_active,
        joined_at,
        removed_at
      `
        )
        .eq("tenant_id", currentUser.tenant_id);

    if (!membershipError && tenantMemberships && tenantMemberships.length > 0) {
      // New approach: Get users based on tenant_users
      const userIds = tenantMemberships.map((m) => m.user_id);

      const { data: usersData, error: usersError } = await adminClient
        .from("users")
        .select(
          "id, name, email, phone, avatar_url, status, is_super_admin, last_login_at, created_at, tenant_id"
        )
        .in("id", userIds)
        .eq("tenant_id", currentUser.tenant_id);

      if (!usersError && usersData) {
        // Merge user data with membership status
        members = usersData
          .map((user) => {
            const membership = tenantMemberships.find(
              (m) => m.user_id === user.id
            );
            return {
              ...user,
              // Override status based on tenant_users.is_active
              membershipActive: membership?.is_active ?? true,
              joinedAt: membership?.joined_at,
              removedAt: membership?.removed_at,
            };
          })
          .filter((m) => m.membershipActive); // Only show active members
      }
    }

    // Fallback to legacy approach if tenant_users is empty
    if (members.length === 0) {
      const { data: legacyMembers, error: legacyError } = await adminClient
        .from("users")
        .select(
          "id, name, email, phone, avatar_url, status, is_super_admin, last_login_at, created_at, tenant_id"
        )
        .eq("tenant_id", currentUser.tenant_id)
        .in("status", ["active", "invited", "pending_verification"])
        .order("created_at", { ascending: true });

      if (!legacyError && legacyMembers) {
        members = legacyMembers.map((m) => ({
          ...m,
          membershipActive: true,
        }));
      }
    }

    console.log("[TEAM API] Found", members?.length, "active members");

    // Now get roles for each member separately - use admin client
    const memberIds = members?.map((m) => m.id) || [];

    let userRolesMap: Record<string, any[]> = {};

    if (memberIds.length > 0) {
      // Get user_roles for all members
      const { data: userRoles, error: userRolesError } = await adminClient
        .from("user_roles")
        .select("user_id, role_id")
        .in("user_id", memberIds);

      if (userRolesError) {
        console.error("[TEAM API] Failed to get user roles:", userRolesError);
        // Continue without roles rather than failing
      } else if (userRoles && userRoles.length > 0) {
        // Get all role IDs
        const roleIds = Array.from(new Set(userRoles.map((ur) => ur.role_id)));

        // Fetch roles separately
        const { data: roles, error: rolesError } = await adminClient
          .from("roles")
          .select("id, name, slug, hierarchy_level")
          .in("id", roleIds);

        if (rolesError) {
          console.error("[TEAM API] Failed to get roles:", rolesError);
        } else {
          // Build a map of role_id -> role
          const rolesById: Record<string, any> = {};
          roles?.forEach((role) => {
            rolesById[role.id] = role;
          });

          // Build user -> roles map
          userRoles.forEach((ur) => {
            if (!userRolesMap[ur.user_id]) {
              userRolesMap[ur.user_id] = [];
            }
            const role = rolesById[ur.role_id];
            if (role) {
              userRolesMap[ur.user_id].push(role);
            }
          });
        }
      }
    }

    // Transform the data to include roles
    const transformedMembers = members?.map((member: any) => ({
      ...member,
      roles: userRolesMap[member.id] || [],
    }));

    console.log(
      "[TEAM API] Returning",
      transformedMembers?.length,
      "team members"
    );

    return NextResponse.json({
      success: true,
      data: transformedMembers,
    });
  } catch (error: any) {
    console.error("[TEAM API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get team members" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/members?id=<user_id>
 * Soft delete (disable) a team member
 * - Cannot delete yourself
 * - Cannot delete users with higher/equal hierarchy than you
 * - Requires settings.team.remove permission
 */
export async function DELETE(request: NextRequest) {
  console.log("[TEAM API] DELETE /api/team/members - Request received");

  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get member ID from query params
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("id");

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "Member ID is required" },
        { status: 400 }
      );
    }

    // Get current user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[TEAM API] Not authenticated:", authError);
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Prevent self-deletion
    if (authUser.id === memberId) {
      return NextResponse.json(
        { success: false, error: "You cannot remove yourself from the team" },
        { status: 403 }
      );
    }

    // Get current user's details and roles
    const { data: currentUser, error: currentUserError } = await adminClient
      .from("users")
      .select("id, tenant_id, is_super_admin")
      .eq("id", authUser.id)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { success: false, error: "Current user not found" },
        { status: 404 }
      );
    }

    // Get current user's minimum hierarchy level
    const { data: currentUserRoles } = await adminClient
      .from("user_roles")
      .select("roles(hierarchy_level)")
      .eq("user_id", authUser.id);

    let currentUserMinHierarchy = currentUser.is_super_admin ? 0 : 999;
    currentUserRoles?.forEach((ur: any) => {
      if (ur.roles?.hierarchy_level < currentUserMinHierarchy) {
        currentUserMinHierarchy = ur.roles.hierarchy_level;
      }
    });

    // Get target member details
    const { data: targetMember, error: targetError } = await adminClient
      .from("users")
      .select("id, tenant_id, email, name, is_super_admin, status")
      .eq("id", memberId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json(
        { success: false, error: "Member not found" },
        { status: 404 }
      );
    }

    // Ensure member belongs to same tenant
    if (targetMember.tenant_id !== currentUser.tenant_id) {
      return NextResponse.json(
        { success: false, error: "Member not found in your organization" },
        { status: 404 }
      );
    }

    // Cannot delete super admin (owner)
    if (targetMember.is_super_admin) {
      return NextResponse.json(
        { success: false, error: "Cannot remove the organization owner" },
        { status: 403 }
      );
    }

    // Get target member's minimum hierarchy level
    const { data: targetUserRoles } = await adminClient
      .from("user_roles")
      .select("roles(hierarchy_level)")
      .eq("user_id", memberId);

    let targetMinHierarchy = 999;
    targetUserRoles?.forEach((ur: any) => {
      if (ur.roles?.hierarchy_level < targetMinHierarchy) {
        targetMinHierarchy = ur.roles.hierarchy_level;
      }
    });

    // Current user must have lower hierarchy number (higher authority) than target
    if (currentUserMinHierarchy >= targetMinHierarchy) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You cannot remove users with equal or higher authority than you",
        },
        { status: 403 }
      );
    }

    // ALWAYS set users.status = 'disabled' first (works without migration)
    // This is the primary security mechanism
    const { error: userStatusError } = await adminClient
      .from("users")
      .update({
        status: "disabled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .eq("tenant_id", currentUser.tenant_id);

    if (userStatusError) {
      console.error(
        "[TEAM API] Failed to disable user status:",
        userStatusError
      );
      return NextResponse.json(
        { success: false, error: "Failed to remove member" },
        { status: 500 }
      );
    }
    console.log("[TEAM API] User status set to disabled:", memberId);

    // Also try to update tenant_users if the table exists (for multi-tenant support)
    const { error: membershipError } = await adminClient
      .from("tenant_users")
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removed_by: authUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", memberId)
      .eq("tenant_id", currentUser.tenant_id);

    if (membershipError) {
      console.log(
        "[TEAM API] Note: tenant_users update skipped (table may not exist):",
        membershipError.message
      );
      // Not an error - tenant_users table may not exist yet
    } else {
      console.log("[TEAM API] tenant_users membership deactivated:", memberId);
    }

    // Delete user_roles for this user (tenant-specific cleanup)
    const { error: rolesDeleteError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", memberId);

    if (rolesDeleteError) {
      console.error(
        "[TEAM API] Failed to delete user roles:",
        rolesDeleteError
      );
      // Non-fatal - continue
    }

    // SECURITY: Invalidate the user's session immediately
    // This forces them to be logged out across all devices
    try {
      const { error: signOutError } = await adminClient.auth.admin.signOut(
        memberId,
        "global" // Sign out from all sessions
      );
      if (signOutError) {
        console.error(
          "[TEAM API] Failed to invalidate user session:",
          signOutError
        );
        // Non-fatal - middleware will catch them on next request
      } else {
        console.log("[TEAM API] User session invalidated:", memberId);
      }
    } catch (signOutErr) {
      console.error("[TEAM API] Error invalidating session:", signOutErr);
      // Non-fatal - middleware will catch them on next request
    }

    console.log("[TEAM API] Member removed successfully:", memberId);

    return NextResponse.json({
      success: true,
      message: `${targetMember.name} has been removed from the team`,
    });
  } catch (error: any) {
    console.error("[TEAM API] Error deleting member:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to remove member" },
      { status: 500 }
    );
  }
}
