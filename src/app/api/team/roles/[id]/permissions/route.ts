/**
 * What a role may do.
 *
 *   PUT /api/team/roles/:id/permissions   { keys: string[] }
 *
 * Takes the complete set rather than a diff, because the screen it serves is a
 * list of checkboxes and "what is ticked now" is the only state it knows. A
 * diff would need the client to track what it changed, and get it right.
 *
 * Editing a shipped role copies it to the tenant first - see
 * ensureTenantOwnedRole - so the response may carry a DIFFERENT role id than
 * the request. Callers must use `data.roleId` afterwards rather than assuming
 * they edited the role they asked for.
 *
 * Gated on team.roles.manage (Owner, Admin), which is separate from
 * team.roles.assign: putting someone into a role and rewriting what that role
 * may do are different acts with very different blast radius.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";
import { ensureTenantOwnedRole } from "@/lib/auth/role-customise";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["team.roles.manage"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: roleId } = await params;
    const body = await request.json();
    const keys: unknown = body?.keys;

    if (!Array.isArray(keys) || keys.some((k) => typeof k !== "string")) {
      return NextResponse.json(
        { success: false, error: "keys must be an array of permission keys" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: caller } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", guard.user.id)
      .single();

    if (!caller?.tenant_id) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // The Owner role is locked. The database refuses the write regardless, but
    // a check_violation surfacing as a 500 tells the user nothing - this says
    // what the rule is instead.
    const { data: target } = await admin
      .from("roles")
      .select("slug, tenant_id")
      .eq("id", roleId)
      .single();

    if (target?.slug === "owner" && target.tenant_id === null) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The Owner role holds every permission and cannot be changed, by anyone.",
          reason: "owner_locked",
        },
        { status: 409 }
      );
    }

    const owned = await ensureTenantOwnedRole(admin, roleId, caller.tenant_id);
    if ("error" in owned) {
      return NextResponse.json(
        { success: false, error: owned.error },
        { status: owned.status }
      );
    }

    // Resolve keys to ids in one go, and refuse the whole request if any key is
    // unknown. A partial apply would leave the role in a state nobody asked
    // for and the screen would show it as saved.
    const uniqueKeys = Array.from(new Set(keys as string[]));
    const { data: permissions } = await admin
      .from("permissions")
      .select("id, key")
      .in("key", uniqueKeys.length ? uniqueKeys : ["__none__"]);

    const found = new Set((permissions ?? []).map((p) => p.key));
    const unknown = uniqueKeys.filter((k) => !found.has(k));
    if (unknown.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown permission${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Replace the set. Delete then insert rather than diffing: the table has a
    // unique (role_id, permission_id) and this is one screen's worth of rows.
    const { error: deleteError } = await admin
      .from("role_permissions")
      .delete()
      .eq("role_id", owned.roleId);

    if (deleteError) {
      log.error("Failed to clear role permissions", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to save the role" },
        { status: 500 }
      );
    }

    if (permissions?.length) {
      const { error: insertError } = await admin.from("role_permissions").insert(
        permissions.map((p) => ({
          role_id: owned.roleId,
          permission_id: p.id,
          granted: true,
        }))
      );

      if (insertError) {
        log.error("Failed to write role permissions", insertError);
        return NextResponse.json(
          {
            success: false,
            error:
              "Failed to save the role. Its permissions may now be incomplete - reopen it and save again.",
          },
          { status: 500 }
        );
      }
    }

    log.info(
      `Role ${owned.roleId} set to ${permissions?.length ?? 0} permissions` +
        (owned.copied ? ` (copied for tenant, ${owned.membersMoved} member(s) moved)` : "")
    );

    return NextResponse.json({
      success: true,
      message: owned.copied
        ? `Customised for your organisation. ${owned.membersMoved} member${owned.membersMoved === 1 ? "" : "s"} moved onto your copy.`
        : "Role updated",
      data: {
        roleId: owned.roleId,
        copied: owned.copied,
        membersMoved: owned.membersMoved,
        permissionCount: permissions?.length ?? 0,
      },
    });
  } catch (error) {
    log.error("Error updating role permissions", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
