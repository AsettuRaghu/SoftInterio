/**
 * The roles screen's own listing, and creating a role.
 *
 *   GET  /api/team/roles/manage   every role this tenant works with
 *   POST /api/team/roles/manage   create one of their own
 *
 * Separate from GET /api/team/roles, which exists to fill the invite dropdown
 * and filters by what the caller may *assign* - Owner is excluded, and an
 * Admin cannot assign another Admin. Neither restriction belongs on a screen
 * whose job is to show what each role can do.
 *
 * One entry per role, not one per row. Once a tenant customises "Sales" there
 * are two Sales rows - the shipped one and theirs - and showing both invites
 * somebody to edit the wrong one. Their copy represents the role; the shipped
 * one is only visible until they take it.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";
import { holdsOwnerRole } from "@/lib/auth/role-guard";

interface RoleRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hierarchy_level: number;
  is_system_role: boolean;
  tenant_id: string | null;
}

export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    // Viewing is gated on seeing permissions at all, not on managing them - a
    // person who may look at who can do what does not have to be able to
    // change it.
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["team.permissions.view"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
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

    const { data: roles } = await admin
      .from("roles")
      .select("id, name, slug, description, hierarchy_level, is_system_role, tenant_id")
      .or(`is_system_role.eq.true,tenant_id.eq.${caller.tenant_id}`)
      .order("hierarchy_level", { ascending: true });

    const all = (roles ?? []) as RoleRow[];

    // The tenant's own copy replaces the shipped role of the same slug.
    const ownBySlug = new Map(
      all.filter((r) => r.tenant_id === caller.tenant_id).map((r) => [r.slug, r])
    );
    const visible = all.filter(
      (r) => r.tenant_id === caller.tenant_id || !ownBySlug.has(r.slug)
    );

    // Counts are exact head counts, never a select length: role_permissions has
    // over a thousand rows and PostgREST caps a plain select at 1000, which has
    // produced a confident "this role has no permissions" before now.
    const tenantUserIds = (
      await admin.from("users").select("id").eq("tenant_id", caller.tenant_id)
    ).data?.map((u) => u.id) ?? [];

    // Which roles this caller may actually change, worked out once rather than
    // per row. The rules live in lib/auth/role-guard and the API enforces them;
    // this is only so the screen can say why a role is read-only instead of
    // letting somebody tick boxes that will be refused on save.
    const callerIsOwner = await holdsOwnerRole(admin, guard.user.id);
    const { data: callerRoleRows } = await admin
      .from("user_roles")
      .select("role_id")
      .eq("user_id", guard.user.id);
    const callerRoleIds = new Set((callerRoleRows ?? []).map((r) => r.role_id));

    const summarised = await Promise.all(
      visible.map(async (role) => {
        const { count: permissionCount } = await admin
          .from("role_permissions")
          .select("*", { count: "exact", head: true })
          .eq("role_id", role.id);

        let memberCount = 0;
        if (tenantUserIds.length) {
          const { count } = await admin
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role_id", role.id)
            .in("user_id", tenantUserIds);
          memberCount = count ?? 0;
        }

        return {
          id: role.id,
          name: role.name,
          slug: role.slug,
          description: role.description,
          hierarchyLevel: role.hierarchy_level,
          // "Shipped by SoftInterio, shared with every tenant" - editing takes
          // a copy first. The screen says so before anyone clicks.
          isSystem: role.is_system_role && role.tenant_id === null,
          isOwn: role.tenant_id === caller.tenant_id,
          // Locked outright, not merely "shipped by us". The screen needs to
          // say so before someone starts ticking boxes they cannot save.
          isLocked: role.slug === "owner" && role.tenant_id === null,
          ...roleRestriction(role, callerIsOwner, callerRoleIds),
          permissionCount: permissionCount ?? 0,
          memberCount,
        };
      })
    );

    return NextResponse.json({ success: true, data: { roles: summarised } });
  } catch (error) {
    log.error("Error listing roles", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["team.roles.manage"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : "";
    const hierarchyLevel = Number.isInteger(body?.hierarchyLevel)
      ? body.hierarchyLevel
      : 3;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Give the role a name" },
        { status: 400 }
      );
    }

    // 0 is Owner and 1 is Admin; both carry meaning elsewhere (is_admin_or_higher,
    // ownership transfer). A custom role starts at the manager tier or below.
    if (hierarchyLevel < 2 || hierarchyLevel > 4) {
      return NextResponse.json(
        { success: false, error: "Level must be between 2 and 4" },
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

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "That name has no letters or numbers in it" },
        { status: 400 }
      );
    }

    const { data: role, error } = await admin
      .from("roles")
      .insert({
        tenant_id: caller.tenant_id,
        name,
        slug,
        description: description || null,
        hierarchy_level: hierarchyLevel,
        is_system_role: false,
        is_default: false,
      })
      .select("id, name, slug, hierarchy_level")
      .single();

    if (error || !role) {
      // unique_role_slug_per_tenant
      if (error?.code === "23505") {
        return NextResponse.json(
          { success: false, error: `You already have a role called "${name}"` },
          { status: 409 }
        );
      }
      log.error("Failed to create role", error);
      return NextResponse.json(
        { success: false, error: "Failed to create the role" },
        { status: 500 }
      );
    }

    log.info(`Created role ${role.name} for tenant ${caller.tenant_id}`);

    // Deliberately created with no permissions. A new role that silently
    // inherited a template's access would be a surprise in the direction that
    // matters; the screen opens on its permission list so the next step is
    // obvious.
    //
    // This is also why creation needs no permission-escalation check of its
    // own: an empty role grants nobody anything, and filling it goes through
    // the editor, where checkMayGrantPermissions() refuses anything the
    // creator does not hold themselves.
    return NextResponse.json({ success: true, data: { role } });
  } catch (error) {
    log.error("Error creating role", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * The read-only reason shown on the roles screen, mirroring rules 2 and 3 of
 * checkMayEditRole(). Rule 1 (Owner) is reported separately as isLocked.
 *
 * Duplicating the rules for display is a real risk of drift, so keep this in
 * step with lib/auth/role-guard - the API is what actually enforces them, and
 * a mismatch here shows the wrong explanation rather than allowing anything.
 */
function roleRestriction(
  role: RoleRow,
  callerIsOwner: boolean,
  callerRoleIds: Set<string>
): { isRestricted: boolean; restrictedReason: string | null } {
  if (role.slug === "admin" && !callerIsOwner) {
    return {
      isRestricted: true,
      restrictedReason:
        "Only an owner can change the Admin role. This stops an administrator from widening their own access.",
    };
  }
  if (callerRoleIds.has(role.id)) {
    return {
      isRestricted: true,
      restrictedReason: `You hold the ${role.name} role, so you cannot change what it may do. Ask an owner.`,
    };
  }
  return { isRestricted: false, restrictedReason: null };
}
