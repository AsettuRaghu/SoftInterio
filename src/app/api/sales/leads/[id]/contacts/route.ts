import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireLeadPartner } from "@/lib/leads/partner-guard";
import { normalisePhone } from "@/lib/partners/identity";
import { sortContacts } from "@/lib/partners/contacts";

/**
 * The people at this lead's customer.
 *
 *   GET  /api/sales/leads/:id/contacts   -> { data: [contact] }
 *   POST /api/sales/leads/:id/contacts   { name, designation?, phone?, email?, notes?, is_primary? }
 *
 * Gated on access to the LEAD, not on `partners.edit` - see
 * `lib/leads/partner-guard.ts` for why. The rows are ordinary
 * `partner_contacts`: the same people the Partners screen shows, reached from
 * where the conversation happens.
 *
 * One primary per partner, enforced by a partial unique index; making a new
 * contact primary demotes the old one in the same request.
 */
type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { loadPermissions: true });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();

  const lead = await requireLeadPartner(supabase, {
    leadId: id,
    user: guard.user,
    permissions: guard.permissions,
    mode: "read",
  });
  if (!lead.ok) return lead.response;

  const { data, error } = await supabase
    .from("partner_contacts")
    .select("id, name, designation, phone, email, is_primary, notes, created_at")
    .eq("partner_id", lead.partnerId);
  if (error) return NextResponse.json({ error: "Could not load the contacts" }, { status: 500 });

  return NextResponse.json({ data: sortContacts(data ?? []) });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { loadPermissions: true });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const lead = await requireLeadPartner(supabase, {
    leadId: id,
    user: guard.user,
    permissions: guard.permissions,
    mode: "write",
  });
  if (!lead.ok) return lead.response;

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Give the contact a name" }, { status: 400 });

  // A person with no phone and no email is a note, not a contact - the whole
  // point of recording them is being able to reach them.
  const phone = normalisePhone(body.phone);
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  if (!phone && !email) {
    return NextResponse.json({ error: "Add a phone number or an email, so there is a way to reach them" }, { status: 400 });
  }

  if (body.is_primary === true) {
    await supabase
      .from("partner_contacts")
      .update({ is_primary: false })
      .eq("partner_id", lead.partnerId)
      .eq("is_primary", true);
  }

  const { data, error } = await supabase
    .from("partner_contacts")
    .insert({
      tenant_id: guard.user.tenantId,
      partner_id: lead.partnerId,
      name,
      designation: String(body.designation ?? "").trim() || null,
      phone,
      email,
      is_primary: body.is_primary === true,
      notes: String(body.notes ?? "").trim() || null,
    })
    .select("id, name, designation, phone, email, is_primary, notes, created_at")
    .single();

  if (error) {
    console.error("[lead contacts] insert failed", error.message);
    return NextResponse.json({ error: "Could not add the contact" }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
