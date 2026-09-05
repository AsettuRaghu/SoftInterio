import { NextRequest, NextResponse } from "next/server";
import { canViewCosts } from "@/lib/quotations/cost-visibility";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/settings/quotation-cost-items - List all quotation cost items
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

    // Parse query params
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("category_id");
    const isActive = searchParams.get("is_active");

    // Build query
    let query = supabase
      .from("quotation_cost_items")
      .select(
        `
        *,
        category:quotation_cost_item_categories(id, name, slug, color, icon)
      `,
        { count: "exact" }
      )
      .eq("tenant_id", user!.tenantId)
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

    if (isActive !== null && isActive !== "") {
      query = query.eq("is_active", isActive === "true");
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: costItems, error, count } = await query;

    if (error) {
      console.error("Error fetching quotation cost items:", error);
      return NextResponse.json(
        { error: "Failed to fetch quotation cost items" },
        { status: 500 }
      );
    }

    // What the company pays, and therefore what it makes, is gated on
    // cost_items.pricing - the permission that already governs these numbers
    // in the library, held by owner and admin only. default_rate stays visible
    // to everyone: it is the client-facing price, and the builder cannot
    // quote without it.
    const showCosts = await canViewCosts();

    const itemsWithMargin = (costItems || []).map((item) => {
      if (!showCosts) {
        const {
          company_cost: _c,
          vendor_cost: _v,
          retail_price: _r,
          margin_percent: _m,
          ...safe
        } = item as Record<string, unknown>;
        return safe;
      }
      return {
        ...item,
        calculated_margin_percent:
          item.company_cost > 0 && item.default_rate > 0
            ? Math.round(
                ((item.default_rate - item.company_cost) / item.company_cost) *
                  100 *
                  100
              ) / 100
            : null,
      };
    });

    return NextResponse.json({
      quotationCostItems: itemsWithMargin,
      can_view_costs: showCosts,
      // Legacy key for backward compatibility
      costItems: itemsWithMargin,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/settings/quotation-cost-items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/settings/quotation-cost-items - Create a new quotation cost item
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

    // Create the quotation cost item
    const { data: costItem, error } = await supabase
      .from("quotation_cost_items")
      .insert({
        tenant_id: user!.tenantId,
        name: body.name,
        slug: slug,
        description: body.description || null,
        category_id: body.category_id || null,
        unit_code: body.unit_code,
        vendor_cost: body.vendor_cost || 0,
        company_cost: body.company_cost || 0,
        default_rate: body.default_rate || 0,
        quality_tier: body.quality_tier || "standard",
        is_active: body.is_active !== false,
        specifications: body.specifications || null,
        display_order: body.display_order || 0,
      })
      .select(
        `
        *,
        category:quotation_cost_item_categories(id, name, slug, color, icon)
      `
      )
      .single();

    if (error) {

      if (error.code === "23505") {

        return NextResponse.json(

          { error: "A cost item with that name already exists" },

          { status: 409 }

        );

      }

      console.error("Error creating cost item:", error);
      return NextResponse.json(
        { error: "Failed to create quotation cost item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      quotationCostItem: costItem,
      costItem: costItem // Legacy
    }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/settings/quotation-cost-items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
