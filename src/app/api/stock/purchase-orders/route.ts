import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/stock/purchase-orders - List purchase orders with filters
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const excludeStatus = searchParams.get("exclude_status");
    const vendorId = searchParams.get("vendor_id");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("stock_purchase_orders")
      .select(
        `
        *,
        vendor:stock_vendors(id, name, code, contact_person, phone)
      `,
        { count: "exact" }
      )
      .eq("tenant_id", userData.tenant_id);

    // Status filter
    if (status) {
      const statuses = status.split(",");
      query = query.in("status", statuses);
    }

    // Exclude status filter (e.g., hide closed POs)
    if (excludeStatus) {
      const excludeStatuses = excludeStatus.split(",");
      for (const excStatus of excludeStatuses) {
        query = query.neq("status", excStatus);
      }
    }

    // Vendor filter
    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    }

    // Date range
    if (dateFrom) {
      query = query.gte("order_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("order_date", dateTo);
    }

    // Search - search across multiple columns including vendor name
    if (search) {
      // First, find vendor IDs that match the search
      const { data: matchingVendors } = await supabase
        .from("stock_vendors")
        .select("id")
        .eq("tenant_id", userData.tenant_id)
        .or(
          `name.ilike.%${search}%,code.ilike.%${search}%,contact_person.ilike.%${search}%`
        );

      const vendorIds = matchingVendors?.map((v) => v.id) || [];

      // Build OR condition for PO fields and vendor_id
      if (vendorIds.length > 0) {
        // Search in PO fields OR vendor matches
        query = query.or(
          `po_number.ilike.%${search}%,notes.ilike.%${search}%,vendor_id.in.(${vendorIds.join(
            ","
          )})`
        );
      } else {
        // No vendor matches, just search PO fields
        query = query.or(`po_number.ilike.%${search}%,notes.ilike.%${search}%`);
      }
    }

    // Sorting - validate sort field
    const validSortFields = [
      "po_number",
      "order_date",
      "expected_delivery",
      "status",
      "total_amount",
      "created_at",
    ];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "created_at";
    const ascending = sortOrder === "asc";
    query = query.order(safeSortBy, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: purchaseOrders, error, count } = await query;

    if (error) {
      console.error("PO fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      purchaseOrders: purchaseOrders || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("PO API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/stock/purchase-orders - Create a new purchase order
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
    if (!body.vendor_id) {
      return NextResponse.json(
        { error: "Vendor is required" },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

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

    // Calculate totals
    let subtotal = 0;
    const itemsToCreate = body.items.map((item: any) => {
      const itemTotal =
        item.quantity *
        item.unit_price *
        (1 - (item.discount_percent || 0) / 100);
      const taxAmount = itemTotal * ((item.tax_percent || 18) / 100);
      const totalAmount = itemTotal + taxAmount;
      subtotal += totalAmount;
      return {
        material_id: item.material_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        tax_percent: item.tax_percent || 18,
        total_amount: totalAmount,
        received_quantity: 0,
      };
    });

    const discountAmount = subtotal * ((body.discount_percent || 0) / 100);
    const taxAmount =
      (subtotal - discountAmount) * ((body.tax_percent || 18) / 100);
    const totalAmount = subtotal - discountAmount + taxAmount;

    // Generate PO number
    const { data: poNumberData } = await supabase.rpc("generate_po_number", {
      p_tenant_id: userData.tenant_id,
    });
    const poNumber = poNumberData || `PO-${Date.now()}`;

    // Create PO
    const { data: po, error: poError } = await supabase
      .from("stock_purchase_orders")
      .insert({
        tenant_id: userData.tenant_id,
        po_number: poNumber,
        vendor_id: body.vendor_id,
        order_date: body.order_date || new Date().toISOString().split("T")[0],
        expected_delivery: body.expected_delivery,
        status: "draft",
        payment_terms: body.payment_terms,
        notes: body.notes,
        shipping_address: body.shipping_address,
        subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        created_by: user.id,
      })
      .select()
      .single();

    if (poError) {
      console.error("Create PO error:", poError);
      return NextResponse.json({ error: poError.message }, { status: 500 });
    }

    // Create PO items
    const poItems = itemsToCreate.map((item: any) => ({
      ...item,
      po_id: po.id,
    }));

    const { error: itemsError } = await supabase
      .from("stock_purchase_order_items")
      .insert(poItems);

    if (itemsError) {
      console.error("Create PO items error:", itemsError);
      // Rollback PO creation
      await supabase.from("stock_purchase_orders").delete().eq("id", po.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Fetch the complete PO with relations
    const { data: completePO } = await supabase
      .from("stock_purchase_orders")
      .select(
        `
        *,
        vendor:stock_vendors(id, name, code),
        items:stock_purchase_order_items(*)
      `
      )
      .eq("id", po.id)
      .single();

    return NextResponse.json({ purchaseOrder: completePO }, { status: 201 });
  } catch (error) {
    console.error("Create PO API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
