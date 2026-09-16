/**
 * What the project is waiting on someone else for.
 *
 *   GET  /api/projects/:id/dependencies
 *   POST /api/projects/:id/dependencies   { owner_type, description, expected_by?, counterpart?, blocks_task_id? }
 *
 * A row per thing the client, a vendor or a third party must do. Rows for
 * playbook steps marked client/vendor are raised by a trigger when the task
 * is created; POST is for anything ad hoc ("society NOC", "lift booking").
 *
 * An ad-hoc ask may name the step it holds up (`blocks_task_id`). Raising it
 * then holds that step until the expected date - blocked if it has not
 * started, paused if it has - through task_transition, so the plan re-lays
 * from it like any other hold. That is how a delay nobody foresaw gets onto
 * the timeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";
import { logProjectActivity } from "@/lib/activity/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const OWNERS = new Set(["client", "vendor"]);

export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);
  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
    const { id } = await params;
    const supabase = await createClient();
    const gate = await requireProjectAccess(supabase, {
      projectId: id, user: guard.user, permissions: guard.permissions, mode: "read",
    });
    if (!gate.ok) return gate.response;

    const { data, error } = await supabase
      .from("project_dependencies")
      .select("*")
      .eq("project_id", id)
      .order("resolved_at", { ascending: true, nullsFirst: true })
      .order("expected_by", { ascending: true, nullsFirst: false });
    if (error) {
      log.error("Could not load dependencies", error, { projectId: id });
      return NextResponse.json({ error: "Could not load the waiting-on list" }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    log.error("Dependencies GET failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);
  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const gate = await requireProjectAccess(supabase, {
      projectId: id, user, permissions: guard.permissions, mode: "write",
    });
    if (!gate.ok) return gate.response;

    const body = await request.json().catch(() => ({}));
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const owner_type = body.owner_type;
    if (!description) return NextResponse.json({ error: "Say what is needed" }, { status: 400 });
    if (!OWNERS.has(owner_type)) {
      return NextResponse.json({ error: "owner_type must be client or vendor" }, { status: 400 });
    }

    // The step it holds up, if any - must be this project's, and open.
    let blocks: { id: string; status: string; title: string } | null = null;
    if (typeof body.blocks_task_id === "string" && body.blocks_task_id) {
      const { data: step } = await supabase
        .from("tasks")
        .select("id, status, title, related_type, related_id")
        .eq("id", body.blocks_task_id)
        .eq("related_type", "project")
        .eq("related_id", id)
        .maybeSingle();
      if (!step) return NextResponse.json({ error: "That step is not on this project" }, { status: 400 });
      if (["completed", "skipped", "cancelled"].includes(step.status)) {
        return NextResponse.json({ error: `"${step.title}" is already ${step.status}` }, { status: 409 });
      }
      blocks = step;
    }

    const { data, error } = await supabase
      .from("project_dependencies")
      .insert({
        project_id: id,
        owner_type,
        description,
        counterpart: body.counterpart?.trim() || null,
        expected_by: body.expected_by || null,
        expected_by_set_by_hand: !!body.expected_by,
        raised_by: user.id,
        blocks_task_id: blocks?.id ?? null,
      })
      .select("*")
      .single();
    if (error || !data) {
      log.error("Could not add dependency", error, { projectId: id });
      return NextResponse.json({ error: "Could not add it to the list" }, { status: 500 });
    }

    // Hold the step it names. A step not yet started is blocked; one under
    // way is paused. Either way the hold carries the ask's owner, an "other"
    // reason, the ask as the note, and the expected date - so the scheduler
    // pushes everything after it, and the delay log knows who to count it
    // against.
    let held: string | null = null;
    if (blocks && ["todo", "in_progress"].includes(blocks.status)) {
      const { data: t } = await supabase.rpc("task_transition", {
        p_task_id: blocks.id,
        p_user_id: user.id,
        p_to: blocks.status === "todo" ? "blocked" : "on_hold",
        p_reason: description,
        p_hold_owner: owner_type,
        p_hold_reason_code: `other_${owner_type}`,
        p_hold_expected_until: body.expected_by || null,
        p_hold_counterpart: body.counterpart?.trim() || null,
      });
      const r = t as { success?: boolean; error?: string } | null;
      held = r?.success ? blocks.title : null;
      if (!r?.success) log.warn("Ask raised but the step could not be held", { projectId: id, taskId: blocks.id, error: r?.error });
    }

    await logProjectActivity(supabase, {
      projectId: id,
      userId: user.id,
      type: "dependency_raised",
      title: `Waiting on ${owner_type}: ${description}`,
      description: [
        body.expected_by ? `Expected by ${body.expected_by}` : null,
        held ? `Holds up "${held}"` : null,
      ].filter(Boolean).join(". ") || null,
    });

    return NextResponse.json({ success: true, data: { ...data, held_step: held } }, { status: 201 });
  } catch (error) {
    log.error("Dependencies POST failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
