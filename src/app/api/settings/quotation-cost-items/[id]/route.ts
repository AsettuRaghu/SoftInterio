import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/settings/quotation-cost-items/[id] - Get a single quotation cost item
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

    const { data: costItem, error } = await supabase
      .from("quotation_cost_items")
      .select(
        `
        *,
        category:quotation_cost_item_categories(id, name, slug, color, icon)
      `
      )
      .eq("id", id)
      .eq("tenant_id", user!.tenantId)
      .single();

    if (error) {
      console.error("Error fetching quotation cost item:", error);
      return NextResponse.json(
        { error: "Quotation cost item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      quotationCostItem: costItem,
      costItem: costItem // Legacy
    });
  } catch (error) {
    console.error("Error in GET /api/settings/quotation-cost-items/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/settings/quotation-cost-items/[id] - Update a quotation cost item
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
    if (body.category_id !== undefined) updateData.category_id = body.category_id;
    if (body.unit_code !== undefined) updateData.unit_code = body.unit_code;
    if (body.vendor_cost !== undefined) updateData.vendor_cost = body.vendor_cost;
    if (body.company_cost !== undefined) updateData.company_cost = body.company_cost;
    if (body.default_rate !== undefined) updateData.default_rate = body.default_rate;
    if (body.quality_tier !== undefined) updateData.quality_tier = body.quality_tier;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.specifications !== undefined) updateData.specifications = body.specifications;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;

    const { data: costItem, error } = await supabase
      .from("quotation_cost_items")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", user!.tenantId)
      .select(
        `
        *,
        category:quotation_cost_item_categories(id, name, slug, color, icon)
      `
      )
      .single();

    if (error) {
      console.error("Error updating quotation cost item:", error);
      return NextResponse.json(
        { error: "Failed to update quotation cost item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      quotationCostItem: costItem,
      costItem: costItem // Legacy
    });
  } catch (error) {
    console.error("Error in PUT /api/settings/quotation-cost-items/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/quotation-cost-items/[id] - Delete a quotation cost item
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

    // Check if item is used in any quotation line items
    const { data: usageCheck, error: usageError } = await supabase
      .from("quotation_line_items")
      .select("id")
      .eq("quotation_cost_item_id", id)
      .limit(1);

    if (usageError) {
      console.error("Error checking usage:", usageError);
      return NextResponse.json(
        { error: "Failed to check item usage" },
        { status: 500 }
      );
    }

    if (usageCheck && usageCheck.length > 0) {
      // Soft delete - just deactivate
      const { error: updateError } = await supabase
        .from("quotation_cost_items")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", user!.tenantId);

      if (updateError) {
        console.error("Error deactivating quotation cost item:", updateError);
        return NextResponse.json(
          { error: "Failed to deactivate quotation cost item" },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        message: "Quotation cost item deactivated (in use by quotations)",
        deactivated: true 
      });
    }

    // Hard delete if not used
    const { error } = await supabase
      .from("quotation_cost_items")
      .delete()
      .eq("id", id)
      .eq("tenant_id", user!.tenantId);

    if (error) {
      console.error("Error deleting quotation cost item:", error);
      return NextResponse.json(
        { error: "Failed to delete quotation cost item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Quotation cost item deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /api/settings/quotation-cost-items/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
