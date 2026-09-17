/**
 * The hats a partner can wear: shipped types (tenant_id NULL) and this
 * business's own, in display order.
 *
 *   GET  /api/partners/types
 *   POST /api/partners/types { code, label, description? }   (settings.company.update)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["partners.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_types")
    .select("id, tenant_id, code, label, description, display_order, is_active")
    .eq("is_active", true)
    .order("display_order")
    .order("label");
  if (error) return NextResponse.json({ error: "Could not load partner types" }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, { loadPermissions: true, requiredPermissions: ["settings.company.update"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const label = String(body.label ?? "").trim();
  if (!label) return NextResponse.json({ error: "Give the type a name" }, { status: 400 });
  const code = (String(body.code ?? "").trim() || label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const { data, error } = await supabase
    .from("partner_types")
    .insert({ tenant_id: guard.user.tenantId, code, label, description: String(body.description ?? "").trim() || null, display_order: 500 })
    .select("id, code, label")
    .single();
  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "A type with that name already exists" : "Could not add the type" },
      { status: error.code === "23505" ? 409 : 500 }
    );
  }
  return NextResponse.json({ success: true, data }, { status: 201 });
}
