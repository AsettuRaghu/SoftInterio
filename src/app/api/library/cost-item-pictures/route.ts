import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { ENTRY_SELECT, shapeEntries } from "@/lib/library/shape";

/**
 * GET /api/library/cost-item-pictures?ids=a,b,c[&customer=1]
 *
 * The pictures of cost items - library entries linked to them (kind
 * `product` or `material`, one entry per picture as the catalogue's Pictures
 * dialog uploads them), grouped by item, signed for an hour. The Scope Sheet
 * reads it once per component so a chip can show what acrylic looks like
 * while the customer chooses; `customer=1` keeps only pictures marked
 * visible to the customer, which is what the summary shows. Gated on
 * `leads.view` rather than `library.view`: a seller reading a picture of a
 * shutter is not browsing the library.
 */
export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  const customerOnly = request.nextUrl.searchParams.get("customer") === "1";
  if (ids.length === 0) return NextResponse.json({ data: {} });
  const supabase = await createClient();
  let q = supabase.from("library_entries").select(ENTRY_SELECT).in("cost_item_id", ids).order("created_at", { ascending: true });
  if (customerOnly) q = q.eq("visible_to_customer", true);
  const { data } = await q;
  const shaped = await shapeEntries(data ?? []);
  const out: Record<string, { entry_id: string; url: string; title: string; visible_to_customer: boolean }[]> = {};
  for (const e of shaped) {
    if (!e.cost_item_id) continue;
    for (const img of e.images) {
      if (!img.url) continue;
      (out[e.cost_item_id] ??= []).push({ entry_id: e.id, url: img.url, title: e.title, visible_to_customer: e.visible_to_customer });
    }
  }
  return NextResponse.json({ data: out });
}
