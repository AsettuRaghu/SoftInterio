import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { LeadActivityType, MeetingType, MeetingAttendee } from "@/types/leads";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/sales/leads/[id]/activities - Create a new activity
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: leadId } = await params;
    const body = await request.json();

    const {
      activity_type,
      title,
      description,
      // Call details
      call_duration_seconds,
      call_outcome,
      // Meeting details
      meeting_type,
      meeting_scheduled_at,
      meeting_location,
      meeting_completed,
      meeting_notes,
      attendees,
      save_notes_to_lead,
      // Email details
      email_subject,
    } = body;

    // Validate required fields
    if (!activity_type || !title) {
      return NextResponse.json(
        { error: "Activity type and title are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Get user's tenant first for security
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the lead exists and belongs to the tenant
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, tenant_id")
      .eq("id", leadId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Create the activity
    const { data: activity, error: createError } = await supabaseAdmin
      .from("lead_activities")
      .insert({
        lead_id: leadId,
        tenant_id: userData.tenant_id,
        activity_type: activity_type as LeadActivityType,
        title,
        description: description || null,
        call_duration_seconds: call_duration_seconds || null,
        call_outcome: call_outcome || null,
        meeting_type: meeting_type || null,
        meeting_scheduled_at: meeting_scheduled_at || null,
        meeting_location: meeting_location || null,
        meeting_completed: meeting_completed || false,
        meeting_notes: meeting_notes || null,
        attendees: attendees || [],
        email_subject: email_subject || null,
        created_by: user.id,
      })
      .select(
        `
        *,
        created_user:users!lead_activities_created_by_fkey(id, name, avatar_url)
      `
      )
      .single();

    if (createError) {
      console.error("Error creating activity:", createError);
      return NextResponse.json(
        { error: "Failed to create activity" },
        { status: 500 }
      );
    }

    // If save_notes_to_lead is true and there are meeting notes, create a lead note
    let linkedNoteId = null;
    if (save_notes_to_lead && meeting_notes) {
      const meetingTypeLabel = meeting_type === "client_meeting" ? "Client Meeting" 
        : meeting_type === "internal_meeting" ? "Internal Meeting"
        : meeting_type === "site_visit" ? "Site Visit" 
        : "Meeting";
      
      const { data: note, error: noteError } = await supabaseAdmin
        .from("lead_notes")
        .insert({
          lead_id: leadId,
          content: `**${meetingTypeLabel}: ${title}**\n\n${meeting_notes}`,
          created_by: user.id,
        })
        .select()
        .single();

      if (!noteError && note) {
        linkedNoteId = note.id;
        // Update the activity with the linked note ID
        await supabaseAdmin
          .from("lead_activities")
          .update({ linked_note_id: linkedNoteId })
          .eq("id", activity.id);
      }
    }

    // Update lead's last activity info
    await supabaseAdmin
      .from("leads")
      .update({
        last_activity_at: new Date().toISOString(),
        last_activity_type: activity_type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error("Create activity API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/sales/leads/[id]/activities?activityId=xxx - Update an activity (e.g., mark meeting as completed)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: leadId } = await params;
    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get("activityId");

    if (!activityId) {
      return NextResponse.json(
        { error: "Activity ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Get user's tenant first for security
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the lead exists and belongs to the tenant
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, tenant_id")
      .eq("id", leadId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Allowed fields to update
    const allowedFields = [
      "meeting_type",
      "meeting_completed",
      "meeting_notes",
      "meeting_scheduled_at",
      "meeting_location",
      "attendees",
      "call_outcome",
      "call_duration_seconds",
      "description",
      "title",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update the activity
    const { data: activity, error: updateError } = await supabaseAdmin
      .from("lead_activities")
      .update(updateData)
      .eq("id", activityId)
      .eq("lead_id", leadId)
      .select(
        `
        *,
        created_user:users!lead_activities_created_by_fkey(id, name, avatar_url)
      `
      )
      .single();

    if (updateError) {
      console.error("Error updating activity:", updateError);
      return NextResponse.json(
        { error: "Failed to update activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Update activity API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/sales/leads/[id]/activities?activityId=xxx - Delete an activity
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: leadId } = await params;
    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get("activityId");

    if (!activityId) {
      return NextResponse.json(
        { error: "Activity ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Get user's tenant first for security
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the lead exists and belongs to the tenant
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, tenant_id")
      .eq("id", leadId)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Delete the activity
    const { error: deleteError } = await supabaseAdmin
      .from("lead_activities")
      .delete()
      .eq("id", activityId)
      .eq("lead_id", leadId);

    if (deleteError) {
      console.error("Error deleting activity:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete activity" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete activity API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
