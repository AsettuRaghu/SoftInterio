/**
 * Team Invite API Route
 * POST /api/team/invite - Send invitation to a new team member
 * GET /api/team/invite - Get all invitations for the current tenant
 * PATCH /api/team/invite - Resend an invitation
 * DELETE /api/team/invite - Cancel an invitation
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  console.log("[INVITE API] POST /api/team/invite");

  try {
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

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

    const body = await request.json();
    const roleIds = body.roleIds || (body.roleId ? [body.roleId] : []);

    if (
      !body.email ||
      !body.firstName ||
      !body.lastName ||
      roleIds.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const email = body.email.toLowerCase();

    const { data: existingUser } = await adminClient
      .from("users")
      .select("id, email, status")
      .eq("tenant_id", currentUser.tenant_id)
      .ilike("email", email)
      .single();

    if (existingUser) {
      const msg =
        existingUser.status === "invited"
          ? "This user has already been invited and is pending"
          : "A user with this email already exists in your organization";
      return NextResponse.json({ success: false, error: msg }, { status: 409 });
    }

    const { data: existingInvite } = await adminClient
      .from("user_invitations")
      .select("id")
      .eq("tenant_id", currentUser.tenant_id)
      .ilike("email", email)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return NextResponse.json(
        {
          success: false,
          error: "An invitation has already been sent to this email",
        },
        { status: 409 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: inviteError } = await adminClient
      .from("user_invitations")
      .insert({
        tenant_id: currentUser.tenant_id,
        email: email,
        invited_by_user_id: authUser.id,
        role_id: roleIds[0],
        token: token,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        metadata: {
          first_name: body.firstName,
          last_name: body.lastName,
          designation: body.designation || null,
          role_ids: roleIds,
        },
      })
      .select()
      .single();

    if (inviteError) {
      console.error("[INVITE API] Failed to create invitation:", inviteError);
      return NextResponse.json(
        { success: false, error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    const { data: rolesData } = await adminClient
      .from("roles")
      .select("id, name")
      .in("id", roleIds);
    const roleNames = rolesData?.map((r) => r.name) || [];

    const { data: authUsers } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existingAuthUser && !existingAuthUser.email_confirmed_at) {
      console.log("[INVITE API] Deleting unconfirmed auth user to re-invite");
      await adminClient.auth.admin.deleteUser(existingAuthUser.id);
      await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", existingAuthUser.id);
      await adminClient.from("users").delete().eq("id", existingAuthUser.id);
    }

    if (existingAuthUser?.email_confirmed_at) {
      console.log("[INVITE API] User has existing account, sending magic link");

      const acceptUrl =
        process.env.NEXT_PUBLIC_APP_URL +
        "/auth/accept-invite?token=" +
        token +
        "&email=" +
        encodeURIComponent(email);

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: acceptUrl,
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        console.error("[INVITE API] Magic link error:", otpError);
        return NextResponse.json(
          { success: false, error: "Failed to send invitation email" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "Invitation sent! They'll receive an email to join your organization.",
        data: {
          invitation: { id: invitation.id, email, roles: roleNames },
          isExistingUser: true,
        },
      });
    }

    const redirectUrl =
      process.env.NEXT_PUBLIC_APP_URL +
      "/auth/callback?type=invite&next=/auth/setup-password";

    const { data: authInvite, error: authError2 } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectUrl,
        data: {
          first_name: body.firstName,
          last_name: body.lastName,
          full_name: body.firstName + " " + body.lastName,
          designation: body.designation || null,
          tenant_id: currentUser.tenant_id,
          invitation_id: invitation.id,
          role_ids: roleIds,
        },
      });

    if (authError2) {
      console.error("[INVITE API] Auth invite error:", authError2);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send invitation email: " + authError2.message,
        },
        { status: 500 }
      );
    }

    if (authInvite?.user?.id) {
      const userId = authInvite.user.id;

      await adminClient.from("users").insert({
        id: userId,
        email: email,
        name: (body.firstName + " " + body.lastName).trim(),
        tenant_id: currentUser.tenant_id,
        status: "invited",
      });

      // Insert tenant_users record (ignore errors if it already exists)
      try {
        await adminClient.from("tenant_users").insert({
          user_id: userId,
          tenant_id: currentUser.tenant_id,
          role_id: roleIds[0],
          is_active: true,
          is_primary_tenant: true,
          invited_by: authUser.id,
        });
      } catch {
        // Ignore - might already exist
      }

      const roleInserts = roleIds.map((roleId: string) => ({
        user_id: userId,
        role_id: roleId,
      }));
      await adminClient.from("user_roles").insert(roleInserts);
    }

    console.log("[INVITE API] Invitation sent successfully to:", email);

    return NextResponse.json({
      success: true,
      message:
        "Invitation sent! They'll receive an email to set up their password.",
      data: {
        invitation: { id: invitation.id, email, roles: roleNames },
      },
    });
  } catch (error: any) {
    console.error("[INVITE API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send invitation" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

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
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

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
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

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
