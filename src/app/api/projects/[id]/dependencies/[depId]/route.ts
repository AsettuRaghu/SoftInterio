/**
 * One entry on the waiting-on list.
 *
 *   PATCH  /api/projects/:id/dependencies/:depId   { expected_by?, counterpart?, description?, resolved? }
 *   DELETE /api/projects/:id/dependencies/:depId   (ad-hoc entries only)
 *
 * `resolved: true` marks it done by hand - the PM confirming the client did
 * their part. An entry tied to a playbook step is settled by the step itself,
 * and cannot be deleted here: the step is the record.
 *
 * The row is always looked up by project as well as id, so a dependency id
 * from another project cannot be edited through this URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";
import { logProjectActivity } from "@/lib/activity/log";

interface RouteParams {
  params: Promise<{ id: string; depId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);
  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
    const { user } = guard;
    const { id, depId } = await params;
    const supabase = await createClient();
    const gate = await requireProjectAccess(supabase, {
      projectId: id, user, permissions: guard.permissions, mode: "write",
    });
    if (!gate.ok) return gate.response;

    const { data: existing } = await supabase
      .from("project_dependencies")
      .select("id, task_id, description, owner_type, resolved_at, blocks_task_id")
      .eq("id", depId)
      .eq("project_id", id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const update: Record<string, unknown> = {};
    if ("expected_by" in body) {
      update.expected_by = body.expected_by || null;
      // A date a person sets stops following the step's planned date.
      update.expected_by_set_by_hand = !!body.expected_by;
    }
    if ("counterpart" in body) update.counterpart = body.counterpart?.trim() || null;
    if ("description" in body && !existing.task_id) {
      const d = String(body.description ?? "").trim();
      if (!d) return NextResponse.json({ error: "Say what is needed" }, { status: 400 });
      update.description = d;
    }
    if (body.resolved === true && !existing.resolved_at) {
      update.resolved_at = new Date().toISOString();
      update.resolved_by = user.id;
    } else if (body.resolved === false && existing.resolved_at) {
      update.resolved_at = null;
      update.resolved_by = null;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("project_dependencies")
      .update(update)
      .eq("id", depId)
      .eq("project_id", id)
      .select("*")
      .single();
    if (error || !data) {
      log.error("Could not update dependency", error, { projectId: id, depId });
      return NextResponse.json({ error: "Could not save the change" }, { status: 500 });
    }

    // Delivered: a step that was only waiting to start is released. One that
    // had been paused stays paused - whoever picks it up resumes it.
    if (update.resolved_at && existing.blocks_task_id) {
      const { data: step } = await supabase
        .from("tasks")
        .select("id, status")
        .eq("id", existing.blocks_task_id)
        .maybeSingle();
      if (step?.status === "blocked") {
        await supabase.rpc("task_transition", {
          p_task_id: step.id,
          p_user_id: user.id,
          p_to: "todo",
          p_reason: null,
          p_hold_owner: null,
          p_hold_reason_code: null,
          p_hold_expected_until: null,
          p_hold_counterpart: null,
        });
      }
    }

    if (update.resolved_at) {
      await logProjectActivity(supabase, {
        projectId: id,
        userId: user.id,
        type: "dependency_resolved",
        title: `${existing.owner_type === "client" ? "Client" : "Vendor"} delivered: ${existing.description}`,
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    log.error("Dependency PATCH failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);
  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
    const { id, depId } = await params;
    const supabase = await createClient();
    const gate = await requireProjectAccess(supabase, {
      projectId: id, user: guard.user, permissions: guard.permissions, mode: "write",
    });
    if (!gate.ok) return gate.response;

    const { data: existing } = await supabase
      .from("project_dependencies")
      .select("id, task_id")
      .eq("id", depId)
      .eq("project_id", id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.task_id) {
      return NextResponse.json(
        { error: "This comes from a playbook step. Skip or cancel the step instead." },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("project_dependencies")
      .delete()
      .eq("id", depId)
      .eq("project_id", id);
    if (error) {
      log.error("Could not delete dependency", error, { projectId: id, depId });
      return NextResponse.json({ error: "Could not remove it" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Dependency DELETE failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
