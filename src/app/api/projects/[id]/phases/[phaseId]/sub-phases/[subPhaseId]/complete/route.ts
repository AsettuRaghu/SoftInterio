import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// POST /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/complete
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

    // Get completion notes from body (required for status change)
    let notes: string | null = null;
    try {
      const body = await request.json();
      notes = body.notes || null;
    } catch {
      // No body provided
    }

    // VALIDATION: Completion requires notes
    if (!notes?.trim()) {
      return NextResponse.json(
        {
          error: "Completion notes are required",
          reason: "Please provide notes describing what was completed.",
          can_complete: false,
        },
        { status: 400 }
      );
    }

    // Call the complete_sub_phase function
    const { data, error } = await supabase.rpc("complete_sub_phase", {
      p_sub_phase_id: subPhaseId,
      p_user_id: user.id,
      p_notes: notes,
    });

    if (error) {
      console.error("Error completing sub-phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check if the function returned an error
    if (data && !data.success && !data.can_complete) {
      return NextResponse.json(
        { error: data.reason || "Cannot complete sub-phase", details: data },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error in complete sub-phase API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
