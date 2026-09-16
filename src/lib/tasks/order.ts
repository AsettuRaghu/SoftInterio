/**
 * The one default order for a list of tasks, used by every table that shows
 * them - the Tasks page, a project's Tasks tab, a lead's.
 *
 * Plan steps come first, grouped by the project (or lead) they belong to and
 * in the playbook's own order (`plan_order`, the step's display_order from the
 * API); ad-hoc tasks follow, newest first. Two tables sorting the same rows
 * two ways - which is how a project's steps read one way on one screen and
 * backwards on another - is exactly what this exists to stop.
 */
export function defaultTaskOrder<
  T extends {
    procedure_run_id?: string | null;
    plan_order?: number | null;
    related_id?: string | null;
    related_name?: string | null;
    created_at?: string | null;
  },
>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const ap = !!a.procedure_run_id;
    const bp = !!b.procedure_run_id;
    if (ap !== bp) return ap ? -1 : 1;
    if (ap && bp) {
      const g = String(a.related_name ?? a.related_id ?? "").localeCompare(String(b.related_name ?? b.related_id ?? ""));
      if (g !== 0) return g;
      return (a.plan_order ?? Number.MAX_SAFE_INTEGER) - (b.plan_order ?? Number.MAX_SAFE_INTEGER);
    }
    return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  });
}
