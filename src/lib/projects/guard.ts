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
 * Almost all of the project API hangs off /api/projects/[id]/... - phases,
 * sub-phases, checklists, comments, attachments, approvals, notes, activities,
 * payment milestones. Before this, those handlers proved only that a session
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
      "id, tenant_id, project_manager_id, created_by, is_active, name, project_number"
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

/**
 * Confirms a phase, sub-phase and checklist item really hang off the project
 * named in the URL.
 *
 * requireProjectAccess proves the caller may touch /api/projects/<id>. It says
 * nothing about the ids further along the path, and the handlers took those on
 * trust: the checklist route, for instance, read subPhaseId straight out of
 * the URL and never mentioned the project at all. Pairing an id you are
 * allowed to open with a sub-phase id you are not would have read and written
 * another business's checklist, because none of these tables carries a
 * tenant_id to fall back on - they are three joins from one.
 *
 * Anything that does not belong to the chain is reported as missing, for the
 * same reason as above: a distinct error would confirm the row exists.
 */
export async function requirePhaseLineage(
  supabase: SupabaseClient,
  args: {
    projectId: string;
    phaseId?: string;
    subPhaseId?: string;
    checklistItemId?: string;
  }
): Promise<{ ok: true } | ProjectGuardFailed> {
  const { projectId, phaseId, subPhaseId, checklistItemId } = args;

  const notFound: ProjectGuardFailed = {
    ok: false,
    response: NextResponse.json({ error: "Not found" }, { status: 404 }),
  };

  let expectedPhaseId = phaseId;

  if (phaseId) {
    const { data: phase } = await supabase
      .from("project_phases")
      .select("id")
      .eq("id", phaseId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!phase) return notFound;
  }

  if (subPhaseId) {
    const { data: subPhase } = await supabase
      .from("project_sub_phases")
      .select("id, project_phase_id")
      .eq("id", subPhaseId)
      .maybeSingle();
    if (!subPhase) return notFound;

    if (expectedPhaseId) {
      if (subPhase.project_phase_id !== expectedPhaseId) return notFound;
    } else {
      // No phase in the path, so walk up one level to reach the project.
      const { data: parent } = await supabase
        .from("project_phases")
        .select("id")
        .eq("id", subPhase.project_phase_id)
        .eq("project_id", projectId)
        .maybeSingle();
      if (!parent) return notFound;
      expectedPhaseId = subPhase.project_phase_id;
    }
  }

  if (checklistItemId) {
    const { data: item } = await supabase
      .from("project_checklist_items")
      .select("id")
      .eq("id", checklistItemId)
      .eq("project_sub_phase_id", subPhaseId ?? "")
      .maybeSingle();
    if (!item) return notFound;
  }

  return { ok: true };
}
