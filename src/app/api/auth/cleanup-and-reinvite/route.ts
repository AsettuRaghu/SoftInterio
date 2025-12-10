/**
 * Cleanup and Re-invite API
 * POST /api/auth/cleanup-and-reinvite
 * Completely removes a user and sends a fresh invite
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  console.log("[CLEANUP-REINVITE] Starting cleanup and reinvite process...");

  try {
    const body = await request.json();
    const { email, firstName, lastName } = body;

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Check if request is from an authenticated admin
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const cleanupLog: string[] = [];

    // Get current user's tenant_id
    const { data: currentUserData } = await adminClient
      .from("users")
      .select("tenant_id")
      .eq("id", currentUser.id)
      .single();

    const tenantId = body.tenantId || currentUserData?.tenant_id;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Could not determine tenant" },
        { status: 400 }
      );
    }
    cleanupLog.push(`Using tenant: ${tenantId}`);

    // Get a default role (e.g., "Staff" or "Designer")
    // Roles are system-wide with tenant_id = NULL
    const { data: roles, error: rolesError } = await adminClient
      .from("roles")
      .select("id, name, slug, tenant_id, is_system_role, is_default")
      .order("hierarchy_level", { ascending: false });

    console.log("[CLEANUP-REINVITE] Roles query result:", {
      rolesCount: roles?.length,
      rolesError,
      tenantId,
      firstFewRoles: roles
        ?.slice(0, 3)
        .map((r) => ({ name: r.name, slug: r.slug })),
    });

    let roleIds = body.roleIds;
    if (!roleIds || roleIds.length === 0) {
      // Find a suitable default role - prefer Staff (is_default=true), then Designer
      const defaultRole =
        roles?.find((r) => r.is_default) ||
        roles?.find((r) => r.slug === "staff") ||
        roles?.find((r) => r.slug === "designer") ||
        roles?.find((r) => r.name === "Designer") ||
        roles?.[0];

      if (defaultRole) {
        roleIds = [defaultRole.id];
        cleanupLog.push(
          `Using default role: ${defaultRole.name} (${defaultRole.id})`
        );
      } else {
        return NextResponse.json(
          {
            error: "No roles found for tenant",
            debug: { tenantId, rolesCount: roles?.length || 0, cleanupLog },
          },
          { status: 400 }
        );
      }
    }

    // Step 1: Find the auth user
    console.log("[CLEANUP-REINVITE] Step 1: Looking for auth user...");
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const authUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (authUser) {
      cleanupLog.push(`Found auth user: ${authUser.id}`);

      // Step 2: Delete from user_roles
      console.log("[CLEANUP-REINVITE] Step 2: Deleting user_roles...");
      const { error: rolesError } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", authUser.id);
      if (rolesError) {
        cleanupLog.push(`user_roles delete error: ${rolesError.message}`);
      } else {
        cleanupLog.push("Deleted user_roles");
      }

      // Step 3: Delete from tenant_users
      console.log("[CLEANUP-REINVITE] Step 3: Deleting tenant_users...");
      const { error: tenantError } = await adminClient
        .from("tenant_users")
        .delete()
        .eq("user_id", authUser.id);
      if (tenantError) {
        cleanupLog.push(`tenant_users delete error: ${tenantError.message}`);
      } else {
        cleanupLog.push("Deleted tenant_users");
      }

      // Step 4: Delete from users table
      console.log("[CLEANUP-REINVITE] Step 4: Deleting from users table...");
      const { error: usersError } = await adminClient
        .from("users")
        .delete()
        .eq("id", authUser.id);
      if (usersError) {
        cleanupLog.push(`users delete error: ${usersError.message}`);
      } else {
        cleanupLog.push("Deleted from users table");
      }

      // Step 5: Delete from Supabase Auth
      console.log("[CLEANUP-REINVITE] Step 5: Deleting from Supabase Auth...");
      const { error: authDeleteError } =
        await adminClient.auth.admin.deleteUser(authUser.id);
      if (authDeleteError) {
        cleanupLog.push(`Auth delete error: ${authDeleteError.message}`);
      } else {
        cleanupLog.push("Deleted from Supabase Auth");
      }
    } else {
      cleanupLog.push("No auth user found - skipping auth cleanup");
    }

    // Step 6: Delete all invitations for this email
    console.log("[CLEANUP-REINVITE] Step 6: Deleting invitations...");
    const { error: inviteDeleteError } = await adminClient
      .from("user_invitations")
      .delete()
      .ilike("email", email);
    if (inviteDeleteError) {
      cleanupLog.push(`Invitations delete error: ${inviteDeleteError.message}`);
    } else {
      cleanupLog.push("Deleted all invitations");
    }

    console.log("[CLEANUP-REINVITE] Cleanup complete:", cleanupLog);

    // Now send a fresh invite if we have the required data
    if (!tenantId || !roleIds || roleIds.length === 0) {
      return NextResponse.json({
        success: true,
        message:
          "Cleanup complete. No invite sent (missing tenantId or roleIds)",
        cleanupLog,
      });
    }

    // Step 7: Create new invitation record
    console.log("[CLEANUP-REINVITE] Step 7: Creating new invitation...");
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: invCreateError } = await adminClient
      .from("user_invitations")
      .insert({
        email: email.toLowerCase(),
        tenant_id: tenantId,
        role_id: roleIds[0],
        token,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        invited_by_user_id: currentUser.id,
        metadata: {
          first_name: firstName || "",
          last_name: lastName || "",
          role_ids: roleIds,
        },
      })
      .select()
      .single();

    if (invCreateError) {
      cleanupLog.push(`Invitation create error: ${invCreateError.message}`);
      console.error(
        "[CLEANUP-REINVITE] Invitation create error:",
        invCreateError
      );
      return NextResponse.json({
        success: false,
        error: "Cleanup done but failed to create invitation",
        errorDetails: invCreateError.message,
        errorCode: invCreateError.code,
        cleanupLog,
        debug: { tenantId, roleIds, email: email.toLowerCase() },
      });
    }

    cleanupLog.push(`Created invitation: ${invitation.id}`);

    // Step 8: Send Supabase invite email
    console.log("[CLEANUP-REINVITE] Step 8: Sending Supabase invite email...");
    const redirectUrl =
      process.env.NEXT_PUBLIC_APP_URL +
      "/auth/callback?type=invite&next=/auth/setup-password";

    const { data: authInvite, error: authInviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectUrl,
        data: {
          first_name: firstName || "",
          last_name: lastName || "",
          full_name: `${firstName || ""} ${lastName || ""}`.trim(),
          tenant_id: tenantId,
          invitation_id: invitation.id,
          role_ids: roleIds,
        },
      });

    if (authInviteError) {
      cleanupLog.push(`Auth invite error: ${authInviteError.message}`);
      return NextResponse.json({
        success: false,
        error: `Failed to send invite email: ${authInviteError.message}`,
        cleanupLog,
      });
    }

    cleanupLog.push(
      `Invite email sent! New auth user ID: ${authInvite?.user?.id}`
    );

    // Step 9: Create user record with 'invited' status
    if (authInvite?.user?.id) {
      console.log("[CLEANUP-REINVITE] Step 9: Creating user record...");
      const { error: userCreateError } = await adminClient
        .from("users")
        .insert({
          id: authInvite.user.id,
          email: email.toLowerCase(),
          name:
            `${firstName || ""} ${lastName || ""}`.trim() ||
            email.split("@")[0],
          tenant_id: tenantId,
          status: "invited",
        });

      if (userCreateError) {
        cleanupLog.push(`User create error: ${userCreateError.message}`);
      } else {
        cleanupLog.push("Created user record with status 'invited'");
      }

      // Step 10: Create tenant_users record
      console.log(
        "[CLEANUP-REINVITE] Step 10: Creating tenant_users record..."
      );
      const { error: tenantUserError } = await adminClient
        .from("tenant_users")
        .insert({
          user_id: authInvite.user.id,
          tenant_id: tenantId,
          role_id: roleIds[0],
          is_active: true,
          is_primary_tenant: true,
          invited_by: currentUser.id,
        });

      if (tenantUserError) {
        cleanupLog.push(
          `tenant_users create error: ${tenantUserError.message}`
        );
      } else {
        cleanupLog.push("Created tenant_users record");
      }

      // Step 11: Create user_roles records
      console.log("[CLEANUP-REINVITE] Step 11: Creating user_roles...");
      const roleInserts = roleIds.map((roleId: string) => ({
        user_id: authInvite.user.id,
        role_id: roleId,
      }));
      const { error: rolesCreateError } = await adminClient
        .from("user_roles")
        .insert(roleInserts);

      if (rolesCreateError) {
        cleanupLog.push(`user_roles create error: ${rolesCreateError.message}`);
      } else {
        cleanupLog.push(`Created ${roleIds.length} user_roles records`);
      }
    }

    console.log("[CLEANUP-REINVITE] Process complete!");

    return NextResponse.json({
      success: true,
      message: "User cleaned up and fresh invite sent!",
      cleanupLog,
      newUserId: authInvite?.user?.id,
      invitationId: invitation.id,
    });
  } catch (error: any) {
    console.error("[CLEANUP-REINVITE] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
