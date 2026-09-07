import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  requireProjectAccess,
  requirePhaseLineage,
} from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

// GET /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/approvals
export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; phaseId: string; subPhaseId: string }> }
) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id: projectId, phaseId, subPhaseId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId,
      user,
      permissions: guard.permissions,
      mode: "read",
    });
    if (!gate.ok) return gate.response;

    const lineage = await requirePhaseLineage(supabase, {
      projectId,
      phaseId,
      subPhaseId,
    });
    if (!lineage.ok) return lineage.response;

    const { data: approvals, error } = await supabase
      .from("project_phase_approvals")
      .select(
        `
        *,
        requested_by:users!project_phase_approvals_requested_by_fkey(id, name),
        approver:users!project_phase_approvals_approver_id_fkey(id, name)
      `
      )
      .eq("project_sub_phase_id", subPhaseId)
      .order("requested_at", { ascending: false });

    if (error) {
      log.error("Error fetching approvals", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ approvals });
  } catch (error) {
    log.error("Error in get approvals API", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/approvals
// Request approval
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; phaseId: string; subPhaseId: string }> }
) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId, phaseId, subPhaseId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const lineage = await requirePhaseLineage(supabase, {
      projectId,
      phaseId,
      subPhaseId,
    });
    if (!lineage.ok) return lineage.response;

    const body = await request.json();
    const { request_notes, approver_id, approver_role } = body;

    // Create approval request
    const { data: approval, error } = await supabase
      .from("project_phase_approvals")
      .insert({
        project_id: projectId,
        project_sub_phase_id: subPhaseId,
        requested_by: user.id,
        request_notes: request_notes || null,
        approver_id: approver_id || null,
        approver_role: approver_role || "client",
        status: "pending",
      })
      .select(
        `
        *,
        requested_by:users!project_phase_approvals_requested_by_fkey(id, name)
      `
      )
      .single();

    if (error) {
      log.error("Error creating approval", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    // Log activity
    await supabase.from("project_phase_activity_log").insert({
      project_id: projectId,
      project_phase_id: phaseId,
      project_sub_phase_id: subPhaseId,
      activity_type: "approval_requested",
      description: "Approval requested",
      new_value: { approval_id: approval.id },
      performed_by: user.id,
    });

    return NextResponse.json({ success: true, approval });
  } catch (error) {
    log.error("Error in create approval API", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/approvals
// Respond to approval (approve/reject)
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; phaseId: string; subPhaseId: string }> }
) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id: projectId, phaseId, subPhaseId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const lineage = await requirePhaseLineage(supabase, {
      projectId,
      phaseId,
      subPhaseId,
    });
    if (!lineage.ok) return lineage.response;


    const body = await request.json();
    const { approval_id, status, response_notes } = body;

    if (!approval_id) {
      return NextResponse.json(
        { error: "approval_id is required" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected", "revision_requested"].includes(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Must be approved, rejected, or revision_requested",
        },
        { status: 400 }
      );
    }

    // Update approval
    const { data: approval, error } = await supabase
      .from("project_phase_approvals")
      .update({
        status: status,
        response_notes: response_notes || null,
        responded_at: new Date().toISOString(),
        approver_id: user.id,
      })
      .eq("id", approval_id)
      .select(
        `
        *,
        requested_by:users!project_phase_approvals_requested_by_fkey(id, name),
        approver:users!project_phase_approvals_approver_id_fkey(id, name)
      `
      )
      .single();

    if (error) {
      log.error("Error updating approval", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    // Log activity
    await supabase.from("project_phase_activity_log").insert({
      project_id: projectId,
      project_phase_id: phaseId,
      project_sub_phase_id: subPhaseId,
      activity_type:
        status === "approved" ? "approval_granted" : "approval_response",
      description: `Approval ${status}`,
      new_value: { approval_id: approval.id, status },
      performed_by: user.id,
    });

    return NextResponse.json({ success: true, approval });
  } catch (error) {
    log.error("Error in update approval API", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
