import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  requireProjectAccess,
  requirePhaseLineage,
} from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{ id: string; phaseId: string; subPhaseId: string }>;
}

// GET - Get all checklist items for a sub-phase
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id, subPhaseId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "read",
    });
    if (!gate.ok) return gate.response;

    const lineage = await requirePhaseLineage(supabase, {
      projectId: id,
      subPhaseId,
    });
    if (!lineage.ok) return lineage.response;

    const { data: items, error } = await supabase
      .from("project_checklist_items")
      .select(
        `
        *,
        completed_by_user:users!completed_by(id, name)
      `
      )
      .eq("project_sub_phase_id", subPhaseId)
      .order("display_order", { ascending: true });

    if (error) {
      log.error("Error fetching checklist items", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ checklist_items: items || [] });
  } catch (error) {
    log.error("Checklist API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Add checklist item
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id, subPhaseId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const lineage = await requirePhaseLineage(supabase, {
      projectId: id,
      subPhaseId,
    });
    if (!lineage.ok) return lineage.response;

    const body = await request.json();
    const { name, notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Checklist item name is required" },
        { status: 400 }
      );
    }

    // Get max display_order
    const { data: maxOrder } = await supabase
      .from("project_checklist_items")
      .select("display_order")
      .eq("project_sub_phase_id", subPhaseId)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const display_order = (maxOrder?.display_order || 0) + 1;

    const { data: item, error } = await supabase
      .from("project_checklist_items")
      .insert({
        project_sub_phase_id: subPhaseId,
        name,
        notes,
        display_order,
      })
      .select()
      .single();

    if (error) {
      log.error("Error creating checklist item", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ checklist_item: item }, { status: 201 });
  } catch (error) {
    log.error("Checklist API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
