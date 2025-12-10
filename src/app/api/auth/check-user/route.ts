/**
 * Public Debug API - For checking user status without auth (development only)
 * GET /api/auth/check-user?email=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  const email = request.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Email required as query param" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Check auth user
  const { data: usersData } = await adminClient.auth.admin.listUsers();
  const authUser = usersData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  // Check user record
  const { data: userRecord, error: userError } = await adminClient
    .from("users")
    .select("id, email, name, status, tenant_id, is_super_admin")
    .ilike("email", email)
    .maybeSingle();

  // Check tenant_users
  let tenantUser = null;
  if (authUser?.id || userRecord?.id) {
    const { data } = await adminClient
      .from("tenant_users")
      .select("tenant_id, user_id, is_active, joined_at")
      .eq("user_id", authUser?.id || userRecord?.id)
      .maybeSingle();
    tenantUser = data;
  }

  // Check user_roles
  let userRoles = null;
  if (authUser?.id || userRecord?.id) {
    const { data } = await adminClient
      .from("user_roles")
      .select("role_id, assigned_at, role:roles(name, slug)")
      .eq("user_id", authUser?.id || userRecord?.id);
    userRoles = data;
  }

  // Check invitation
  const { data: invitation } = await adminClient
    .from("user_invitations")
    .select("id, status, email, tenant_id, role_id, created_at, accepted_at")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    email,
    summary: {
      hasAuthUser: !!authUser,
      hasUserRecord: !!userRecord,
      hasTenantUser: !!tenantUser,
      hasRoles: !!(userRoles && userRoles.length > 0),
      canLogin: !!authUser && !!userRecord && userRecord.status === "active",
    },
    authUser: authUser
      ? {
          id: authUser.id,
          email: authUser.email,
          email_confirmed: !!authUser.email_confirmed_at,
          created_at: authUser.created_at,
          user_metadata: authUser.user_metadata,
        }
      : null,
    userRecord: userRecord || null,
    userRecordError: userError?.message || null,
    tenantUser: tenantUser || null,
    userRoles: userRoles || null,
    invitation: invitation || null,
    issues: analyzeIssues(authUser, userRecord, tenantUser, userRoles),
  });
}

function analyzeIssues(
  authUser: any,
  userRecord: any,
  tenantUser: any,
  userRoles: any[] | null
): string[] {
  const issues: string[] = [];

  if (!authUser) {
    issues.push("❌ No auth user - user was never created in Supabase Auth");
  } else {
    issues.push("✅ Auth user exists: " + authUser.id);
    if (!authUser.email_confirmed_at) {
      issues.push("⚠️ Email not confirmed");
    }
  }

  if (!userRecord) {
    issues.push("❌ No user record in 'users' table - this prevents login!");
  } else {
    issues.push("✅ User record exists in 'users' table");
    if (userRecord.status !== "active") {
      issues.push(
        `⚠️ User status is '${userRecord.status}' - should be 'active'`
      );
    }
  }

  if (!tenantUser) {
    issues.push("❌ No tenant_users record - user won't show in team list");
  } else {
    issues.push("✅ tenant_users record exists");
    if (!tenantUser.is_active) {
      issues.push("⚠️ tenant_users.is_active is false");
    }
  }

  if (!userRoles || userRoles.length === 0) {
    issues.push("⚠️ No roles assigned - user may have limited access");
  } else {
    issues.push(`✅ Has ${userRoles.length} role(s) assigned`);
  }

  return issues;
}

// POST to fix user records
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { email, tenantId, firstName, lastName, roleId } = body;

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Get auth user
  const { data: usersData } = await adminClient.auth.admin.listUsers();
  const authUser = usersData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!authUser) {
    return NextResponse.json(
      {
        error:
          "No auth user found. The user was never created in Supabase Auth.",
        suggestion: "Try inviting the user again through the team settings",
      },
      { status: 400 }
    );
  }

  const fixes: string[] = [];

  // Get tenant from invitation or parameter
  let targetTenantId = tenantId || authUser.user_metadata?.tenant_id;
  if (!targetTenantId) {
    const { data: invitation } = await adminClient
      .from("user_invitations")
      .select("tenant_id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    targetTenantId = invitation?.tenant_id;
  }

  if (!targetTenantId) {
    return NextResponse.json(
      {
        error: "No tenant_id found. Provide tenantId in the request body.",
      },
      { status: 400 }
    );
  }

  // 1. Fix users table
  const { data: existingUser } = await adminClient
    .from("users")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!existingUser) {
    const name =
      firstName && lastName
        ? `${firstName} ${lastName}`.trim()
        : authUser.user_metadata?.full_name || email.split("@")[0];

    const { error } = await adminClient.from("users").insert({
      id: authUser.id,
      email: email.toLowerCase(),
      name,
      tenant_id: targetTenantId,
      status: "active",
      is_super_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    fixes.push(
      error ? `❌ users insert: ${error.message}` : "✅ Created users record"
    );
  } else {
    const { error } = await adminClient
      .from("users")
      .update({ status: "active", tenant_id: targetTenantId })
      .eq("id", authUser.id);
    fixes.push(
      error ? `❌ users update: ${error.message}` : "✅ Updated users record"
    );
  }

  // 2. Fix tenant_users table
  const { data: existingTenantUser } = await adminClient
    .from("tenant_users")
    .select("user_id")
    .eq("user_id", authUser.id)
    .eq("tenant_id", targetTenantId)
    .maybeSingle();

  if (!existingTenantUser) {
    const { error } = await adminClient.from("tenant_users").insert({
      user_id: authUser.id,
      tenant_id: targetTenantId,
      is_active: true,
      joined_at: new Date().toISOString(),
    });
    fixes.push(
      error
        ? `❌ tenant_users insert: ${error.message}`
        : "✅ Created tenant_users record"
    );
  } else {
    const { error } = await adminClient
      .from("tenant_users")
      .update({ is_active: true })
      .eq("user_id", authUser.id)
      .eq("tenant_id", targetTenantId);
    fixes.push(
      error
        ? `❌ tenant_users update: ${error.message}`
        : "✅ Updated tenant_users record"
    );
  }

  // 3. Fix user_roles (if roleId provided)
  if (roleId) {
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("user_id", authUser.id)
      .eq("role_id", roleId)
      .maybeSingle();

    if (!existingRole) {
      const { error } = await adminClient.from("user_roles").insert({
        user_id: authUser.id,
        role_id: roleId,
        assigned_at: new Date().toISOString(),
      });
      fixes.push(
        error
          ? `❌ user_roles insert: ${error.message}`
          : "✅ Created user_roles record"
      );
    } else {
      fixes.push("✅ user_roles record already exists");
    }
  }

  // 4. Update invitation status
  const { data: invitation } = await adminClient
    .from("user_invitations")
    .select("id, status")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invitation && invitation.status !== "accepted") {
    await adminClient
      .from("user_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);
    fixes.push("✅ Updated invitation to accepted");
  }

  return NextResponse.json({
    success: true,
    message: "User records fixed!",
    fixes,
    userId: authUser.id,
    tenantId: targetTenantId,
    note: "User should now be able to log in at /auth/signin",
  });
}
