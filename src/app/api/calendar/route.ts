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

    // Lead meetings. Excluded for source="project": a project asking for its
    // calendar was previously handed EVERY lead meeting in the tenant, because
    // the linkedId filter below only applies when source === "lead". That was
    // invisible while the project tab passed externalEvents and never called
    // this endpoint.
    if (source !== "standalone" && source !== "project") {
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
                  sourceName = (lead.client as any)?.name || null;
                  sourceNumber = lead.lead_number;
                  propertyName = (lead.property as any)?.property_name || null;
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
    // Note follow-ups, as a THIRD source rather than as calendar_events rows.
    //
    // Writing a real event row when a follow-up is set would store one fact
    // twice, and the two copies would drift the moment anyone rescheduled the
    // note, resolved the event, or deleted the note. This endpoint is already
    // a union over lead_activities and calendar_events, so deriving costs one
    // more query and keeps the note as the single source of truth.
    if (source !== "standalone" && source !== "project") {
      let followUpQuery = supabaseAdmin
        .from("lead_notes")
        .select(`
          id,
          lead_id,
          content,
          follow_up_at,
          follow_up_done_at,
          created_by,
          created_at,
          created_user:users!lead_notes_created_by_fkey(id, name, avatar_url),
          lead:leads!inner(
            id,
            lead_number,
            tenant_id,
            client:clients!leads_client_id_fkey(id, name, email, phone)
          )
        `)
        .eq("lead.tenant_id", tenantId)
        .not("follow_up_at", "is", null);

      if (linkedId && source === "lead") {
        followUpQuery = followUpQuery.eq("lead_id", linkedId);
      }
      if (startDate) followUpQuery = followUpQuery.gte("follow_up_at", startDate);
      if (endDate) followUpQuery = followUpQuery.lte("follow_up_at", endDate);

      const { data: followUps, error: followUpError } = await followUpQuery;

      if (followUpError) {
        console.error("Error fetching follow-ups:", followUpError);
      } else {
        allEvents.push(
          ...(followUps || []).map((n: any) => ({
            id: `followup-${n.id}`,
            source_type: "lead" as const,
            source_id: n.lead_id,
            source_number: n.lead?.lead_number,
            source_name: n.lead?.client?.name,
            // Uses the follow_up type that already exists in calendar_events,
            // so the UI can colour and filter it alongside everything else.
            activity_type: "follow_up",
            event_type: "follow_up",
            // The calendar table labels rows from meeting_type, and its map
            // already has a follow_up entry - without this it fell back to
            // "Other".
            meeting_type: "follow_up",
            // The note text IS the reason, so it is the title.
            title: n.content?.slice(0, 80) || "Follow up",
            description: n.content,
            // A follow-up is a day, not a time. Anchor it to 09:00 local so it
            // sorts sensibly against timed meetings rather than landing at
            // midnight above everything else.
            scheduled_at: `${n.follow_up_at}T09:00:00`,
            is_all_day: true,
            is_completed: !!n.follow_up_done_at,
            attendees: [],
            created_by: n.created_by,
            created_at: n.created_at,
            created_user: n.created_user,
            client_email: n.lead?.client?.email,
            client_phone: n.lead?.client?.phone,
            // Marks it as derived - it has no calendar_events row, so the UI
            // must not offer to edit or delete it as though it did.
            is_derived: true,
            note_id: n.id,
          }))
        );
      }
    }

    // Project note follow-ups - the same derived treatment as lead notes.
    if (source !== "standalone" && source !== "lead") {
      let projFollowUpQuery = supabaseAdmin
        .from("project_notes")
        .select(`
          id,
          project_id,
          title,
          content,
          follow_up_at,
          follow_up_done_at,
          created_by,
          created_at,
          created_user:users!project_notes_created_by_fkey(id, name, avatar_url),
          project:projects!inner(id, project_number, name, tenant_id)
        `)
        .eq("project.tenant_id", tenantId)
        .not("follow_up_at", "is", null);

      if (linkedId && source === "project") {
        projFollowUpQuery = projFollowUpQuery.eq("project_id", linkedId);
      }
      if (startDate) projFollowUpQuery = projFollowUpQuery.gte("follow_up_at", startDate);
      if (endDate) projFollowUpQuery = projFollowUpQuery.lte("follow_up_at", endDate);

      const { data: projFollowUps, error: projFollowUpError } =
        await projFollowUpQuery;

      if (projFollowUpError) {
        console.error("Error fetching project follow-ups:", projFollowUpError);
      } else {
        allEvents.push(
          ...(projFollowUps || []).map((n: any) => ({
            id: `followup-${n.id}`,
            source_type: "project" as const,
            source_id: n.project_id,
            source_number: n.project?.project_number,
            source_name: n.project?.name,
            activity_type: "follow_up",
            event_type: "follow_up",
            // The calendar table labels rows from meeting_type, and its map
            // already has a follow_up entry - without this it fell back to
            // "Other".
            meeting_type: "follow_up",
            title: n.title || n.content?.slice(0, 80) || "Follow up",
            description: n.content,
            scheduled_at: `${n.follow_up_at}T09:00:00`,
            is_all_day: true,
            is_completed: !!n.follow_up_done_at,
            attendees: [],
            created_by: n.created_by,
            created_at: n.created_at,
            created_user: n.created_user,
            is_derived: true,
            note_id: n.id,
          }))
        );
      }
    }

    // Task due dates.
    //
    // Derived, like note follow-ups: the task stays the single source of truth
    // and nothing is copied into calendar_events, so rescheduling or completing
    // a task cannot leave a stale calendar row behind.
    //
    // A due date is a deadline, not an appointment - it has no time and no
    // duration - so these are all-day rows typed task_due, which the calendar's
    // existing type filter can hide for anyone who finds them noisy.
    {
      let taskQuery = supabaseAdmin
        .from("tasks")
        .select(
          `id, title, description, due_date, status, priority, assigned_to,
           related_type, related_id, created_by, created_at,
           assigned_user:users!tasks_assigned_to_fkey(id, name, avatar_url)`
        )
        .eq("tenant_id", tenantId)
        .not("due_date", "is", null)
        // Finished work is not a reminder.
        .not("status", "in", "(completed,cancelled,skipped)");

      if (source === "lead") taskQuery = taskQuery.eq("related_type", "lead");
      if (source === "project") taskQuery = taskQuery.eq("related_type", "project");
      if (linkedId && (source === "lead" || source === "project")) {
        taskQuery = taskQuery.eq("related_id", linkedId);
      }
      if (startDate) taskQuery = taskQuery.gte("due_date", startDate);
      if (endDate) taskQuery = taskQuery.lte("due_date", endDate);

      const { data: dueTasks, error: taskError } = await taskQuery;

      if (taskError) {
        console.error("Error fetching task due dates:", taskError);
      } else if (dueTasks?.length) {
        // Resolve the names of whatever the tasks hang off, in two batched
        // lookups rather than one per task.
        const leadIds = dueTasks
          .filter((t: any) => t.related_type === "lead" && t.related_id)
          .map((t: any) => t.related_id);
        const projectIds = dueTasks
          .filter((t: any) => t.related_type === "project" && t.related_id)
          .map((t: any) => t.related_id);

        const [{ data: relLeads }, { data: relProjects }] = await Promise.all([
          leadIds.length
            ? supabaseAdmin
                .from("leads")
                .select(
                  `id, lead_number, client:clients!leads_client_id_fkey(name)`
                )
                .in("id", leadIds)
            : Promise.resolve({ data: [] as any[] }),
          projectIds.length
            ? supabaseAdmin
                .from("projects")
                .select("id, project_number, project_name")
                .in("id", projectIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const leadById = new Map((relLeads || []).map((l: any) => [l.id, l]));
        const projectById = new Map(
          (relProjects || []).map((pr: any) => [pr.id, pr])
        );

        allEvents.push(
          ...dueTasks.map((t: any) => {
            const rel =
              t.related_type === "lead"
                ? leadById.get(t.related_id)
                : t.related_type === "project"
                ? projectById.get(t.related_id)
                : null;

            return {
              id: `task-${t.id}`,
              source_type: (t.related_type === "project"
                ? "project"
                : t.related_type === "lead"
                ? "lead"
                : "standalone") as any,
              source_id: t.related_id,
              source_number: rel?.lead_number || rel?.project_number,
              source_name: rel?.client?.name || rel?.project_name,
              activity_type: "task_due",
              event_type: "task_due",
              meeting_type: "task_due",
              title: t.title,
              description: t.description,
              // Anchored to 09:00 like note follow-ups so both read as
              // "handle this today" rather than sorting at midnight above
              // every real appointment.
              scheduled_at: `${String(t.due_date).slice(0, 10)}T09:00:00`,
              is_all_day: true,
              is_completed: false,
              // The person who must act on a task is its assignee, not its
              // creator. Listing them as an attendee is what lets the
              // role-based visibility filter below show the task to them.
              attendees: t.assigned_to
                ? [
                    {
                      type: "team",
                      id: t.assigned_to,
                      name: t.assigned_user?.name || "Assignee",
                    },
                  ]
                : [],
              created_by: t.created_by,
              created_at: t.created_at,
              created_user: t.assigned_user,
              priority: t.priority,
              // Derived: there is no calendar_events row to edit or delete.
              is_derived: true,
              task_id: t.id,
            };
          })
        );
      }
    }

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
          sourceName = (lead.client as any)?.name || null;
          sourceNumber = lead.lead_number;
          propertyName = (lead.property as any)?.property_name || null;
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
