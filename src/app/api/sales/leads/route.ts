import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { CreateLeadInput, LeadStage } from "@/types/leads";

// GET /api/sales/leads - List leads with filters
export async function GET(request: NextRequest) {
  console.log("[GET /api/sales/leads] Starting request");

  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    console.log("[GET /api/sales/leads] User authenticated:", user!.id);

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error(
        "[GET /api/sales/leads] Error fetching user data:",
        userError
      );
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    if (!userData?.tenant_id) {
      console.log("[GET /api/sales/leads] User has no tenant");
      return NextResponse.json(
        { error: "User not found or no tenant" },
        { status: 404 }
      );
    }
    console.log("[GET /api/sales/leads] Tenant ID:", userData.tenant_id);

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const stage = searchParams.get("stage") as LeadStage | null;
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
        assigned_user:users!leads_assigned_to_fkey(id, name, avatar_url),
        created_user:users!leads_created_by_fkey(id, name, avatar_url)
      `,
        { count: "exact" }
      )
      .eq("tenant_id", userData.tenant_id);

    // Apply filters
    if (stage) {
      query = query.eq("stage", stage);
    }

    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo);
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (search) {
      query = query.or(
        `client_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,lead_number.ilike.%${search}%,property_name.ilike.%${search}%,property_city.ilike.%${search}%`
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
      "lead_number",
      "estimated_value",
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
      console.error(
        "[GET /api/sales/leads] Error fetching leads:",
        JSON.stringify(leadsError, null, 2)
      );
      console.error("[GET /api/sales/leads] Error code:", leadsError.code);
      console.error(
        "[GET /api/sales/leads] Error message:",
        leadsError.message
      );

      // Check if the error is because the table doesn't exist or RLS issue
      const isTableMissing =
        leadsError.code === "42P01" ||
        leadsError.code === "PGRST116" ||
        leadsError.message?.includes("does not exist") ||
        leadsError.message?.includes("relation") ||
        leadsError.message?.includes("permission denied");

      if (isTableMissing) {
        console.log(
          "[GET /api/sales/leads] Leads table issue - migration may not be run or RLS issue"
        );
        return NextResponse.json({
          leads: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          warning:
            "Leads module not initialized. Please run the database migration.",
        });
      }

      return NextResponse.json(
        { error: "Failed to fetch leads", details: leadsError.message },
        { status: 500 }
      );
    }

    console.log(
      "[GET /api/sales/leads] Successfully fetched",
      leads?.length || 0,
      "leads"
    );

    // Success - no warning
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
    console.error("[GET /api/sales/leads] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST /api/sales/leads - Create a new lead
export async function POST(request: NextRequest) {
  console.log("[POST /api/sales/leads] Starting request");

  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    console.log("[POST /api/sales/leads] User authenticated:", user!.id);

    const supabase = await createClient();

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error(
        "[POST /api/sales/leads] Error fetching user data:",
        userError
      );
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    if (!userData?.tenant_id) {
      console.log("[POST /api/sales/leads] User has no tenant");
      return NextResponse.json(
        { error: "User not found or no tenant" },
        { status: 404 }
      );
    }
    console.log("[POST /api/sales/leads] Tenant ID:", userData.tenant_id);

    const body: CreateLeadInput = await request.json();
    console.log(
      "[POST /api/sales/leads] Request body:",
      JSON.stringify(body, null, 2)
    );

    // Validate required fields
    if (!body.client_name?.trim()) {
      console.log(
        "[POST /api/sales/leads] Validation failed: client_name required"
      );
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }
    if (!body.phone?.trim()) {
      console.log("[POST /api/sales/leads] Validation failed: phone required");
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }
    // Email and property_type are optional for new leads

    // Create lead
    console.log("[POST /api/sales/leads] Creating lead in database");
    const { data: lead, error: createError } = await supabase
      .from("leads")
      .insert({
        tenant_id: userData.tenant_id,
        client_name: body.client_name.trim(),
        phone: body.phone.trim(),
        email: body.email?.trim().toLowerCase() || null,
        property_type: body.property_type || null,
        service_type: body.service_type || null,
        lead_source: body.lead_source || null,
        lead_source_detail: body.lead_source_detail || null,
        target_start_date: body.target_start_date || null,
        target_end_date: body.target_end_date || null,
        property_name: body.property_name || null,
        flat_number: body.flat_number || null,
        property_address: body.property_address || null,
        property_city: body.property_city || null,
        property_pincode: body.property_pincode || null,
        carpet_area_sqft: body.carpet_area_sqft || null,
        budget_range: body.budget_range || null,
        estimated_value: body.estimated_value || null,
        project_scope: body.project_scope || null,
        special_requirements: body.special_requirements || null,
        lead_score: body.lead_score || "warm",
        stage: "new",
        created_by: user.id,
        assigned_to: user.id, // Auto-assign to creator
        assigned_at: new Date().toISOString(),
        assigned_by: user.id,
      })
      .select(
        `
        *,
        assigned_user:users!leads_assigned_to_fkey(id, name, avatar_url),
        created_user:users!leads_created_by_fkey(id, name, avatar_url)
      `
      )
      .single();

    if (createError) {
      console.error(
        "[POST /api/sales/leads] Error creating lead:",
        JSON.stringify(createError, null, 2)
      );
      console.error("[POST /api/sales/leads] Error code:", createError.code);
      console.error(
        "[POST /api/sales/leads] Error message:",
        createError.message
      );
      console.error(
        "[POST /api/sales/leads] Error details:",
        createError.details
      );
      console.error("[POST /api/sales/leads] Error hint:", createError.hint);

      // Check if the error is because the table doesn't exist or RLS issue
      const isTableMissing =
        createError.code === "42P01" ||
        createError.code === "PGRST116" ||
        createError.message?.includes("does not exist") ||
        createError.message?.includes("relation");

      const isRLSIssue =
        createError.code === "42501" ||
        createError.message?.includes("permission denied") ||
        createError.message?.includes("new row violates row-level security");

      if (isTableMissing) {
        return NextResponse.json(
          {
            error:
              "Leads module not initialized. Please run the database migration (007_leads_module.sql).",
          },
          { status: 500 }
        );
      }

      if (isRLSIssue) {
        return NextResponse.json(
          {
            error:
              "Permission denied. RLS policy may not be configured correctly.",
            details: createError.message,
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create lead", details: createError.message },
        { status: 500 }
      );
    }

    console.log(
      "[POST /api/sales/leads] Lead created successfully:",
      lead.id,
      lead.lead_number
    );

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
      console.warn(
        "[POST /api/sales/leads] Failed to create activity:",
        activityError
      );
    }

    // Create note if provided
    if (body.notes?.trim()) {
      const { error: noteError } = await supabase.from("lead_notes").insert({
        lead_id: lead.id,
        content: body.notes.trim(),
        created_by: user.id,
      });

      if (noteError) {
        console.warn(
          "[POST /api/sales/leads] Failed to create note:",
          noteError
        );
      }
    }

    console.log("[POST /api/sales/leads] Request completed successfully");
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/sales/leads] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
