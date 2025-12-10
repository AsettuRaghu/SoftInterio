import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string; phaseId: string }>;
}

// GET /api/projects/[id]/phases/[phaseId] - Get single phase with details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id, phaseId } = await params;
    const supabase = await createClient();

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    // Fetch phase with sub-phases
    const { data: phase, error } = await supabase
      .from("project_phases")
      .select(
        `
        *,
        assigned_user:users!assigned_to(id, name, email, avatar_url),
        sub_phases:project_sub_phases(
          *,
          assigned_user:users!assigned_to(id, name, email, avatar_url),
          checklist_items:project_checklist_items(*)
        )
      `
      )
      .eq("id", phaseId)
      .eq("project_id", id)
      .single();

    if (error || !phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    // Fetch dependencies
    const { data: deps } = await supabase
      .from("project_phase_dependencies")
      .select(
        `
        depends_on_phase_id,
        dependency_type
      `
      )
      .eq("project_phase_id", phaseId);

    let dependencies: Array<{
      id: string;
      name: string;
      status: string;
      dependency_type: string;
    }> = [];

    if (deps && deps.length > 0) {
      const depPhaseIds = deps.map((d) => d.depends_on_phase_id);
      const { data: depPhases } = await supabase
        .from("project_phases")
        .select("id, name, status")
        .in("id", depPhaseIds);

      if (depPhases) {
        dependencies = deps.map((dep) => {
          const depPhase = depPhases.find(
            (p) => p.id === dep.depends_on_phase_id
          );
          return {
            id: dep.depends_on_phase_id,
            name: depPhase?.name || "Unknown",
            status: depPhase?.status || "unknown",
            dependency_type: dep.dependency_type,
          };
        });
      }
    }

    const blockingDeps = dependencies
      .filter((d) => d.dependency_type === "hard" && d.status !== "completed")
      .map((d) => d.name);

    return NextResponse.json({
      phase: {
        ...phase,
        dependencies,
        blocking_dependencies: blockingDeps,
        is_blocked: blockingDeps.length > 0,
      },
    });
  } catch (error) {
    console.error("Phase API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/phases/[phaseId] - Update phase
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id, phaseId } = await params;
    const supabase = await createClient();

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      status,
      progress_percentage,
      progress_mode,
      assigned_to,
      planned_start_date,
      planned_end_date,
      actual_start_date,
      actual_end_date,
      notes,
      status_change_notes, // Required when status changes
    } = body;

    // Get current phase to check status change and assignment
    const { data: currentPhase, error: fetchError } = await supabase
      .from("project_phases")
      .select("status, assigned_to")
      .eq("id", phaseId)
      .single();

    if (fetchError || !currentPhase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    const previousStatus = currentPhase.status;
    const statusChanging = status !== undefined && status !== previousStatus;

    // VALIDATION: Cannot start a phase without an assignee
    if (status === "in_progress") {
      const effectiveAssignee =
        assigned_to !== undefined ? assigned_to : currentPhase.assigned_to;
      if (!effectiveAssignee) {
        return NextResponse.json(
          {
            error:
              "Cannot start phase without an assignee. Please assign someone first.",
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

    // Check if trying to start a blocked phase
    if (status === "in_progress") {
      const { data: canStart } = await supabase.rpc("can_phase_start", {
        p_phase_id: phaseId,
      });

      if (canStart && !canStart[0]?.can_start) {
        const blockingPhases = canStart[0]?.blocking_phases || [];
        return NextResponse.json(
          {
            error: "Cannot start phase - blocked by dependencies",
            blocking_phases: blockingPhases,
          },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      updateData.status = status;
      // Auto-set actual dates
      if (status === "in_progress" && !actual_start_date) {
        updateData.actual_start_date = new Date().toISOString().split("T")[0];
      }
      if (status === "completed" && !actual_end_date) {
        updateData.actual_end_date = new Date().toISOString().split("T")[0];
      }
    }
    if (progress_percentage !== undefined)
      updateData.progress_percentage = progress_percentage;
    if (progress_mode !== undefined) updateData.progress_mode = progress_mode;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (planned_start_date !== undefined)
      updateData.planned_start_date = planned_start_date;
    if (planned_end_date !== undefined)
      updateData.planned_end_date = planned_end_date;
    if (actual_start_date !== undefined)
      updateData.actual_start_date = actual_start_date;
    if (actual_end_date !== undefined)
      updateData.actual_end_date = actual_end_date;
    if (notes !== undefined) updateData.notes = notes;

    const { data: phase, error } = await supabase
      .from("project_phases")
      .update(updateData)
      .eq("id", phaseId)
      .eq("project_id", id)
      .select(
        `
        *,
        assigned_user:users!assigned_to(id, name, email, avatar_url)
      `
      )
      .single();

    if (error) {
      console.error("Error updating phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log status change if status changed
    if (statusChanging && status_change_notes) {
      const { error: logError } = await supabase
        .from("project_phase_status_logs")
        .insert({
          phase_id: phaseId,
          previous_status: previousStatus,
          new_status: status,
          notes: status_change_notes,
          changed_by: user.id,
        });

      if (logError) {
        console.error("Error logging phase status change:", logError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({ phase });
  } catch (error) {
    console.error("Phase API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/phases/[phaseId] - Delete phase
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, phaseId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    // Check if any other phases depend on this one
    const { data: dependents } = await supabase
      .from("project_phase_dependencies")
      .select("project_phase_id")
      .eq("depends_on_phase_id", phaseId);

    if (dependents && dependents.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete phase - other phases depend on it" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("project_phases")
      .delete()
      .eq("id", phaseId)
      .eq("project_id", id);

    if (error) {
      console.error("Error deleting phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Phase API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
