import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  logLeadActivity,
  logNoteChange,
  noteExcerpt,
} from "@/lib/activity/log";

/**
 * Lead note update / delete.
 *
 * These handlers previously used a bare supabase.auth.getUser(), which only
 * proves a session exists. It does not check whether the account has since
 * been disabled or removed from the tenant, so a deactivated user holding a
 * valid token could still edit and delete notes. protectApiRoute() covers all
 * three (auth, account status, tenant membership).
 *
 * Cross-tenant access was already blocked by RLS on lead_notes, which scopes
 * through leads.tenant_id. The existence check below is belt-and-braces and
 * turns an invisible note into a clean 404 instead of a 500.
 */


interface RouteParams {
  params: Promise<{ noteId: string }>;
}

/**
 * PostgREST returns an embedded to-one relation as an object, but types it (and
 * sometimes returns it) as an array. Normalise both shapes.
 */
function tenantOf(row: any): string {
  const lead = Array.isArray(row?.lead) ? row.lead[0] : row?.lead;
  return lead?.tenant_id;
}

/**
 * Binds the shared note-change describer to this lead's timeline. The wording
 * lives in @/lib/activity/log so lead and project notes stay in step.
 */
async function logNoteUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: { existing: any; note: any; userId: string }
) {
  const { existing, note, userId } = args;
  await logNoteChange(
    (entry) =>
      logLeadActivity(supabase, {
        ...entry,
        leadId: existing.lead_id,
        tenantId: tenantOf(existing),
        userId,
        linkedNoteId: note.id,
      }),
    { before: existing, after: note }
  );
}

// PATCH /api/sales/leads/notes/[noteId] - Update a note
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { noteId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // A follow-up-only edit (reschedule, or mark it dealt with) leaves the
    // content untouched, so content is only required when it is being changed.
    const editsContent = "content" in body;
    const editsFollowUp =
      "follow_up_at" in body || "follow_up_done" in body;
    const editsPin = "is_pinned" in body;

    if (!editsContent && !editsFollowUp && !editsPin) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    if (editsContent && (typeof body.content !== "string" || !body.content.trim())) {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      );
    }

    // RLS hides notes outside the caller's tenant, so a miss here means
    // "not found or not yours" - both answer with 404.
    const { data: existing } = await supabase
      .from("lead_notes")
      .select("id, lead_id, content, follow_up_at, follow_up_done_at, lead:leads!inner(tenant_id)")
      .eq("id", noteId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (editsContent) update.content = body.content.trim();
    if (editsPin) update.is_pinned = !!body.is_pinned;
    if ("follow_up_at" in body) {
      update.follow_up_at = body.follow_up_at || null;
      // Rescheduling revives a follow-up that had been dealt with, otherwise
      // the new date would be set on an already-resolved note and never show.
      if (body.follow_up_at) {
        update.follow_up_done_at = null;
        update.follow_up_done_by = null;
      }
    }
    if ("follow_up_done" in body) {
      update.follow_up_done_at = body.follow_up_done
        ? new Date().toISOString()
        : null;
      update.follow_up_done_by = body.follow_up_done ? user.id : null;
    }

    const { data: note, error } = await supabase
      .from("lead_notes")
      .update(update)
      .eq("id", noteId)
      .select()
      .single();

    if (error) {
      console.error("Error updating note:", error);
      return NextResponse.json(
        { error: "Failed to update note" },
        { status: 500 }
      );
    }

    await logNoteUpdate(supabase, { existing, note, userId: user.id });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("Error updating note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/sales/leads/notes/[noteId] - Delete a note
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { noteId } = await params;
    const supabase = await createClient();

    // Read the note before deleting it - afterwards there is nothing left to
    // describe on the timeline.
    const { data: existing } = await supabase
      .from("lead_notes")
      .select("id, lead_id, content, lead:leads!inner(tenant_id)")
      .eq("id", noteId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("lead_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      console.error("Error deleting note:", error);
      return NextResponse.json(
        { error: "Failed to delete note" },
        { status: 500 }
      );
    }

    await logLeadActivity(supabase, {
      leadId: existing.lead_id,
      tenantId: tenantOf(existing),
      userId: guard.user.id,
      type: "note_deleted",
      title: "Note deleted",
      description: noteExcerpt(existing.content || ""),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
