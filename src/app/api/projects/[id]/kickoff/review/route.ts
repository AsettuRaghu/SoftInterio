/**
 * The first tick on the kick-off checklist: "I have read what Sales handed
 * over." Recorded with who and when, because the hand-off between sales and
 * delivery is exactly the kind of thing that later gets argued about.
 *
 *   POST /api/projects/:id/kickoff/review
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = requestLogger(request);
  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    if (gate.project.kicked_off_at) {
      return NextResponse.json({ error: "This project has already been kicked off" }, { status: 409 });
    }

    const { error } = await supabase
      .from("projects")
      .update({
        handover_reviewed_at: new Date().toISOString(),
        handover_reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      log.error("Could not record handover review", error, { projectId: id });
      return NextResponse.json({ error: "Could not record the review" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Handover review failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
