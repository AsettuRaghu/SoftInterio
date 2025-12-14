import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/quotations/templates/[id]/duplicate - Duplicate a template
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const { id } = await params;

    // Fetch the original template - filter by tenant for security
    const { data: originalTemplate, error: templateError } = await supabase
      .from("quotation_templates")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", user!.tenantId)
      .single();

    if (templateError || !originalTemplate) {
      console.error("Error fetching template:", templateError);
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Fetch template spaces and line items
    const [spacesResult, lineItemsResult] = await Promise.all([
      supabase
        .from("template_spaces")
        .select("*")
        .eq("template_id", id)
        .order("display_order", { ascending: true }),
      supabase
        .from("quotation_template_line_items")
        .select("*")
        .eq("template_id", id)
        .order("display_order", { ascending: true }),
    ]);

    // Create the new template with "_copy" suffix
    const newName = `${originalTemplate.name}_copy`;
    const { data: newTemplate, error: createError } = await supabase
      .from("quotation_templates")
      .insert({
        tenant_id: user!.tenantId,
        name: newName,
        description: originalTemplate.description,
        property_type: originalTemplate.property_type,
        quality_tier: originalTemplate.quality_tier,
        base_price: originalTemplate.base_price,
        template_data: originalTemplate.template_data || {},
        is_active: true,
        is_featured: false,
        created_by: user!.id,
      })
      .select()
      .single();

    if (createError || !newTemplate) {
      console.error("Error creating duplicate template:", createError);
      return NextResponse.json(
        { error: "Failed to create duplicate template" },
        { status: 500 }
      );
    }

    // Copy template spaces and build a mapping from old space ID to new space ID
    // This is critical for properly linking line items to the correct space instances
    const spaceIdMapping: Record<string, string> = {};
    
    if (spacesResult.data && spacesResult.data.length > 0) {
      // Insert spaces one by one to get the new IDs for mapping
      for (const space of spacesResult.data) {
        const { data: newSpace, error: spaceError } = await supabase
          .from("template_spaces")
          .insert({
            template_id: newTemplate.id,
            space_type_id: space.space_type_id,
            default_name: space.default_name,
            display_order: space.display_order,
          })
          .select("id")
          .single();

        if (spaceError) {
          console.error("Error copying template space:", spaceError);
        } else if (newSpace) {
          // Map old space ID to new space ID
          spaceIdMapping[space.id] = newSpace.id;
        }
      }
    }

    // Copy template line items with proper template_space_id mapping
    if (lineItemsResult.data && lineItemsResult.data.length > 0) {
      const newLineItems = lineItemsResult.data.map((item) => ({
        template_id: newTemplate.id,
        space_type_id: item.space_type_id,
        // Map the template_space_id to the new space's ID
        template_space_id: item.template_space_id ? spaceIdMapping[item.template_space_id] || null : null,
        component_type_id: item.component_type_id,
        cost_item_id: item.cost_item_id,
        rate: item.rate,
        display_order: item.display_order,
        notes: item.notes,
        metadata: item.metadata,
      }));

      const { error: itemsError } = await supabase
        .from("quotation_template_line_items")
        .insert(newLineItems);

      if (itemsError) {
        console.error("Error copying template line items:", itemsError);
      }
    }

    // Fetch the created template with all details
    const [newSpacesResult, newLineItemsResult] = await Promise.all([
      supabase
        .from("template_spaces")
        .select("*, space_type:space_types(id, name, slug, icon)")
        .eq("template_id", newTemplate.id)
        .order("display_order", { ascending: true }),
      supabase
        .from("quotation_template_line_items")
        .select(
          `
          *,
          space_type:space_types(id, name, slug),
          component_type:component_types(id, name, slug),
          cost_item:quotation_cost_items(id, name, slug, unit_code, default_rate, category:quotation_cost_item_categories(id, name, slug, color))
        `
        )
        .eq("template_id", newTemplate.id)
        .order("display_order", { ascending: true }),
    ]);

    return NextResponse.json(
      {
        success: true,
        template: {
          ...newTemplate,
          spaces: newSpacesResult.data || [],
          line_items: newLineItemsResult.data || [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Duplicate template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
