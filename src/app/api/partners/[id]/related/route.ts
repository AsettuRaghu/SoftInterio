/**
 * What this partner has been to us: the leads, projects and quotations of
 * a customer, the purchase orders of a vendor. One read for the detail page.
 *
 *   GET /api/partners/:id/related
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["clients.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clients }, { data: vendors }] = await Promise.all([
    supabase.from("clients").select("id").eq("partner_id", id),
    supabase.from("stock_vendors").select("id").eq("partner_id", id),
  ]);
  const cids = (clients ?? []).map((c) => c.id);
  const vids = (vendors ?? []).map((v) => v.id);

  const [leads, projects, quotations, pos] = await Promise.all([
    cids.length
      ? supabase.from("leads").select("id, lead_number, stage, service_type, won_amount, created_at, stage_changed_at, property:properties(property_name, city)").in("client_id", cids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    cids.length
      ? supabase.from("projects").select("id, project_number, name, status, project_category, expected_end_date, created_at, property:properties!property_id(property_name, city)").in("client_id", cids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    cids.length
      ? supabase.from("quotations").select("id, quotation_number, version, status, grand_total, valid_until, created_at, lead_id, project_id").in("client_id", cids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    vids.length
      ? supabase.from("stock_purchase_orders").select("id, po_number, status, total_amount, order_date, expected_delivery, created_at").in("vendor_id", vids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      leads: leads.data ?? [],
      projects: projects.data ?? [],
      quotations: quotations.data ?? [],
      purchase_orders: pos.data ?? [],
    },
  });
}
