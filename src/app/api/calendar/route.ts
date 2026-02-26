import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/calendar - Fetch all calendar events (meetings, site visits, standalone events)
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { searchParams } = new URL(request.url);
    
    // Date range parameters
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");
    const source = searchParams.get("source"); // lead, project, standalone, all
    const linkedId = searchParams.get("linked_id"); // specific lead or project ID

    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Get user's tenant info
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("tenant_id, is_super_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      console.log("[CALENDAR API] User not found or no tenant");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's role from user_roles table
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select(`
        role:roles (
          name,
          hierarchy_level
        )
      `)
      .eq("user_id", user.id);

    // Check if user is admin/owner (hierarchy_level <= 1 means owner/admin)
    const isAdminOrOwner = userData.is_super_admin || userRoles?.some(
      (ur) =>
        ur.role &&
        typeof ur.role === "object" &&
        "hierarchy_level" in ur.role &&
        (ur.role as { hierarchy_level: number }).hierarchy_level <= 1
    );

    const tenantId = userData.tenant_id;
    let allEvents: any[] = [];

    // Fetch lead activities (meetings, site visits) - unless filtering for standalone only
    if (source !== "standalone") {
      let leadEventsQuery = supabaseAdmin
        .from("lead_activities")
        .select(`
          id,
          lead_id,
          activity_type,
          meeting_type,
          title,
          description,
          meeting_scheduled_at,
          meeting_location,
          meeting_completed,
          meeting_notes,
          attendees,
          created_by,
          created_at,
          lead:leads!inner(
            id,
            lead_number,
            tenant_id,
            client:clients!leads_client_id_fkey(id, name, email, phone),
            property:properties!leads_property_id_fkey(id, property_name)
          ),
          created_user:users!lead_activities_created_by_fkey(id, name, avatar_url)
        `)
        .eq("lead.tenant_id", tenantId)
        .not("meeting_scheduled_at", "is", null)
        .in("activity_type", ["meeting_scheduled", "client_meeting", "internal_meeting", "site_visit", "other"])
        .order("meeting_scheduled_at", { ascending: true });

      // Filter by specific lead if linkedId is provided
      if (linkedId && source === "lead") {
        leadEventsQuery = leadEventsQuery.eq("lead_id", linkedId);
      }

      // Apply date filters if provided
      if (startDate) {
        leadEventsQuery = leadEventsQuery.gte("meeting_scheduled_at", startDate);
      }
      if (endDate) {
        leadEventsQuery = leadEventsQuery.lte("meeting_scheduled_at", endDate);
      }

      const { data: leadEvents, error: leadEventsError } = await leadEventsQuery;

      if (leadEventsError) {
        console.error("Error fetching lead events:", leadEventsError);
      } else {
        // Transform lead events to calendar format
        const leadCalendarEvents = (leadEvents || []).map((event: any) => ({
          id: event.id,
          source_type: "lead" as const,
          source_id: event.lead_id,
          source_number: event.lead?.lead_number,
          source_name: event.lead?.client?.name,
          activity_type: event.activity_type,
          meeting_type: event.meeting_type,
          title: event.title,
          description: event.description,
          scheduled_at: event.meeting_scheduled_at,
          location: event.meeting_location,
          is_completed: event.meeting_completed,
          notes: event.meeting_notes,
          attendees: event.attendees || [],
          created_by: event.created_by,
          created_at: event.created_at,
          created_user: event.created_user,
          client_email: event.lead?.client?.email,
          client_phone: event.lead?.client?.phone,
          property_name: event.lead?.property?.property_name,
        }));
        allEvents.push(...leadCalendarEvents);
      }
    }

    // Fetch standalone calendar events - unless filtering for lead only
    if (source !== "lead") {
      let standaloneQuery = supabaseAdmin
        .from("calendar_events")
        .select(`
          id,
          title,
          description,
          event_type,
          scheduled_at,
          end_at,
          is_all_day,
          location,
          is_completed,
          notes,
          linked_type,
          linked_id,
          attendees,
          created_by,
          created_at,
          created_user:users!calendar_events_created_by_fkey(id, name, avatar_url)
        `)
        .eq("tenant_id", tenantId)
        .order("scheduled_at", { ascending: true });

      // Filter by linked entity if specified
      if (linkedId && source === "lead") {
        standaloneQuery = standaloneQuery
          .eq("linked_type", "lead")
          .eq("linked_id", linkedId);
      } else if (linkedId && source === "project") {
        standaloneQuery = standaloneQuery
          .eq("linked_type", "project")
          .eq("linked_id", linkedId);
      }

      // Apply date filters
      if (startDate) {
        standaloneQuery = standaloneQuery.gte("scheduled_at", startDate);
      }
      if (endDate) {
        standaloneQuery = standaloneQuery.lte("scheduled_at", endDate);
      }

      const { data: standaloneEvents, error: standaloneError } = await standaloneQuery;

      if (standaloneError) {
        console.error("Error fetching standalone events:", standaloneError);
      } else {
        // Transform standalone events to calendar format
        const standaloneCalendarEvents = await Promise.all(
          (standaloneEvents || []).map(async (event: any) => {
            let sourceName = null;
            let sourceNumber = null;
            let propertyName = null;

            // Fetch linked entity details if linked
            if (event.linked_type && event.linked_id) {
              if (event.linked_type === "lead") {
                const { data: lead } = await supabaseAdmin
                  .from("leads")
                  .select(`
                    id,
                    lead_number,
                    client:clients!leads_client_id_fkey(id, name),
                    property:properties!leads_property_id_fkey(id, property_name)
                  `)
                  .eq("id", event.linked_id)
                  .single();

                if (lead) {
                  sourceName = lead.client?.name || null;
                  sourceNumber = lead.lead_number;
                  propertyName = lead.property?.property_name || null;
                }
              } else if (event.linked_type === "project") {
                const { data: project } = await supabaseAdmin
                  .from("projects")
                  .select("id, project_name, project_number")
                  .eq("id", event.linked_id)
                  .single();

                if (project) {
                  sourceName = project.project_name;
                  sourceNumber = project.project_number;
                }
              }
            }

            return {
              id: event.id,
              source_type: event.linked_type || ("standalone" as const),
              source_id: event.linked_id || null,
              source_number: sourceNumber,
              source_name: sourceName,
              activity_type: event.event_type,
              meeting_type: event.event_type,
              title: event.title,
              description: event.description,
              scheduled_at: event.scheduled_at,
              end_at: event.end_at,
              is_all_day: event.is_all_day,
              location: event.location,
              is_completed: event.is_completed,
              notes: event.notes,
              attendees: event.attendees || [],
              created_by: event.created_by,
              created_at: event.created_at,
              created_user: event.created_user,
              is_standalone: !event.linked_type,
              property_name: propertyName,
            };
          })
        );
        allEvents.push(...standaloneCalendarEvents);
      }
    }

    // Sort all events by scheduled_at
    allEvents.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    // Filter events based on user role and attendee status
    // Admin/Owner can see all events
    // Other users can only see events where they are creator or attendee
    const events = isAdminOrOwner
      ? allEvents
      : allEvents.filter((event) => {
          if (event.created_by === user.id) return true;
          const attendees = event.attendees || [];
          const isAttendee = attendees.some(
            (a: any) => a.type === "team" && a.id === user.id
          );
          return isAttendee;
        });

    // Group events by date
    const eventsByDate: Record<string, typeof events> = {};
    events.forEach((event) => {
      const date = event.scheduled_at.split("T")[0];
      if (!eventsByDate[date]) {
        eventsByDate[date] = [];
      }
      eventsByDate[date].push(event);
    });

    // Get upcoming events (next 7 days)
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingEvents = events.filter((e) => {
      const eventDate = new Date(e.scheduled_at);
      return eventDate >= today && eventDate <= nextWeek && !e.is_completed;
    });

    // Get overdue events
    const overdueEvents = events.filter((e) => {
      const eventDate = new Date(e.scheduled_at);
      return eventDate < today && !e.is_completed;
    });

    return NextResponse.json({
      events,
      eventsByDate,
      upcomingEvents,
      overdueEvents,
      totalCount: events.length,
      isAdminOrOwner,
    });
  } catch (error) {
    console.error("Calendar API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/calendar - Create a new calendar event
export async function POST(request: NextRequest) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const body = await request.json();
    const supabase = await createClient();

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!body.scheduled_at) {
      return NextResponse.json({ error: "Date/time is required" }, { status: 400 });
    }

    // Create the calendar event
    // Handle both linked_type/linked_id format AND lead_id/project_id format
    let linkedType = body.linked_type || null;
    let linkedId = body.linked_id || null;
    
    // Support lead_id/project_id format (for backwards compatibility and frontend simplicity)
    if (!linkedType && body.lead_id) {
      linkedType = "lead";
      linkedId = body.lead_id;
    } else if (!linkedType && body.project_id) {
      linkedType = "project";
      linkedId = body.project_id;
    }

    const { data: event, error: createError } = await supabase
      .from("calendar_events")
      .insert({
        tenant_id: user.tenantId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        event_type: body.event_type || "other",
        scheduled_at: body.scheduled_at,
        end_at: body.end_at || null,
        is_all_day: body.is_all_day || false,
        location: body.location?.trim() || null,
        linked_type: linkedType,
        linked_id: linkedId,
        attendees: body.attendees || [],
        notes: body.notes?.trim() || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(`
        *,
        created_user:users!calendar_events_created_by_fkey(id, name, avatar_url)
      `)
      .single();

    if (createError) {
      console.error("Error creating calendar event:", createError);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    // Transform the created event to include source details if linked
    const supabaseAdmin = createAdminClient();
    let sourceName = null;
    let sourceNumber = null;
    let propertyName = null;

    if (event.linked_type && event.linked_id) {
      if (event.linked_type === "lead") {
        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select(`
            id,
            lead_number,
            client:clients!leads_client_id_fkey(id, name),
            property:properties!leads_property_id_fkey(id, property_name)
          `)
          .eq("id", event.linked_id)
          .single();

        if (lead) {
          sourceName = lead.client?.name || null;
          sourceNumber = lead.lead_number;
          propertyName = lead.property?.property_name || null;
        }
      } else if (event.linked_type === "project") {
        const { data: project } = await supabaseAdmin
          .from("projects")
          .select("id, name, project_number")
          .eq("id", event.linked_id)
          .single();

        if (project) {
          sourceName = project.name;
          sourceNumber = project.project_number;
        }
      }
    }

    // Transform event to match GET response format
    const transformedEvent = {
      id: event.id,
      source_type: event.linked_type || ("standalone" as const),
      source_id: event.linked_id || null,
      source_number: sourceNumber,
      source_name: sourceName,
      activity_type: event.event_type,
      meeting_type: event.event_type,
      title: event.title,
      description: event.description,
      scheduled_at: event.scheduled_at,
      end_at: event.end_at,
      is_all_day: event.is_all_day,
      location: event.location,
      is_completed: event.is_completed,
      notes: event.notes,
      attendees: event.attendees || [],
      created_by: event.created_by,
      created_at: event.created_at,
      created_user: event.created_user,
      is_standalone: !event.linked_type,
      property_name: propertyName,
    };

    return NextResponse.json({ event: transformedEvent }, { status: 201 });
  } catch (error) {
    console.error("Calendar POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
