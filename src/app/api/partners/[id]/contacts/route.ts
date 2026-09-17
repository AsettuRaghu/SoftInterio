/**
 * The people at a partner.
 *
 *   POST /api/partners/:id/contacts { name, designation?, phone?, email?, is_primary? }
 *
 * Exactly one primary per partner - its owner. Making a new one primary
 * demotes the old one in the same request.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { normalisePhone } from "@/lib/partners/identity";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["clients.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Give the contact a name" }, { status: 400 });
  const { data: partner } = await supabase.from("partners").select("id").eq("id", id).maybeSingle();
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  if (body.is_primary === true) {
    await supabase.from("partner_contacts").update({ is_primary: false }).eq("partner_id", id).eq("is_primary", true);
  }
  const { data, error } = await supabase
    .from("partner_contacts")
    .insert({
      tenant_id: guard.user.tenantId,
      partner_id: id,
      name,
      designation: String(body.designation ?? "").trim() || null,
      phone: normalisePhone(body.phone),
      email: String(body.email ?? "").trim().toLowerCase() || null,
      is_primary: body.is_primary === true,
      notes: String(body.notes ?? "").trim() || null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Could not add the contact" }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
