import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { logLeadActivity, noteExcerpt } from "@/lib/activity/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sales/leads/[id]/notes - Get lead notes
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const { data: notes, error } = await supabase
      .from("lead_notes")
      .select(
        `
        *,
        created_user:users!lead_notes_created_by_fkey(id, name, avatar_url)
      `
      )
      .eq("lead_id", id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes:", error);
      return NextResponse.json(
        { error: "Failed to fetch notes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (error) {
    console.error("Get notes API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/sales/leads/[id]/notes - Add a note
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    // follow_up_at turns a note into a scheduled next contact. The note text
    // is the reason, so there is no separate reason field.
    const { content, is_pinned, follow_up_at } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Verify lead exists
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, tenant_id")
      .eq("id", id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Create note
    const { data: note, error: createError } = await supabase
      .from("lead_notes")
      .insert({
        lead_id: id,
        content: content.trim(),
        is_pinned: is_pinned || false,
        created_by: user.id,
        follow_up_at: follow_up_at || null,
      })
      .select(
        `
        *,
        created_user:users!lead_notes_created_by_fkey(id, name, avatar_url)
      `
      )
      .single();

    if (createError) {
      console.error("Error creating note:", createError);
      return NextResponse.json(
        { error: "Failed to create note" },
        { status: 500 }
      );
    }

    const activity = {
      leadId: id,
      tenantId: lead.tenant_id,
      userId: user.id,
      // Links the entry back to its note, so the timeline can navigate to it.
      linkedNoteId: note.id,
    };

    await logLeadActivity(supabase, {
      ...activity,
      type: "note_added",
      title: "Note added",
      description: noteExcerpt(content),
    });

    // A note created with a follow-up is two things happening at once. The
    // reminder gets its own entry so it appears alongside every other
    // follow-up event rather than being buried in the note.
    if (follow_up_at) {
      await logLeadActivity(supabase, {
        ...activity,
        type: "follow_up_scheduled",
        title: "Follow-up scheduled",
        description: `Due ${follow_up_at}`,
      });
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Create note API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
