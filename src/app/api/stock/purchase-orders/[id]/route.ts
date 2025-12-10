import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/stock/purchase-orders/[id] - Get a single purchase order with items
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

    // Get user's tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    // Get PO with all relations
    const { data: purchaseOrder, error } = await supabase
      .from("stock_purchase_orders")
      .select(
        `
        *,
        vendor:stock_vendors(id, name, code, contact_person, email, phone, address_line1, address_line2, city, state, pincode, gst_number),
        items:stock_purchase_order_items(
          *,
          material:stock_materials(id, name, sku, unit_of_measure)
        )
      `
      )
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Purchase order not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      purchaseOrder,
    });
  } catch (error) {
    console.error("Get PO API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/stock/purchase-orders/[id] - Update purchase order
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

    // Get user's tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Get current PO
    const { data: currentPO } = await supabase
      .from("stock_purchase_orders")
      .select("status, tenant_id")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!currentPO) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // Check if PO can be edited - only draft status allows editing
    const editableStatuses = ["draft"];
    if (!editableStatuses.includes(currentPO.status)) {
      return NextResponse.json(
        {
          error:
            "Cannot edit purchase order in current status. Only draft POs can be edited.",
        },
        { status: 400 }
      );
    }

    // Separate items from PO data
    const { items, ...poData } = body;

    // Update PO (without items)
    const { error: poError } = await supabase
      .from("stock_purchase_orders")
      .update({
        ...poData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id);

    if (poError) {
      console.error("Error updating PO:", poError);
      return NextResponse.json({ error: poError.message }, { status: 500 });
    }

    // Handle items update if provided
    if (items && Array.isArray(items)) {
      // Get existing item IDs
      const { data: existingItems } = await supabase
        .from("stock_purchase_order_items")
        .select("id")
        .eq("po_id", id);

      const existingItemIds = new Set(existingItems?.map((i) => i.id) || []);
      const newItemIds = new Set(items.filter((i) => i.id).map((i) => i.id));

      // Delete items that are no longer in the list
      const itemsToDelete = Array.from(existingItemIds).filter(
        (itemId) => !newItemIds.has(itemId)
      );

      if (itemsToDelete.length > 0) {
        await supabase
          .from("stock_purchase_order_items")
          .delete()
          .in("id", itemsToDelete);
      }

      // Calculate total amount
      let totalAmount = 0;

      // Update or insert items
      for (const item of items) {
        const subtotal = item.quantity * item.unit_price;
        const discount = subtotal * ((item.discount_percent || 0) / 100);
        const taxable = subtotal - discount;
        const tax = taxable * ((item.tax_percent || 0) / 100);
        const itemTotal = taxable + tax;
        totalAmount += itemTotal;

        const itemData = {
          po_id: id,
          material_id: item.material_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_percent: item.tax_percent || 0,
          discount_percent: item.discount_percent || 0,
          total_amount: itemTotal,
          project_id: item.project_id || null,
          cost_type: item.cost_type || "stock",
          cost_code: item.cost_code || null,
        };

        if (item.id && existingItemIds.has(item.id)) {
          // Update existing item
          await supabase
            .from("stock_purchase_order_items")
            .update(itemData)
            .eq("id", item.id);
        } else {
          // Insert new item
          await supabase.from("stock_purchase_order_items").insert(itemData);
        }
      }

      // Update PO total amount
      await supabase
        .from("stock_purchase_orders")
        .update({ total_amount: totalAmount })
        .eq("id", id);
    }

    // Fetch updated PO with items
    const { data: purchaseOrder, error: fetchError } = await supabase
      .from("stock_purchase_orders")
      .select(
        `
        *,
        vendor:stock_vendors(id, name, code, contact_person, email, phone, address_line1, address_line2, city, state, pincode, gst_number),
        items:stock_purchase_order_items(
          *,
          material:stock_materials(id, name, sku, unit_of_measure),
          project:projects(id, project_number, name)
        )
      `
      )
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Error fetching updated PO:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    console.error("Update PO API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/stock/purchase-orders/[id] - Cancel purchase order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current PO
    const { data: currentPO } = await supabase
      .from("stock_purchase_orders")
      .select("status")
      .eq("id", id)
      .single();

    if (!currentPO) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // Check if PO can be cancelled
    // Can cancel until order is received (once received, must close)
    const cancellableStatuses = ["draft", "order_placed", "order_dispatched"];
    if (!cancellableStatuses.includes(currentPO.status)) {
      return NextResponse.json(
        {
          error:
            "Cannot cancel purchase order in current status. Orders that have been received cannot be cancelled.",
        },
        { status: 400 }
      );
    }

    // Cancel PO (soft delete by updating status)
    const { error } = await supabase
      .from("stock_purchase_orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel PO API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
