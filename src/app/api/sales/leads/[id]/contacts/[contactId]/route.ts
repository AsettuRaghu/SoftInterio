import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireLeadPartner } from "@/lib/leads/partner-guard";
import { normalisePhone } from "@/lib/partners/identity";

/**
 *   PATCH  /api/sales/leads/:id/contacts/:contactId
 *   DELETE /api/sales/leads/:id/contacts/:contactId
 *
 * Gated on write access to the lead. **Lineage is checked, not assumed**: the
 * contact must hang off the partner behind THIS lead's client, or a caller who
 * may edit one lead could edit any contact in the tenant by pairing a lead id
 * they hold with a contact id they do not. That is the same trap the project
 * sub-routes had before `requireProjectAccess`, and the fix is the same shape -
 * the `.eq("partner_id", …)` below is the whole of it.
 */
type Params = { params: Promise<{ id: string; contactId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { loadPermissions: true });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id, contactId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const lead = await requireLeadPartner(supabase, {
    leadId: id,
    user: guard.user,
    permissions: guard.permissions,
    mode: "write",
  });
  if (!lead.ok) return lead.response;

  const { data: existing } = await supabase
    .from("partner_contacts")
    .select("id, is_primary, phone, email")
    .eq("id", contactId)
    .eq("partner_id", lead.partnerId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in body) {
    const n = String(body.name ?? "").trim();
    if (!n) return NextResponse.json({ error: "A contact needs a name" }, { status: 400 });
    patch.name = n;
  }
  if ("designation" in body) patch.designation = String(body.designation ?? "").trim() || null;
  if ("phone" in body) patch.phone = normalisePhone(body.phone);
  if ("email" in body) patch.email = String(body.email ?? "").trim().toLowerCase() || null;
  if ("notes" in body) patch.notes = String(body.notes ?? "").trim() || null;

  // The create rule applies to the edit: an edit must not leave a contact with
  // no way to reach them. Judged on the result, so clearing the phone is fine
  // while an email stands and refused when it is the last one.
  const phoneAfter = "phone" in patch ? (patch.phone as string | null) : existing.phone;
  const emailAfter = "email" in patch ? (patch.email as string | null) : existing.email;
  if (!phoneAfter && !emailAfter) {
    return NextResponse.json({ error: "Keep a phone number or an email, so there is a way to reach them" }, { status: 400 });
  }

  if (body.is_primary === true && !existing.is_primary) {
    await supabase
      .from("partner_contacts")
      .update({ is_primary: false })
      .eq("partner_id", lead.partnerId)
      .eq("is_primary", true);
    patch.is_primary = true;
  }
  if (body.is_primary === false && existing.is_primary) {
    return NextResponse.json(
      { error: "Every customer has one main contact. Make somebody else the main contact instead." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("partner_contacts")
    .update(patch)
    .eq("id", contactId)
    .select("id, name, designation, phone, email, is_primary, notes, created_at")
    .single();
  if (error) {
    console.error("[lead contacts] update failed", error.message);
    return NextResponse.json({ error: "Could not save the contact" }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { loadPermissions: true });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id, contactId } = await params;
  const supabase = await createClient();

  const lead = await requireLeadPartner(supabase, {
    leadId: id,
    user: guard.user,
    permissions: guard.permissions,
    mode: "write",
  });
  if (!lead.ok) return lead.response;

  const { data: existing } = await supabase
    .from("partner_contacts")
    .select("id, is_primary")
    .eq("id", contactId)
    .eq("partner_id", lead.partnerId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  if (existing.is_primary) {
    return NextResponse.json(
      { error: "This is the main contact. Make somebody else the main contact first." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("partner_contacts").delete().eq("id", contactId);
  if (error) return NextResponse.json({ error: "Could not remove the contact" }, { status: 500 });
  return NextResponse.json({ success: true });
}
