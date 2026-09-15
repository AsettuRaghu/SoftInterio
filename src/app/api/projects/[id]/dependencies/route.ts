/**
 * What the project is waiting on someone else for.
 *
 *   GET  /api/projects/:id/dependencies
 *   POST /api/projects/:id/dependencies   { owner_type, description, expected_by?, counterpart? }
 *
 * A row per thing the client, a vendor or a third party must do. Rows for
 * playbook steps marked client/vendor are raised by a trigger when the task
 * is created; POST is for anything ad hoc ("society NOC", "lift booking").
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

    const { data, error } = await supabase
      .from("project_dependencies")
      .insert({
        project_id: id,
        owner_type,
        description,
        counterpart: body.counterpart?.trim() || null,
        expected_by: body.expected_by || null,
        raised_by: user.id,
      })
      .select("*")
      .single();
    if (error || !data) {
      log.error("Could not add dependency", error, { projectId: id });
      return NextResponse.json({ error: "Could not add it to the list" }, { status: 500 });
    }

    await logProjectActivity(supabase, {
      projectId: id,
      userId: user.id,
      type: "dependency_raised",
      title: `Waiting on ${owner_type}: ${description}`,
      description: body.expected_by ? `Expected by ${body.expected_by}` : null,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    log.error("Dependencies POST failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
