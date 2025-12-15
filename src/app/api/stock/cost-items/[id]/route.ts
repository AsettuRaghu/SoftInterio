import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/stock/cost-items/[id] - Get a single cost item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const { id } = await params;

    // Get user's tenant_id from users table
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return createErrorResponse("No tenant associated with user", 400);
    }

    // Fetch cost item with related data
    const { data: costItem, error } = await supabase
      .from("cost_items")
      .select(
        `
        *,
        category:cost_item_categories(id, name, slug, color, icon),
        last_vendor:stock_vendors(id, name, code)
      `
      )
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Cost item not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching cost item:", error);
      return NextResponse.json(
        { error: "Failed to fetch cost item" },
        { status: 500 }
      );
    }

    // Fetch linked stock materials
    const { data: stockMaterials } = await supabase
      .from("stock_materials")
      .select(
        `
        id,
        name,
        sku,
        current_stock,
        unit_price,
        brand:stock_brands(id, name)
      `
      )
      .eq("cost_item_id", id)
      .eq("tenant_id", userData.tenant_id);

    // Calculate margin
    const calculatedMarginPercent =
      costItem.company_cost > 0 && costItem.default_rate > 0
        ? Math.round(
            ((costItem.default_rate - costItem.company_cost) /
              costItem.company_cost) *
              100 *
              100
          ) / 100
        : null;

    return NextResponse.json({
      costItem: {
        ...costItem,
        calculated_margin_percent: calculatedMarginPercent,
        stock_materials: stockMaterials || [],
      },
    });
  } catch (error) {
    console.error("Error in GET /api/stock/cost-items/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/stock/cost-items/[id] - Update a cost item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get user's tenant_id from users table
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return createErrorResponse("No tenant associated with user", 400);
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
      // Also update slug if name changes
      updateData.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.category_id !== undefined)
      updateData.category_id = body.category_id;
    if (body.unit_code !== undefined) updateData.unit_code = body.unit_code;
    if (body.vendor_cost !== undefined)
      updateData.vendor_cost = body.vendor_cost;
    if (body.company_cost !== undefined)
      updateData.company_cost = body.company_cost;
    if (body.default_rate !== undefined)
      updateData.default_rate = body.default_rate;
    if (body.retail_price !== undefined)
      updateData.retail_price = body.retail_price;
    if (body.margin_percent !== undefined)
      updateData.margin_percent = body.margin_percent;
    if (body.quality_tier !== undefined)
      updateData.quality_tier = body.quality_tier;
    if (body.is_stockable !== undefined)
      updateData.is_stockable = body.is_stockable;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.specifications !== undefined)
      updateData.specifications = body.specifications;
    if (body.reorder_level !== undefined)
      updateData.reorder_level = body.reorder_level;
    if (body.min_order_qty !== undefined)
      updateData.min_order_qty = body.min_order_qty;
    if (body.lead_time_days !== undefined)
      updateData.lead_time_days = body.lead_time_days;

    // Update the cost item
    const { data: costItem, error } = await supabase
      .from("cost_items")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .select(
        `
        *,
        category:cost_item_categories(id, name, slug, color, icon),
        last_vendor:stock_vendors(id, name, code)
      `
      )
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Cost item not found" },
          { status: 404 }
        );
      }
      console.error("Error updating cost item:", error);
      return NextResponse.json(
        { error: "Failed to update cost item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ costItem });
  } catch (error) {
    console.error("Error in PUT /api/stock/cost-items/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/stock/cost-items/[id] - Delete a cost item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get current user's tenant
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's tenant_id from users table
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 400 }
      );
    }

    // Check if cost item is used in quotations
    const { count: quotationCount } = await supabase
      .from("quotation_line_items")
      .select("*", { count: "exact", head: true })
      .eq("cost_item_id", id);

    if (quotationCount && quotationCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete cost item: used in ${quotationCount} quotation line items`,
        },
        { status: 400 }
      );
    }

    // Check if cost item is linked to stock materials
    const { count: stockCount } = await supabase
      .from("stock_materials")
      .select("*", { count: "exact", head: true })
      .eq("cost_item_id", id);

    if (stockCount && stockCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete cost item: linked to ${stockCount} stock materials`,
        },
        { status: 400 }
      );
    }

    // Delete the cost item
    const { error } = await supabase
      .from("cost_items")
      .delete()
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (error) {
      console.error("Error deleting cost item:", error);
      return NextResponse.json(
        { error: "Failed to delete cost item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/stock/cost-items/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
