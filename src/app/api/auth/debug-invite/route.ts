/**
 * Debug Invite API - For troubleshooting invite issues
 * GET /api/auth/debug-invite?email=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");

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

  // Check invitation status
  const { data: invitation, error: invError } = await adminClient
    .from("user_invitations")
    .select("*")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Check if user exists in auth - use listUsers with filter since getUserByEmail doesn't exist
  let targetAuthUser: any = null;
  let authError: string | null = null;
  try {
    const { data: usersData, error: listError } =
      await adminClient.auth.admin.listUsers();

    if (listError) {
      authError = listError.message;
    } else {
      targetAuthUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
    }
  } catch (e: any) {
    authError = e.message;
  }

  // Check user record
  const { data: userRecord, error: userError } = await adminClient
    .from("users")
    .select("*")
    .ilike("email", email)
    .single();

  // Check tenant_users
  const { data: tenantUser } = await adminClient
    .from("tenant_users")
    .select("*, tenant:tenants(name)")
    .eq("user_id", targetAuthUser?.id || userRecord?.id || "")
    .maybeSingle();

  return NextResponse.json({
    email,
    invitation: invitation
      ? {
          id: invitation.id,
          status: invitation.status,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at,
          accepted_at: invitation.accepted_at,
          tenant_id: invitation.tenant_id,
        }
      : null,
    invitationError: invError?.message,
    authUser: targetAuthUser
      ? {
          id: targetAuthUser.id,
          email: targetAuthUser.email,
          email_confirmed: targetAuthUser.email_confirmed_at ? true : false,
          created_at: targetAuthUser.created_at,
          last_sign_in: targetAuthUser.last_sign_in_at,
          user_metadata: targetAuthUser.user_metadata,
        }
      : null,
    authError: authError,
    userRecord: userRecord
      ? {
          id: userRecord.id,
          email: userRecord.email,
          name: userRecord.name,
          status: userRecord.status,
          tenant_id: userRecord.tenant_id,
        }
      : null,
    userError: userError?.message,
    tenantUser: tenantUser
      ? {
          is_active: tenantUser.is_active,
          tenant_name: (tenantUser.tenant as any)?.name,
          role_id: tenantUser.role_id,
        }
      : null,
    analysis: analyzeStatus(invitation, targetAuthUser, userRecord),
  });
}

function analyzeStatus(
  invitation: any,
  authUser: any,
  userRecord: any
): string[] {
  const issues: string[] = [];

  if (!invitation) {
    issues.push("❌ No invitation found for this email");
  } else {
    if (invitation.status === "pending") {
      issues.push("⏳ Invitation is still pending (not yet clicked)");
    } else if (invitation.status === "accepted") {
      issues.push("✅ Invitation has been accepted");
    } else if (invitation.status === "cancelled") {
      issues.push("❌ Invitation was cancelled");
    }

    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      issues.push("❌ Invitation has EXPIRED - need to resend");
    }
  }

  if (!authUser) {
    issues.push("❌ No auth user found - user never clicked invite link");
  } else {
    if (!authUser.email_confirmed_at) {
      issues.push("⚠️ Email not confirmed in auth system");
    }
    if (!authUser.user_metadata?.password_set) {
      issues.push(
        "⚠️ Password not set yet (user_metadata.password_set is false)"
      );
    } else {
      issues.push("✅ Password has been set");
    }
  }

  if (!userRecord) {
    issues.push("❌ No user record in users table");
  } else {
    if (userRecord.status === "invited") {
      issues.push(
        "⚠️ User status is 'invited' (should be 'active' after password set)"
      );
    } else if (userRecord.status === "active") {
      issues.push("✅ User status is 'active'");
    }
  }

  if (issues.length === 0) {
    issues.push("✅ Everything looks good!");
  }

  return issues;
}

// POST to resend invite or generate magic link
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, action } = body;

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Check if auth user exists
  const { data: usersData } = await adminClient.auth.admin.listUsers();
  const authUser = usersData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  // Action: fix user records (ensure all tables have the user)
  if (action === "fix-user") {
    if (!authUser) {
      return NextResponse.json(
        { error: "No auth user found. Use create-with-password first." },
        { status: 400 }
      );
    }

    // Get invitation data
    const { data: invitation } = await adminClient
      .from("user_invitations")
      .select("*")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const firstName =
      invitation?.metadata?.first_name ||
      authUser.user_metadata?.first_name ||
      "";
    const lastName =
      invitation?.metadata?.last_name ||
      authUser.user_metadata?.last_name ||
      "";
    const tenantId = invitation?.tenant_id || authUser.user_metadata?.tenant_id;
    const roleId = invitation?.role_id;
    const roleIds = invitation?.metadata?.role_ids || [roleId].filter(Boolean);

    const fixLog: string[] = [];

    // 1. Ensure user record exists
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("id", authUser.id)
      .single();

    if (!existingUser) {
      const { error: userError } = await adminClient.from("users").insert({
        id: authUser.id,
        email: email.toLowerCase(),
        name: `${firstName} ${lastName}`.trim() || email.split("@")[0],
        tenant_id: tenantId,
        status: "active",
      });
      fixLog.push(
        userError
          ? `users insert error: ${userError.message}`
          : "Created users record"
      );
    } else {
      // Update status to active
      await adminClient
        .from("users")
        .update({ status: "active" })
        .eq("id", authUser.id);
      fixLog.push("users record exists - updated status to active");
    }

    // 2. Ensure tenant_users record exists
    if (tenantId) {
      const { data: existingTenantUser } = await adminClient
        .from("tenant_users")
        .select("user_id")
        .eq("user_id", authUser.id)
        .eq("tenant_id", tenantId)
        .single();

      if (!existingTenantUser) {
        // tenant_users table schema: id, tenant_id, user_id, is_active, joined_at, invited_by, removed_at, removed_by, created_at, updated_at
        const { error: tuError } = await adminClient
          .from("tenant_users")
          .insert({
            user_id: authUser.id,
            tenant_id: tenantId,
            is_active: true,
            joined_at: new Date().toISOString(),
          });
        fixLog.push(
          tuError
            ? `tenant_users insert error: ${tuError.message}`
            : "Created tenant_users record"
        );
      } else {
        await adminClient
          .from("tenant_users")
          .update({ is_active: true })
          .eq("user_id", authUser.id)
          .eq("tenant_id", tenantId);
        fixLog.push("tenant_users record exists - updated is_active to true");
      }
    } else {
      fixLog.push("No tenant_id found - skipped tenant_users");
    }

    // 3. Ensure user_roles records exist
    if (roleIds.length > 0) {
      for (const rid of roleIds) {
        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("user_id", authUser.id)
          .eq("role_id", rid)
          .single();

        if (!existingRole) {
          const { error: roleError } = await adminClient
            .from("user_roles")
            .insert({
              user_id: authUser.id,
              role_id: rid,
            });
          fixLog.push(
            roleError
              ? `user_roles insert error: ${roleError.message}`
              : `Created user_roles for ${rid}`
          );
        } else {
          fixLog.push(`user_roles for ${rid} exists`);
        }
      }
    }

    // 4. Update invitation status
    if (invitation && invitation.status !== "accepted") {
      await adminClient
        .from("user_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);
      fixLog.push("Updated invitation to accepted");
    }

    return NextResponse.json({
      success: true,
      message: "User records fixed!",
      fixLog,
      userId: authUser.id,
      tenantId,
      note: "User should now be able to log in at /auth/signin",
    });
  }

  // Action: create user with temporary password (most reliable method)
  if (action === "create-with-password") {
    const tempPassword = body.password || "TempPass123!";

    // Get invitation data
    const { data: invitation } = await adminClient
      .from("user_invitations")
      .select("*")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Create user with password if doesn't exist
    if (!authUser) {
      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email: email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            first_name: invitation?.metadata?.first_name || "",
            last_name: invitation?.metadata?.last_name || "",
            full_name: `${invitation?.metadata?.first_name || ""} ${
              invitation?.metadata?.last_name || ""
            }`.trim(),
            tenant_id: invitation?.tenant_id,
            invitation_id: invitation?.id,
            role_ids: invitation?.metadata?.role_ids || [invitation?.role_id],
          },
        });

      if (createError) {
        return NextResponse.json(
          { error: `Create user error: ${createError.message}` },
          { status: 500 }
        );
      }

      // Create user record in users table
      if (newUser?.user) {
        await adminClient.from("users").upsert({
          id: newUser.user.id,
          email: email.toLowerCase(),
          name:
            `${invitation?.metadata?.first_name || ""} ${
              invitation?.metadata?.last_name || ""
            }`.trim() || email.split("@")[0],
          tenant_id: invitation?.tenant_id,
          status: "active",
        });

        // Create tenant_users record
        if (invitation?.tenant_id) {
          await adminClient.from("tenant_users").upsert({
            user_id: newUser.user.id,
            tenant_id: invitation.tenant_id,
            role_id: invitation.role_id,
            is_active: true,
            is_primary_tenant: true,
          });
        }

        // Create user_roles
        const roleIds = invitation?.metadata?.role_ids || [invitation?.role_id];
        if (roleIds && roleIds.length > 0) {
          const roleInserts = roleIds.filter(Boolean).map((roleId: string) => ({
            user_id: newUser.user.id,
            role_id: roleId,
          }));
          if (roleInserts.length > 0) {
            await adminClient.from("user_roles").upsert(roleInserts);
          }
        }

        // Update invitation status
        if (invitation) {
          await adminClient
            .from("user_invitations")
            .update({
              status: "accepted",
              accepted_at: new Date().toISOString(),
            })
            .eq("id", invitation.id);
        }
      }

      return NextResponse.json({
        success: true,
        message: "User created successfully!",
        credentials: {
          email: email,
          temporaryPassword: tempPassword,
        },
        note: "Share these credentials with the user. They can log in at /auth/signin and should change their password after logging in.",
        userId: newUser?.user?.id,
      });
    } else {
      // User exists, update password
      const { error: updateError } =
        await adminClient.auth.admin.updateUserById(authUser.id, {
          password: tempPassword,
          email_confirm: true,
        });

      if (updateError) {
        return NextResponse.json(
          { error: `Update password error: ${updateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Password reset for existing user!",
        credentials: {
          email: email,
          temporaryPassword: tempPassword,
        },
        note: "Share these credentials with the user. They can log in at /auth/signin",
        userId: authUser.id,
      });
    }
  }

  // Action: generate a magic link for existing user
  if (action === "generate-link") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // If no auth user exists, we need to use invite type instead
    if (!authUser) {
      // Use invite type to create user and get link
      const { data: linkData, error: linkError } =
        await adminClient.auth.admin.generateLink({
          type: "invite",
          email: email,
        });

      if (linkError) {
        return NextResponse.json(
          { error: `Generate link error: ${linkError.message}` },
          { status: 500 }
        );
      }

      // Extract token from the Supabase link and build our own link
      // Supabase link format: https://xxx.supabase.co/auth/v1/verify?token=xxx&type=invite&redirect_to=xxx
      const supabaseLink = linkData?.properties?.action_link || "";
      const tokenMatch = supabaseLink.match(/token=([^&]+)/);
      const token = tokenMatch
        ? tokenMatch[1]
        : linkData?.properties?.hashed_token;

      // Build link that goes through our callback
      const inviteLink = `${appUrl}/auth/callback?token=${token}&type=invite&next=/auth/setup-password`;

      return NextResponse.json({
        success: true,
        message:
          "Invite link generated (no email sent)! Share this link with the user:",
        inviteLink: inviteLink,
        supabaseLink: supabaseLink,
        note: "User will be created when they click this link",
        newUserId: linkData?.user?.id,
      });
    }

    // Auth user exists, generate magic link
    const redirectUrl = `${appUrl}/auth/callback?type=invite&next=/auth/setup-password`;
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: email,
        options: {
          redirectTo: redirectUrl,
        },
      });

    if (linkError) {
      return NextResponse.json(
        { error: `Magic link error: ${linkError.message}` },
        { status: 500 }
      );
    }

    // Extract token and build our own link
    const supabaseLink = linkData?.properties?.action_link || "";
    const tokenMatch = supabaseLink.match(/token=([^&]+)/);
    const token = tokenMatch
      ? tokenMatch[1]
      : linkData?.properties?.hashed_token;
    const magicLink = `${appUrl}/auth/callback?token=${token}&type=magiclink&next=/auth/setup-password`;

    return NextResponse.json({
      success: true,
      message: "Magic link generated! Share this link with the user:",
      magicLink: magicLink,
      supabaseLink: supabaseLink,
      note: "This link will log them in and redirect to password setup",
    });
  }

  // Action: generate invite link (for users who haven't been created yet or to resend)
  if (action === "generate-invite-link") {
    const redirectUrl =
      process.env.NEXT_PUBLIC_APP_URL +
      "/auth/callback?type=invite&next=/auth/setup-password";

    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "invite",
        email: email,
        options: {
          redirectTo: redirectUrl,
        },
      });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    const inviteLink = linkData?.properties?.action_link;

    return NextResponse.json({
      success: true,
      message: "Invite link generated! Share this link with the user:",
      inviteLink: inviteLink,
    });
  }

  // Default action: resend invite email via Supabase
  // Get the invitation
  const { data: invitation } = await adminClient
    .from("user_invitations")
    .select("*")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!invitation) {
    return NextResponse.json(
      { error: "No invitation found for this email" },
      { status: 404 }
    );
  }

  // Generate new token and extend expiry
  const newToken = crypto.randomUUID();
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 7);

  // Update invitation
  await adminClient
    .from("user_invitations")
    .update({
      token: newToken,
      expires_at: newExpiry.toISOString(),
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  // Resend invite via Supabase
  const redirectUrl =
    process.env.NEXT_PUBLIC_APP_URL +
    "/auth/callback?type=invite&next=/auth/setup-password";

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: redirectUrl,
      data: invitation.metadata || {},
    }
  );

  if (inviteError) {
    console.error("[DEBUG-INVITE] Resend error:", inviteError);
    return NextResponse.json(
      { error: "Failed to resend: " + inviteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Invitation resent successfully",
    newExpiry: newExpiry.toISOString(),
  });
}
