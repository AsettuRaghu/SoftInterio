import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/quotations/master-data - Get all master data for quotation module V2
// Security: Requires authentication and filters by user's tenant
export async function GET(request: NextRequest) {
  try {
    // Protect API route - requires authentication and checks user status
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // units, space_types, component_types, quotation_cost_item_categories, quotation_cost_items

    // If specific type is requested
    if (type) {
      let tableName: string;
      let selectQuery = "*";

      switch (type) {
        case "units":
          tableName = "units";
          break;
        case "space_types":
          tableName = "space_types";
          break;
        case "component_types":
          tableName = "component_types";
          break;
        case "quotation_cost_item_categories":
          tableName = "quotation_cost_item_categories";
          break;
        case "quotation_cost_items":
          tableName = "quotation_cost_items";
          selectQuery =
            "*, category:quotation_cost_item_categories(id, name, slug, color)";
          break;
        // Legacy support (deprecated - use quotation_cost_* instead)
        case "cost_item_categories":
          tableName = "quotation_cost_item_categories";
          break;
        case "cost_items":
          tableName = "quotation_cost_items";
          selectQuery =
            "*, category:quotation_cost_item_categories(id, name, slug, color)";
          break;
        case "cost_attribute_types":
          tableName = "quotation_cost_items";
          selectQuery =
            "*, category:quotation_cost_item_categories(id, name, slug, color)";
          break;
        default:
          return NextResponse.json(
            { error: "Invalid type parameter" },
            { status: 400 }
          );
      }

      // Build query with tenant_id filter for tenant-specific tables (units are system-wide)
      let query = supabase
        .from(tableName)
        .select(selectQuery);
      
      // Units table is system-wide (measurement units: sqft, rft, nos), no tenant_id
      if (type !== "units") {
        query = query.eq("tenant_id", user!.tenantId);
      }
      
      const { data, error } = await query
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error(`Error fetching ${type}:`, error);
        return NextResponse.json(
          { error: `Failed to fetch ${type}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ [type]: data || [] });
    }

    // Fetch all master data in parallel (V2 schema)
    // Use regular client (with RLS) and filter by tenant_id for extra security
    const tenantId = user!.tenantId;

    const [
      units,
      spaceTypes,
      componentTypes,
      quotationCostItemCategories,
      quotationCostItems,
    ] = await Promise.all([
      // Units are system-wide (measurement units: sqft, rft, nos), no tenant_id
      supabase
        .from("units")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("space_types")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("component_types")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("quotation_cost_item_categories")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("quotation_cost_items")
        .select("*, category:quotation_cost_item_categories(id, name, slug, color)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);

    // Check for errors
    const errors = [];
    if (units.error) errors.push(`units: ${units.error.message}`);
    if (spaceTypes.error)
      errors.push(`space_types: ${spaceTypes.error.message}`);
    if (componentTypes.error)
      errors.push(`component_types: ${componentTypes.error.message}`);
    if (quotationCostItemCategories.error)
      errors.push(`quotation_cost_item_categories: ${quotationCostItemCategories.error.message}`);
    if (quotationCostItems.error) errors.push(`quotation_cost_items: ${quotationCostItems.error.message}`);

    if (errors.length > 0) {
      console.error("Errors fetching master data:", errors);
      // Continue with available data, don't fail completely
    }

    // Group cost items by category_id for easier client-side usage
    const itemsByCategory: Record<string, typeof quotationCostItems.data> = {};
    (quotationCostItems.data || []).forEach((item) => {
      const categoryId = item.category_id || "uncategorized";
      if (!itemsByCategory[categoryId]) {
        itemsByCategory[categoryId] = [];
      }
      itemsByCategory[categoryId]!.push(item);
    });

    return NextResponse.json({
      success: true,
      data: {
        units: units.data || [],
        space_types: spaceTypes.data || [],
        component_types: componentTypes.data || [],
        quotation_cost_item_categories: quotationCostItemCategories.data || [],
        quotation_cost_items: quotationCostItems.data || [],
        // Legacy keys for backward compatibility
        cost_item_categories: quotationCostItemCategories.data || [],
        cost_items: quotationCostItems.data || [],
      },
      // Grouped data for easier access
      grouped: {
        items_by_category: itemsByCategory,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Master data API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
