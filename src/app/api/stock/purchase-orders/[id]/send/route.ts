import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// POST /api/stock/purchase-orders/[id]/send - Mark PO as sent to vendor
export async function POST(
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

    // Check if PO can be sent
    const sendableStatuses = ["draft", "approved"];
    if (!sendableStatuses.includes(currentPO.status)) {
      return NextResponse.json(
        { error: "Purchase order cannot be sent in current status" },
        { status: 400 }
      );
    }

    // Mark as sent
    const { data: purchaseOrder, error } = await supabase
      .from("stock_purchase_orders")
      .update({
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    console.error("Send PO API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
