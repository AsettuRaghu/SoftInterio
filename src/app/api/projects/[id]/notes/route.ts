import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List all notes for a project
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: projectId } = await params;
    const supabase = await createClient();

    // Fetch notes with related data
    const { data: notes, error } = await supabase
      .from("project_notes")
      .select(
        `
        *,
        created_by_user:profiles!project_notes_created_by_fkey(id, name, avatar_url),
        phase:project_phases!project_notes_phase_id_fkey(id, name),
        sub_phase:project_subphases!project_notes_sub_phase_id_fkey(id, name)
      `
      )
      .eq("project_id", projectId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      // If table doesn't exist, return gracefully
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        return NextResponse.json({ notes: [] });
      }
      console.error("Error fetching notes:", error);
      return NextResponse.json(
        { error: "Failed to fetch notes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Error in GET /api/projects/[id]/notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new note
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId } = await params;
    const supabase = await createClient();

    const body = await request.json();
    const { title, content, phase_id, sub_phase_id, category, is_pinned } =
      body;

    console.log("POST /api/projects/[id]/notes - Request body:", {
      userId: user.id,
      projectId,
      title,
      content: content?.substring(0, 50),
      category,
    });

    // Validate required fields
    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Get tenant_id from user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", {
        userId: user.id,
        error: profileError,
      });
      return NextResponse.json(
        { error: "Failed to get user profile" },
        { status: 400 }
      );
    }

    if (!profile?.tenant_id) {
      console.error("Tenant not found for user:", {
        userId: user.id,
        profile,
      });
      return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
    }

    console.log("Creating note with tenant:", profile.tenant_id);

    // Create the note
    const { data: note, error } = await supabase
      .from("project_notes")
      .insert({
        tenant_id: profile.tenant_id,
        project_id: projectId,
        title: title || null,
        content,
        phase_id: phase_id || null,
        sub_phase_id: sub_phase_id || null,
        category: category || "general",
        is_pinned: is_pinned || false,
        created_by: user.id,
      })
      .select(
        `
        *,
        created_by_user:profiles!project_notes_created_by_fkey(id, name, avatar_url),
        phase:project_phases!project_notes_phase_id_fkey(id, name)
      `
      )
      .single();

    if (error) {
      // If table doesn't exist, return gracefully
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        console.warn("project_notes table not found, returning empty response");
        return NextResponse.json(
          { error: "Notes feature not available" },
          { status: 500 }
        );
      }
      console.error("Error creating note:", {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return NextResponse.json(
        { error: "Failed to create note" },
        { status: 500 }
      );
    }

    console.log("Note created successfully:", note.id);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/projects/[id]/notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
