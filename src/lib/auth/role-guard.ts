/**
 * Who may change which role.
 *
 * `team.roles.manage` says you may edit roles. It does not say you may edit
 * *your own*, and without that distinction the permission is equivalent to
 * granting yourself anything: an Admin holds 252 of 254 permissions, so
 * editing the Admin role hands them the remaining two and they are an Owner in
 * all but name.
 *
 * Three rules, checked in order of how absolute they are:
 *
 *   1. The Owner role is untouchable. Enforced in the database as well; this
 *      only exists so the refusal is a sentence rather than a check_violation.
 *   2. The Admin role may only be changed by someone holding Owner. An admin
 *      cannot edit the role that makes them an admin.
 *   3. Nobody may edit a role they themselves hold. This is rule 2's reason,
 *      generalised - otherwise a tenant that delegates role management to a
 *      custom role has handed that role's holders a way to grant themselves
 *      everything.
 *
 * And separately, on the permissions being written:
 *
 *   4. You cannot grant a permission you do not hold. Rules 2 and 3 stop you
 *      editing your own role; this stops the way around them, which is to
 *      create a new role with everything in it and assign it to yourself.
 *
 * **These are application rules, not database ones.** Unlike the Owner lock,
 * they depend on who is asking, and every write here goes through the admin
 * client where `auth.uid()` is null - so a trigger cannot see the caller. Any
 * new route that writes roles must call these; the database will not catch it.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { fetchEffectivePermissions } from "@/lib/auth/permissions";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface RoleGuardFailure {
  error: string;
  status: 403 | 409;
  reason: string;
}

/** Whether this user holds the shipped Owner role. */
export async function holdsOwnerRole(
  admin: AdminClient,
  userId: string
): Promise<boolean> {
  const { data: ownerRole } = await admin
    .from("roles")
    .select("id")
    .eq("slug", "owner")
    .is("tenant_id", null)
    .maybeSingle();

  if (!ownerRole) return false;

  const { count } = await admin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role_id", ownerRole.id);

  return (count ?? 0) > 0;
}

/**
 * Rules 1-3. Returns null when the edit is allowed.
 *
 * `roleId` is the role as asked for, before any copy-on-write: the rules are
 * about which role is being changed, and a tenant's copy of Admin is still
 * Admin.
 */
export async function checkMayEditRole(
  admin: AdminClient,
  callerId: string,
  roleId: string
): Promise<RoleGuardFailure | null> {
  const { data: role } = await admin
    .from("roles")
    .select("id, slug, name, tenant_id")
    .eq("id", roleId)
    .maybeSingle();

  if (!role) return null; // the caller's own 404 handling covers this

  // 1. Owner, for anybody.
  if (role.slug === "owner" && role.tenant_id === null) {
    return {
      error: "The Owner role holds every permission and cannot be changed, by anyone.",
      status: 409,
      reason: "owner_locked",
    };
  }

  const callerIsOwner = await holdsOwnerRole(admin, callerId);

  // 2. Admin, for anyone who is not an owner. Covers a tenant's own copy of
  //    Admin too - it is the same role, wearing the same name.
  if (role.slug === "admin" && !callerIsOwner) {
    return {
      error:
        "Only an owner can change the Admin role. This stops an administrator from widening their own access.",
      status: 403,
      reason: "admin_role_requires_owner",
    };
  }

  // 3. A role the caller holds. An owner is exempt only in the sense that the
  //    Owner role is already blocked by rule 1, so this still applies to them
  //    for every other role they might hold.
  const { count: holdsIt } = await admin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("user_id", callerId)
    .eq("role_id", role.id);

  if ((holdsIt ?? 0) > 0) {
    return {
      error: `You hold the ${role.name} role, so you cannot change what it may do. Ask an owner.`,
      status: 403,
      reason: "cannot_edit_own_role",
    };
  }

  return null;
}

/**
 * Rule 4. Returns null when every requested key is one the caller holds.
 *
 * Deliberately checks the caller's *effective* permissions, so a per-user grant
 * counts and a per-user revoke takes it away - the question is what this person
 * can actually do, not what their roles nominally say.
 *
 * A super admin is exempt: they already hold everything, and resolution
 * short-circuits for them rather than returning a set to compare against.
 */
export async function checkMayGrantPermissions(
  admin: AdminClient,
  callerId: string,
  keys: string[]
): Promise<RoleGuardFailure | null> {
  const { data: caller } = await admin
    .from("users")
    .select("is_super_admin")
    .eq("id", callerId)
    .maybeSingle();

  if (caller?.is_super_admin) return null;

  const mine = await fetchEffectivePermissions(admin, callerId);
  const beyond = keys.filter((k) => !mine.has(k));

  if (beyond.length) {
    const shown = beyond.slice(0, 3).join(", ");
    const more = beyond.length > 3 ? ` and ${beyond.length - 3} more` : "";
    return {
      error: `You cannot give a role permissions you do not have yourself: ${shown}${more}.`,
      status: 403,
      reason: "cannot_grant_beyond_own",
    };
  }

  return null;
}
