import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/notes - Get project notes
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: notes, error } = await supabase
      .from("project_notes")
      .select("*")
      .eq("project_id", id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      // If table doesn't exist, return empty array gracefully
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        return NextResponse.json({ notes: [] });
      }
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

// POST /api/projects/[id]/notes - Add a note
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

    const { title, content, category, is_pinned } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Verify project exists and get tenant_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, tenant_id")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create note
    const { data: note, error: createError } = await supabase
      .from("project_notes")
      .insert({
        tenant_id: project.tenant_id,
        project_id: id,
        title: title?.trim() || null,
        content: content.trim(),
        category: category || "general",
        is_pinned: is_pinned || false,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (createError) {
      // If table doesn't exist, return graceful error
      if (createError.code === "PGRST205" || createError.message?.includes("Could not find the table")) {
        return NextResponse.json(
          { error: "Notes feature not available" },
          { status: 500 }
        );
      }
      console.error("Error creating note:", createError);
      return NextResponse.json(
        { error: "Failed to create note" },
        { status: 500 }
      );
    }

    // Create activity for the note
    const { error: activityError } = await supabase.from("project_activities").insert({
      project_id: id,
      activity_type: "note_added",
      title: title?.trim() || "Note added",
      description:
        content.trim().slice(0, 100) + (content.length > 100 ? "..." : ""),
      created_by: user.id,
    });

    if (activityError) {
      console.error("Error creating activity for note:", activityError);
      // Don't fail the whole request, note was created successfully
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
