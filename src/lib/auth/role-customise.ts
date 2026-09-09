/**
 * Taking a shipped role into a tenant's own hands.
 *
 * All 21 seeded roles are global - tenant_id NULL, is_system_role true - and
 * shared by every business on the platform. Editing one in place would change
 * what "Sales" means for everybody, so the first edit takes a copy instead.
 *
 * This is the same bargain protected playbooks strike: SoftInterio proposes a
 * practice, and the moment a tenant wants it different, they get their own.
 *
 * The copy has to bring three things across or it is not the same role:
 *
 *   1. the definition   name, slug, description, hierarchy_level
 *   2. the permissions  every grant, revokes included - `granted` is tri-state
 *   3. the people       this tenant's members, moved onto the copy
 *
 * Step 3 is the one that is easy to forget and impossible to notice: without
 * it the tenant edits a role nobody holds, and every member carries on under
 * the shipped one. Members of OTHER tenants must not move, which is why the
 * reassignment is filtered by tenant rather than done by role id alone.
 */

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface CustomiseResult {
  roleId: string;
  /** False when the role was already the tenant's own and no copy was needed. */
  copied: boolean;
  /** How many of this tenant's members were moved onto the copy. */
  membersMoved: number;
}

/**
 * Returns a role id the tenant may edit, copying the shipped role if needed.
 *
 * Safe to call on a role the tenant already owns - it is then a no-op, which
 * lets callers use it unconditionally before any edit.
 */
export async function ensureTenantOwnedRole(
  admin: AdminClient,
  roleId: string,
  tenantId: string
): Promise<CustomiseResult | { error: string; status: 400 | 404 | 409 }> {
  const { data: role } = await admin
    .from("roles")
    .select("id, name, slug, description, hierarchy_level, is_system_role, tenant_id")
    .eq("id", roleId)
    .single();

  if (!role) return { error: "Role not found", status: 404 };

  // Already this tenant's own - nothing to do.
  if (role.tenant_id === tenantId) {
    return { roleId: role.id, copied: false, membersMoved: 0 };
  }

  // Somebody else's custom role. Not ours to read, let alone copy.
  if (role.tenant_id && role.tenant_id !== tenantId) {
    return { error: "Role not found", status: 404 };
  }

  // Owner is the one role that must not be forked: is_super_admin and the
  // ownership-transfer flow both key off it, and a tenant-local copy would
  // quietly stop satisfying either.
  if (role.slug === "owner") {
    return {
      error:
        "The Owner role cannot be customised. Use per-person permissions to adjust an individual instead.",
      status: 409,
    };
  }

  const { data: copy, error: copyError } = await admin
    .from("roles")
    .insert({
      tenant_id: tenantId,
      name: role.name,
      slug: role.slug,
      description: role.description,
      hierarchy_level: role.hierarchy_level,
      is_system_role: false,
      is_default: false,
    })
    .select("id")
    .single();

  if (copyError || !copy) {
    // unique_role_slug_per_tenant is (tenant_id, slug), so this fires when the
    // tenant already customised this role - a concurrent second attempt.
    return {
      error: "This role has already been customised for your organisation.",
      status: 409,
    };
  }

  // Carry the grants across, `granted` included. Copying only the true rows
  // would silently turn an explicit revoke into "not stated", which resolves
  // the same way today but is a different statement about intent.
  const { data: grants } = await admin
    .from("role_permissions")
    .select("permission_id, granted")
    .eq("role_id", role.id);

  if (grants?.length) {
    await admin.from("role_permissions").insert(
      grants.map((g) => ({
        role_id: copy.id,
        permission_id: g.permission_id,
        granted: g.granted,
      }))
    );
  }

  // Move this tenant's members onto the copy. Scoped by tenant: the shipped
  // role stays exactly as it is for every other business.
  const { data: tenantUsers } = await admin
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId);

  const userIds = (tenantUsers ?? []).map((u) => u.id);
  let membersMoved = 0;

  if (userIds.length) {
    const { data: moved } = await admin
      .from("user_roles")
      .update({ role_id: copy.id })
      .eq("role_id", role.id)
      .in("user_id", userIds)
      .select("user_id");

    membersMoved = moved?.length ?? 0;
  }

  return { roleId: copy.id, copied: true, membersMoved };
}
