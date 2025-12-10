import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/comments
export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; phaseId: string; subPhaseId: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: projectId, phaseId, subPhaseId } = await params;
    const supabase = await createClient();

    const { data: comments, error } = await supabase
      .from("project_phase_comments")
      .select(
        `
        *,
        created_by:users!project_phase_comments_created_by_fkey(id, name)
      `
      )
      .eq("project_sub_phase_id", subPhaseId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching comments:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Error in get comments API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/phases/[phaseId]/sub-phases/[subPhaseId]/comments
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; phaseId: string; subPhaseId: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId, phaseId, subPhaseId } = await params;
    const supabase = await createClient();

    const body = await request.json();
    const {
      content,
      comment_type = "note",
      is_internal = false,
      parent_comment_id,
    } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Create comment
    const { data: comment, error } = await supabase
      .from("project_phase_comments")
      .insert({
        project_id: projectId,
        project_phase_id: phaseId,
        project_sub_phase_id: subPhaseId,
        comment_type: comment_type,
        content: content.trim(),
        is_internal: is_internal,
        parent_comment_id: parent_comment_id || null,
        created_by: user.id,
      })
      .select(
        `
        *,
        created_by:users!project_phase_comments_created_by_fkey(id, name)
      `
      )
      .single();

    if (error) {
      console.error("Error creating comment:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    await supabase.from("project_phase_activity_log").insert({
      project_id: projectId,
      project_phase_id: phaseId,
      project_sub_phase_id: subPhaseId,
      activity_type: "comment_added",
      description: `Added a ${comment_type} comment`,
      new_value: { comment_id: comment.id, type: comment_type },
      performed_by: user.id,
    });

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("Error in create comment API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
