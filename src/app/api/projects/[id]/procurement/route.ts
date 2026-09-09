/**
 * What has been ordered for this project.
 *
 *   GET /api/projects/:id/procurement
 *
 * Procurement attaches to a project at the **line item** level, not the
 * purchase order: `stock_purchase_order_items.project_id`. One PO to one vendor
 * routinely covers several projects, so asking "which POs belong to this
 * project" is the wrong question - the answer is which lines do, and a PO
 * appears here when any of its lines does.
 *
 * That is also why the totals are computed from the lines rather than read off
 * `stock_purchase_orders.total_amount`: the PO total includes work for other
 * projects, and showing it here would overstate what this project has
 * committed.
 *
 * Read-only. Ordering is done in Stock -> Purchase Orders, against a vendor and
 * a material catalogue; this is the project's view of decisions taken there.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "read",
    });
    if (!gate.ok) return gate.response;

    const { data: items, error } = await supabase
      .from("stock_purchase_order_items")
      .select(
        `
        id, quantity, unit_price, total_amount, received_quantity,
        cost_type, cost_code, notes,
        material:stock_materials(id, name, sku, unit_of_measure),
        po:stock_purchase_orders(
          id, po_number, status, order_date, expected_delivery,
          payment_status, amount_paid,
          vendor:stock_vendors(id, name, display_name)
        )
      `
      )
      .eq("project_id", id);

    if (error) {
      log.error("Failed to load project procurement", error);
      return NextResponse.json(
        { error: "Failed to load procurement" },
        { status: 500 }
      );
    }

    // PostgREST types a to-one embed as an array often enough to be worth
    // normalising once here rather than in the component.
    const one = <T,>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

    const lines = (items ?? []).map((row: any) => ({
      id: row.id,
      quantity: Number(row.quantity ?? 0),
      unitPrice: Number(row.unit_price ?? 0),
      totalAmount: Number(row.total_amount ?? 0),
      receivedQuantity: Number(row.received_quantity ?? 0),
      costType: row.cost_type,
      costCode: row.cost_code,
      notes: row.notes,
      material: one<any>(row.material),
      po: (() => {
        const po = one<any>(row.po);
        return po ? { ...po, vendor: one<any>(po.vendor) } : null;
      })(),
    }));

    // Cancelled orders are not a commitment. They stay in the list, because
    // "we tried to order this and it fell through" is worth seeing, but they
    // must not count toward what the project has spent.
    const live = lines.filter((l) => l.po?.status !== "cancelled");

    const summary = {
      lineCount: lines.length,
      orderCount: new Set(lines.map((l) => l.po?.id).filter(Boolean)).size,
      committed: live.reduce((n, l) => n + l.totalAmount, 0),
      // Value received, apportioned by quantity: a line half delivered has
      // half its value on site. Guards against divide-by-zero on a zero-qty
      // line, which the PO screen does allow.
      received: live.reduce((n, l) => {
        if (!l.quantity) return n;
        const ratio = Math.min(l.receivedQuantity / l.quantity, 1);
        return n + l.totalAmount * ratio;
      }, 0),
      awaitingDelivery: live.filter((l) => l.receivedQuantity < l.quantity).length,
    };

    return NextResponse.json({ success: true, data: { lines, summary } });
  } catch (error) {
    log.error("Project procurement API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
