/**
 * One reason of this tenant's own.
 *
 *   PATCH  { label?, is_active? }   rename, or hide / show
 *   DELETE                          remove (holds that used it keep the code)
 *
 * Shipped defaults (tenant_id NULL) are refused here: they belong to every
 * business. RLS already limits writes to the tenant's rows; the checks below
 * only make the refusal a sentence rather than an empty update.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

async function own(request: NextRequest, id: string) {
  const guard = await protectApiRoute(request, {
    loadPermissions: true,
    requiredPermissions: ["settings.company.update"],
  });
  if (!guard.success) return { fail: createErrorResponse(guard.error!, guard.statusCode!) };
  const supabase = await createClient();
  const { data } = await supabase.from("delay_reasons").select("id, tenant_id").eq("id", id).maybeSingle();
  if (!data) return { fail: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!data.tenant_id || data.tenant_id !== guard.user.tenantId) {
    return { fail: NextResponse.json({ error: "That reason is shipped with SoftInterio and is shared by every business; add your own beside it." }, { status: 403 }) };
  }
  return { supabase };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await own(request, id);
  if ("fail" in r) return r.fail;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) update.label = body.label.trim();
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  const { data, error } = await r.supabase.from("delay_reasons").update(update).eq("id", id).select("id, owner, code, label, is_active").single();
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await own(request, id);
  if ("fail" in r) return r.fail;
  const { error } = await r.supabase.from("delay_reasons").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not remove" }, { status: 500 });
  return NextResponse.json({ success: true });
}
