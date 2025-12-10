import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// POST /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/skip
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

    // Get reason from body
    const body = await request.json();
    const reason = body.reason;

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json(
        { error: "Reason is required to skip a sub-phase" },
        { status: 400 }
      );
    }

    // Call the skip_sub_phase function
    const { data, error } = await supabase.rpc("skip_sub_phase", {
      p_sub_phase_id: subPhaseId,
      p_user_id: user.id,
      p_reason: reason.trim(),
    });

    if (error) {
      console.error("Error skipping sub-phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check if the function returned an error
    if (data && !data.success) {
      return NextResponse.json(
        { error: data.reason || "Cannot skip sub-phase", details: data },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error in skip sub-phase API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
