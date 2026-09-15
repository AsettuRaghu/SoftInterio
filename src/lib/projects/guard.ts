import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedUser } from "@/lib/auth/api-guard";
import {
  projectAccess,
  canReadProject,
  canWriteProject,
  type ProjectAccess,
} from "./access";

/**
 * The gate every project-scoped route goes through.
 *
 * Almost all of the project API hangs off /api/projects/[id]/... - the plan,
 * playbook, stages, notes, activities, documents, payment milestones. Before
 * this, those handlers proved only that a session
 * existed. Most never mentioned tenant_id at all, so they leaned entirely on
 * row level security to keep one business out of another's data, and none of
 * them consulted a permission.
 *
 * Resolving the parent project once, scoped to the caller's tenant, answers
 * both questions together: a project that is not yours to see is not found,
 * and a project you may read but not change refuses the write. Doing it in one
 * place means a new sub-route cannot quietly forget either half.
 */

export interface ProjectGuardOk {
  ok: true;
  /** The parent project, tenant-scoped and access-checked. */
  project: {
    id: string;
    tenant_id: string;
    project_manager_id: string | null;
    created_by: string | null;
    is_active: boolean | null;
    name: string | null;
    project_number: string | null;
    status: string | null;
    kicked_off_at: string | null;
  };
  access: ProjectAccess;
}

export interface ProjectGuardFailed {
  ok: false;
  response: NextResponse;
}

/**
 * A project the caller may not read is reported as missing rather than
 * forbidden. Saying "forbidden" would confirm the project exists, which leaks
 * the existence of another team's work to anyone who can guess an id.
 */
export async function requireProjectAccess(
  supabase: SupabaseClient,
  args: {
    projectId: string;
    user: AuthenticatedUser;
    permissions: Set<string> | undefined;
    mode: "read" | "write";
  }
): Promise<ProjectGuardOk | ProjectGuardFailed> {
  const { projectId, user, permissions, mode } = args;

  const access = projectAccess(permissions, user.isSuperAdmin);

  if (access.denied) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You do not have permission to view projects" },
        { status: 403 }
      ),
    };
  }

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, tenant_id, project_manager_id, created_by, is_active, name, project_number, status, kicked_off_at"
    )
    .eq("id", projectId)
    .eq("tenant_id", user.tenantId)
    .maybeSingle();

  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Project not found" }, { status: 404 }),
    };
  }

  if (!canReadProject(access, project, user.id)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Project not found" }, { status: 404 }),
    };
  }

  if (mode === "write" && !canWriteProject(access, project, user.id)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You do not have permission to change this project" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, project, access };
}
