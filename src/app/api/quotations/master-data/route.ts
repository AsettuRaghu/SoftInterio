import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/quotations/master-data - Get all master data for quotation module V2
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

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

      const { data, error } = await supabase
        .from(tableName)
        .select(selectQuery)
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
    const [
      units,
      spaceTypes,
      componentTypes,
      componentVariants,
      costItemCategories,
      costItems,
    ] = await Promise.all([
      supabase
        .from("units")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("space_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("component_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("component_variants")
        .select("*, component_type:component_types(id, name, slug)")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("cost_item_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("cost_items")
        .select("*, category:cost_item_categories(id, name, slug, color)")
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
