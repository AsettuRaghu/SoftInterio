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
    const type = searchParams.get("type"); // units, space_types, component_types, component_variants, cost_item_categories, cost_items

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
        case "component_variants":
          tableName = "component_variants";
          selectQuery = "*, component_type:component_types(id, name, slug)";
          break;
        case "cost_item_categories":
          tableName = "cost_item_categories";
          break;
        case "cost_items":
          tableName = "cost_items";
          selectQuery =
            "*, category:cost_item_categories(id, name, slug, color)";
          break;
        // Legacy support
        case "variant_types":
          tableName = "component_variants";
          selectQuery = "*, component_type:component_types(id, name, slug)";
          break;
        case "cost_attribute_types":
          tableName = "cost_items";
          selectQuery =
            "*, category:cost_item_categories(id, name, slug, color)";
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
      componentVariants,
      costItemCategories,
      costItems,
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
        .from("component_variants")
        .select("*, component_type:component_types(id, name, slug)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("cost_item_categories")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("cost_items")
        .select("*, category:cost_item_categories(id, name, slug, color)")
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
    if (componentVariants.error)
      errors.push(`component_variants: ${componentVariants.error.message}`);
    if (costItemCategories.error)
      errors.push(`cost_item_categories: ${costItemCategories.error.message}`);
    if (costItems.error) errors.push(`cost_items: ${costItems.error.message}`);

    if (errors.length > 0) {
      console.error("Errors fetching master data:", errors);
      // Continue with available data, don't fail completely
    }

    // Group component variants by component_type_id for easier client-side usage
    const variantsByComponent: Record<string, typeof componentVariants.data> =
      {};
    (componentVariants.data || []).forEach((variant) => {
      if (!variantsByComponent[variant.component_type_id]) {
        variantsByComponent[variant.component_type_id] = [];
      }
      variantsByComponent[variant.component_type_id]!.push(variant);
    });

    // Group cost items by category_id for easier client-side usage
    const itemsByCategory: Record<string, typeof costItems.data> = {};
    (costItems.data || []).forEach((item) => {
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
        component_variants: componentVariants.data || [],
        cost_item_categories: costItemCategories.data || [],
        cost_items: costItems.data || [],
      },
      // Grouped data for easier access
      grouped: {
        variants_by_component: variantsByComponent,
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
