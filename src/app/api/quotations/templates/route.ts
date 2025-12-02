import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// GET /api/quotations/templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const propertyType = searchParams.get("property_type");
    const qualityTier = searchParams.get("quality_tier");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const includeDetails = searchParams.get("include_details") === "true";

    let query = supabase
      .from("quotation_templates")
      .select("*", { count: "exact" });

    // Filter by status (is_active)
    if (status !== "all") {
      if (status === "active") {
        query = query.eq("is_active", true);
      } else if (status === "archived") {
        query = query.eq("is_active", false);
      }
    }

    // Filter by property type
    if (propertyType && propertyType !== "all") {
      query = query.eq("property_type", propertyType);
    }

    // Filter by quality tier
    if (qualityTier && qualityTier !== "all") {
      query = query.eq("quality_tier", qualityTier);
    }

    // Search by name or description
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Order by created_at desc
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: templates, error, count } = await query;

    if (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    // If details requested, fetch spaces and line items for each template
    let templatesWithDetails = templates || [];
    if (includeDetails && templates && templates.length > 0) {
      const templateIds = templates.map((t) => t.id);

      const [spacesResult, lineItemsResult] = await Promise.all([
        supabase
          .from("template_spaces")
          .select("*, space_type:space_types(id, name, slug, icon)")
          .in("template_id", templateIds)
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
          .in("template_id", templateIds)
          .order("display_order", { ascending: true }),
      ]);

      // Group spaces and line items by template_id
      const spacesByTemplate: Record<string, typeof spacesResult.data> = {};
      const lineItemsByTemplate: Record<string, typeof lineItemsResult.data> =
        {};

      (spacesResult.data || []).forEach((space) => {
        if (!spacesByTemplate[space.template_id]) {
          spacesByTemplate[space.template_id] = [];
        }
        spacesByTemplate[space.template_id]!.push(space);
      });

      (lineItemsResult.data || []).forEach((item) => {
        if (!lineItemsByTemplate[item.template_id]) {
          lineItemsByTemplate[item.template_id] = [];
        }
        lineItemsByTemplate[item.template_id]!.push(item);
      });

      // Attach to templates
      templatesWithDetails = templates.map((template) => ({
        ...template,
        spaces: spacesByTemplate[template.id] || [],
        line_items: lineItemsByTemplate[template.id] || [],
      }));
    }

    return NextResponse.json({
      success: true,
      templates: templatesWithDetails,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Templates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/quotations/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();
    const userSupabase = await createClient();

    const body = await request.json();
    const {
      name,
      description,
      property_type,
      quality_tier,
      base_price,
      template_data, // Legacy JSONB field
      spaces, // V2: Array of template spaces
      line_items, // V2: Array of template line items
      is_featured,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    // Get current user for created_by (use server client which has cookies)
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

    // Create the template
    const { data: template, error } = await adminSupabase
      .from("quotation_templates")
      .insert({
        tenant_id: userProfile.tenant_id,
        name,
        description,
        property_type,
        quality_tier: quality_tier || "standard",
        base_price,
        template_data: template_data || {}, // Legacy field, can be empty
        is_active: true,
        is_featured: is_featured || false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating template:", error);
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }

    // Insert template spaces if provided
    if (spaces && Array.isArray(spaces) && spaces.length > 0) {
      const templateSpaces = spaces.map((space, index) => ({
        template_id: template.id,
        space_type_id: space.space_type_id,
        default_name: space.default_name || null,
        display_order: space.display_order ?? index,
      }));

      const { error: spacesError } = await adminSupabase
        .from("template_spaces")
        .insert(templateSpaces);

      if (spacesError) {
        console.error("Error creating template spaces:", spacesError);
        // Don't fail the whole request, just log the error
      }
    }

    // Insert template line items if provided
    if (line_items && Array.isArray(line_items) && line_items.length > 0) {
      const templateLineItems = line_items.map((item, index) => ({
        template_id: template.id,
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

      const { error: itemsError } = await adminSupabase
        .from("template_line_items")
        .insert(templateLineItems);

      if (itemsError) {
        console.error("Error creating template line items:", itemsError);
        // Don't fail the whole request, just log the error
      }
    }

    // Fetch the created template with all details
    const { data: createdTemplate } = await adminSupabase
      .from("quotation_templates")
      .select("*")
      .eq("id", template.id)
      .single();

    // Fetch spaces and line items
    const [spacesResult, lineItemsResult] = await Promise.all([
      adminSupabase
        .from("template_spaces")
        .select("*, space_type:space_types(id, name, slug, icon)")
        .eq("template_id", template.id)
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
        .eq("template_id", template.id)
        .order("display_order", { ascending: true }),
    ]);

    return NextResponse.json(
      {
        success: true,
        template: {
          ...createdTemplate,
          spaces: spacesResult.data || [],
          line_items: lineItemsResult.data || [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
