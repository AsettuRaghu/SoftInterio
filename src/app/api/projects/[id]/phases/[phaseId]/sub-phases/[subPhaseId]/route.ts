import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string; phaseId: string; subPhaseId: string }>;
}

// GET /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId] - Get sub-phase details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: projectId, phaseId, subPhaseId } = await params;
    const supabase = await createClient();

    // Get sub-phase with related data
    const { data: subPhase, error } = await supabase
      .from("project_sub_phases")
      .select(
        `
        *,
        assigned_user:users!project_sub_phases_assigned_to_fkey(id, name, email),
        started_by_user:users!project_sub_phases_started_by_fkey(id, name),
        completed_by_user:users!project_sub_phases_completed_by_fkey(id, name),
        skipped_by_user:users!project_sub_phases_skipped_by_fkey(id, name),
        checklist_items:project_checklist_items(*)
      `
      )
      .eq("id", subPhaseId)
      .single();

    if (error) {
      console.error("Error fetching sub-phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get template data for instructions and can_skip
    const { data: template } = await supabase
      .from("project_sub_phase_templates")
      .select(
        "instructions, can_skip, action_type, required_role, completion_role, approval_role"
      )
      .eq("id", subPhase.sub_phase_template_id)
      .single();

    // Get attachments
    const { data: attachments } = await supabase
      .from("project_phase_attachments")
      .select(
        `
        *,
        uploaded_by:users!project_phase_attachments_uploaded_by_fkey(id, name)
      `
      )
      .eq("project_sub_phase_id", subPhaseId)
      .order("uploaded_at", { ascending: false });

    // Get comments
    const { data: comments } = await supabase
      .from("project_phase_comments")
      .select(
        `
        *,
        created_by:users!project_phase_comments_created_by_fkey(id, name)
      `
      )
      .eq("project_sub_phase_id", subPhaseId)
      .order("created_at", { ascending: false });

    // Get approvals
    const { data: approvals } = await supabase
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

    // Get status change logs (audit trail)
    const { data: statusLogs } = await supabase
      .from("project_phase_status_logs")
      .select(
        `
        *,
        changed_by_user:users!project_phase_status_logs_changed_by_fkey(id, name)
      `
      )
      .eq("sub_phase_id", subPhaseId)
      .order("changed_at", { ascending: false });

    // Format response
    const formattedSubPhase = {
      ...subPhase,
      instructions: template?.instructions || null,
      can_skip: template?.can_skip ?? true,
      action_type: subPhase.action_type || template?.action_type || "manual",
      assigned_to: subPhase.assigned_user,
      started_by: subPhase.started_by_user,
      completed_by: subPhase.completed_by_user,
      skipped_by: subPhase.skipped_by_user,
      attachments: attachments || [],
      comments: comments || [],
      approvals: approvals || [],
      status_logs: statusLogs || [],
    };

    return NextResponse.json({ subPhase: formattedSubPhase });
  } catch (error) {
    console.error("Sub-phase API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId] - Update sub-phase
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { subPhaseId } = await params;
    const supabase = await createClient();

    const body = await request.json();
    const {
      name,
      status,
      progress_percentage,
      progress_mode,
      assigned_to,
      due_date,
      planned_start_date,
      planned_end_date,
      actual_start_date,
      actual_end_date,
      notes,
      completed_at,
      additional_assignees,
      status_change_notes, // Required when status changes
    } = body;

    // Get current sub-phase to check for status change and assignment
    const { data: currentSubPhase, error: fetchError } = await supabase
      .from("project_sub_phases")
      .select("status, assigned_to")
      .eq("id", subPhaseId)
      .single();

    if (fetchError || !currentSubPhase) {
      return NextResponse.json(
        { error: "Sub-phase not found" },
        { status: 404 }
      );
    }

    const previousStatus = currentSubPhase.status;
    const statusChanging = status !== undefined && status !== previousStatus;

    // VALIDATION: Cannot start a sub-phase without an assignee
    if (status === "in_progress") {
      const effectiveAssignee =
        assigned_to !== undefined ? assigned_to : currentSubPhase.assigned_to;
      if (!effectiveAssignee) {
        return NextResponse.json(
          {
            error:
              "Cannot start sub-phase without an assignee. Please assign someone first.",
          },
          { status: 400 }
        );
      }
    }

    // VALIDATION: Status change requires notes
    if (statusChanging && !status_change_notes?.trim()) {
      return NextResponse.json(
        { error: "Status change requires notes explaining the reason." },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (status !== undefined) {
      updateData.status = status;
      // Auto-set completed info
      if (status === "completed") {
        updateData.completed_at = completed_at || new Date().toISOString();
        updateData.completed_by = user.id;
      } else if (status !== "completed") {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }
      // Auto-set actual_start_date when starting
      if (status === "in_progress" && !actual_start_date) {
        updateData.actual_start_date = new Date().toISOString().split("T")[0];
      }
      // Auto-set actual_end_date when completing
      if (status === "completed" && !actual_end_date) {
        updateData.actual_end_date = new Date().toISOString().split("T")[0];
      }
    }
    if (progress_percentage !== undefined)
      updateData.progress_percentage = progress_percentage;
    if (progress_mode !== undefined) updateData.progress_mode = progress_mode;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (planned_start_date !== undefined)
      updateData.planned_start_date = planned_start_date;
    if (planned_end_date !== undefined)
      updateData.planned_end_date = planned_end_date;
    if (actual_start_date !== undefined)
      updateData.actual_start_date = actual_start_date;
    if (actual_end_date !== undefined)
      updateData.actual_end_date = actual_end_date;
    if (notes !== undefined) updateData.notes = notes;

    // Update sub-phase
    const { data: subPhase, error } = await supabase
      .from("project_sub_phases")
      .update(updateData)
      .eq("id", subPhaseId)
      .select(
        `
        *,
        assigned_user:users!assigned_to(id, name, email, avatar_url)
      `
      )
      .single();

    if (error) {
      console.error("Error updating sub-phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log status change to status_logs table if status changed
    if (statusChanging && status_change_notes) {
      const { error: logError } = await supabase
        .from("project_phase_status_logs")
        .insert({
          sub_phase_id: subPhaseId,
          previous_status: previousStatus,
          new_status: status,
          notes: status_change_notes,
          changed_by: user.id,
        });

      if (logError) {
        console.error("Error logging status change:", logError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({ sub_phase: subPhase });
  } catch (error) {
    console.error("Sub-phase API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId] - Delete sub-phase
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { subPhaseId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("project_sub_phases")
      .delete()
      .eq("id", subPhaseId);

    if (error) {
      console.error("Error deleting sub-phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sub-phase API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
