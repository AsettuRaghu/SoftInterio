/**
 *   PATCH  /api/partners/:id/contacts/:contactId
 *   DELETE /api/partners/:id/contacts/:contactId   (not the primary - make another primary first)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { normalisePhone } from "@/lib/partners/identity";

type Params = { params: Promise<{ id: string; contactId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["clients.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id, contactId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const { data: existing } = await supabase.from("partner_contacts").select("id, is_primary").eq("id", contactId).eq("partner_id", id).maybeSingle();
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
  if (body.is_primary === true && !existing.is_primary) {
    await supabase.from("partner_contacts").update({ is_primary: false }).eq("partner_id", id).eq("is_primary", true);
    patch.is_primary = true;
  }
  if (body.is_primary === false && existing.is_primary) {
    return NextResponse.json({ error: "Every partner has a primary contact. Make another contact primary instead." }, { status: 409 });
  }
  const { data, error } = await supabase.from("partner_contacts").update(patch).eq("id", contactId).select("*").single();
  if (error) return NextResponse.json({ error: "Could not save the contact" }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["clients.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id, contactId } = await params;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("partner_contacts").select("id, is_primary").eq("id", contactId).eq("partner_id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (existing.is_primary) {
    return NextResponse.json({ error: "This is the primary contact. Make another contact primary first." }, { status: 409 });
  }
  const { error } = await supabase.from("partner_contacts").delete().eq("id", contactId);
  if (error) return NextResponse.json({ error: "Could not remove the contact" }, { status: 500 });
  return NextResponse.json({ success: true });
}
