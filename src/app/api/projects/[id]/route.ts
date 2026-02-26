import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get single project with all phases
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

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

    // Fetch project with relations
    const { data: project, error } = await supabase
      .from("projects")
      .select(
        `
        *,
        project_manager:users!project_manager_id(id, name, email, avatar_url),
        client:clients!client_id(id, name, email, phone),
        property:properties!property_id(id, property_name, property_type, unit_number, address_line1, city, pincode, carpet_area),
        lead:leads!lead_id(id, lead_number, service_type, lead_source, budget_range, won_amount)
      `
      )
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (error) {
      console.error("Error fetching project:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch phases with sub-phases
    const { data: phases } = await supabase
      .from("project_phases")
      .select(
        `
        *,
        assigned_user:users!assigned_to(id, name, email, avatar_url),
        sub_phases:project_sub_phases(
          *,
          assigned_user:users!assigned_to(id, name, email, avatar_url),
          checklist_items:project_checklist_items(*)
        )
      `
      )
      .eq("project_id", id)
      .order("display_order", { ascending: true });

    // Fetch phase dependencies
    const phaseIds = phases?.map((p) => p.id) || [];
    let dependencies: Record<
      string,
      Array<{
        id: string;
        name: string;
        status: string;
        dependency_type: string;
      }>
    > = {};

    if (phaseIds.length > 0) {
      const { data: deps } = await supabase
        .from("project_phase_dependencies")
        .select(
          `
          project_phase_id,
          depends_on_phase_id,
          dependency_type
        `
        )
        .in("project_phase_id", phaseIds);

      if (deps && phases) {
        for (const dep of deps) {
          const dependsOnPhase = phases.find(
            (p) => p.id === dep.depends_on_phase_id
          );
          if (dependsOnPhase) {
            if (!dependencies[dep.project_phase_id]) {
              dependencies[dep.project_phase_id] = [];
            }
            dependencies[dep.project_phase_id].push({
              id: dependsOnPhase.id,
              name: dependsOnPhase.name,
              status: dependsOnPhase.status,
              dependency_type: dep.dependency_type,
            });
          }
        }
      }
    }

    // Add dependencies and blocking info to phases
    const phasesWithDeps = phases?.map((phase) => {
      const phaseDeps = dependencies[phase.id] || [];
      const blockingDeps = phaseDeps
        .filter((d) => d.dependency_type === "hard" && d.status !== "completed")
        .map((d) => d.name);

      return {
        ...phase,
        dependencies: phaseDeps,
        blocking_dependencies: blockingDeps,
        is_blocked: blockingDeps.length > 0,
      };
    });

    // Fetch full project details with client and property relations for flattening
    // Note: We fetch all related data separately to avoid Supabase join syntax issues
    const { data: fullProject, error: fullProjectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (fullProjectError) {
       console.error("Error fetching full project details:", fullProjectError);
       return NextResponse.json(
         { error: "Failed to fetch project details" },
         { status: 500 }
       );
    }
    
    // Fetch project manager data separately if project_manager_id exists
    let pManager = null;
    if (fullProject?.project_manager_id) {
      const { data: managerData } = await supabase
        .from("users")
        .select("id, name, email, avatar_url")
        .eq("id", fullProject.project_manager_id)
        .single();
      pManager = managerData;
    }
    
    // Fetch client data separately if client_id exists
    let pClient = null;
    if (fullProject?.client_id) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("name, email, phone")
        .eq("id", fullProject.client_id)
        .single();
      pClient = clientData;
    }
    
    // Fetch property data separately if property_id exists
    let pProperty = null;
    if (fullProject?.property_id) {
      const { data: propertyData } = await supabase
        .from("properties")
        .select(`
          id,
          property_name,
          property_type,
          property_subtype,
          unit_number,
          address_line1,
          city,
          pincode,
          carpet_area
        `)
        .eq("id", fullProject.property_id)
        .single();
      pProperty = propertyData;
    }
    
    // Fetch lead data if converted from lead
    let pLead = null;
    let effectiveSalesRep = null;
    let assignedByUser = null;
    if (fullProject?.lead_id) {
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select(`
          id,
          lead_number,
          lead_source,
          service_type,
          stage,
          budget_range,
          won_amount,
          won_at,
          contract_signed_date,
          expected_project_start,
          target_start_date,
          target_end_date,
          assigned_to,
          assigned_by,
          assigned_user:users!leads_assigned_to_fkey(id, name, email, avatar_url),
          created_by_user:users!leads_assigned_by_fkey(id, name, email, avatar_url)
        `)
        .eq("id", fullProject.lead_id)
        .single();
      
      if (leadError) {
        console.error("Error fetching lead data:", leadError);
      }
      
      pLead = leadData;
      effectiveSalesRep = leadData?.assigned_user;
      assignedByUser = leadData?.created_by_user;
    }
    
    const flattenedProject = {
      ...project,
      
      // Relations - all fetched separately
      client: pClient,
      property: pProperty,
      lead: pLead,
      sales_rep: effectiveSalesRep,
      assigned_by_user: assignedByUser,
      project_manager: pManager || project.project_manager
    };

    // Fetch payment milestones
    const { data: paymentMilestones } = await supabase
      .from("project_payment_milestones")
      .select(
        `
        *,
        linked_phase:project_phases!linked_phase_id(id, name, status)
      `
      )
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    // Fetch lead data if project was converted from lead
    let leadData = null;
    let leadActivities = null;
    
    // Try to find linked lead ID
    let leadId = project.lead_id;

    // Fallback: If no link on project, check if any lead points to this project
    if (!leadId) {
      const { data: reverseLinkedLead } = await supabase
        .from("leads")
        .select("id")
        .eq("project_id", id)
        .limit(1)
        .single();
      
      if (reverseLinkedLead) {
        leadId = reverseLinkedLead.id;
        // Optionally update the project to fix the missing link
        await supabase
          .from("projects")
          .update({ lead_id: leadId, converted_from_lead_id: leadId })
          .eq("id", id);
      }
    }

    if (leadId) {

      const { data: lead } = await supabase
        .from("leads")
        .select(
          `
          id,
          lead_number,
          lead_number,
          stage,
          property_name,
          property_type,
          flat_number,
          property_address,
          property_city,
          property_pincode,
          carpet_area_sqft,
          service_type,
          project_scope,
          special_requirements,
          budget_range,
          won_amount,
          contract_signed_date,
          expected_project_start,
          target_start_date,
          target_end_date,
          lead_source,
          assigned_to,
          created_at,
          updated_at,
          won_at,
          client:clients!client_id(name, email, phone),
          assigned_user:users!assigned_to(id, name, email, avatar_url)
        `
        )
        .eq("id", leadId)
        .single();

      if (lead) {
        // Calculate lead duration
        const leadDurationDays =
          lead.won_at && lead.created_at
            ? Math.floor(
                (new Date(lead.won_at).getTime() -
                  new Date(lead.created_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null;

        // Fetch lead activities/history
        const { data: activities, count } = await supabase
          .from("lead_activities")
          .select(
            `
            id,
            activity_type,
            title,
            description,
            created_at,
            created_by,
            creator:users!created_by(id, name)
          `,
            { count: "exact" }
          )
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(50);

        leadActivities = activities;

        // Build lead data with calculated fields and flattened client info
        // Handle client relation which might be returned as an array or object
        const linkedClient = Array.isArray(lead.client) ? lead.client[0] : lead.client;
        
        leadData = {
          ...lead,
          client_name: linkedClient?.name || "Unknown",
          email: linkedClient?.email,
          phone: linkedClient?.phone,
          lead_duration_days: leadDurationDays,
          activity_count: count || 0,
        };
      }
    }

    // Fetch calendar events linked to this project
    const { data: calendarEvents } = await supabaseAdmin
      .from("calendar_events")
      .select(
        `
        *,
        created_user:users!calendar_events_created_by_fkey(id, name, avatar_url)
      `
      )
      .eq("tenant_id", userData.tenant_id)
      .eq("linked_type", "project")
      .eq("linked_id", id)
      .order("scheduled_at", { ascending: false });

    return NextResponse.json({
      project: {
        ...flattenedProject,
        // Flatten client and property info for frontend convenience
        client_name: pClient?.name || flattenedProject.client_name || "Unknown Client",
        client_email: pClient?.email || flattenedProject.client_email,
        client_phone: pClient?.phone || flattenedProject.client_phone,
        property_name: pProperty?.property_name || project.property?.property_name || flattenedProject.property_name || "Unknown Property",
        property: pProperty || project.property, // Use pProperty if available, fallback to initial query result
        priority: fullProject?.priority,
        current_phase: fullProject?.current_phase,
        current_phase_id: fullProject?.current_phase_id,
        quoted_amount: fullProject?.actual_cost, // Map to quoted_amount for display
        actual_cost: fullProject?.actual_cost,
        lead_id: fullProject?.lead_id, // Include lead_id for navigation
        won_amount: pLead?.won_amount, // Include won amount from lead
        phases: phasesWithDeps || [],
        payment_milestones: paymentMilestones || [],
        lead_activities: leadActivities,
        calendar_events: calendarEvents || [],
      },
    });
  } catch (error) {
    console.error("Project API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
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

    // Separate property updates from project updates
    // Extended property fields need to be extracted
    const {
        block_tower,
        built_up_area,
        super_built_up_area,
        bedrooms,
        bathrooms,
        balconies,
        floor_number,
        total_floors,
        facing,
        furnishing_status,
        age_of_property,
        parking_slots,
        has_lift,
        has_gym,
        has_power_backup,
        has_security,
        // Existing flat property fields that we want to sync to property table
        property_name,
        property_type,
        flat_number, // maps to unit_number
        carpet_area_sqft, // maps to carpet_area
        site_address, // maps to address_line1
        city,
        pincode,
        // Client updates
        client_name,
        client_email,
        client_phone,
        // Project specific fields that shouldn't be forwarded
        phases,
        payment_milestones,
        project_manager,
        phase_summary,
        ...projectUpdateData
    } = body;

    // 1. Update Project Table
    const { data: existingProject, error: fetchError } = await supabase
        .from("projects")
        .select("property_id")
        .eq("id", id)
        .single();
    
    if (fetchError) throw fetchError;

    // Prepare project updates (keep original project fields)
    // We can also update the denormalized fields on project if they exist there, 
    // but we prioritize checking what columns actually exist. 
    // Based on schemas, project has property_type, etc. So we should update project too if those columns exist.
    // However, the prompt says "removed from projects table".
    // So we primarily rely on `projectUpdateData`. 
    // We will manually add back the ones that ARE on the project table if needed.
    // Checking types: Project has property_type, project_category, status, etc.
    
    const projectUpdates: any = { ...projectUpdateData };
    if (body.project_category) projectUpdates.project_category = body.project_category;
    if (body.status) projectUpdates.status = body.status;
    if (body.description) projectUpdates.description = body.description;
    if (body.notes) projectUpdates.notes = body.notes;
    // ... maps other direct fields automatically via ...projectUpdateData

    const { data: project, error } = await supabase
      .from("projects")
      .update(projectUpdates)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating project:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Update Property Table if property_id exists
    if (existingProject?.property_id) {
      const propertyUpdates: any = {};
      
      // Map fields
      if (property_name !== undefined) propertyUpdates.property_name = property_name;
      if (property_type !== undefined) propertyUpdates.property_type = property_type;
      if (flat_number !== undefined) propertyUpdates.unit_number = flat_number;
      if (carpet_area_sqft !== undefined) propertyUpdates.carpet_area = carpet_area_sqft;
      if (site_address !== undefined) propertyUpdates.address_line1 = site_address;
      if (city !== undefined) propertyUpdates.city = city;
      if (pincode !== undefined) propertyUpdates.pincode = pincode;

      // Extended fields
      if (block_tower !== undefined) propertyUpdates.block_tower = block_tower;
      if (built_up_area !== undefined) propertyUpdates.built_up_area = built_up_area;
      if (super_built_up_area !== undefined) propertyUpdates.super_built_up_area = super_built_up_area;
      if (bedrooms !== undefined) propertyUpdates.bedrooms = bedrooms;
      if (bathrooms !== undefined) propertyUpdates.bathrooms = bathrooms;
      if (balconies !== undefined) propertyUpdates.balconies = balconies;
      if (floor_number !== undefined) propertyUpdates.floor_number = floor_number;
      if (total_floors !== undefined) propertyUpdates.total_floors = total_floors;
      if (facing !== undefined) propertyUpdates.facing = facing;
      if (furnishing_status !== undefined) propertyUpdates.furnishing_status = furnishing_status;

      if (Object.keys(propertyUpdates).length > 0) {
        const { error: propError } = await supabase
          .from("properties")
          .update(propertyUpdates)
          .eq("id", existingProject.property_id);
        
        if (propError) {
          console.error("Error updating property:", propError);
          // We don't fail the whole request, but log it
        }
      }
    }

    // 3. Update Client Table if client information is provided
    if (client_name !== undefined || client_email !== undefined || client_phone !== undefined) {
      // First, fetch the current project to get client_id
      const { data: currentProject, error: currentProjectError } = await supabase
        .from("projects")
        .select("client_id")
        .eq("id", id)
        .single();

      if (!currentProjectError && currentProject?.client_id) {
        const clientUpdates: any = {};
        
        if (client_name !== undefined) clientUpdates.name = client_name;
        if (client_email !== undefined) clientUpdates.email = client_email;
        if (client_phone !== undefined) clientUpdates.phone = client_phone;

        if (Object.keys(clientUpdates).length > 0) {
          const { error: clientError } = await supabase
            .from("clients")
            .update(clientUpdates)
            .eq("id", currentProject.client_id)
            .eq("tenant_id", userData.tenant_id);
          
          if (clientError) {
            console.error("Error updating client:", clientError);
            // We don't fail the whole request, but log it
          }
        }
      }
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Project API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Soft delete project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
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

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from("projects")
      .update({ is_active: false })
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (error) {
      console.error("Error deleting project:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Project API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
