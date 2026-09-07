import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";
import {
  logProjectActivity,
  logNoteChange,
  noteExcerpt,
} from "@/lib/activity/log";

interface RouteParams {
  params: Promise<{ id: string; noteId: string }>;
}

// GET - Get a single note
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id: projectId, noteId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId,
      user,
      permissions: guard.permissions,
      mode: "read",
    });
    if (!gate.ok) return gate.response;

    const { data: note, error } = await supabase
      .from("project_notes")
      .select("*")
      .eq("id", noteId)
      .eq("project_id", projectId)
      .single();

    if (error || !note) {
      // If table doesn't exist, return gracefully
      if (error?.code === "PGRST205" || error?.message?.includes("Could not find the table")) {
        return NextResponse.json({ error: "Note not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    log.error("Error in GET /api/projects/[id]/notes/[noteId]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update a note
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId, noteId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const body = await request.json();
    const { title, content, category, is_pinned, follow_up_at, follow_up_done } =
      body;

    // Build update object. updated_at was never set here, so an edited
    // project note kept its original timestamp - the Updated column would
    // have shown stale data.
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned;
    if (follow_up_at !== undefined) {
      updateData.follow_up_at = follow_up_at || null;
      // Rescheduling revives a resolved follow-up; otherwise the new date
      // would sit on a done note and never surface.
      if (follow_up_at) {
        updateData.follow_up_done_at = null;
        updateData.follow_up_done_by = null;
      }
    }
    if (follow_up_done !== undefined) {
      updateData.follow_up_done_at = follow_up_done
        ? new Date().toISOString()
        : null;
      updateData.follow_up_done_by = follow_up_done ? user.id : null;
    }

    // Prior state, needed to describe the edit on the timeline.
    const { data: before } = await supabase
      .from("project_notes")
      .select("content, follow_up_at, follow_up_done_at")
      .eq("id", noteId)
      .eq("project_id", projectId)
      .maybeSingle();

    const { data: note, error } = await supabase
      .from("project_notes")
      .update(updateData)
      .eq("id", noteId)
      .eq("project_id", projectId)
      .select("*")
      .single();

    if (error) {
      log.error("Error updating note", error);
      return NextResponse.json(
        { error: "Failed to update note" },
        { status: 500 }
      );
    }

    if (before) {
      // Wording lives in @/lib/activity/log so lead and project notes read the
      // same way on their respective timelines.
      await logNoteChange(
        (entry) =>
          logProjectActivity(supabase, {
            ...entry,
            projectId,
            userId: user.id,
            linkedNoteId: note.id,
          }),
        { before, after: note }
      );
    }

    return NextResponse.json({ note });
  } catch (error) {
    log.error("Error in PATCH /api/projects/[id]/notes/[noteId]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a note
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId, noteId } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    // Read the note before deleting it - afterwards there is nothing left to
    // describe on the timeline.
    const { data: existing } = await supabase
      .from("project_notes")
      .select("content")
      .eq("id", noteId)
      .eq("project_id", projectId)
      .maybeSingle();

    const { error } = await supabase
      .from("project_notes")
      .delete()
      .eq("id", noteId)
      .eq("project_id", projectId);

    if (error) {
      log.error("Error deleting note", error);
      return NextResponse.json(
        { error: "Failed to delete note" },
        { status: 500 }
      );
    }

    if (existing) {
      await logProjectActivity(supabase, {
        projectId,
        userId: user.id,
        type: "note_deleted",
        title: "Note deleted",
        description: noteExcerpt(existing.content || ""),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error in DELETE /api/projects/[id]/notes/[noteId]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
