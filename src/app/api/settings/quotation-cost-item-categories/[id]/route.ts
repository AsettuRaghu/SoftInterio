import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/settings/quotation-cost-item-categories/[id] - Get a single category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { data: category, error } = await supabase
      .from("quotation_cost_item_categories")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", user!.tenantId)
      .single();

    if (error) {
      console.error("Error fetching quotation cost item category:", error);
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      quotationCostItemCategory: category,
      category: category // Legacy
    });
  } catch (error) {
    console.error("Error in GET /api/settings/quotation-cost-item-categories/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/settings/quotation-cost-item-categories/[id] - Update a category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const body = await request.json();

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only update provided fields
    if (body.name !== undefined) {
      updateData.name = body.name;
      // Update slug if name changes
      updateData.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    if (body.description !== undefined) updateData.description = body.description;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data: category, error } = await supabase
      .from("quotation_cost_item_categories")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", user!.tenantId)
      .select()
      .single();

    if (error) {
      console.error("Error updating quotation cost item category:", error);
      return NextResponse.json(
        { error: "Failed to update category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      quotationCostItemCategory: category,
      category: category // Legacy
    });
  } catch (error) {
    console.error("Error in PUT /api/settings/quotation-cost-item-categories/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/quotation-cost-item-categories/[id] - Delete a category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Check if category has any cost items
    const { count: itemCount, error: countError } = await supabase
      .from("quotation_cost_items")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id)
      .eq("tenant_id", user!.tenantId);

    if (countError) {
      console.error("Error checking cost items:", countError);
    }

    if (itemCount && itemCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${itemCount} cost items. Please reassign or delete them first.` },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("quotation_cost_item_categories")
      .delete()
      .eq("id", id)
      .eq("tenant_id", user!.tenantId);

    if (error) {
      console.error("Error deleting quotation cost item category:", error);
      return NextResponse.json(
        { error: "Failed to delete category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/settings/quotation-cost-item-categories/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
