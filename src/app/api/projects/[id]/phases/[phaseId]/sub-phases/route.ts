import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string; phaseId: string }>;
}

// GET /api/projects/[id]/phases/[phaseId]/sub-phases - Get all sub-phases
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { phaseId } = await params;
    const supabase = await createClient();

    const { data: subPhases, error } = await supabase
      .from("project_sub_phases")
      .select(
        `
        *,
        assigned_user:users!assigned_to(id, name, email, avatar_url),
        checklist_items:project_checklist_items(*)
      `
      )
      .eq("project_phase_id", phaseId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching sub-phases:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sub_phases: subPhases || [] });
  } catch (error) {
    console.error("Sub-phases API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/phases/[phaseId]/sub-phases - Add sub-phase
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { phaseId } = await params;
    const supabase = await createClient();

    const body = await request.json();
    const { name, assigned_to, due_date, notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Sub-phase name is required" },
        { status: 400 }
      );
    }

    // Get max display_order
    const { data: maxOrder } = await supabase
      .from("project_sub_phases")
      .select("display_order")
      .eq("project_phase_id", phaseId)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const display_order = (maxOrder?.display_order || 0) + 1;

    const { data: subPhase, error } = await supabase
      .from("project_sub_phases")
      .insert({
        project_phase_id: phaseId,
        name,
        assigned_to,
        due_date,
        notes,
        display_order,
      })
      .select(
        `
        *,
        assigned_user:users!assigned_to(id, name, email, avatar_url)
      `
      )
      .single();

    if (error) {
      console.error("Error creating sub-phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sub_phase: subPhase }, { status: 201 });
  } catch (error) {
    console.error("Sub-phases API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
