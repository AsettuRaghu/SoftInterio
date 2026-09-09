/**
 * Per-user permission grants.
 *
 *   GET    /api/team/members/:id/permissions   what this person may do, and why
 *   PUT    /api/team/members/:id/permissions   grant or revoke one permission
 *   DELETE /api/team/members/:id/permissions   drop an override, back to roles
 *
 * The overlay described in 20260909140000: a row grants or revokes one
 * permission for one person, and beats whatever their roles say. This is what
 * makes "give Raghu quotation approval" a single action rather than a new role
 * or an edit to a role three other people share.
 *
 * Gated on team.permissions.manage (Owner, Admin), not on hierarchy_level -
 * which is what the sibling roles route uses. Permissions here are flat by
 * decision: a person may do what they are granted. The hierarchy check next
 * door predates that and is worth reconciling, but copying it across would
 * spread a model the app has otherwise moved away from.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";
import { fetchEffectivePermissions } from "@/lib/auth/permissions";

/**
 * Resolves the target member inside the caller's tenant.
 *
 * Answers 404 rather than 403 for someone in another tenant, so this cannot be
 * used to discover which user ids exist elsewhere.
 */
async function resolveMember(
  adminClient: ReturnType<typeof createAdminClient>,
  callerId: string,
  memberId: string
) {
  const { data: caller } = await adminClient
    .from("users")
    .select("id, tenant_id")
    .eq("id", callerId)
    .single();

  if (!caller) return { error: "User not found", status: 404 as const };

  const { data: member } = await adminClient
    .from("users")
    .select("id, name, email, tenant_id, is_super_admin")
    .eq("id", memberId)
    .single();

  if (!member || member.tenant_id !== caller.tenant_id) {
    return { error: "Member not found in your organization", status: 404 as const };
  }

  return { caller, member };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["team.permissions.view"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: memberId } = await params;
    const adminClient = createAdminClient();
    const resolved = await resolveMember(adminClient, guard.user.id, memberId);
    if ("error" in resolved) {
      return NextResponse.json(
        { success: false, error: resolved.error },
        { status: resolved.status }
      );
    }

    // The overrides themselves, and the effective set they produce. Both,
    // because "what has been decided for this person" and "what they can
    // actually do" are different questions and the screen asks both.
    const { data: overrides } = await adminClient
      .from("user_permissions")
      .select("granted, reason, created_at, permission:permissions(id, key, module, description)")
      .eq("user_id", memberId);

    const effective = await fetchEffectivePermissions(adminClient, memberId);

    return NextResponse.json({
      success: true,
      data: {
        member: {
          id: resolved.member.id,
          name: resolved.member.name,
          email: resolved.member.email,
        },
        overrides: overrides ?? [],
        effective: Array.from(effective).sort(),
        // A super admin bypasses resolution entirely, so the list above is not
        // the whole truth for them. Say so rather than let the screen imply it.
        isSuperAdmin: resolved.member.is_super_admin === true,
      },
    });
  } catch (error) {
    log.error("Error reading member permissions", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["team.permissions.manage"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: memberId } = await params;
    const body = await request.json();
    const { key, granted, reason } = body as {
      key?: string;
      granted?: boolean;
      reason?: string;
    };

    if (typeof key !== "string" || !key.trim()) {
      return NextResponse.json(
        { success: false, error: "A permission key is required" },
        { status: 400 }
      );
    }
    if (typeof granted !== "boolean") {
      return NextResponse.json(
        { success: false, error: "granted must be true (grant) or false (revoke)" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const resolved = await resolveMember(adminClient, guard.user.id, memberId);
    if ("error" in resolved) {
      return NextResponse.json(
        { success: false, error: resolved.error },
        { status: resolved.status }
      );
    }

    // Revoking from a super admin would look like it worked and change
    // nothing, because resolution short-circuits for them.
    if (resolved.member.is_super_admin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This user is a super admin and already has every permission. Remove that first if you need to limit them.",
        },
        { status: 409 }
      );
    }

    const { data: permission } = await adminClient
      .from("permissions")
      .select("id, key")
      .eq("key", key)
      .single();

    if (!permission) {
      return NextResponse.json(
        { success: false, error: `No such permission: ${key}` },
        { status: 400 }
      );
    }

    // One decision per person per permission - changing your mind updates the
    // existing row rather than stacking a contradictory second one.
    const { error } = await adminClient.from("user_permissions").upsert(
      {
        user_id: memberId,
        permission_id: permission.id,
        granted,
        tenant_id: resolved.member.tenant_id,
        granted_by: guard.user.id,
        reason: reason?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,permission_id" }
    );

    if (error) {
      log.error("Failed to write user permission", error);
      return NextResponse.json(
        { success: false, error: "Failed to save the permission" },
        { status: 500 }
      );
    }

    log.info(
      `${granted ? "Granted" : "Revoked"} ${key} for ${resolved.member.email}`
    );

    const effective = await fetchEffectivePermissions(adminClient, memberId);

    return NextResponse.json({
      success: true,
      message: granted
        ? `${resolved.member.name || resolved.member.email} can now ${key}`
        : `${key} removed for ${resolved.member.name || resolved.member.email}`,
      data: { effective: Array.from(effective).sort() },
    });
  } catch (error) {
    log.error("Error writing member permission", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["team.permissions.manage"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: memberId } = await params;
    const key = new URL(request.url).searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { success: false, error: "A permission key is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const resolved = await resolveMember(adminClient, guard.user.id, memberId);
    if ("error" in resolved) {
      return NextResponse.json(
        { success: false, error: resolved.error },
        { status: resolved.status }
      );
    }

    const { data: permission } = await adminClient
      .from("permissions")
      .select("id")
      .eq("key", key)
      .single();

    if (!permission) {
      return NextResponse.json(
        { success: false, error: `No such permission: ${key}` },
        { status: 400 }
      );
    }

    // Removing the override is not the same as revoking: it hands the decision
    // back to the person's roles, which may well still grant the permission.
    const { error } = await adminClient
      .from("user_permissions")
      .delete()
      .eq("user_id", memberId)
      .eq("permission_id", permission.id);

    if (error) {
      log.error("Failed to clear user permission", error);
      return NextResponse.json(
        { success: false, error: "Failed to clear the override" },
        { status: 500 }
      );
    }

    const effective = await fetchEffectivePermissions(adminClient, memberId);

    return NextResponse.json({
      success: true,
      message: `${key} now follows this person's roles again`,
      data: { effective: Array.from(effective).sort() },
    });
  } catch (error) {
    log.error("Error clearing member permission", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
