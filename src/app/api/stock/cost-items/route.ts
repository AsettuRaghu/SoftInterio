import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/stock/cost-items - List all cost items with pricing
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

    // Get user's tenant_id from users table
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData?.tenant_id) {
      return createErrorResponse("No tenant associated with user", 400);
    }

    // Parse query params
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("category_id");
    const isStockable = searchParams.get("is_stockable");
    const isActive = searchParams.get("is_active");

    // Build query
    let query = supabase
      .from("cost_items")
      .select(
        `
        *,
        category:cost_item_categories(id, name, slug, color, icon),
        last_vendor:stock_vendors(id, name, code)
      `,
        { count: "exact" }
      )
      .eq("tenant_id", userData.tenant_id)
      .order("category_id", { ascending: true })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    // Apply filters
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,slug.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    if (isStockable !== null && isStockable !== "") {
      query = query.eq("is_stockable", isStockable === "true");
    }

    if (isActive !== null && isActive !== "") {
      query = query.eq("is_active", isActive === "true");
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: costItems, error, count } = await query;

    if (error) {
      console.error("Error fetching cost items:", error);
      return NextResponse.json(
        { error: "Failed to fetch cost items" },
        { status: 500 }
      );
    }

    // Calculate margin for each item
    const itemsWithMargin = (costItems || []).map((item) => ({
      ...item,
      calculated_margin_percent:
        item.company_cost > 0 && item.default_rate > 0
          ? Math.round(
              ((item.default_rate - item.company_cost) / item.company_cost) *
                100 *
                100
            ) / 100
          : null,
    }));

    return NextResponse.json({
      costItems: itemsWithMargin,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/stock/cost-items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/stock/cost-items - Create a new cost item
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

    // Get user's tenant_id from users table
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return createErrorResponse("No tenant associated with user", 400);
    }
    }

    // Validate required fields
    if (!body.name || !body.unit_code) {
      return NextResponse.json(
        { error: "Name and unit_code are required" },
        { status: 400 }
      );
    }

    // Generate slug from name
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Create the cost item
    const { data: costItem, error } = await supabase
      .from("cost_items")
      .insert({
        tenant_id: userData.tenant_id,
        name: body.name,
        slug: slug,
        description: body.description || null,
        category_id: body.category_id || null,
        unit_code: body.unit_code,
        vendor_cost: body.vendor_cost || 0,
        company_cost: body.company_cost || 0,
        default_rate: body.default_rate || 0,
        retail_price: body.retail_price || null,
        margin_percent: body.margin_percent || null,
        quality_tier: body.quality_tier || "standard",
        is_stockable: body.is_stockable || false,
        is_active: body.is_active !== false,
        specifications: body.specifications || null,
        reorder_level: body.reorder_level || 0,
        min_order_qty: body.min_order_qty || 1,
        lead_time_days: body.lead_time_days || 0,
      })
      .select(
        `
        *,
        category:cost_item_categories(id, name, slug, color, icon)
      `
      )
      .single();

    if (error) {
      console.error("Error creating cost item:", error);
      return NextResponse.json(
        { error: "Failed to create cost item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ costItem }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/stock/cost-items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
