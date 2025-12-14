import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/quotations/templates/[id] - Get a single template with all details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const { id } = await params;

    // Fetch template - filter by tenant for security
    const { data: template, error } = await supabase
      .from("quotation_templates")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", user!.tenantId)
      .single();

    if (error) {
      console.error("Error fetching template:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch template" },
        { status: 500 }
      );
    }

    // Fetch template spaces and line items in parallel
    const [spacesResult, lineItemsResult] = await Promise.all([
      supabase
        .from("template_spaces")
        .select("*, space_type:space_types(id, name, slug, icon)")
        .eq("template_id", id)
        .order("display_order", { ascending: true }),
      supabase
        .from("quotation_template_line_items")
        .select(
          `
          *,
          space_type:space_types(id, name, slug),
          component_type:component_types(id, name, slug, icon),
          cost_item:quotation_cost_items(id, name, slug, unit_code, default_rate, quality_tier, category:quotation_cost_item_categories(id, name, slug, color, icon))
        `
        )
        .eq("template_id", id)
        .order("display_order", { ascending: true }),
    ]);

    // Group line items by hierarchy for easier display
    const lineItemsBySpace: Record<string, typeof lineItemsResult.data> = {};
    const lineItemsByComponent: Record<string, typeof lineItemsResult.data> =
      {};
    const ungroupedLineItems: typeof lineItemsResult.data = [];

    (lineItemsResult.data || []).forEach((item) => {
      if (item.component_type_id) {
        const key = `${item.space_type_id || "none"}-${item.component_type_id}`;
        if (!lineItemsByComponent[key]) {
          lineItemsByComponent[key] = [];
        }
        lineItemsByComponent[key]!.push(item);
      } else if (item.space_type_id) {
        if (!lineItemsBySpace[item.space_type_id]) {
          lineItemsBySpace[item.space_type_id] = [];
        }
        lineItemsBySpace[item.space_type_id]!.push(item);
      } else {
        ungroupedLineItems.push(item);
      }
    });

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        spaces: spacesResult.data || [],
        line_items: lineItemsResult.data || [],
      },
      grouped: {
        line_items_by_space: lineItemsBySpace,
        line_items_by_component: lineItemsByComponent,
        ungrouped_line_items: ungroupedLineItems,
      },
    });
  } catch (error) {
    console.error("Template API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/quotations/templates/[id] - Update a template
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      description,
      property_type,
      quality_tier,
      base_price,
      template_data,
      spaces,
      line_items,
      is_active,
      is_featured,
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (property_type !== undefined) updateData.property_type = property_type;
    if (quality_tier !== undefined) updateData.quality_tier = quality_tier;
    if (base_price !== undefined) updateData.base_price = base_price;
    if (template_data !== undefined) updateData.template_data = template_data;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (is_featured !== undefined) updateData.is_featured = is_featured;

    // Update template - filter by tenant for security
    const { data: template, error } = await supabase
      .from("quotation_templates")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", user!.tenantId)
      .select()
      .single();

    if (error) {
      console.error("Error updating template:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      );
    }

    // Map to track client space IDs to database space IDs
    const spaceIdMap = new Map<string, string>();

    // Update template spaces if provided
    if (spaces !== undefined) {
      // Delete existing spaces
      await supabase.from("template_spaces").delete().eq("template_id", id);

      // Insert new spaces
      if (Array.isArray(spaces) && spaces.length > 0) {
        const templateSpaces = spaces.map((space, index) => ({
          template_id: id,
          space_type_id: space.space_type_id,
          default_name: space.default_name || null,
          display_order: space.display_order ?? index,
        }));

        const { data: insertedSpaces } = await supabase
          .from("template_spaces")
          .insert(templateSpaces)
          .select("id, space_type_id, display_order");

        // Build the mapping from client space index to database space ID
        insertedSpaces?.forEach((dbSpace) => {
          const clientSpace = spaces.find(
            (s, idx) =>
              s.space_type_id === dbSpace.space_type_id &&
              (s.display_order ?? idx) === dbSpace.display_order
          );
          if (clientSpace && clientSpace.client_id) {
            spaceIdMap.set(clientSpace.client_id, dbSpace.id);
          }
        });
      }
    }

    // Update template line items if provided
    if (line_items !== undefined) {
      // Delete existing line items
      await supabase.from("quotation_template_line_items").delete().eq("template_id", id);

      // Insert new line items
      if (Array.isArray(line_items) && line_items.length > 0) {
        const templateLineItems = line_items.map((item, index) => {
          // Try to resolve template_space_id from client_space_id
          const templateSpaceId = item.client_space_id
            ? spaceIdMap.get(item.client_space_id) || null
            : null;

          return {
            template_id: id,
            template_space_id: templateSpaceId,
            space_type_id: item.space_type_id || null,
            component_type_id: item.component_type_id || null,
            cost_item_id: item.cost_item_id,
            rate: item.rate || null,
            display_order: item.display_order ?? index,
            notes: item.notes || null,
            metadata: item.metadata || null,
          };
        });

        await supabase.from("quotation_template_line_items").insert(templateLineItems);
      }
    }

    // Fetch updated template with details
    const [spacesResult, lineItemsResult] = await Promise.all([
      supabase
        .from("template_spaces")
        .select("*, space_type:space_types(id, name, slug, icon)")
        .eq("template_id", id)
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
        .eq("template_id", id)
        .order("display_order", { ascending: true }),
    ]);

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        spaces: spacesResult.data || [],
        line_items: lineItemsResult.data || [],
      },
    });
  } catch (error) {
    console.error("Update template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/quotations/templates/[id] - Delete (archive) a template
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const { id } = await params;

    // Soft delete by setting is_active to false - filter by tenant for security
    const { data: template, error } = await supabase
      .from("quotation_templates")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", user!.tenantId)
      .select()
      .single();

    if (error) {
      console.error("Error deleting template:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Template archived successfully",
      template,
    });
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
