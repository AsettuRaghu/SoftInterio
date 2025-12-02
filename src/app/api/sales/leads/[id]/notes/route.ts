import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sales/leads/[id]/notes - Get lead notes
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, is_pinned } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Verify lead exists
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id")
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

    // Create activity for the note
    await supabase.from("lead_activities").insert({
      lead_id: id,
      activity_type: "note_added",
      title: "Note added",
      description:
        content.trim().slice(0, 100) + (content.length > 100 ? "..." : ""),
      created_by: user.id,
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Create note API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
