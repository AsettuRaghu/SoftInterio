import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { generateUniqueProjectNumber } from "@/utils/project-number-generator";

// GET /api/projects - List projects with phase summary
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get user's tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const project_category = searchParams.get("project_category") || "";
    const project_type = searchParams.get("project_type") || "";
    const project_manager_id = searchParams.get("project_manager_id") || "";
    const is_active = searchParams.get("is_active");

    let query = supabase
      .from("projects")
      .select(
        `
        id,
        project_number,
        name,
        description,
        status,
        priority,
        expected_start_date,
        expected_end_date,
        actual_end_date,
        actual_cost,
        overall_progress,
        created_at,
        updated_at,
        project_category,
        is_active,
        current_phase_id,
        client:clients!client_id(name),
        project_manager:users!project_manager_id(id, name, email, avatar_url),
        property:properties!property_id(property_name, property_type, carpet_area, city),
        lead:leads!lead_id(service_type)
      `,
        { count: "exact" }
      )
      .eq("tenant_id", userData.tenant_id)
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      // For searching linked client name, we need to rely on the client relation
      // Supabase/PostgREST doesn't support easy deep filtering on joined generic columns without embedding
      // A common workaround is searching the project name/number normally, 
      // OR doing a separate search for clients and filtering by ID.
      // For now, simpler fuzzy search on project fields:
      query = query.or(
        `project_number.ilike.%${search}%,name.ilike.%${search}%`
      );
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (project_category) {
      query = query.eq("project_category", project_category);
    }

    if (project_type) {
      query = query.eq("project_type", project_type);
    }

    if (project_manager_id) {
      query = query.eq("project_manager_id", project_manager_id);
    }

    if (is_active !== null && is_active !== "") {
      query = query.eq("is_active", is_active === "true");
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: projects, error, count } = await query;

    if (error) {
      console.error("Error fetching projects:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Attach flat client_name and property/service data to projects
    let projectsWithClientName = projects?.map((p: any) => {
      const pClient = Array.isArray(p.client) ? p.client[0] : p.client;
      const pProperty = Array.isArray(p.property) ? p.property[0] : p.property;
      const pLead = Array.isArray(p.lead) ? p.lead[0] : p.lead;
      return {
        ...p,
        client_name: pClient?.name || "Unknown Client",
        service_type: pLead?.service_type,
        property_name: pProperty?.property_name || "Unknown Property",
        property_type: pProperty?.property_type,
        carpet_area: pProperty?.carpet_area,
        city: pProperty?.city,
        quoted_amount: p.actual_cost || 0, // Map actual_cost to quoted_amount for frontend
        project_type: p.project_category, // Use project_category as project_type
        priority: p.priority || "Medium", // Default to Medium if not set
        current_phase: null, // Will be populated if current_phase_id exists
      };
    }) || [];

    // Fetch phase names for projects that have current_phase_id
    const phaseIds = projectsWithClientName
      .filter((p: any) => p.current_phase_id)
      .map((p: any) => p.current_phase_id);

    if (phaseIds.length > 0) {
      const { data: phases } = await supabase
        .from("project_phases")
        .select("id, name")
        .in("id", phaseIds);

      const phaseMap = new Map(phases?.map((phase: any) => [phase.id, phase.name]) || []);

      projectsWithClientName = projectsWithClientName.map((p: any) => ({
        ...p,
        current_phase: p.current_phase_id ? phaseMap.get(p.current_phase_id) : null,
      }));
    }

    return NextResponse.json({
      projects: projectsWithClientName,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Projects API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project with phases
export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get user's tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      client_name,
      client_email,
      client_phone,
      site_address,
      city,
      state,
      pincode,
      project_type,
      project_category = "turnkey",
      expected_start_date,
      expected_end_date,
      quoted_amount,
      budget_amount,
      project_manager_id,
      lead_id,
      quotation_id,
      notes,
      initialize_phases = true, // Whether to initialize phases from templates
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    // Generate project number with retry logic to handle duplicates
    let projectNumber: string;
    try {
      projectNumber = await generateUniqueProjectNumber(userData.tenant_id);
    } catch (err) {
      console.error("Error generating project number:", err);
      return NextResponse.json(
        { error: "Failed to generate project number" },
        { status: 500 }
      );
    }

    // Create project
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        tenant_id: userData.tenant_id,
        project_number: projectNumber,
        name,
        description,
        client_name,
        client_email,
        client_phone,
        site_address,
        city,
        state,
        pincode,
        project_type: project_type || "residential",
        project_category: project_category || "turnkey",
        expected_start_date,
        expected_end_date,
        quoted_amount: quoted_amount || 0,
        budget_amount: budget_amount || 0,
        project_manager_id,
        lead_id,
        quotation_id,
        notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating project:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Initialize phases from templates
    if (initialize_phases && project) {
      try {
        await supabase.rpc("initialize_project_phases", {
          p_project_id: project.id,
          p_tenant_id: userData.tenant_id,
          p_project_category: project_category || "turnkey",
        });
      } catch (phaseError) {
        console.error("Error initializing phases:", phaseError);
        // Don't fail the whole request, just log the error
      }
    }

    // Update the lead with project_id reference if created from a lead
    if (lead_id && project) {
      try {
        await supabase
          .from("leads")
          .update({ project_id: project.id })
          .eq("id", lead_id);
      } catch (leadUpdateError) {
        console.error("Error linking project to lead:", leadUpdateError);
        // Don't fail - project was created successfully
      }
    }

    // Fetch the project with phases
    const { data: projectWithPhases } = await supabase
      .from("projects")
      .select(
        `
        *,
        project_manager:users!project_manager_id(id, name, email, avatar_url),
        phases:project_phases(*)
      `
      )
      .eq("id", project.id)
      .single();

    return NextResponse.json(
      { project: projectWithPhases || project },
      { status: 201 }
    );
  } catch (error) {
    console.error("Projects API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
