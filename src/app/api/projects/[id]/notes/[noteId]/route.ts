import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string; noteId: string }>;
}

// GET - Get a single note
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: projectId, noteId } = await params;
    const supabase = await createClient();

    const { data: note, error } = await supabase
      .from("project_notes")
      .select(
        `
        *,
        created_by_user:profiles!project_notes_created_by_fkey(id, name, avatar_url),
        phase:project_phases!project_notes_phase_id_fkey(id, name)
      `
      )
      .eq("id", noteId)
      .eq("project_id", projectId)
      .single();

    if (error || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Error in GET /api/projects/[id]/notes/[noteId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update a note
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId, noteId } = await params;
    const supabase = await createClient();

    const body = await request.json();
    const { title, content, phase_id, sub_phase_id, category, is_pinned } =
      body;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (phase_id !== undefined) updateData.phase_id = phase_id;
    if (sub_phase_id !== undefined) updateData.sub_phase_id = sub_phase_id;
    if (category !== undefined) updateData.category = category;
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned;

    const { data: note, error } = await supabase
      .from("project_notes")
      .update(updateData)
      .eq("id", noteId)
      .eq("project_id", projectId)
      .select(
        `
        *,
        created_by_user:profiles!project_notes_created_by_fkey(id, name, avatar_url),
        phase:project_phases!project_notes_phase_id_fkey(id, name)
      `
      )
      .single();

    if (error) {
      console.error("Error updating note:", error);
      return NextResponse.json(
        { error: "Failed to update note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Error in PATCH /api/projects/[id]/notes/[noteId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a note
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: projectId, noteId } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("project_notes")
      .delete()
      .eq("id", noteId)
      .eq("project_id", projectId);

    if (error) {
      console.error("Error deleting note:", error);
      return NextResponse.json(
        { error: "Failed to delete note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/projects/[id]/notes/[noteId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
