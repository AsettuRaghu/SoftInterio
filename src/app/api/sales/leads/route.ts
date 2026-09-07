import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { generateUniqueLeadNumber } from "@/utils/lead-number-generator";
import type { CreateLeadInput, LeadStage } from "@/types/leads";
import { validateLeadDates, type LeadDateFields } from "@/lib/dates/lead-dates";
import { leadAccess } from "@/lib/leads/access";
import { requestLogger } from "@/lib/logger/request";

// GET /api/sales/leads - List leads with filters
export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const log = requestLogger(request, { userId: user.id });

    // leads.view sees the tenant's leads; leads.view_own sees only leads
    // assigned to the caller. RLS enforces neither - its policy checks tenant
    // membership alone - so without this a salesperson holding only view_own
    // could read every lead in the business.
    const access = leadAccess(guard.permissions, user.isSuperAdmin);
    if (access.denied) {
      log.warn("Lead list refused: no read permission");
      return NextResponse.json(
        { error: "You do not have permission to view leads" },
        { status: 403 }
      );
    }
    const supabase = await createClient();

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not found or no tenant" },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const stage = searchParams.get("stage") as LeadStage | null;
    const stages = searchParams.get("stages"); // Comma-separated list of stages
    const assignedTo = searchParams.get("assigned_to");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";
    const priority = searchParams.get("priority");
    const needsFollowup = searchParams.get("needs_followup") === "true";

    // Use admin client for fetching leads with user data (bypasses RLS for foreign key joins)
    const supabaseAdmin = createAdminClient();

    // Build query with admin client to fetch user data properly
    let query = supabaseAdmin
      .from("leads")
      .select(
        `
        *,
        client:clients!leads_client_id_fkey(id, name, phone, email, city),
        property:properties!leads_property_id_fkey(id, property_name, unit_number, category, property_type, property_subtype, carpet_area, address_line1, city, pincode),
        assigned_user:users!leads_assigned_to_fkey(id, name, avatar_url),
        created_user:users!leads_created_by_fkey(id, name, avatar_url)
      `,
        { count: "exact" }
      )
      .eq("tenant_id", userData.tenant_id);

    // Narrowed before any other filter, so nothing downstream can widen it
    // back. This query uses the admin client, which bypasses RLS entirely -
    // the scoping has to happen here or it happens nowhere.
    if (!access.readAll) {
      query = query.eq("assigned_to", user.id);
    }

    // Apply filters
    if (stages) {
      // Multiple stages filter (comma-separated)
      const stageList = stages.split(",").map(s => s.trim()).filter(Boolean);
      if (stageList.length > 0) {
        query = query.in("stage", stageList);
      }
    } else if (stage) {
      // Single stage filter
      query = query.eq("stage", stage);
    }

    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo);
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (search) {
      // Search in lead_number only (client/property search needs separate handling)
      query = query.or(
        `lead_number.ilike.%${search}%`
      );
    }

    if (needsFollowup) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      query = query
        .not("stage", "in", "(won,lost,disqualified)")
        .lt("last_activity_at", threeDaysAgo.toISOString());
    }

    // Apply sorting
    const validSortColumns = [
      "created_at",
      "updated_at",
      "client_name",
      "stage",
      "priority",
      "last_activity_at",
      // The leads list offers this as a sortable column; without it here the
      // sort silently fell back to created_at.
      "next_follow_up_at",
      "property_name",
    ];
    const sortColumn = validSortColumns.includes(sortBy)
      ? sortBy
      : "created_at";
    query = query.order(sortColumn, { ascending: sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: leads, error: leadsError, count } = await query;

    if (leadsError) {
      log.error("Error fetching leads", leadsError);
      return NextResponse.json(
        { error: "Failed to fetch leads", details: leadsError.message },
        { status: 500 }
      );
    }

    // Attach the most recent activity's own words to each lead.
    //
    // leads.last_activity_type says a note was added; it cannot say what the
    // note said. That detail lives on lead_activities, so the list would
    // otherwise force a click into the lead to learn anything useful.
    //
    // One batched query for the whole page rather than one per row. If this
    // list ever grows past a few hundred rows per page, the better move is a
    // last_activity_summary rollup column on leads maintained by the same
    // trigger that already sets last_activity_at.
    const leadIds = (leads || []).map((l: any) => l.id);
    if (leadIds.length) {
      const { data: recent, error: recentError } = await supabase
        .from("lead_activities")
        .select("lead_id, activity_type, title, description, created_at")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false });

      if (recentError) {
        // Non-fatal: the list still renders, just without the detail line.
        log.error("activity detail", recentError);
      } else {
        // Rows arrive newest-first, so the first three seen per lead are the
        // three most recent. Three rather than one because a single line says
        // when something last happened but not whether the lead is moving - a
        // burst this week reads very differently from one note in April, and
        // that difference is the whole point of the column.
        const byLead = new Map<string, any[]>();
        for (const a of recent || []) {
          const list = byLead.get(a.lead_id) || [];
          if (list.length < 3) {
            list.push(a);
            byLead.set(a.lead_id, list);
          }
        }
        for (const lead of leads || []) {
          const list = byLead.get(lead.id) || [];
          (lead as any).last_activity_detail = list[0]
            ? list[0].description || list[0].title || null
            : null;
          (lead as any).recent_activities = list.map((a) => ({
            type: a.activity_type,
            detail: a.description || a.title || null,
            at: a.created_at,
          }));
        }
      }
    }

    // What is coming up on each lead: outstanding follow-ups and open tasks,
    // merged and sorted by date. Two batched queries for the page, matching
    // the activity enrichment above - the alternative is one pair per row.
    if (leadIds.length) {
      const [{ data: followUps }, { data: dueTasks }] = await Promise.all([
        supabase
          .from("lead_notes")
          .select("lead_id, content, follow_up_at")
          .in("lead_id", leadIds)
          .not("follow_up_at", "is", null)
          .is("follow_up_done_at", null),
        supabase
          .from("tasks")
          .select("related_id, title, due_date, status")
          .eq("related_type", "lead")
          .in("related_id", leadIds)
          .in("status", ["todo", "in_progress", "on_hold"])
          .not("due_date", "is", null),
      ]);

      const upcoming = new Map<string, Array<{ kind: string; label: string; at: string }>>();
      const add = (leadId: string, entry: { kind: string; label: string; at: string }) => {
        const list = upcoming.get(leadId) || [];
        list.push(entry);
        upcoming.set(leadId, list);
      };

      (followUps || []).forEach((n) =>
        add(n.lead_id, {
          kind: "follow_up",
          label: (n.content || "").split("\n")[0].slice(0, 80) || "Follow-up",
          at: n.follow_up_at,
        })
      );
      (dueTasks || []).forEach((t) =>
        add(t.related_id, { kind: "task", label: t.title, at: t.due_date })
      );

      for (const lead of leads || []) {
        (lead as any).upcoming_items = (upcoming.get(lead.id) || [])
          // Soonest first - what is closest to today is what a seller needs to
          // see, and overdue items sort to the top because they are furthest
          // in the past.
          .sort((a, b) => (a.at < b.at ? -1 : 1))
          .slice(0, 3);
      }
    }

    return NextResponse.json({
      leads: leads || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    log.error("Unexpected error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get leads" },
      { status: 500 }
    );
  }
}

// POST /api/sales/leads - Create a new lead
// This also creates linked Client and Property records automatically
export async function POST(request: NextRequest) {
  const log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["leads.create"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;

    const supabase = await createClient();

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError) {
      log.error("Error fetching user data", userError);
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    if (!userData?.tenant_id) {
      log.debug("User has no tenant");
      return NextResponse.json(
        { error: "User not found or no tenant" },
        { status: 404 }
      );
    }
    log.debug("Tenant ID", { detail: userData.tenant_id });

    const body: CreateLeadInput = await request.json();
    // The whole body was logged as pretty-printed JSON on every request -
     // client name, phone and email into the log stream on a create. Only the
     // shape is recorded now.
    log.debug("Creating lead", {
      hasClient: !!body.client_name,
      source: body.lead_source,
      serviceType: body.service_type,
    });

    // Validate required fields
    if (!body.client_name?.trim()) {
      log.debug("Validation failed: client_name required");
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }
    if (!body.phone?.trim()) {
      log.debug("Validation failed: phone required");
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // A new lead has nothing to compare against, so every date it carries is
    // treated as newly set and held to the full rules.
    const dateProblems = validateLeadDates(body as LeadDateFields);
    if (dateProblems.length > 0) {
      return NextResponse.json(
        { error: dateProblems.join(". "), invalidDates: dateProblems },
        { status: 400 }
      );
    }

    // STEP 1: Create Client record
    log.debug("Creating client record");
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        tenant_id: userData.tenant_id,
        client_type: "individual",
        status: "active",
        name: body.client_name.trim(),
        phone: body.phone.trim(),
        email: body.email?.trim().toLowerCase() || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (clientError) {
      log.error("Error creating client", clientError);
      return NextResponse.json(
        { error: "Failed to create client record", details: clientError.message },
        { status: 500 }
      );
    }
    log.debug("Client created", { detail: client.id });

    // STEP 2: Create Property record (if property details provided)
    let propertyId: string | null = null;
    const hasPropertyData = body.property_name || body.unit_number || body.property_city || body.property_category;
    
    if (hasPropertyData) {
      log.debug("Creating property record");
      const { data: property, error: propertyError } = await supabase
        .from("properties")
        .insert({
          tenant_id: userData.tenant_id,
          property_name: body.property_name || null,
          unit_number: body.unit_number || null,
          category: body.property_category || "residential",
          property_type: body.property_type || "apartment",
          property_subtype: body.property_subtype || null,
          carpet_area: body.carpet_area || null,
          address_line1: body.property_address || null,
          city: body.property_city || "Unknown",
          pincode: body.property_pincode || null,
        })
        .select("id")
        .single();

      if (propertyError) {
        log.error("Error creating property", propertyError);
        // Don't fail the lead creation - property is optional
        log.warn("Continuing without property record");
      } else {
        propertyId = property.id;
        log.debug("Property created", { detail: propertyId });
      }
    }

    // STEP 3: Generate lead number based on tenant_lead_config
    log.debug("Generating lead number");
    const leadNumber = await generateUniqueLeadNumber(userData.tenant_id);
    log.debug("Generated lead number", { detail: leadNumber });

    // STEP 4: Create Lead record with linked client and property
    log.debug("Creating lead in database");
    const { data: lead, error: createError } = await supabase
      .from("leads")
      .insert({
        tenant_id: userData.tenant_id,
        lead_number: leadNumber,
        client_id: client.id,
        property_id: propertyId,
        service_type: body.service_type || null,
        lead_source: body.lead_source || null,
        target_start_date: body.target_start_date || null,
        target_end_date: body.target_end_date || null,
        budget_range: body.budget_range || null,
        stage: "new",
        created_by: user.id,
        assigned_to: body.assigned_to || user.id, // Use provided assignee or default to creator
        assigned_at: new Date().toISOString(),
        assigned_by: user.id,
      })
      .select(
        `
        *,
        client:clients!leads_client_id_fkey(id, name, phone, email, city),
        property:properties!leads_property_id_fkey(id, property_name, unit_number, category, property_type, property_subtype, carpet_area, address_line1, city, pincode),
        assigned_user:users!leads_assigned_to_fkey(id, name, avatar_url),
        created_user:users!leads_created_by_fkey(id, name, avatar_url)
      `
      )
      .single();

    if (createError) {
      log.error("Error creating lead", createError);

      // Clean up created client and property if lead creation fails
      if (client?.id) {
        await supabase.from("clients").delete().eq("id", client.id);
      }
      if (propertyId) {
        await supabase.from("properties").delete().eq("id", propertyId);
      }

      return NextResponse.json(
        { error: "Failed to create lead", details: createError.message },
        { status: 500 }
      );
    }

    log.info("Lead created", { leadId: lead.id, leadNumber: lead.lead_number });

    // Create initial activity
    const { error: activityError } = await supabase
      .from("lead_activities")
      .insert({
        lead_id: lead.id,
        activity_type: "other",
        title: "Lead Created",
        description: `Lead ${lead.lead_number} was created`,
        created_by: user.id,
      });

    if (activityError) {
      log.warn("Failed to create activity", { detail: activityError });
    }

    // Create note if provided
    if (body.notes?.trim()) {
      const { error: noteError } = await supabase.from("lead_notes").insert({
        lead_id: lead.id,
        content: body.notes.trim(),
        created_by: user.id,
      });

      if (noteError) {
        log.warn("Failed to create note", { detail: noteError });
      }
    }

    log.debug("Request completed successfully");
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    log.error("Unexpected error", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
