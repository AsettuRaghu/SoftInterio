import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";
import { logProjectActivity, noteExcerpt } from "@/lib/activity/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/notes - Get project notes
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const { id } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "read",
    });
    if (!gate.ok) return gate.response;

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
      log.error("Error fetching notes", error);
      return NextResponse.json(
        { error: "Failed to fetch notes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (error) {
    log.error("Get notes API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/notes - Add a note
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const { title, content, category, is_pinned, follow_up_at } =
      await request.json();

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
        follow_up_at: follow_up_at || null,
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
      log.error("Error creating note", createError);
      return NextResponse.json(
        { error: "Failed to create note" },
        { status: 500 }
      );
    }

    const activity = {
      projectId: id,
      userId: user.id,
      // Links the entry back to its note, so the timeline can navigate to it.
      linkedNoteId: note.id,
    };

    await logProjectActivity(supabase, {
      ...activity,
      type: "note_added",
      title: title?.trim() || "Note added",
      description: noteExcerpt(content),
    });

    // A note created with a follow-up is two things happening at once. The
    // reminder gets its own entry so it appears alongside every other
    // follow-up event rather than being buried in the note.
    if (follow_up_at) {
      await logProjectActivity(supabase, {
        ...activity,
        type: "follow_up_scheduled",
        title: "Follow-up scheduled",
        description: `Due ${follow_up_at}`,
      });
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    log.error("Create note API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
