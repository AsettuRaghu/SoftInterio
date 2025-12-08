import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user and their tenant
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("[GRN API] Auth check - User:", user?.id, "Error:", userError);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant_id from user
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    console.log(
      "[GRN API] Tenant check - Tenant:",
      userData?.tenant_id,
      "Error:",
      userDataError
    );

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const poId = searchParams.get("po_id") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    console.log("[GRN API] Query params:", {
      poId,
      status,
      search,
      page,
      limit,
      tenant_id: userData.tenant_id,
    });

    // Build the query - simplified to avoid nested join issues
    let query = supabase
      .from("stock_goods_receipts")
      .select(
        `
        *,
        purchase_order:stock_purchase_orders(
          id,
          po_number,
          vendor_id
        ),
        items:stock_goods_receipt_items(
          id,
          po_item_id,
          quantity_received,
          quantity_accepted,
          quantity_rejected,
          rejection_reason
        )
      `,
        { count: "exact" }
      )
      .eq("tenant_id", userData.tenant_id)
      .order("received_date", { ascending: false });

    // Apply filters
    if (search) {
      query = query.ilike("grn_number", `%${search}%`);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (poId) {
      query = query.eq("po_id", poId);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: grns, error, count } = await query;

    console.log("[GRN GET] Query params:", {
      poId,
      status,
      search,
      page,
      limit,
    });
    console.log("[GRN GET] Found GRNs:", grns?.length, "Error:", error);

    if (error) {
      console.error("Error fetching GRNs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      grns: grns || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in GRN API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new GRN
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant_id from user
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
    const {
      po_id,
      received_date,
      delivery_note_number,
      vehicle_number,
      notes,
      items,
    } = body;

    // Validate required fields
    if (!po_id) {
      return NextResponse.json(
        { error: "Purchase Order is required" },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    // Verify PO exists and is in a valid status for receiving
    const { data: poData, error: poError } = await supabase
      .from("stock_purchase_orders")
      .select("id, po_number, status, tenant_id")
      .eq("id", po_id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (poError || !poData) {
      return NextResponse.json(
        { error: "Purchase Order not found" },
        { status: 404 }
      );
    }

    // Only allow GRN creation for dispatched, acknowledged, or partially_received POs
    const validStatuses = ["dispatched", "acknowledged", "partially_received"];
    if (!validStatuses.includes(poData.status)) {
      return NextResponse.json(
        {
          error: `Cannot create GRN for PO with status "${poData.status}". PO must be dispatched, acknowledged, or partially received.`,
        },
        { status: 400 }
      );
    }

    // Get PO items to validate quantities
    const { data: poItems, error: poItemsError } = await supabase
      .from("stock_purchase_order_items")
      .select("id, quantity, received_quantity, material:stock_materials(name)")
      .eq("po_id", po_id);

    if (poItemsError || !poItems) {
      return NextResponse.json(
        { error: "Failed to fetch PO items" },
        { status: 500 }
      );
    }

    // Create a map of PO items for validation
    const poItemMap = new Map(poItems.map((item) => [item.id, item]));

    // Validate each item's quantity against pending
    for (const item of items) {
      const poItem = poItemMap.get(item.po_item_id);
      if (!poItem) {
        return NextResponse.json(
          { error: `Invalid PO item: ${item.po_item_id}` },
          { status: 400 }
        );
      }

      const orderedQty = Number(poItem.quantity);
      const alreadyReceived = Number(poItem.received_quantity) || 0;
      const pendingQty = orderedQty - alreadyReceived;
      const receivingQty = Number(item.quantity_accepted) || 0;

      if (receivingQty > pendingQty) {
        const materialName = (poItem.material as any)?.name || "Unknown";
        return NextResponse.json(
          {
            error: `Cannot receive ${receivingQty} units of "${materialName}". Only ${pendingQty} units pending (ordered: ${orderedQty}, already received: ${alreadyReceived}).`,
          },
          { status: 400 }
        );
      }

      if (receivingQty < 0) {
        return NextResponse.json(
          { error: "Quantity cannot be negative" },
          { status: 400 }
        );
      }
    }

    // Generate GRN number - get the latest GRN number and increment
    const { data: latestGrn } = await supabase
      .from("stock_goods_receipts")
      .select("grn_number")
      .eq("tenant_id", userData.tenant_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (latestGrn?.grn_number) {
      // Extract number from GRN-XXXXX format
      const match = latestGrn.grn_number.match(/GRN-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const grnNumber = `GRN-${String(nextNumber).padStart(5, "0")}`;

    // Create the GRN
    const { data: newGrn, error: grnError } = await supabase
      .from("stock_goods_receipts")
      .insert({
        tenant_id: userData.tenant_id,
        grn_number: grnNumber,
        po_id,
        received_date: received_date || new Date().toISOString().split("T")[0],
        received_by: user.id,
        status: "completed",
        delivery_note_number,
        vehicle_number,
        notes,
      })
      .select()
      .single();

    if (grnError) {
      console.error("Error creating GRN:", grnError);
      return NextResponse.json(
        { error: `Failed to create GRN: ${grnError.message}` },
        { status: 500 }
      );
    }

    // Insert GRN items
    const grnItems = items.map((item: any) => ({
      grn_id: newGrn.id,
      po_item_id: item.po_item_id,
      quantity_received: item.quantity_received,
      quantity_accepted: item.quantity_accepted,
      quantity_rejected: item.quantity_rejected || 0,
      rejection_reason: item.rejection_reason || null,
      storage_location: item.storage_location || null,
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase
      .from("stock_goods_receipt_items")
      .insert(grnItems);

    if (itemsError) {
      console.error("Error creating GRN items:", itemsError);
      // Rollback the GRN
      await supabase.from("stock_goods_receipts").delete().eq("id", newGrn.id);
      return NextResponse.json(
        { error: `Failed to create GRN items: ${itemsError.message}` },
        { status: 500 }
      );
    }

    // Update PO status based on received quantities
    await updatePOStatusFromGRN(supabase, po_id, userData.tenant_id);

    return NextResponse.json(
      {
        message: "GRN created successfully",
        grn: {
          ...newGrn,
          items: grnItems,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in GRN POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to update PO status based on GRN received quantities
async function updatePOStatusFromGRN(
  supabase: any,
  poId: string,
  tenantId: string
) {
  try {
    // Get all PO items with their ordered quantities
    const { data: poItems } = await supabase
      .from("stock_purchase_order_items")
      .select("id, quantity")
      .eq("po_id", poId);

    if (!poItems || poItems.length === 0) return;

    // Get all completed GRNs for this PO
    const { data: grns } = await supabase
      .from("stock_goods_receipts")
      .select("id")
      .eq("po_id", poId)
      .eq("status", "completed");

    if (!grns || grns.length === 0) return;

    const grnIds = grns.map((g: any) => g.id);

    // Get all GRN items for these GRNs
    const { data: grnItems } = await supabase
      .from("stock_goods_receipt_items")
      .select("po_item_id, quantity_accepted")
      .in("grn_id", grnIds);

    // Calculate total accepted quantity per PO item
    const acceptedByItem: Record<string, number> = {};
    (grnItems || []).forEach((item: any) => {
      acceptedByItem[item.po_item_id] =
        (acceptedByItem[item.po_item_id] || 0) + Number(item.quantity_accepted);
    });

    // Update each PO item's received_quantity
    for (const poItem of poItems) {
      const accepted = acceptedByItem[poItem.id] || 0;
      await supabase
        .from("stock_purchase_order_items")
        .update({ received_quantity: accepted })
        .eq("id", poItem.id);
    }

    // Check if all items are fully received
    let allFullyReceived = true;
    let someReceived = false;

    for (const poItem of poItems) {
      const accepted = acceptedByItem[poItem.id] || 0;
      const ordered = Number(poItem.quantity);

      if (accepted > 0) {
        someReceived = true;
      }

      if (accepted < ordered) {
        allFullyReceived = false;
      }
    }

    // Determine new status
    let newStatus: string;
    if (allFullyReceived) {
      newStatus = "fully_received";
    } else if (someReceived) {
      newStatus = "partially_received";
    } else {
      // No change needed
      return;
    }

    // Update PO status and fully_received_at timestamp if applicable
    const updateData: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "fully_received") {
      updateData.fully_received_at = new Date().toISOString();
    }

    await supabase
      .from("stock_purchase_orders")
      .update(updateData)
      .eq("id", poId)
      .eq("tenant_id", tenantId);

    console.log(`PO ${poId} status updated to ${newStatus}`);
  } catch (error) {
    console.error("Error updating PO status from GRN:", error);
  }
}
