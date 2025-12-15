import { NextRequest, NextResponse } from "next/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Fetch all activities for a project
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId } = await params;
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Get user's tenant_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const tenantId = userData.tenant_id;

    // Verify project exists and belongs to this tenant
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("tenant_id", tenantId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Fetch activities
    const { data: activities, error: activitiesError } = await supabase
      .from("project_activities")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (activitiesError) {
      console.error("Error fetching project activities:", activitiesError);
      return NextResponse.json(
        { error: "Failed to fetch activities" },
        { status: 500 }
      );
    }

    return NextResponse.json({ activities: activities || [] });
  } catch (error) {
    console.error("Get project activities API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new activity
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId } = await params;
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const body = await request.json();

    // Get user's tenant_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const tenantId = userData.tenant_id;

    // Verify project exists and belongs to this tenant
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .eq("tenant_id", tenantId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Create activity
    const activityData: any = {
      project_id: projectId,
      activity_type: body.activity_type,
      title: body.title,
      description: body.description,
      created_by: user.id,
    };

    // Add meeting-specific fields if this is a meeting
    if (
      body.activity_type === "meeting_scheduled" ||
      body.activity_type === "client_meeting" ||
      body.activity_type === "internal_meeting" ||
      body.activity_type === "site_visit" ||
      body.activity_type === "design_review"
    ) {
      activityData.meeting_type = body.meeting_type;
      activityData.meeting_scheduled_at = body.meeting_scheduled_at;
      activityData.meeting_location = body.meeting_location;
      activityData.meeting_completed = body.meeting_completed || false;
      activityData.meeting_notes = body.meeting_notes;
      activityData.attendees = body.attendees || [];
    }

    const { data: activity, error: activityError } = await supabaseAdmin
      .from("project_activities")
      .insert(activityData)
      .select()
      .single();

    if (activityError) {
      console.error("Error creating project activity:", activityError);
      return NextResponse.json(
        { error: "Failed to create activity" },
        { status: 500 }
      );
    }

    // If save_notes_to_project is true and there are meeting notes, create a project note
    if (body.save_notes_to_project && body.meeting_notes) {
      const noteData = {
        project_id: projectId,
        content: body.meeting_notes,
        note_type: "meeting",
        created_by: user.id,
        tenant_id: tenantId,
      };

      const { data: note, error: noteError } = await supabaseAdmin
        .from("project_notes")
        .insert(noteData)
        .select()
        .single();

      if (!noteError && note) {
        // Link the note to the activity
        await supabaseAdmin
          .from("project_activities")
          .update({ linked_note_id: note.id })
          .eq("id", activity.id);
      }
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Create project activity API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update an activity
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const activityId = searchParams.get("activityId");

    if (!activityId) {
      return NextResponse.json(
        { error: "Activity ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const body = await request.json();

    // Get user's tenant_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const tenantId = userData.tenant_id;

    // Verify activity exists and belongs to this tenant
    const { data: activity, error: activityError } = await supabaseAdmin
      .from("project_activities")
      .select("*")
      .eq("id", activityId)
      .eq("project_id", projectId)
      .eq("tenant_id", tenantId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Build update data
    const allowedFields = [
      "title",
      "description",
      "meeting_type",
      "meeting_scheduled_at",
      "meeting_location",
      "meeting_completed",
      "meeting_notes",
      "attendees",
    ];

    const updateData: any = {};
    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // Update activity
    const { data: updatedActivity, error: updateError } = await supabaseAdmin
      .from("project_activities")
      .update(updateData)
      .eq("id", activityId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating project activity:", updateError);
      return NextResponse.json(
        { error: "Failed to update activity" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedActivity);
  } catch (error) {
    console.error("Update project activity API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an activity
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: projectId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const activityId = searchParams.get("activityId");

    if (!activityId) {
      return NextResponse.json(
        { error: "Activity ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Get user's tenant_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const tenantId = userData.tenant_id;

    // Verify activity exists and belongs to this tenant
    const { data: activity, error: activityError } = await supabaseAdmin
      .from("project_activities")
      .select("*")
      .eq("id", activityId)
      .eq("project_id", projectId)
      .eq("tenant_id", tenantId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Delete activity
    const { error: deleteError } = await supabaseAdmin
      .from("project_activities")
      .delete()
      .eq("id", activityId);

    if (deleteError) {
      console.error("Error deleting project activity:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project activity API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
