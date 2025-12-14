import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/quotations/templates - List all templates
// Security: Requires authentication and filters by user's tenant
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const propertyType = searchParams.get("property_type");
    const qualityTier = searchParams.get("quality_tier");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const includeDetails = searchParams.get("include_details") === "true";

    // Filter by tenant_id for security
    let query = supabase
      .from("quotation_templates")
      .select("*", { count: "exact" })
      .eq("tenant_id", user!.tenantId);

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

    // Always fetch counts for spaces, components, and usage
    let templatesWithCounts = templates || [];
    if (templates && templates.length > 0) {
      const templateIds = templates.map((t) => t.id);

      // Fetch spaces count, unique component types count, and usage count in parallel
      const [spacesCountResult, lineItemsResult, usageCountResult] = await Promise.all([
        // Count spaces per template
        supabase
          .from("template_spaces")
          .select("template_id")
          .in("template_id", templateIds),
        // Get line items to count unique components per template
        supabase
          .from("quotation_template_line_items")
          .select("template_id, component_type_id")
          .in("template_id", templateIds),
        // Count quotations that use each template
        supabase
          .from("quotations")
          .select("template_id")
          .in("template_id", templateIds),
      ]);

      // Calculate spaces count per template
      const spacesCountByTemplate: Record<string, number> = {};
      (spacesCountResult.data || []).forEach((space) => {
        spacesCountByTemplate[space.template_id] = (spacesCountByTemplate[space.template_id] || 0) + 1;
      });

      // Calculate unique components count per template (unique component_type_id)
      const componentsCountByTemplate: Record<string, number> = {};
      const componentsSeen: Record<string, Set<string>> = {};
      (lineItemsResult.data || []).forEach((item) => {
        if (!componentsSeen[item.template_id]) {
          componentsSeen[item.template_id] = new Set();
        }
        const componentKey = `${item.component_type_id || 'default'}`;
        componentsSeen[item.template_id].add(componentKey);
      });
      Object.keys(componentsSeen).forEach((templateId) => {
        componentsCountByTemplate[templateId] = componentsSeen[templateId].size;
      });

      // Calculate usage count per template
      const usageCountByTemplate: Record<string, number> = {};
      (usageCountResult.data || []).forEach((quotation) => {
        if (quotation.template_id) {
          usageCountByTemplate[quotation.template_id] = (usageCountByTemplate[quotation.template_id] || 0) + 1;
        }
      });

      // Attach counts to templates
      templatesWithCounts = templates.map((template) => ({
        ...template,
        spaces_count: spacesCountByTemplate[template.id] || 0,
        components_count: componentsCountByTemplate[template.id] || 0,
        usage_count: usageCountByTemplate[template.id] || 0,
      }));
    }

    // If details requested, fetch full spaces and line items for each template
    let templatesWithDetails = templatesWithCounts;
    if (includeDetails && templates && templates.length > 0) {
      const templateIds = templates.map((t) => t.id);

      const [spacesResult, lineItemsResult] = await Promise.all([
        supabase
          .from("template_spaces")
          .select("*, space_type:space_types(id, name, slug, icon)")
          .in("template_id", templateIds)
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

      // Attach spaces and line_items to templates (preserving counts from templatesWithCounts)
      templatesWithDetails = templatesWithCounts.map((template) => ({
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
// Security: Requires authentication
export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const body = await request.json();
    console.log("=== CREATE TEMPLATE API ===");
    console.log("User:", user?.id, "Tenant:", user?.tenantId);
    console.log("Body received:", JSON.stringify(body, null, 2));
    
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

    // Create the template using the user's tenant from guard
    const { data: template, error } = await supabase
      .from("quotation_templates")
      .insert({
        tenant_id: user!.tenantId,
        name,
        description,
        property_type,
        quality_tier: quality_tier || "standard",
        base_price,
        template_data: template_data || {}, // Legacy field, can be empty
        is_active: true,
        is_featured: is_featured || false,
        created_by: user!.id,
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

    console.log("Template created:", template.id);

    // Map to track client space IDs to database space IDs
    const spaceIdMap = new Map<string, string>();

    // Insert template spaces if provided
    if (spaces && Array.isArray(spaces) && spaces.length > 0) {
      console.log("Inserting", spaces.length, "template spaces");
      const templateSpaces = spaces.map((space, index) => ({
        template_id: template.id,
        space_type_id: space.space_type_id,
        default_name: space.default_name || null,
        display_order: space.display_order ?? index,
      }));
      console.log("Template spaces:", JSON.stringify(templateSpaces, null, 2));

      const { data: insertedSpaces, error: spacesError } = await supabase
        .from("template_spaces")
        .insert(templateSpaces)
        .select("id, space_type_id, display_order");

      if (spacesError) {
        console.error("Error creating template spaces:", spacesError);
        // Don't fail the whole request, just log the error
      } else {
        console.log("Template spaces inserted successfully:", insertedSpaces?.length);
        // Build the mapping from client space index to database space ID
        // Match by display_order and space_type_id
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
        console.log("Space ID mapping:", Object.fromEntries(spaceIdMap));
      }
    }

    // Insert template line items if provided
    if (line_items && Array.isArray(line_items) && line_items.length > 0) {
      console.log("Inserting", line_items.length, "template line items");
      const templateLineItems = line_items.map((item, index) => {
        // Try to resolve template_space_id from client_space_id
        const templateSpaceId = item.client_space_id
          ? spaceIdMap.get(item.client_space_id) || null
          : null;

        return {
          template_id: template.id,
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
      console.log("Template line items:", JSON.stringify(templateLineItems, null, 2));

      const { error: itemsError } = await supabase
        .from("quotation_template_line_items")
        .insert(templateLineItems);

      if (itemsError) {
        console.error("Error creating template line items:", itemsError);
        // Don't fail the whole request, just log the error
      } else {
        console.log("Template line items inserted successfully");
      }
    }

    // Fetch the created template with all details
    const { data: createdTemplate } = await supabase
      .from("quotation_templates")
      .select("*")
      .eq("id", template.id)
      .single();

    // Fetch spaces and line items
    const [spacesResult, lineItemsResult] = await Promise.all([
      supabase
        .from("template_spaces")
        .select("*, space_type:space_types(id, name, slug, icon)")
        .eq("template_id", template.id)
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
