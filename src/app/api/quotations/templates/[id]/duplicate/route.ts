import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/quotations/templates/[id]/duplicate - Duplicate a template
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const adminSupabase = createAdminClient();
    const userSupabase = await createClient();
    const { id } = await params;

    // Get current user for created_by
    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's tenant_id
    const { data: userProfile, error: profileError } = await adminSupabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile?.tenant_id) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Fetch the original template
    const { data: originalTemplate, error: templateError } = await adminSupabase
      .from("quotation_templates")
      .select("*")
      .eq("id", id)
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
      adminSupabase
        .from("template_spaces")
        .select("*")
        .eq("template_id", id)
        .order("display_order", { ascending: true }),
      adminSupabase
        .from("template_line_items")
        .select("*")
        .eq("template_id", id)
        .order("display_order", { ascending: true }),
    ]);

    // Create the new template with "_copy" suffix
    const newName = `${originalTemplate.name}_copy`;
    const { data: newTemplate, error: createError } = await adminSupabase
      .from("quotation_templates")
      .insert({
        tenant_id: userProfile.tenant_id,
        name: newName,
        description: originalTemplate.description,
        property_type: originalTemplate.property_type,
        quality_tier: originalTemplate.quality_tier,
        base_price: originalTemplate.base_price,
        template_data: originalTemplate.template_data || {},
        is_active: true,
        is_featured: false,
        created_by: user.id,
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

    // Copy template spaces
    if (spacesResult.data && spacesResult.data.length > 0) {
      const newSpaces = spacesResult.data.map((space) => ({
        template_id: newTemplate.id,
        space_type_id: space.space_type_id,
        default_name: space.default_name,
        display_order: space.display_order,
      }));

      const { error: spacesError } = await adminSupabase
        .from("template_spaces")
        .insert(newSpaces);

      if (spacesError) {
        console.error("Error copying template spaces:", spacesError);
      }
    }

    // Copy template line items
    if (lineItemsResult.data && lineItemsResult.data.length > 0) {
      const newLineItems = lineItemsResult.data.map((item) => ({
        template_id: newTemplate.id,
        space_type_id: item.space_type_id,
        component_type_id: item.component_type_id,
        component_variant_id: item.component_variant_id,
        cost_item_id: item.cost_item_id,
        group_name: item.group_name,
        rate: item.rate,
        display_order: item.display_order,
        notes: item.notes,
        metadata: item.metadata,
      }));

      const { error: itemsError } = await adminSupabase
        .from("template_line_items")
        .insert(newLineItems);

      if (itemsError) {
        console.error("Error copying template line items:", itemsError);
      }
    }

    // Fetch the created template with all details
    const [newSpacesResult, newLineItemsResult] = await Promise.all([
      adminSupabase
        .from("template_spaces")
        .select("*, space_type:space_types(id, name, slug, icon)")
        .eq("template_id", newTemplate.id)
        .order("display_order", { ascending: true }),
      adminSupabase
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
