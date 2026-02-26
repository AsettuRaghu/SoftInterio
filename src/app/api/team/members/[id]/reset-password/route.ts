/**
 * Reset Team Member Password API Route
 * PUT /api/team/members/[id]/reset-password
 * Allow admin/owner to reset a team member's password
 *
 * Security:
 * - Only admin/owner can reset passwords
 * - Cannot reset your own password this way
 * - Cannot reset passwords for users with equal/higher hierarchy
 * - Requires settings.team.manage permission
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { generateSecurePassword } from "@/lib/auth/password-validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[RESET PASSWORD API] PUT /api/team/members/[id]/reset-password - Request received");

  try {
    const { id: memberId } = await params;

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "Member ID is required" },
        { status: 400 }
      );
    }

    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user: currentUser } = guard;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Parse request body for optional password
    let providedPassword: string | undefined;
    let sendEmail = true;
    
    try {
      const body = await request.json();
      providedPassword = body.password;
      sendEmail = body.sendEmail !== false;
    } catch (e) {
      // Empty body is fine, will generate password
    }

    // Get current user's roles for hierarchy check
    const { data: currentUserRoles } = await adminClient
      .from("user_roles")
      .select("roles(hierarchy_level)")
      .eq("user_id", currentUser.id);

    let currentUserMinHierarchy = currentUser.isSuperAdmin ? 0 : 999;
    currentUserRoles?.forEach((ur: any) => {
      if (ur.roles?.hierarchy_level < currentUserMinHierarchy) {
        currentUserMinHierarchy = ur.roles.hierarchy_level;
      }
    });

    // Cannot be below admin level or be exactly equal
    if (currentUserMinHierarchy > 100) {
      // Not admin/owner
      return NextResponse.json(
        { success: false, error: "You don't have permission to reset passwords" },
        { status: 403 }
      );
    }

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

    // Verify member belongs to same tenant
    if (targetMember.tenant_id !== currentUser.tenantId) {
      return NextResponse.json(
        { success: false, error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot reset password for yourself
    if (targetMember.id === currentUser.id) {
      return NextResponse.json(
        { success: false, error: "Cannot reset your own password this way" },
        { status: 400 }
      );
    }

    // Cannot reset password for users with equal/higher hierarchy
    if (targetMember.is_super_admin && !currentUser.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: "Cannot reset password for Owner" },
        { status: 403 }
      );
    }

    const { data: targetRoles } = await adminClient
      .from("user_roles")
      .select("roles(hierarchy_level)")
      .eq("user_id", targetMember.id);

    let targetMinHierarchy = targetMember.is_super_admin ? 0 : 999;
    targetRoles?.forEach((ur: any) => {
      if (ur.roles?.hierarchy_level < targetMinHierarchy) {
        targetMinHierarchy = ur.roles.hierarchy_level;
      }
    });

    // Current user must have higher authority
    if (currentUserMinHierarchy >= targetMinHierarchy && !currentUser.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: "Cannot reset password for user with equal or higher level" },
        { status: 403 }
      );
    }

    // Generate or use provided password
    const newPassword = providedPassword || generateSecurePassword(12);

    console.log(`[RESET PASSWORD API] Resetting password for member: ${memberId}`);

    // Update password in Supabase Auth
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetMember.id,
      {
        password: newPassword,
      }
    );

    if (updateError) {
      console.error("[RESET PASSWORD API] Error updating password:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to reset password" },
        { status: 500 }
      );
    }

    // Invalidate all existing sessions for this user (security best practice)
    // This forces them to log out and log back in with the new password
    try {
      const { error: signOutError } = await adminClient.auth.admin.signOut(
        targetMember.id,
        "global" // Invalidate all sessions across all devices
      );

      if (signOutError) {
        console.warn("[RESET PASSWORD API] Warning: Could not invalidate sessions:", signOutError);
        // Don't fail the request if session invalidation fails - password was already reset
      } else {
        console.log(`[RESET PASSWORD API] Invalidated all sessions for: ${memberId}`);
      }
    } catch (signOutError) {
      console.warn("[RESET PASSWORD API] Warning: Could not invalidate sessions:", signOutError);
      // Don't fail the request if session invalidation fails - password was already reset
    }

    console.log(`[RESET PASSWORD API] Password reset successfully for: ${memberId}`);

    return NextResponse.json({
      success: true,
      message: `Password reset successfully for ${targetMember.name}`,
      data: {
        memberId: targetMember.id,
        memberName: targetMember.name,
        memberEmail: targetMember.email,
        temporaryPassword: newPassword,
        passwordGenerated: !providedPassword,
      },
    });
  } catch (error: any) {
    console.error("[RESET PASSWORD API] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
