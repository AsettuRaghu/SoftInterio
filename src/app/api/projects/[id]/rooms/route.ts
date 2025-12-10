import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get rooms for a project (from quotation_spaces)
// Quotation can be linked via:
// 1. Direct project.quotation_id
// 2. Through the lead: project.converted_from_lead_id -> lead.id -> quotation.lead_id
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: projectId } = await params;
    const supabase = await createClient();

    // First, get the project to find the quotation_id and lead_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(
        "id, quotation_id, converted_from_lead_id, lead_id, project_number, name"
      )
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let quotationId = project.quotation_id;
    let quotation = null;

    // If no direct quotation_id, try to find via lead
    if (!quotationId) {
      const leadId = project.converted_from_lead_id || project.lead_id;

      if (leadId) {
        // Find quotation linked to this lead
        const { data: leadQuotation, error: leadQuotationError } =
          await supabase
            .from("quotations")
            .select("id, quotation_number")
            .eq("lead_id", leadId)
            .order("version", { ascending: false })
            .limit(1)
            .single();

        if (!leadQuotationError && leadQuotation) {
          quotationId = leadQuotation.id;
          quotation = leadQuotation;
        }
      }
    }

    if (!quotationId) {
      // No quotation linked either directly or through lead
      return NextResponse.json({
        rooms: [],
        message: "No quotation linked to this project",
      });
    }

    // Get the quotation info if not already fetched
    if (!quotation) {
      const { data: quotationData, error: quotationError } = await supabase
        .from("quotations")
        .select("id, quotation_number")
        .eq("id", quotationId)
        .single();

      if (quotationError) {
        console.error("Error fetching quotation:", quotationError);
        return NextResponse.json(
          { error: "Failed to fetch quotation" },
          { status: 500 }
        );
      }
      quotation = quotationData;
    }

    // Fetch rooms (spaces) from quotation_spaces
    const { data: spaces, error: spacesError } = await supabase
      .from("quotation_spaces")
      .select(
        `
        id,
        name,
        description,
        space_type_id,
        display_order,
        subtotal,
        metadata,
        space_types (
          id,
          name,
          slug,
          icon
        )
      `
      )
      .eq("quotation_id", quotationId)
      .order("display_order", { ascending: true });

    if (spacesError) {
      console.error("Error fetching spaces:", spacesError);
      return NextResponse.json(
        { error: "Failed to fetch rooms" },
        { status: 500 }
      );
    }

    // Get component counts per space
    const spaceIds = (spaces || []).map((s) => s.id);
    let componentCounts: Record<string, number> = {};

    if (spaceIds.length > 0) {
      const { data: components, error: componentsError } = await supabase
        .from("quotation_components")
        .select("space_id")
        .in("space_id", spaceIds);

      if (!componentsError && components) {
        componentCounts = components.reduce(
          (acc: Record<string, number>, comp) => {
            acc[comp.space_id] = (acc[comp.space_id] || 0) + 1;
            return acc;
          },
          {}
        );
      }
    }

    // Transform to ProjectRoom format
    const rooms = (spaces || []).map((space: any) => ({
      project_id: projectId,
      project_number: project.project_number,
      project_name: project.name,
      quotation_id: quotationId,
      quotation_number: quotation?.quotation_number || "",
      room_id: space.id,
      room_name: space.name,
      room_description: space.description,
      space_type: space.space_types?.slug || null,
      space_icon: space.space_types?.icon || null,
      display_order: space.display_order,
      room_total: space.subtotal || 0,
      room_metadata: space.metadata,
      component_count: componentCounts[space.id] || 0,
    }));

    return NextResponse.json({
      rooms,
      quotation_id: quotationId,
      quotation_number: quotation?.quotation_number,
    });
  } catch (error) {
    console.error("Error in GET /api/projects/[id]/rooms:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
