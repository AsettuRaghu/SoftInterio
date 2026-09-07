/**
 * Who may see and change which leads.
 *
 * Two shapes of permission exist for the same action: leads.view means any
 * lead in the tenant, leads.view_own means only the caller's. RLS enforces
 * neither - the policy on leads checks tenant membership and nothing else - so
 * until now a salesperson holding only view_own could read every lead in the
 * business through the API.
 *
 * A lead is "yours" when it is assigned to you. Not when you created it: leads
 * arrive from forms and imports with a system creator, and a lead handed on to
 * a colleague stops being yours the moment it is reassigned.
 *
 * Deliberately flat - no team or reporting hierarchy. A person sees what their
 * granted permissions say they see, nothing more and nothing inherited.
 */

export interface LeadAccess {
  /** May read every lead in the tenant. */
  readAll: boolean;
  /** May read leads assigned to them. */
  readOwn: boolean;
  /** May change every lead in the tenant. */
  writeAll: boolean;
  /** May change leads assigned to them. */
  writeOwn: boolean;
  /** No read access of any kind. */
  denied: boolean;
}

export function leadAccess(
  permissions: Set<string> | undefined,
  isSuperAdmin = false
): LeadAccess {
  if (isSuperAdmin) {
    return { readAll: true, readOwn: true, writeAll: true, writeOwn: true, denied: false };
  }

  const has = (key: string) => permissions?.has(key) ?? false;

  const readAll = has("leads.view");
  const readOwn = readAll || has("leads.view_own");
  const writeAll = has("leads.edit");
  const writeOwn = writeAll || has("leads.edit_own");

  return { readAll, readOwn, writeAll, writeOwn, denied: !readOwn };
}

/**
 * Whether this specific lead may be changed.
 *
 * Ownership is only consulted for someone limited to their own: a holder of
 * leads.edit does not need to own anything.
 */
export function canWriteLead(
  access: LeadAccess,
  lead: { assigned_to?: string | null } | null,
  userId: string
): boolean {
  if (access.writeAll) return true;
  if (!access.writeOwn) return false;
  return !!lead && lead.assigned_to === userId;
}

/** As above, for reading. */
export function canReadLead(
  access: LeadAccess,
  lead: { assigned_to?: string | null } | null,
  userId: string
): boolean {
  if (access.readAll) return true;
  if (!access.readOwn) return false;
  return !!lead && lead.assigned_to === userId;
}
