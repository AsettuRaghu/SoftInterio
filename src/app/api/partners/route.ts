/**
 * Partners - everyone a business works with. See docs/plans/partners.md.
 *
 *   GET  /api/partners?type=customer&search=&status=active
 *   POST /api/partners  { name, kind, types[], phone?, email?, ... , contact? }
 *
 * Gated on the clients.* keys: they were the customer keys and this is the
 * customer module grown up. RLS scopes every table to the tenant; the
 * session client is used throughout.
 *
 * A partner that wears the "customer" hat also gets a `clients` row, so a
 * lead or a quotation can point at it the way they always have. The clients
 * row is the customer hat's own record; the partner is the identity above.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { normalisePhone } from "@/lib/partners/identity";

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["partners.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;
  const type = params.get("type") || "";
  const status = params.get("status") || "";
  const search = (params.get("search") || "").trim().toLowerCase();

  let query = supabase
    .from("partners")
    .select(
      "id, kind, name, display_name, phone, email, website, city, state, status, notes, platform_identity_id, created_at, updated_at, " +
        "types:partner_type_links(type_code), contacts:partner_contacts(id, name, designation, phone, email, is_primary), " +
        "clients:clients(id)"
    )
    .order("name");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) {
    console.error("[partners] list failed", error);
    return NextResponse.json({ error: "Could not load partners" }, { status: 500 });
  }

  // Leads and projects per customer, through the clients rows; purchase
  // orders per vendor, through stock_vendors. Counted in three queries for
  // the page rather than per row.
  const rows = (data ?? []) as any[];
  const clientIds = rows.flatMap((p) => (p.clients ?? []).map((c: any) => c.id));
  const leadsBy = new Map<string, number>();
  const projectsBy = new Map<string, number>();
  const posBy = new Map<string, number>();
  if (clientIds.length) {
    const [{ data: leads }, { data: projects }] = await Promise.all([
      supabase.from("leads").select("client_id").in("client_id", clientIds),
      supabase.from("projects").select("client_id").in("client_id", clientIds),
    ]);
    for (const l of leads ?? []) leadsBy.set(l.client_id, (leadsBy.get(l.client_id) ?? 0) + 1);
    for (const p of projects ?? []) projectsBy.set(p.client_id, (projectsBy.get(p.client_id) ?? 0) + 1);
  }
  const { data: vendors } = await supabase.from("stock_vendors").select("id, partner_id").in("partner_id", rows.map((p) => p.id));
  const vendorByPartner = new Map((vendors ?? []).map((v) => [v.partner_id, v.id]));
  if (vendors?.length) {
    const { data: pos } = await supabase.from("stock_purchase_orders").select("vendor_id").in("vendor_id", vendors.map((v) => v.id));
    for (const po of pos ?? []) posBy.set(po.vendor_id, (posBy.get(po.vendor_id) ?? 0) + 1);
  }

  let partners = rows.map((p) => {
    const types: string[] = (p.types ?? []).map((t: any) => t.type_code);
    const contacts = (p.contacts ?? []) as any[];
    const primary = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;
    const cids: string[] = (p.clients ?? []).map((c: any) => c.id);
    const vendorId = vendorByPartner.get(p.id) ?? null;
    return {
      id: p.id,
      kind: p.kind,
      name: p.name,
      display_name: p.display_name,
      phone: p.phone,
      email: p.email,
      website: p.website,
      city: p.city,
      state: p.state,
      status: p.status,
      notes: p.notes,
      // Whether the party has its own account on SoftInterio - the
      // ecosystem's pointer, empty for everyone today.
      on_platform: !!p.platform_identity_id,
      created_at: p.created_at,
      updated_at: p.updated_at,
      types,
      primary_contact: primary,
      contacts_count: contacts.length,
      client_ids: cids,
      vendor_id: vendorId,
      leads_count: cids.reduce((n, id) => n + (leadsBy.get(id) ?? 0), 0),
      projects_count: cids.reduce((n, id) => n + (projectsBy.get(id) ?? 0), 0),
      purchase_orders_count: vendorId ? (posBy.get(vendorId) ?? 0) : 0,
    };
  });
  if (type) partners = partners.filter((p) => p.types.includes(type));
  if (search) {
    partners = partners.filter((p) =>
      [p.name, p.display_name, p.phone, p.email, p.city, p.primary_contact?.name, p.primary_contact?.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(search))
    );
  }
  return NextResponse.json({ success: true, data: partners });
}

export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["partners.create"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const name = String(body.name ?? "").trim();
  const kind = body.kind === "organisation" ? "organisation" : "person";
  const types: string[] = Array.isArray(body.types) ? body.types.map(String).filter(Boolean) : [];
  const phone = normalisePhone(body.phone);
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  if (!name) return NextResponse.json({ error: "Give the partner a name" }, { status: 400 });
  if (types.length === 0) return NextResponse.json({ error: "Choose at least one type - what is this partner to us?" }, { status: 400 });

  const { data: known } = await supabase.from("partner_types").select("code").in("code", types);
  const knownCodes = new Set((known ?? []).map((t) => t.code));
  const unknown = types.filter((t) => !knownCodes.has(t));
  if (unknown.length) return NextResponse.json({ error: `Unknown partner type: ${unknown.join(", ")}` }, { status: 400 });

  const { data: partner, error } = await supabase
    .from("partners")
    .insert({
      tenant_id: user.tenantId,
      kind,
      name,
      display_name: String(body.display_name ?? "").trim() || null,
      phone,
      email,
      website: String(body.website ?? "").trim() || null,
      address_line1: String(body.address_line1 ?? "").trim() || null,
      city: String(body.city ?? "").trim() || null,
      state: String(body.state ?? "").trim() || null,
      pincode: String(body.pincode ?? "").trim() || null,
      gst_number: String(body.gst_number ?? "").trim() || null,
      pan_number: String(body.pan_number ?? "").trim() || null,
      notes: String(body.notes ?? "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !partner) {
    console.error("[partners] create failed", error);
    return NextResponse.json({ error: "Could not create the partner" }, { status: 500 });
  }

  await supabase.from("partner_type_links").insert(types.map((t) => ({ partner_id: partner.id, type_code: t })));

  // The primary contact - the owner. A person is their own; an organisation
  // names one, or we use the organisation's own name until someone does.
  const contact = body.contact && typeof body.contact === "object" ? body.contact : null;
  await supabase.from("partner_contacts").insert({
    tenant_id: user.tenantId,
    partner_id: partner.id,
    name: String(contact?.name ?? "").trim() || name,
    designation: String(contact?.designation ?? "").trim() || null,
    phone: normalisePhone(contact?.phone) ?? phone,
    email: String(contact?.email ?? "").trim().toLowerCase() || email,
    is_primary: true,
  });

  // A customer needs a clients row for leads and quotations to point at.
  if (types.includes("customer")) {
    await supabase.from("clients").insert({
      tenant_id: user.tenantId,
      partner_id: partner.id,
      client_type: kind === "organisation" ? "company" : "individual",
      status: "active",
      name,
      phone,
      email,
      city: String(body.city ?? "").trim() || null,
      created_by: user.id,
    });
  }

  return NextResponse.json({ success: true, data: { id: partner.id } }, { status: 201 });
}
