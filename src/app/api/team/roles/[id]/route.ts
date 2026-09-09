/**
 * One role: read it, rename it, delete it.
 *
 *   GET    /api/team/roles/:id   its definition and the permission keys it holds
 *   PATCH  /api/team/roles/:id   name and description
 *   DELETE /api/team/roles/:id   remove a role this tenant created
 *
 * A shipped role can be read by anyone in the tenant but changed by nobody -
 * PATCH copies it first, the same as the permission editor does, because a
 * rename is still an edit to something every business shares. DELETE refuses
 * outright: there is no copy that makes deleting a shared role safe.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";
import { ensureTenantOwnedRole } from "@/lib/auth/role-customise";

/** Resolves a role the caller's tenant is allowed to see. */
async function visibleRole(
  admin: ReturnType<typeof createAdminClient>,
  callerId: string,
  roleId: string
) {
  const { data: caller } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", callerId)
    .single();

  if (!caller?.tenant_id) return { error: "User not found", status: 404 as const };

  const { data: role } = await admin
    .from("roles")
    .select("id, name, slug, description, hierarchy_level, is_system_role, tenant_id")
    .eq("id", roleId)
    .single();

  // Another tenant's custom role is not found, rather than forbidden - a 403
  // would confirm the id exists.
  if (!role || (role.tenant_id && role.tenant_id !== caller.tenant_id)) {
    return { error: "Role not found", status: 404 as const };
  }

  return { role, tenantId: caller.tenant_id };
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

    const { id } = await params;
    const admin = createAdminClient();
    const found = await visibleRole(admin, guard.user.id, id);
    if ("error" in found) {
      return NextResponse.json(
        { success: false, error: found.error },
        { status: found.status }
      );
    }

    // Paged rather than a plain select: Owner holds 253 permissions today,
    // comfortably under the 1000-row cap, but this is exactly the query that
    // grows quietly and starts lying.
    const keys: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await admin
        .from("role_permissions")
        .select("granted, permission:permissions(key)")
        .eq("role_id", found.role.id)
        .range(from, from + 999);

      if (!data?.length) break;
      for (const row of data as any[]) {
        // Only positive grants are returned. The editor works in ticked or not
        // ticked, and a role-level revoke has no way to be expressed there.
        if (row.granted !== false && row.permission?.key) {
          keys.push(row.permission.key);
        }
      }
      if (data.length < 1000) break;
    }

    return NextResponse.json({
      success: true,
      data: {
        role: {
          id: found.role.id,
          name: found.role.name,
          slug: found.role.slug,
          description: found.role.description,
          hierarchyLevel: found.role.hierarchy_level,
          isSystem: found.role.is_system_role && found.role.tenant_id === null,
          isOwn: found.role.tenant_id === found.tenantId,
        },
        keys: keys.sort(),
      },
    });
  } catch (error) {
    log.error("Error reading role", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const { id } = await params;
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : undefined;
    const description =
      typeof body?.description === "string" ? body.description.trim() : undefined;

    if (name === undefined && description === undefined) {
      return NextResponse.json(
        { success: false, error: "Nothing to update" },
        { status: 400 }
      );
    }
    if (name !== undefined && !name) {
      return NextResponse.json(
        { success: false, error: "Give the role a name" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const found = await visibleRole(admin, guard.user.id, id);
    if ("error" in found) {
      return NextResponse.json(
        { success: false, error: found.error },
        { status: found.status }
      );
    }

    const owned = await ensureTenantOwnedRole(admin, id, found.tenantId);
    if ("error" in owned) {
      return NextResponse.json(
        { success: false, error: owned.error },
        { status: owned.status }
      );
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description || null;

    const { error } = await admin
      .from("roles")
      .update(update)
      .eq("id", owned.roleId);

    if (error) {
      log.error("Failed to rename role", error);
      return NextResponse.json(
        { success: false, error: "Failed to save the role" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { roleId: owned.roleId, copied: owned.copied },
    });
  } catch (error) {
    log.error("Error updating role", error);
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
      requiredPermissions: ["team.roles.manage"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const admin = createAdminClient();
    const found = await visibleRole(admin, guard.user.id, id);
    if ("error" in found) {
      return NextResponse.json(
        { success: false, error: found.error },
        { status: found.status }
      );
    }

    if (found.role.tenant_id !== found.tenantId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This role is provided by SoftInterio and cannot be deleted. Customise it instead, or stop assigning it.",
        },
        { status: 409 }
      );
    }

    // Deleting a role would strip everyone in it of that access at once, and
    // user_roles cascades - so the people have to be moved off it first, by
    // someone who knows where they should go instead.
    const tenantUserIds =
      (await admin.from("users").select("id").eq("tenant_id", found.tenantId)).data?.map(
        (u) => u.id
      ) ?? [];

    if (tenantUserIds.length) {
      const { count } = await admin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role_id", id)
        .in("user_id", tenantUserIds);

      if (count && count > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `${count} ${count === 1 ? "person is" : "people are"} still in this role. Move them to another role first.`,
            reason: "role_in_use",
            memberCount: count,
          },
          { status: 409 }
        );
      }
    }

    const { error } = await admin.from("roles").delete().eq("id", id);

    if (error) {
      log.error("Failed to delete role", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete the role" },
        { status: 500 }
      );
    }

    log.info(`Deleted role ${found.role.name}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting role", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
