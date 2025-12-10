/**
 * Member Roles API Route
 * PUT /api/team/members/:id/roles
 * Update roles for a specific team member
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
  console.log("[MEMBER ROLES API] PUT - Updating roles for member:", memberId);

  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user: authUser } = guard;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Get current user's details (use admin client to bypass RLS)
    const { data: currentUser, error: currentUserError } = await adminSupabase
      .from("users")
      .select("id, tenant_id, is_super_admin")
      .eq("id", authUser.id)
      .single();

    if (currentUserError || !currentUser) {
      console.error(
        "[MEMBER ROLES API] Failed to get current user:",
        currentUserError
      );
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Get current user's hierarchy level
    let currentUserHierarchy = 999;
    if (currentUser.is_super_admin) {
      currentUserHierarchy = 0;
    } else {
      const { data: userRoles } = await adminSupabase
        .from("user_roles")
        .select("roles(hierarchy_level)")
        .eq("user_id", authUser.id);

      if (userRoles && userRoles.length > 0) {
        currentUserHierarchy = Math.min(
          ...userRoles.map((ur: any) => ur.roles?.hierarchy_level ?? 999)
        );
      }
    }

    // Check permission - only admin or higher can manage roles
    if (currentUserHierarchy > 1) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to manage roles" },
        { status: 403 }
      );
    }

    // Get target member details (use admin client to bypass RLS)
    const { data: targetMember, error: targetError } = await adminSupabase
      .from("users")
      .select("id, tenant_id, is_super_admin, name")
      .eq("id", memberId)
      .single();

    if (targetError || !targetMember) {
      console.error("[MEMBER ROLES API] Target member not found:", targetError);
      return NextResponse.json(
        { success: false, error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot modify owner's roles
    if (targetMember.is_super_admin) {
      return NextResponse.json(
        { success: false, error: "Cannot modify owner's roles" },
        { status: 403 }
      );
    }

    // Ensure same tenant
    if (targetMember.tenant_id !== currentUser.tenant_id) {
      return NextResponse.json(
        { success: false, error: "Member not found in your organization" },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { roleIds } = body;

    if (!Array.isArray(roleIds)) {
      return NextResponse.json(
        { success: false, error: "roleIds must be an array" },
        { status: 400 }
      );
    }

    // Validate roles exist and user has permission to assign them
    if (roleIds.length > 0) {
      const { data: validRoles, error: rolesError } = await adminSupabase
        .from("roles")
        .select("id, hierarchy_level, slug")
        .in("id", roleIds);

      if (rolesError) {
        console.error(
          "[MEMBER ROLES API] Failed to validate roles:",
          rolesError
        );
        return NextResponse.json(
          { success: false, error: "Failed to validate roles" },
          { status: 500 }
        );
      }

      // Check if any role is owner (can't assign owner role)
      const hasOwnerRole = validRoles?.some((r) => r.slug === "owner");
      if (hasOwnerRole) {
        return NextResponse.json(
          { success: false, error: "Cannot assign owner role" },
          { status: 403 }
        );
      }

      // Check if user can assign these roles (based on hierarchy)
      // Admins can only assign roles at their level or below
      const invalidRoles = validRoles?.filter(
        (r) => r.hierarchy_level < currentUserHierarchy
      );
      if (invalidRoles && invalidRoles.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "You cannot assign roles higher than your own",
          },
          { status: 403 }
        );
      }
    }

    // Delete existing role assignments for this user (use admin client)
    const { error: deleteError } = await adminSupabase
      .from("user_roles")
      .delete()
      .eq("user_id", memberId);

    if (deleteError) {
      console.error(
        "[MEMBER ROLES API] Failed to remove old roles:",
        deleteError
      );
      return NextResponse.json(
        { success: false, error: "Failed to update roles" },
        { status: 500 }
      );
    }

    // Insert new role assignments (use admin client)
    if (roleIds.length > 0) {
      const roleAssignments = roleIds.map((roleId: string) => ({
        user_id: memberId,
        role_id: roleId,
        assigned_by_user_id: authUser.id,
      }));

      const { error: insertError } = await adminSupabase
        .from("user_roles")
        .insert(roleAssignments);

      if (insertError) {
        console.error(
          "[MEMBER ROLES API] Failed to insert roles:",
          insertError
        );
        return NextResponse.json(
          { success: false, error: "Failed to update roles" },
          { status: 500 }
        );
      }
    }

    console.log(
      "[MEMBER ROLES API] Successfully updated roles for",
      targetMember.name,
      "- New roles:",
      roleIds.length
    );

    return NextResponse.json({
      success: true,
      message: "Roles updated successfully",
      data: { roleIds },
    });
  } catch (error: any) {
    console.error("[MEMBER ROLES API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update roles" },
      { status: 500 }
    );
  }
}
