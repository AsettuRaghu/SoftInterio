import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  requireProjectAccess,
  requirePhaseLineage,
} from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{
    id: string;
    phaseId: string;
    subPhaseId: string;
    itemId: string;
  }>;
}

// PATCH - Update checklist item (toggle completion, edit name, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id, itemId } = await params;
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
      checklistItemId: itemId,
    });
    if (!lineage.ok) return lineage.response;

    const body = await request.json();
    const { name, is_completed, notes } = body;

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (notes !== undefined) updateData.notes = notes;
    if (is_completed !== undefined) {
      updateData.is_completed = is_completed;
      if (is_completed) {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user.id;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }
    }

    const { data: item, error } = await supabase
      .from("project_checklist_items")
      .update(updateData)
      .eq("id", itemId)
      .select(
        `
        *,
        completed_by_user:users!completed_by(id, name)
      `
      )
      .single();

    if (error) {
      log.error("Error updating checklist item", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ checklist_item: item });
  } catch (error) {
    log.error("Checklist API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete checklist item
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id, itemId } = await params;
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
      checklistItemId: itemId,
    });
    if (!lineage.ok) return lineage.response;

    const { error } = await supabase
      .from("project_checklist_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      log.error("Error deleting checklist item", error);
      return NextResponse.json({ error: "Request failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Checklist API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
