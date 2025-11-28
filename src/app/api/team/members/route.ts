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

    // Get all team members - use admin client to bypass RLS
    // Include active, invited, pending_verification, and disabled users
    // (disabled = soft-deleted, shown as "Inactive")
    const { data: members, error: membersError } = await adminClient
      .from("users")
      .select(
        "id, name, email, phone, avatar_url, status, is_super_admin, last_login_at, created_at, tenant_id"
      )
      .eq("tenant_id", currentUser.tenant_id)
      .in("status", ["active", "invited", "pending_verification", "disabled"])
      .order("created_at", { ascending: true });

    if (membersError) {
      console.error("[TEAM API] Failed to get members:", membersError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get team members",
          details: membersError.message,
        },
        { status: 500 }
      );
    }

    console.log("[TEAM API] Found", members?.length, "members");
    console.log(
      "[TEAM API] Members:",
      members?.map((m) => ({
        id: m.id,
        email: m.email,
        status: m.status,
        tenant_id: m.tenant_id,
      }))
    );

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
        const roleIds = [...new Set(userRoles.map((ur) => ur.role_id))];

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

    // Soft delete - set status to 'disabled'
    const { error: updateError } = await adminClient
      .from("users")
      .update({
        status: "disabled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    if (updateError) {
      console.error("[TEAM API] Failed to disable member:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to remove member" },
        { status: 500 }
      );
    }

    console.log("[TEAM API] Member disabled successfully:", memberId);

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
