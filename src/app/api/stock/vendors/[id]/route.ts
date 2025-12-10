import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { UpdateVendorInput } from "@/types/stock";

// GET /api/stock/vendors/[id] - Get a single vendor
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
    const { id } = await params;
    const supabase = await createClient();

    const { data: vendor, error } = await supabase
      .from("stock_vendors")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get vendor materials (price list)
    const { data: vendorMaterials } = await supabase
      .from("stock_vendor_materials")
      .select(
        `
        *,
        material:stock_materials(id, name, sku, unit_of_measure, unit_cost)
      `
      )
      .eq("vendor_id", id)
      .eq("is_active", true);

    // Get recent purchase orders for this vendor
    const { data: recentPOs } = await supabase
      .from("stock_purchase_orders")
      .select("id, po_number, order_date, status, total_amount")
      .eq("vendor_id", id)
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      vendor,
      vendorMaterials: vendorMaterials || [],
      recentPOs: recentPOs || [],
    });
  } catch (error) {
    console.error("Get Vendor API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/stock/vendors/[id] - Update a vendor
export async function PATCH(
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
    const { id } = await params;
    const supabase = await createClient();

    const body: UpdateVendorInput = await request.json();

    // Update vendor
    const { data: vendor, error } = await supabase
      .from("stock_vendors")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ vendor });
  } catch (error) {
    console.error("Update Vendor API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/stock/vendors/[id] - Soft delete a vendor
export async function DELETE(
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
    const { id } = await params;
    const supabase = await createClient();

    // Check if vendor has any active POs (not closed or cancelled)
    const { count: activePOs } = await supabase
      .from("stock_purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", id)
      .in("status", [
        "draft",
        "order_placed",
        "order_dispatched",
        "order_received",
      ]);

    if (activePOs && activePOs > 0) {
      return NextResponse.json(
        { error: "Cannot delete vendor with active purchase orders" },
        { status: 400 }
      );
    }

    // Soft delete - set is_active to false
    const { error } = await supabase
      .from("stock_vendors")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Vendor API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
