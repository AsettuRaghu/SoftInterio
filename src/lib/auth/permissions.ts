/**
 * What one person may actually do.
 *
 * There were four copies of this resolution - the API guard, the middleware,
 * the client hook and getCurrentSession - and they disagreed. The guard read
 * `granted !== false`, the hook and the middleware required `granted === true`
 * (so a NULL row silently vanished), and getCurrentSession ignored `granted`
 * altogether, handing back permissions that had been explicitly revoked. No
 * live data exercised the difference - all 1307 role grants are currently
 * true - but three of the four were one NULL row away from disagreeing about
 * what a user may do, depending on which surface asked.
 *
 * So: one resolver, used by all four.
 *
 * Two layers, and the user layer always wins:
 *
 *   roles    a permission is held when some role grants it and none revokes it
 *   user     a row in user_permissions decides that key outright, either way
 *
 * Super admins are not resolved here at all - callers short-circuit them, since
 * "everything" is not a set worth building.
 */

import type { PermissionKey } from "@/types/roles-permissions";

/** A role-derived grant. `granted` is tri-state: null means "not stated". */
export interface RoleGrant {
  granted: boolean | null;
  key: string;
}

/** A per-user override. `granted` is deliberately not nullable. */
export interface UserGrant {
  granted: boolean;
  key: string;
}

/**
 * Merge the two layers.
 *
 * Kept pure and separate from fetching so it can be reasoned about, and so the
 * Edge middleware can use it without dragging a client shape along.
 */
export function mergePermissions(
  roleGrants: RoleGrant[],
  userGrants: UserGrant[] = []
): Set<string> {
  const effective = new Set<string>();

  // A role revoke (granted === false) beats a role grant, whatever order the
  // rows arrive in - so collect the revokes before adding anything.
  const revokedByRole = new Set(
    roleGrants.filter((g) => g.granted === false).map((g) => g.key)
  );

  for (const grant of roleGrants) {
    // null means the row exists without an opinion, which reads as granted.
    // Only an explicit false revokes.
    if (grant.granted !== false && !revokedByRole.has(grant.key)) {
      effective.add(grant.key);
    }
  }

  // The user overlay is applied last and is absolute in both directions.
  for (const grant of userGrants) {
    if (grant.granted) effective.add(grant.key);
    else effective.delete(grant.key);
  }

  return effective;
}

/**
 * Anything with a Supabase-shaped `.from()`. The four call sites pass four
 * different clients - admin, server, browser and the Edge middleware's - and
 * none of their types are compatible with one another.
 */
type QueryableClient = {
  from: (table: string) => any;
};

/**
 * Read both layers for a user and merge them.
 *
 * Two round trips rather than one: `user_permissions` and the role chain have
 * no join between them, and a failed embed here would silently under-report
 * what someone may do, which is the failure direction that matters.
 */
export async function fetchEffectivePermissions(
  client: QueryableClient,
  userId: string
): Promise<Set<string>> {
  const [roleResult, userResult] = await Promise.all([
    client
      .from("user_roles")
      .select("role:roles(role_permissions(granted, permission:permissions(key)))")
      .eq("user_id", userId),
    client
      .from("user_permissions")
      .select("granted, permission:permissions(key)")
      .eq("user_id", userId),
  ]);

  const roleGrants: RoleGrant[] = [];
  for (const userRole of roleResult.data ?? []) {
    for (const rp of userRole.role?.role_permissions ?? []) {
      if (rp.permission?.key) {
        roleGrants.push({ granted: rp.granted, key: rp.permission.key });
      }
    }
  }

  const userGrants: UserGrant[] = [];
  for (const row of userResult.data ?? []) {
    if (row.permission?.key) {
      userGrants.push({ granted: row.granted, key: row.permission.key });
    }
  }

  return mergePermissions(roleGrants, userGrants);
}

/** Narrowing helper for callers holding an effective set. */
export function has(
  permissions: Set<string> | undefined,
  key: PermissionKey
): boolean {
  return permissions?.has(key) ?? false;
}
