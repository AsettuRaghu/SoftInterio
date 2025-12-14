import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/settings/quotation-cost-item-categories - List all categories
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { data: categories, error } = await supabase
      .from("quotation_cost_item_categories")
      .select("*")
      .eq("tenant_id", user!.tenantId)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching quotation cost item categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      quotationCostItemCategories: categories || [],
      // Legacy key
      categories: categories || [],
    });
  } catch (error) {
    console.error("Error in GET /api/settings/quotation-cost-item-categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/settings/quotation-cost-item-categories - Create a new category
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
    if (!body.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Generate slug from name
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Create the category
    const { data: category, error } = await supabase
      .from("quotation_cost_item_categories")
      .insert({
        tenant_id: user!.tenantId,
        name: body.name,
        slug: slug,
        description: body.description || null,
        icon: body.icon || null,
        color: body.color || null,
        display_order: body.display_order || 0,
        is_active: body.is_active !== false,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating quotation cost item category:", error);
      return NextResponse.json(
        { error: "Failed to create category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      quotationCostItemCategory: category,
      category: category // Legacy
    }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/settings/quotation-cost-item-categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
