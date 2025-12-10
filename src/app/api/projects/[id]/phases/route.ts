import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/phases - Get all phases for a project
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

    // Verify project access
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

    // Verify project belongs to tenant
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch phases with sub-phases and checklist items
    const { data: phases, error } = await supabase
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

    if (error) {
      console.error("Error fetching phases:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch dependencies
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
        .select("project_phase_id, depends_on_phase_id, dependency_type")
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

    // Add dependencies to phases
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

    return NextResponse.json({ phases: phasesWithDeps || [] });
  } catch (error) {
    console.error("Phases API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/phases - Add a custom phase
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

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

    // Verify project access
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      category_code,
      phase_template_id,
      assigned_to,
      planned_start_date,
      planned_end_date,
      notes,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Phase name is required" },
        { status: 400 }
      );
    }

    // Get max display_order
    const { data: maxOrder } = await supabase
      .from("project_phases")
      .select("display_order")
      .eq("project_id", id)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const display_order = (maxOrder?.display_order || 0) + 1;

    // Create phase
    const { data: phase, error } = await supabase
      .from("project_phases")
      .insert({
        project_id: id,
        name,
        category_code,
        phase_template_id,
        assigned_to,
        planned_start_date,
        planned_end_date,
        notes,
        display_order,
      })
      .select(
        `
        *,
        assigned_user:users!assigned_to(id, name, email, avatar_url)
      `
      )
      .single();

    if (error) {
      console.error("Error creating phase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ phase }, { status: 201 });
  } catch (error) {
    console.error("Phases API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
