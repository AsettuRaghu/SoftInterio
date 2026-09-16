/**
 * Change a project's status - the only way after kick-off.
 *
 *   POST /api/projects/:id/status
 *   { status, note, hold_owner?, hold_reason_code?, hold_expected_until? }
 *
 * Hands everything to project_transition(), which holds the rules (which
 * moves exist, what a hold needs, what completion needs), the cascades (a
 * hold stops running steps, a cancel cancels the run, a reopen revives it)
 * and the timeline entry, in one transaction. A refusal comes back as 409
 * with the function's own sentence. new -> in_progress is kick-off and is
 * not accepted here.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

const STATUSES = new Set(["in_progress", "on_hold", "completed", "cancelled"]);
const OWNERS = new Set(["client", "vendor", "internal", "third_party"]);

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

    const body = await request.json().catch(() => ({}));
    const status = String(body.status ?? "");
    if (!STATUSES.has(status)) {
      return NextResponse.json(
        { error: "status must be in_progress, on_hold, completed or cancelled" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("project_transition", {
      p_project_id: id,
      p_user_id: user.id,
      p_to: status,
      p_note: typeof body.note === "string" ? body.note.trim() : "",
      p_hold_owner: OWNERS.has(body.hold_owner) ? body.hold_owner : null,
      p_hold_reason_code: typeof body.hold_reason_code === "string" && body.hold_reason_code ? body.hold_reason_code : null,
      p_hold_expected_until:
        typeof body.hold_expected_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.hold_expected_until)
          ? body.hold_expected_until
          : null,
    });

    if (error) {
      log.error("project_transition failed", error, { projectId: id, status });
      return NextResponse.json({ error: "Could not change the project's status" }, { status: 500 });
    }
    const result = data as { success: boolean; error?: string; reason?: string };
    if (!result.success) {
      return NextResponse.json({ error: result.error, reason: result.reason }, { status: 409 });
    }
    log.info("Project status changed", { projectId: id, status });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    log.error("Project status change failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
