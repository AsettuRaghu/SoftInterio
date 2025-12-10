import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: newOwnerId } = await params;

    if (!newOwnerId) {
      return NextResponse.json(
        { success: false, error: "New owner ID is required" },
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
      .select("id, tenant_id, is_super_admin, name")
      .eq("auth_id", authUser.id)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { success: false, error: "Current user not found" },
        { status: 404 }
      );
    }

    // Only the owner (super admin) can transfer ownership
    if (!currentUser.is_super_admin) {
      return NextResponse.json(
        { success: false, error: "Only the owner can transfer ownership" },
        { status: 403 }
      );
    }

    // Cannot transfer to yourself
    if (currentUser.id === newOwnerId) {
      return NextResponse.json(
        { success: false, error: "You are already the owner" },
        { status: 400 }
      );
    }

    // Get new owner details
    const { data: newOwner, error: newOwnerError } = await adminClient
      .from("users")
      .select("id, tenant_id, name, status")
      .eq("id", newOwnerId)
      .single();

    if (newOwnerError || !newOwner) {
      return NextResponse.json(
        { success: false, error: "New owner not found" },
        { status: 404 }
      );
    }

    // Ensure new owner belongs to same tenant
    if (newOwner.tenant_id !== currentUser.tenant_id) {
      return NextResponse.json(
        { success: false, error: "User not found in your organization" },
        { status: 404 }
      );
    }

    // New owner must be active
    if (newOwner.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot transfer ownership to an inactive user",
        },
        { status: 400 }
      );
    }

    // Get Admin role ID for demoting current owner
    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("roles")
      .select("id")
      .eq("slug", "admin")
      .is("tenant_id", null)
      .single();

    if (adminRoleError || !adminRole) {
      console.error("[TRANSFER] Admin role not found:", adminRoleError);
      return NextResponse.json(
        { success: false, error: "System configuration error" },
        { status: 500 }
      );
    }

    // Get Owner role ID
    const { data: ownerRole, error: ownerRoleError } = await adminClient
      .from("roles")
      .select("id")
      .eq("slug", "owner")
      .is("tenant_id", null)
      .single();

    if (ownerRoleError || !ownerRole) {
      console.error("[TRANSFER] Owner role not found:", ownerRoleError);
      return NextResponse.json(
        { success: false, error: "System configuration error" },
        { status: 500 }
      );
    }

    // Start the transfer process
    console.log(
      "[TRANSFER] Starting ownership transfer from",
      currentUser.id,
      "to",
      newOwnerId
    );

    // 1. Remove is_super_admin from current owner
    const { error: demoteError } = await adminClient
      .from("users")
      .update({
        is_super_admin: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentUser.id);

    if (demoteError) {
      console.error("[TRANSFER] Failed to demote current owner:", demoteError);
      return NextResponse.json(
        { success: false, error: "Failed to transfer ownership" },
        { status: 500 }
      );
    }

    // 2. Set is_super_admin on new owner
    const { error: promoteError } = await adminClient
      .from("users")
      .update({
        is_super_admin: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newOwnerId);

    if (promoteError) {
      console.error("[TRANSFER] Failed to promote new owner:", promoteError);
      // Rollback - restore current owner
      await adminClient
        .from("users")
        .update({ is_super_admin: true })
        .eq("id", currentUser.id);
      return NextResponse.json(
        { success: false, error: "Failed to transfer ownership" },
        { status: 500 }
      );
    }

    // 3. Remove Owner role from current owner and assign Admin
    await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("role_id", ownerRole.id);

    // Check if current owner already has Admin role
    const { data: existingAdminRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("role_id", adminRole.id)
      .single();

    if (!existingAdminRole) {
      await adminClient.from("user_roles").insert({
        user_id: currentUser.id,
        role_id: adminRole.id,
      });
    }

    // 4. Remove existing roles from new owner and assign Owner role
    await adminClient.from("user_roles").delete().eq("user_id", newOwnerId);

    await adminClient.from("user_roles").insert({
      user_id: newOwnerId,
      role_id: ownerRole.id,
    });

    console.log("[TRANSFER] Ownership transferred successfully");

    return NextResponse.json({
      success: true,
      message: `Ownership has been transferred to ${newOwner.name}. You are now an Admin.`,
    });
  } catch (error: any) {
    console.error("[TRANSFER] Error transferring ownership:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to transfer ownership",
      },
      { status: 500 }
    );
  }
}
