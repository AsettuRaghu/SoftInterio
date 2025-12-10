import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
        project_manager:users!project_manager_id(id, name, email, avatar_url)
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
    if (project.converted_from_lead_id || project.lead_id) {
      const leadId = project.converted_from_lead_id || project.lead_id;

      const { data: lead } = await supabase
        .from("leads")
        .select(
          `
          id,
          lead_number,
          client_name,
          email,
          phone,
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
          estimated_value,
          won_amount,
          contract_signed_date,
          expected_project_start,
          target_start_date,
          target_end_date,
          lead_source,
          lead_source_detail,
          assigned_to,
          created_at,
          updated_at,
          won_at,
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

        // Build lead data with calculated fields
        leadData = {
          ...lead,
          lead_duration_days: leadDurationDays,
          activity_count: count || 0,
        };
      }
    }

    return NextResponse.json({
      project: {
        ...project,
        phases: phasesWithDeps || [],
        payment_milestones: paymentMilestones || [],
        lead: leadData,
        lead_activities: leadActivities,
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

    // Remove non-updatable fields
    const {
      phases,
      payment_milestones,
      project_manager,
      phase_summary,
      ...updateData
    } = body;

    const { data: project, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating project:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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
