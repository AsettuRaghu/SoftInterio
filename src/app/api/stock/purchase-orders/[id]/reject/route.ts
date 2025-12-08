import { NextRequest, NextResponse } from "next/server";

// POST /api/stock/purchase-orders/[id]/reject - DEPRECATED
// This endpoint is no longer used in the simplified status workflow
// The new workflow uses /api/stock/purchase-orders/[id]/status endpoint
// Status flow: draft → order_placed → order_dispatched → order_received → order_closed
// To cancel a PO, use DELETE /api/stock/purchase-orders/[id] or PATCH status to "cancelled"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use DELETE /api/stock/purchase-orders/[id] to cancel a PO.",
      deprecatedSince: "v2.0",
      newEndpoint: "/api/stock/purchase-orders/[id]",
      method: "DELETE",
    },
    { status: 410 }
  );
}
