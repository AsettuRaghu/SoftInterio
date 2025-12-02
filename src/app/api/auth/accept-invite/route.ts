/**
 * Accept Invite API Route
 * POST /api/auth/accept-invite
 * Adds an existing user to a new tenant after they authenticate
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  console.log("[ACCEPT-INVITE API] POST /api/auth/accept-invite");

  try {
    const body = await request.json();
    const { token, email } = body;

    if (!token || !email) {
      return NextResponse.json(
        { success: false, error: "Missing token or email" },
        { status: 400 }
      );
    }

    // Verify the user is authenticated
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[ACCEPT-INVITE API] Not authenticated:", authError);
      return NextResponse.json(
        { success: false, error: "Not authenticated. Please sign in first." },
        { status: 401 }
      );
    }

    // Verify the email matches
    if (authUser.email?.toLowerCase() !== email.toLowerCase()) {
      console.error("[ACCEPT-INVITE API] Email mismatch:", {
        authEmail: authUser.email,
        requestEmail: email,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Email mismatch. Please use the correct account.",
        },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    // Find and validate the invitation
    const { data: invitation, error: inviteError } = await adminClient
      .from("user_invitations")
      .select(
        `
        id,
        email,
        status,
        expires_at,
        tenant_id,
        role_id,
        metadata,
        tenant:tenants(id, name)
      `
      )
      .eq("token", token)
      .ilike("email", email.toLowerCase())
      .single();

    if (inviteError || !invitation) {
      console.log("[ACCEPT-INVITE API] Invitation not found:", inviteError);
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Check invitation status
    if (invitation.status === "accepted") {
      return NextResponse.json(
        { success: false, error: "This invitation has already been accepted" },
        { status: 400 }
      );
    }

    if (invitation.status === "cancelled") {
      return NextResponse.json(
        { success: false, error: "This invitation has been cancelled" },
        { status: 400 }
      );
    }

    // Check if expired
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "This invitation has expired" },
        { status: 400 }
      );
    }

    const tenantId = invitation.tenant_id;
    const roleIds = invitation.metadata?.role_ids || [invitation.role_id];

    console.log("[ACCEPT-INVITE API] Processing invitation:", {
      userId: authUser.id,
      email: authUser.email,
      tenantId,
      roleIds,
    });

    // Check if user already has a membership to this tenant
    const { data: existingMembership } = await adminClient
      .from("tenant_users")
      .select("id, is_active")
      .eq("user_id", authUser.id)
      .eq("tenant_id", tenantId)
      .single();

    if (existingMembership) {
      if (existingMembership.is_active) {
        // Already an active member
        console.log("[ACCEPT-INVITE API] User already active member");

        // Mark invitation as accepted anyway
        await adminClient
          .from("user_invitations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);

        return NextResponse.json({
          success: true,
          message: "You are already a member of this organization",
          data: { alreadyMember: true },
        });
      } else {
        // Reactivate membership
        console.log("[ACCEPT-INVITE API] Reactivating membership...");

        const { error: reactivateError } = await adminClient
          .from("tenant_users")
          .update({
            is_active: true,
            removed_at: null,
            removed_by: null,
            joined_at: new Date().toISOString(),
          })
          .eq("id", existingMembership.id);

        if (reactivateError) {
          console.error(
            "[ACCEPT-INVITE API] Failed to reactivate:",
            reactivateError
          );
          return NextResponse.json(
            { success: false, error: "Failed to reactivate membership" },
            { status: 500 }
          );
        }
      }
    } else {
      // Create new tenant_users membership
      console.log("[ACCEPT-INVITE API] Creating new membership...");

      const { error: membershipError } = await adminClient
        .from("tenant_users")
        .insert({
          user_id: authUser.id,
          tenant_id: tenantId,
          role_id: roleIds[0],
          is_active: true,
          is_primary_tenant: false, // Not primary since user has existing account
          invited_by: null, // Could track this from invitation if needed
          joined_at: new Date().toISOString(),
        });

      if (membershipError) {
        console.error(
          "[ACCEPT-INVITE API] Failed to create membership:",
          membershipError
        );
        return NextResponse.json(
          { success: false, error: "Failed to create membership" },
          { status: 500 }
        );
      }
    }

    // Assign roles for this tenant
    // First, remove any existing roles for this user in this tenant's context
    // (roles are global per user for now, but we track them)

    // Add new roles
    if (roleIds.length > 0) {
      // Check if user already has these roles
      const { data: existingRoles } = await adminClient
        .from("user_roles")
        .select("role_id")
        .eq("user_id", authUser.id);

      const existingRoleIds = new Set(
        existingRoles?.map((r) => r.role_id) || []
      );

      const newRoles = roleIds.filter((id: string) => !existingRoleIds.has(id));

      if (newRoles.length > 0) {
        const roleInserts = newRoles.map((roleId: string) => ({
          user_id: authUser.id,
          role_id: roleId,
          assigned_at: new Date().toISOString(),
        }));

        const { error: rolesError } = await adminClient
          .from("user_roles")
          .insert(roleInserts);

        if (rolesError) {
          console.log(
            "[ACCEPT-INVITE API] Note: Role assignment issue:",
            rolesError.message
          );
        }
      }
    }

    // Mark invitation as accepted
    const { error: updateInviteError } = await adminClient
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateInviteError) {
      console.error(
        "[ACCEPT-INVITE API] Failed to update invitation:",
        updateInviteError
      );
    }

    console.log("[ACCEPT-INVITE API] Successfully accepted invitation");

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${
        (invitation.tenant as any)?.name || "the organization"
      }`,
      data: {
        tenantId,
        tenantName: (invitation.tenant as any)?.name,
      },
    });
  } catch (error: any) {
    console.error("[ACCEPT-INVITE API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
