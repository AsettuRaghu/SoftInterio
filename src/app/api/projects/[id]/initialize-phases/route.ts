import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/initialize-phases - Initialize phases from templates
// This version calls an RPC function that handles all enum casting in PostgreSQL
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

    // Get project with category
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, project_category, tenant_id")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectCategory = project.project_category || "turnkey";

    // Option to force re-initialize - we always use the RPC which handles this internally
    const body = await request.json().catch(() => ({}));
    const forceReinitialize = body.force === true;

    // Check existing phases if not forcing
    if (!forceReinitialize) {
      const { data: existingPhases } = await supabase
        .from("project_phases")
        .select("id")
        .eq("project_id", id);

      if (existingPhases && existingPhases.length > 0) {
        return NextResponse.json(
          {
            error: "Phases already exist for this project",
            existingCount: existingPhases.length,
            hint: "Pass { force: true } to re-initialize",
          },
          { status: 409 }
        );
      }
    }

    // Call the RPC function that handles all enum casting properly
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "initialize_project_phases_v2",
      {
        p_project_id: id,
        p_tenant_id: userData.tenant_id,
        p_project_category: projectCategory,
      }
    );

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      return NextResponse.json(
        {
          error: "Failed to initialize phases",
          details: rpcError.message,
          code: rpcError.code,
        },
        { status: 500 }
      );
    }

    // rpcResult should be a JSON object with success, phases_created, sub_phases_created, dependencies_created
    if (rpcResult && rpcResult.success) {
      return NextResponse.json({
        success: true,
        message: `Initialized ${rpcResult.phases_created} phases with ${rpcResult.sub_phases_created} sub-phases and ${rpcResult.dependencies_created} dependencies`,
        summary: {
          phases: rpcResult.phases_created,
          subPhases: rpcResult.sub_phases_created,
          dependencies: rpcResult.dependencies_created,
        },
      });
    } else {
      return NextResponse.json(
        {
          error: "Initialization returned unexpected result",
          details: rpcResult,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error initializing phases:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
