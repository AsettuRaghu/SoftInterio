/**
 * Who may see and change which projects.
 *
 * The projects permission vocabulary is not the same as the leads one, and the
 * difference matters enough to write down.
 *
 * On leads the seed is coherent: leads.view (4 roles) means every lead,
 * leads.view_own (3 roles) means only mine, and the two overlap solely on
 * Admin and Owner, who legitimately hold everything. leads.view_all does not
 * exist. So leads.view could safely be read as "all".
 *
 * On projects the seed is not coherent. projects.view is granted to 15 of 21
 * roles - including Limited and Sales, which also hold projects.view_own.
 * Granting a role both "every project" and "only mine" is contradictory, so
 * projects.view here reads as generic module access, with projects.view_all
 * (5 roles) carrying the "every project" meaning. But that reading strands
 * seven roles - Design Manager, Designer, Finance Manager, Procurement,
 * Project Manager, Sales Manager, Site Supervisor Manager - which hold
 * projects.view and neither view_all nor view_own, and would therefore see
 * nothing at all. Project Manager also holds projects.create, projects.edit
 * and projects.delete. A role that may delete a project but not open one is
 * seed data nobody thought through, not an intention to enforce.
 *
 * So both forms are honoured as "may read every project". That follows the
 * rule we settled on - granted the permission to view, then you can view -
 * and locks nobody out. It is deliberately the permissive reading of
 * incoherent data; tightening it means fixing the grants first, not guessing
 * here. The same applies to projects.edit vs projects.update, which are held
 * by near-disjoint role sets and clearly mean the same act.
 *
 * A project is "yours" when you manage it or you created it. Unlike leads -
 * where created_by is often a form or an import and only assigned_to means
 * anything - a project is always created by a person converting a won lead,
 * so authorship is real ownership. It also matters because project_manager_id
 * is currently null on every existing project: manager-only ownership would
 * show a view_own holder an empty list.
 *
 * Deliberately flat - no team or reporting hierarchy. projects.view_team is
 * granted to six roles and is intentionally not consulted, exactly as
 * leads.view_team is not.
 */

export interface ProjectAccess {
  /** May read every project in the tenant. */
  readAll: boolean;
  /** May read projects they manage or created. */
  readOwn: boolean;
  /** May change every project in the tenant. */
  writeAll: boolean;
  /** May change projects they manage or created. */
  writeOwn: boolean;
  /** May create new projects. */
  create: boolean;
  /** May archive projects. */
  remove: boolean;
  /** No read access of any kind. */
  denied: boolean;
}

export function projectAccess(
  permissions: Set<string> | undefined,
  isSuperAdmin = false
): ProjectAccess {
  if (isSuperAdmin) {
    return {
      readAll: true,
      readOwn: true,
      writeAll: true,
      writeOwn: true,
      create: true,
      remove: true,
      denied: false,
    };
  }

  const has = (key: string) => permissions?.has(key) ?? false;

  const readAll = has("projects.view") || has("projects.view_all");
  const readOwn = readAll || has("projects.view_own");
  const writeAll = has("projects.edit") || has("projects.update");
  const writeOwn = writeAll || has("projects.edit_own");

  return {
    readAll,
    readOwn,
    writeAll,
    writeOwn,
    create: has("projects.create"),
    remove: has("projects.delete"),
    denied: !readOwn,
  };
}

/** The shape any ownership check needs. Both fields may be absent or null. */
export interface ProjectOwnership {
  project_manager_id?: string | null;
  created_by?: string | null;
}

export function isProjectOwner(
  project: ProjectOwnership | null,
  userId: string
): boolean {
  if (!project) return false;
  return (
    project.project_manager_id === userId || project.created_by === userId
  );
}

/**
 * Whether this specific project may be changed.
 *
 * Ownership is only consulted for someone limited to their own: a holder of
 * projects.edit does not need to own anything.
 */
export function canWriteProject(
  access: ProjectAccess,
  project: ProjectOwnership | null,
  userId: string
): boolean {
  if (access.writeAll) return true;
  if (!access.writeOwn) return false;
  return isProjectOwner(project, userId);
}

/** As above, for reading. */
export function canReadProject(
  access: ProjectAccess,
  project: ProjectOwnership | null,
  userId: string
): boolean {
  if (access.readAll) return true;
  if (!access.readOwn) return false;
  return isProjectOwner(project, userId);
}
