import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { generateUniqueProjectNumber } from "@/utils/project-number-generator";
import { projectAccess } from "@/lib/projects/access";
import { allowsDirectProjectCreate } from "@/lib/projects/settings";
import { requestLogger } from "@/lib/logger/request";

// GET /api/projects - List projects with phase summary
export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    // loadPermissions rather than requiredPermissions: the list is readable
    // with either the broad or the own-only grant, and the handler has to know
    // which one it got in order to scope the query.
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const access = projectAccess(guard.permissions, user.isSuperAdmin);

    if (access.denied) {
      log.warn("Projects list denied", { userId: user.id });
      return NextResponse.json(
        { error: "You do not have permission to view projects" },
        { status: 403 }
      );
    }

    const supabase = await createClient();
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
        contract_value,
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
      .eq("tenant_id", user.tenantId)
      .order("created_at", { ascending: false });

    // Someone limited to their own sees the projects they manage or created.
    // Applied before the caller-supplied filters so a crafted query string
    // cannot widen it.
    if (!access.readAll) {
      query = query.or(
        `project_manager_id.eq.${user.id},created_by.eq.${user.id}`
      );
    }

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
      log.error("Error fetching projects", error);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
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
        // contract_value is the agreed value; actual_cost is money spent.
        // These were previously the same field, which is why every project
        // showed as worth nothing.
        contract_value: p.contract_value ?? null,
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
    log.error("Unhandled error listing projects", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project with phases
export async function POST(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["projects.create"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // A project normally comes from a won lead, which brings the client,
    // property, quotation and scope with it. Direct creation is opt-in per
    // tenant. Checked here and not only in the UI: a hidden button is not a
    // control.
    if (!(await allowsDirectProjectCreate(supabase, user.tenantId))) {
      log.warn("Direct project creation is disabled for this tenant", {
        tenantId: user.tenantId,
      });
      return NextResponse.json(
        {
          error:
            "Projects are created from won leads. Direct creation is turned off for your organisation.",
          directCreateDisabled: true,
        },
        { status: 403 }
      );
    }

    // Check usage limits - can add projects?
    const { canAddProject } = await import("@/lib/billing/usage");
    const usageCheck = await canAddProject(user.tenantId);
    if (!usageCheck.canAdd) {
      log.info("Project limit reached", { tenantId: user.tenantId });
      return NextResponse.json(
        {
          error: usageCheck.message || "Project limit reached",
          upsellRequired: true,
          usage: {
            current: usageCheck.current,
            limit: usageCheck.limit,
            percentage: usageCheck.percentage,
          },
        },
        { status: 403 }
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
      start_date,
      expected_end_date,
      project_manager_id,
      lead_id,
      quotation_id,
      notes,
      initialize_phases = true, // Whether to initialize phases from templates
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    if (!client_name?.trim()) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    /**
     * The client and the property are separate records.
     *
     * This handler used to insert client_name, client_email, client_phone,
     * site_address, city, state, pincode, project_type, quoted_amount and
     * budget_amount straight onto projects. None of those are columns there,
     * so every request died with PGRST204 and manual project creation had
     * never once worked - unnoticed, because real projects come from the
     * create_project_from_lead RPC.
     *
     * The steps below mirror POST /api/sales/leads, which has always created
     * the client and property this way: a new client each time rather than
     * matching on email, the property optional, and both rolled back by hand
     * if the row that needed them fails.
     */

    // STEP 1: Create the client record.
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        tenant_id: user.tenantId,
        client_type: "individual",
        status: "active",
        name: client_name.trim(),
        phone: client_phone?.trim() || null,
        email: client_email?.trim().toLowerCase() || null,
        address_line1: site_address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        pincode: pincode?.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (clientError) {
      log.error("Error creating client for project", clientError);
      return NextResponse.json(
        { error: "Failed to create client record" },
        { status: 500 }
      );
    }

    // STEP 2: Create the property record, if there is anything to put in it.
    // Optional, exactly as on a lead - a project without a site address is
    // still a project.
    let propertyId: string | null = null;
    if (site_address || city || pincode) {
      const { data: property, error: propertyError } = await supabase
        .from("properties")
        .insert({
          tenant_id: user.tenantId,
          property_name: name.trim(),
          category: project_type || "residential",
          address_line1: site_address?.trim() || null,
          city: city?.trim() || "Unknown",
          pincode: pincode?.trim() || null,
        })
        .select("id")
        .single();

      if (propertyError) {
        log.warn("Continuing without a property record", {
          error: propertyError.message,
        });
      } else {
        propertyId = property.id;
      }
    }

    // Generate project number with retry logic to handle duplicates
    let projectNumber: string;
    try {
      projectNumber = await generateUniqueProjectNumber(user.tenantId);
    } catch (err) {
      log.error("Error generating project number", err);
      await supabase.from("clients").delete().eq("id", client.id);
      if (propertyId) {
        await supabase.from("properties").delete().eq("id", propertyId);
      }
      return NextResponse.json(
        { error: "Failed to generate project number" },
        { status: 500 }
      );
    }

    // STEP 3: Create the project itself.
    //
    // Only real columns. quoted_amount and budget_amount are deliberately not
    // stored: projects has no home for either, and actual_cost is not one -
    // the Overview tab shows it as money spent. A project's value comes from
    // its quotation, which is where the app already models it.
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        tenant_id: user.tenantId,
        project_number: projectNumber,
        name: name.trim(),
        description: description || null,
        client_id: client.id,
        property_id: propertyId,
        project_category: project_category || "turnkey",
        // The form field is start_date; this used to read expected_start_date
        // off the body and so silently dropped whatever was typed.
        expected_start_date: start_date || null,
        expected_end_date: expected_end_date || null,
        project_manager_id: project_manager_id || null,
        lead_id: lead_id || null,
        quotation_id: quotation_id || null,
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      log.error("Error creating project", error);
      // Undo the client and property so a failed attempt leaves nothing behind.
      await supabase.from("clients").delete().eq("id", client.id);
      if (propertyId) {
        await supabase.from("properties").delete().eq("id", propertyId);
      }
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    log.info("Project created", {
      projectId: project.id,
      projectNumber,
      fromLead: !!lead_id,
    });

    // Initialize phases from templates
    if (initialize_phases && project) {
      try {
        await supabase.rpc("initialize_project_phases", {
          p_project_id: project.id,
          p_tenant_id: user.tenantId,
          p_project_category: project_category || "turnkey",
        });
      } catch (phaseError) {
        log.error("Error initializing phases", phaseError, { projectId: project.id });
        // Don't fail the whole request, just log the error
      }
    }

    // Update the lead with project_id reference if created from a lead
    if (lead_id && project) {
      try {
        // Tenant-scoped: lead_id arrives in the request body, so without this
        // a caller could stamp their project id onto another business's lead.
        await supabase
          .from("leads")
          .update({ project_id: project.id })
          .eq("id", lead_id)
          .eq("tenant_id", user.tenantId);
      } catch (leadUpdateError) {
        log.error("Error linking project to lead", leadUpdateError, { projectId: project.id, leadId: lead_id });
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
    log.error("Unhandled error creating project", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
