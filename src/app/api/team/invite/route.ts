/**
 * Team Invite API Route
 * POST /api/team/invite - Create a new team member with password (direct creation)
 * GET /api/team/invite - Get all invitations for the current tenant
 * PATCH /api/team/invite - Resend an invitation
 * DELETE /api/team/invite - Cancel an invitation
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  console.log("[INVITE API] POST /api/team/invite");

  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user: authUser } = guard;
    const supabase = await createClient();

    // Get current user's details
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("id, tenant_id, is_super_admin")
      .eq("id", authUser.id)
      .single();

    if (userError || !currentUser?.tenant_id) {
      return NextResponse.json(
        { success: false, error: "User not found or no tenant" },
        { status: 400 }
      );
    }

    // Check permissions - must be super admin or have hierarchy_level <= 1
    if (!currentUser.is_super_admin) {
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role:roles(slug, hierarchy_level)")
        .eq("user_id", authUser.id);

      const hasPermission = userRoles?.some(
        (ur: any) => ur.role?.hierarchy_level <= 1
      );

      if (!hasPermission) {
        return NextResponse.json(
          {
            success: false,
            error: "You don't have permission to invite team members",
          },
          { status: 403 }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const { email, firstName, lastName, roleIds, designation, password } = body;

    console.log("[INVITE API] Request data:", {
      email,
      firstName,
      lastName,
      roleIds,
      designation,
      hasPassword: !!password,
    });

    // Validate required fields
    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        {
          success: false,
          error: "Email, first name, and last name are required",
        },
        { status: 400 }
      );
    }

    if (!roleIds || roleIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one role is required" },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "Password is required (minimum 8 characters)",
        },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check for existing invitation or user
    const { data: existingInvite } = await adminClient
      .from("user_invitations")
      .select("id, status")
      .eq("email", email.toLowerCase())
      .eq("tenant_id", currentUser.tenant_id)
      .in("status", ["pending", "accepted"])
      .maybeSingle();

    if (existingInvite) {
      if (existingInvite.status === "accepted") {
        return NextResponse.json(
          { success: false, error: "This user is already a team member" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "An invitation is already pending for this email",
        },
        { status: 400 }
      );
    }

    // Check if user already exists in users table for this tenant
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .eq("tenant_id", currentUser.tenant_id)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "This email is already registered in your organization",
        },
        { status: 400 }
      );
    }

    // Create invitation record first
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: inviteError } = await adminClient
      .from("user_invitations")
      .insert({
        email: email.toLowerCase(),
        tenant_id: currentUser.tenant_id,
        role_id: roleIds[0],
        token,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        invited_by_user_id: authUser.id,
        metadata: {
          first_name: firstName,
          last_name: lastName,
          designation: designation || null,
          role_ids: roleIds,
        },
      })
      .select()
      .single();

    if (inviteError) {
      console.error("[INVITE API] Failed to create invitation:", inviteError);
      return NextResponse.json(
        { success: false, error: "Failed to create invitation record" },
        { status: 500 }
      );
    }

    console.log("[INVITE API] Created invitation:", invitation.id);

    // Check if user exists in Supabase Auth
    const { data: authUsers } = await adminClient.auth.admin.listUsers();
    let existingAuthUser = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingAuthUser) {
      // User exists in auth - update their password
      console.log(
        "[INVITE API] Updating existing auth user:",
        existingAuthUser.id
      );

      const { data: updatedUser, error: updateError } =
        await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
          password: password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`.trim(),
            designation: designation || null,
            tenant_id: currentUser.tenant_id,
            invitation_id: invitation.id,
            role_ids: roleIds,
          },
        });

      if (updateError) {
        console.error("[INVITE API] Failed to update auth user:", updateError);
        // Rollback invitation
        await adminClient
          .from("user_invitations")
          .delete()
          .eq("id", invitation.id);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to update user: ${updateError.message}`,
          },
          { status: 500 }
        );
      }

      userId = existingAuthUser.id;
    } else {
      // Create new auth user with password
      console.log("[INVITE API] Creating new auth user with password");

      const { data: newAuthUser, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email: email.toLowerCase(),
          password: password,
          email_confirm: true, // Skip email verification
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`.trim(),
            designation: designation || null,
            tenant_id: currentUser.tenant_id,
            invitation_id: invitation.id,
            role_ids: roleIds,
          },
        });

      if (createAuthError || !newAuthUser?.user) {
        console.error(
          "[INVITE API] Failed to create auth user:",
          createAuthError
        );
        // Rollback invitation
        await adminClient
          .from("user_invitations")
          .delete()
          .eq("id", invitation.id);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to create user: ${
              createAuthError?.message || "Unknown error"
            }`,
          },
          { status: 500 }
        );
      }

      userId = newAuthUser.user.id;
      console.log("[INVITE API] Created auth user:", userId);
    }

    // Create or update user record in users table
    const { data: userRecord, error: userRecordError } = await adminClient
      .from("users")
      .upsert(
        {
          id: userId,
          email: email.toLowerCase(),
          name: `${firstName} ${lastName}`.trim(),
          tenant_id: currentUser.tenant_id,
          status: "active",
          is_super_admin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (userRecordError) {
      console.error(
        "[INVITE API] Failed to create user record:",
        userRecordError
      );
      // This is critical - if user record fails, the user won't be able to login
      // Try a direct insert as fallback
      const { error: insertError } = await adminClient.from("users").insert({
        id: userId,
        email: email.toLowerCase(),
        name: `${firstName} ${lastName}`.trim(),
        tenant_id: currentUser.tenant_id,
        status: "active",
        is_super_admin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error(
          "[INVITE API] Failed to insert user record:",
          insertError
        );
        // Rollback: delete auth user and invitation
        await adminClient.auth.admin.deleteUser(userId);
        await adminClient
          .from("user_invitations")
          .delete()
          .eq("id", invitation.id);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to create user profile: ${insertError.message}`,
          },
          { status: 500 }
        );
      }
    }

    console.log(
      "[INVITE API] User record created/updated:",
      userRecord || "via fallback insert"
    );

    // Create tenant_users record
    const { data: tenantUserRecord, error: tenantUserError } = await adminClient
      .from("tenant_users")
      .upsert(
        {
          tenant_id: currentUser.tenant_id,
          user_id: userId,
          is_active: true,
          joined_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tenant_id" }
      )
      .select()
      .single();

    if (tenantUserError) {
      console.error(
        "[INVITE API] Failed to create tenant_users record:",
        tenantUserError
      );
      // Try direct insert as fallback
      const { error: insertTenantError } = await adminClient
        .from("tenant_users")
        .insert({
          tenant_id: currentUser.tenant_id,
          user_id: userId,
          is_active: true,
          joined_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertTenantError) {
        console.error(
          "[INVITE API] Failed to insert tenant_users record:",
          insertTenantError
        );
      }
    }

    console.log(
      "[INVITE API] tenant_users record created:",
      tenantUserRecord || "via fallback"
    );

    // Create user_roles records
    for (const roleId of roleIds) {
      const { error: roleError } = await adminClient.from("user_roles").upsert(
        {
          user_id: userId,
          role_id: roleId,
          assigned_at: new Date().toISOString(),
          assigned_by_user_id: authUser.id,
        },
        { onConflict: "user_id,role_id" }
      );

      if (roleError) {
        console.error("[INVITE API] Failed to assign role:", roleId, roleError);
        // Try direct insert
        await adminClient.from("user_roles").insert({
          user_id: userId,
          role_id: roleId,
          assigned_at: new Date().toISOString(),
          assigned_by_user_id: authUser.id,
        });
      } else {
        console.log("[INVITE API] Role assigned:", roleId);
      }
    }

    // Update invitation to accepted
    await adminClient
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    console.log("[INVITE API] User created successfully:", userId);

    // Return success with credentials
    const loginUrl = `${
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    }/auth/signin`;

    // Create share message for easy sharing
    const shareMessage = `Welcome to the team!\n\nYour login credentials:\nEmail: ${email.toLowerCase()}\nPassword: ${password}\n\nLogin here: ${loginUrl}\n\nPlease change your password after first login.`;

    return NextResponse.json({
      success: true,
      message: "Team member created successfully",
      data: {
        id: invitation.id,
        userId,
        email: email.toLowerCase(),
        name: `${firstName} ${lastName}`.trim(),
        isExistingUser: !!existingAuthUser,
        credentials: {
          email: email.toLowerCase(),
          password: password,
          loginUrl,
        },
        shareMessage,
      },
    });
  } catch (error: any) {
    console.error("[INVITE API] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user: authUser } = guard;
    const supabase = await createClient();

    const { data: currentUser } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", authUser.id)
      .single();

    if (!currentUser?.tenant_id) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const { data: invitations, error } = await supabase
      .from("user_invitations")
      .select(
        "*, role:roles(id, name, slug), invited_by:users!invited_by_user_id(id, name, email)"
      )
      .eq("tenant_id", currentUser.tenant_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to get invitations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: invitations });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user: authUser } = guard;
    const supabase = await createClient();

    const { data: currentUser } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("id", authUser.id)
      .single();

    if (!currentUser?.tenant_id) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const { invitationId } = await request.json();
    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: "Invitation ID required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: invitation, error: inviteError } = await adminClient
      .from("user_invitations")
      .select("*, metadata")
      .eq("id", invitationId)
      .eq("tenant_id", currentUser.tenant_id)
      .in("status", ["pending", "expired"])
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { success: false, error: "Invitation not found or already accepted" },
        { status: 404 }
      );
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await adminClient
      .from("user_invitations")
      .update({
        token: newToken,
        status: "pending",
        expires_at: newExpiresAt.toISOString(),
      })
      .eq("id", invitationId);

    const metadata = invitation.metadata || {};
    const firstName = metadata.first_name || "Team Member";
    const lastName = metadata.last_name || "";
    const roleIds = metadata.role_ids || [invitation.role_id];

    const { data: authUsers } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
    );

    const redirectUrl =
      process.env.NEXT_PUBLIC_APP_URL +
      "/auth/callback?type=invite&next=/auth/setup-password";

    if (existingAuthUser) {
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: invitation.email,
        options: {
          redirectTo: redirectUrl,
        },
      });
    } else {
      await adminClient.auth.admin.inviteUserByEmail(invitation.email, {
        redirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: (firstName + " " + lastName).trim(),
          designation: metadata.designation || null,
          tenant_id: currentUser.tenant_id,
          invitation_id: invitation.id,
          role_ids: roleIds,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Invitation resent successfully",
      data: { email: invitation.email, expires_at: newExpiresAt.toISOString() },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user: authUser } = guard;
    const supabase = await createClient();

    const { data: currentUser } = await supabase
      .from("users")
      .select("id, tenant_id, is_super_admin")
      .eq("id", authUser.id)
      .single();

    if (!currentUser?.tenant_id) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (!currentUser.is_super_admin) {
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role:roles(hierarchy_level)")
        .eq("user_id", authUser.id);

      const hasPermission = userRoles?.some(
        (ur: any) => ur.role?.hierarchy_level <= 1
      );
      if (!hasPermission) {
        return NextResponse.json(
          {
            success: false,
            error: "You don't have permission to cancel invitations",
          },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get("id");

    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: "Invitation ID required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: invitation, error: getError } = await adminClient
      .from("user_invitations")
      .select("id, email, status")
      .eq("id", invitationId)
      .eq("tenant_id", currentUser.tenant_id)
      .single();

    if (getError || !invitation) {
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status === "accepted") {
      return NextResponse.json(
        { success: false, error: "Cannot cancel an accepted invitation" },
        { status: 400 }
      );
    }

    await adminClient
      .from("user_invitations")
      .update({ status: "cancelled" })
      .eq("id", invitationId);

    const { data: authUsers } = await adminClient.auth.admin.listUsers();
    const authUser2 = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
    );

    if (authUser2 && !authUser2.email_confirmed_at) {
      await adminClient.from("user_roles").delete().eq("user_id", authUser2.id);
      await adminClient.from("users").delete().eq("id", authUser2.id);
      await adminClient.auth.admin.deleteUser(authUser2.id);
    }

    return NextResponse.json({
      success: true,
      message: "Invitation cancelled",
      data: { id: invitationId, email: invitation.email },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
