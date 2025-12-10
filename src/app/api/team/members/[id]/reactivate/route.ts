import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { user: authUser } = guard;

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();

    // Get current user details
    const { data: currentUser, error: currentUserError } = await adminClient
      .from("users")
      .select("id, tenant_id, is_super_admin")
      .eq("auth_id", authUser.id)
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
      .eq("user_id", currentUser.id);

    let currentUserMinHierarchy = currentUser.is_super_admin ? 0 : 999;
    currentUserRoles?.forEach((ur: any) => {
      if (ur.roles?.hierarchy_level < currentUserMinHierarchy) {
        currentUserMinHierarchy = ur.roles.hierarchy_level;
      }
    });

    // Get target member details
    const { data: targetMember, error: targetError } = await adminClient
      .from("users")
      .select("id, tenant_id, email, name, status")
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

    // Member must be disabled to reactivate
    if (targetMember.status !== "disabled") {
      return NextResponse.json(
        { success: false, error: "Member is not deactivated" },
        { status: 400 }
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
            "You cannot reactivate users with equal or higher authority than you",
        },
        { status: 403 }
      );
    }

    // Reactivate - set status to 'active'
    const { error: updateError } = await adminClient
      .from("users")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    if (updateError) {
      console.error("[TEAM API] Failed to reactivate member:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to reactivate member" },
        { status: 500 }
      );
    }

    console.log("[TEAM API] Member reactivated successfully:", memberId);

    return NextResponse.json({
      success: true,
      message: `${targetMember.name} has been reactivated`,
    });
  } catch (error: any) {
    console.error("[TEAM API] Error reactivating member:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reactivate member" },
      { status: 500 }
    );
  }
}
