import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/stock/overview - Get stock overview stats
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get total stockable items count
    const { count: totalItems } = await supabase
      .from("cost_items")
      .select("*", { count: "exact", head: true })
      .eq("is_stockable", true)
      .eq("is_active", true);

    // Get stock summary with status
    const { data: stockSummary } = await supabase.rpc("get_stock_summary");

    // Calculate stats from stock summary
    let lowStockItems = 0;
    let outOfStockItems = 0;
    let totalValue = 0;

    if (stockSummary && Array.isArray(stockSummary)) {
      stockSummary.forEach((item: any) => {
        if (item.stock_status === "low_stock") lowStockItems++;
        if (item.stock_status === "out_of_stock") outOfStockItems++;
        totalValue += parseFloat(item.total_value) || 0;
      });
    }

    // Get active POs count (not closed or cancelled)
    const { count: pendingPOs } = await supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .in("status", [
        "draft",
        "order_placed",
        "order_dispatched",
        "order_received",
      ]);

    // Get orders in transit (dispatched but not received)
    const { count: pendingApprovals } = await supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "order_dispatched");

    // Get recent GRNs count (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: recentGRNs } = await supabase
      .from("goods_receipts")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString());

    // Get low stock items (for the list)
    const { data: lowStockList } = await supabase
      .from("cost_items")
      .select(
        `
        id,
        name,
        slug,
        unit_code,
        default_rate,
        reorder_level,
        category:cost_item_categories(id, name)
      `
      )
      .eq("is_stockable", true)
      .eq("is_active", true)
      .limit(10);

    // For now, return basic low stock items
    // In production, you'd join with stock_levels
    const lowStockItemsList = (lowStockList || []).map((item: any) => ({
      cost_item_id: item.id,
      item_name: item.name,
      slug: item.slug,
      category_name: item.category?.name || null,
      unit_code: item.unit_code,
      default_rate: item.default_rate,
      reorder_level: item.reorder_level,
      total_qty: 0, // Would come from stock_levels
      reserved_qty: 0,
      available_qty: 0,
      total_value: 0,
      stock_status: "low_stock" as const,
    }));

    // Get recent purchase orders
    const { data: recentPOsList } = await supabase
      .from("purchase_orders")
      .select(
        `
        id,
        po_number,
        po_date,
        status,
        grand_total,
        vendor:vendors(id, name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      stats: {
        totalItems: totalItems || 0,
        lowStockItems: lowStockItems || lowStockItemsList.length,
        outOfStockItems: outOfStockItems || 0,
        totalValue: totalValue || 0,
        pendingPOs: pendingPOs || 0,
        pendingApprovals: pendingApprovals || 0,
        recentGRNs: recentGRNs || 0,
        pendingIssues: 0,
      },
      lowStockItems: lowStockItemsList,
      recentPOs: recentPOsList || [],
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
