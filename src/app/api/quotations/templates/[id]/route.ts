import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/quotations/templates/[id] - Get a single template with all details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createAdminClient();
    const { id } = await params;

    // Fetch template
    const { data: template, error } = await supabase
      .from("quotation_templates")
      .select("*")
      .eq("id", id)
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
        .from("template_line_items")
        .select(
          `
          *,
          space_type:space_types(id, name, slug),
          component_type:component_types(id, name, slug, icon),
          component_variant:component_variants(id, name, slug),
          cost_item:cost_items(id, name, slug, unit_code, default_rate, quality_tier, category:cost_item_categories(id, name, slug, color, icon))
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
    const supabase = createAdminClient();
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

    const { data: template, error } = await supabase
      .from("quotation_templates")
      .update(updateData)
      .eq("id", id)
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

        await supabase.from("template_spaces").insert(templateSpaces);
      }
    }

    // Update template line items if provided
    if (line_items !== undefined) {
      // Delete existing line items
      await supabase.from("template_line_items").delete().eq("template_id", id);

      // Insert new line items
      if (Array.isArray(line_items) && line_items.length > 0) {
        const templateLineItems = line_items.map((item, index) => ({
          template_id: id,
          space_type_id: item.space_type_id || null,
          component_type_id: item.component_type_id || null,
          component_variant_id: item.component_variant_id || null,
          cost_item_id: item.cost_item_id,
          group_name: item.group_name || null,
          rate: item.rate || null,
          display_order: item.display_order ?? index,
          notes: item.notes || null,
          metadata: item.metadata || null,
        }));

        await supabase.from("template_line_items").insert(templateLineItems);
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
        .from("template_line_items")
        .select(
          `
          *,
          space_type:space_types(id, name, slug),
          component_type:component_types(id, name, slug),
          component_variant:component_variants(id, name, slug),
          cost_item:cost_items(id, name, slug, unit_code, default_rate, category:cost_item_categories(id, name, slug, color))
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
    const supabase = createAdminClient();
    const { id } = await params;

    // Soft delete by setting is_active to false
    const { data: template, error } = await supabase
      .from("quotation_templates")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
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
