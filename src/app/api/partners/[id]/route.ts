/**
 * One partner.
 *
 *   GET    /api/partners/:id   the record, its types, its contacts
 *   PATCH  /api/partners/:id   the record and/or its types
 *   DELETE /api/partners/:id   refused while anything points at it
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { normalisePhone } from "@/lib/partners/identity";

type Params = { params: Promise<{ id: string }> };

const EDITABLE = [
  "name", "display_name", "kind", "phone", "email", "website",
  "address_line1", "address_line2", "city", "state", "pincode", "country",
  "gst_number", "pan_number", "notes", "status",
] as const;

async function load(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from("partners")
    .select(
      "*, types:partner_type_links(type_code), contacts:partner_contacts(id, name, designation, phone, email, is_primary, is_decision_maker, notes, created_at), " +
        "clients:clients(id), vendors:stock_vendors(id, code, payment_terms, credit_days, credit_limit)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const d = data as any;
  return {
    ...d,
    types: (d.types ?? []).map((t: any) => t.type_code) as string[],
    contacts: ((d.contacts ?? []) as any[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name)),
    client_ids: (d.clients ?? []).map((c: any) => c.id) as string[],
    vendor: (d.vendors ?? [])[0] ?? null,
    clients: undefined,
    vendors: undefined,
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["partners.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const partner = await load(supabase, id);
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: partner });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["partners.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const { data: existing } = await supabase.from("partners").select("id, name, kind").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  for (const f of EDITABLE) {
    if (!(f in body)) continue;
    const v = body[f];
    if (f === "kind") patch.kind = v === "organisation" ? "organisation" : "person";
    else if (f === "status") patch.status = v === "inactive" ? "inactive" : "active";
    else if (f === "phone") patch.phone = normalisePhone(v);
    else if (f === "email") patch.email = String(v ?? "").trim().toLowerCase() || null;
    else patch[f] = typeof v === "string" ? v.trim() || null : v;
  }
  if ("name" in patch && !patch.name) return NextResponse.json({ error: "A partner needs a name" }, { status: 400 });

  if (Object.keys(patch).length) {
    patch.updated_by = guard.user.id;
    patch.updated_at = new Date().toISOString();
    const { error } = await supabase.from("partners").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: "Could not save the partner" }, { status: 500 });
    // The customer hat's own record follows the identity's name and phone.
    const mirror: Record<string, unknown> = {};
    if ("name" in patch) mirror.name = patch.name;
    if ("phone" in patch) mirror.phone = patch.phone;
    if ("email" in patch) mirror.email = patch.email;
    if ("city" in patch) mirror.city = patch.city;
    if (Object.keys(mirror).length) await supabase.from("clients").update(mirror).eq("partner_id", id);
  }

  if (Array.isArray(body.types)) {
    const types = body.types.map(String).filter(Boolean) as string[];
    if (types.length === 0) return NextResponse.json({ error: "A partner wears at least one hat" }, { status: 400 });
    const { data: known } = await supabase.from("partner_types").select("code").in("code", types);
    const unknown = types.filter((t) => !(known ?? []).some((k) => k.code === t));
    if (unknown.length) return NextResponse.json({ error: `Unknown partner type: ${unknown.join(", ")}` }, { status: 400 });
    await supabase.from("partner_type_links").delete().eq("partner_id", id);
    await supabase.from("partner_type_links").insert(types.map((t) => ({ partner_id: id, type_code: t })));
    // Becoming a customer needs a clients row for leads to point at.
    if (types.includes("customer")) {
      const { data: c } = await supabase.from("clients").select("id").eq("partner_id", id).limit(1);
      if (!c?.length) {
        const p = await load(supabase, id);
        await supabase.from("clients").insert({
          tenant_id: guard.user.tenantId,
          partner_id: id,
          client_type: p?.kind === "organisation" ? "company" : "individual",
          status: "active",
          name: p?.name,
          phone: p?.phone,
          email: p?.email,
          city: p?.city,
          created_by: guard.user.id,
        });
      }
    }
  }

  const partner = await load(supabase, id);
  return NextResponse.json({ success: true, data: partner });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["partners.delete"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const partner = await load(supabase, id);
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  // Anything that points at it keeps it. A record with history is made
  // inactive, not deleted.
  const cids = partner.client_ids as string[];
  const [{ count: leads }, { count: projects }, { count: quotations }, { count: pos }] = await Promise.all([
    cids.length ? supabase.from("leads").select("id", { count: "exact", head: true }).in("client_id", cids) : Promise.resolve({ count: 0 }),
    cids.length ? supabase.from("projects").select("id", { count: "exact", head: true }).in("client_id", cids) : Promise.resolve({ count: 0 }),
    cids.length ? supabase.from("quotations").select("id", { count: "exact", head: true }).in("client_id", cids) : Promise.resolve({ count: 0 }),
    partner.vendor ? supabase.from("stock_purchase_orders").select("id", { count: "exact", head: true }).eq("vendor_id", partner.vendor.id) : Promise.resolve({ count: 0 }),
  ]);
  const used = (leads ?? 0) + (projects ?? 0) + (quotations ?? 0) + (pos ?? 0);
  if (used > 0) {
    return NextResponse.json(
      { error: `This partner has ${used} record${used === 1 ? "" : "s"} against it. Mark it inactive instead.`, reason: "in_use" },
      { status: 409 }
    );
  }
  await supabase.from("clients").delete().eq("partner_id", id);
  await supabase.from("stock_vendors").delete().eq("partner_id", id);
  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete the partner" }, { status: 500 });
  return NextResponse.json({ success: true });
}
