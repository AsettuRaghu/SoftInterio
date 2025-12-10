import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// POST /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/start
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; phaseId: string; subPhaseId: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId, phaseId, subPhaseId } = await params;
    const supabase = await createClient();

    // Check if sub-phase has an assignee
    const { data: subPhase, error: fetchError } = await supabase
      .from("project_sub_phases")
      .select("id, name, assigned_to, status")
      .eq("id", subPhaseId)
      .single();

    if (fetchError || !subPhase) {
      return NextResponse.json(
        { error: "Sub-phase not found" },
        { status: 404 }
      );
    }

    // VALIDATION: Cannot start without an assignee
    if (!subPhase.assigned_to) {
      return NextResponse.json(
        {
          error: "Cannot start sub-phase without an assignee",
          reason: "Please assign someone to this sub-phase before starting it.",
          can_start: false,
        },
        { status: 400 }
      );
    }

    // Call the start_sub_phase function
    const { data, error } = await supabase.rpc("start_sub_phase", {
      p_sub_phase_id: subPhaseId,
      p_user_id: user.id,
    });

    if (error) {
      console.error("Error starting sub-phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check if the function returned an error
    if (data && !data.success && !data.can_start) {
      return NextResponse.json(
        { error: data.reason || "Cannot start sub-phase", details: data },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error in start sub-phase API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
