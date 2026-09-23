import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { cleanPresetItems, cleanConfigurations, cleanPropertyTypes } from "@/lib/scope/presets";

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH { name?, description?, items?, is_active?, display_order?, configurations?, property_types? } */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "A name is required" }, { status: 400 });
    patch.name = name;
  }
  if ("description" in body) patch.description = String(body.description ?? "").trim() || null;
  if ("is_active" in body) patch.is_active = !!body.is_active;
  if ("display_order" in body) patch.display_order = Number(body.display_order) || 0;
  if ("package_id" in body) patch.package_id = body.package_id ? String(body.package_id) : null;
  if ("configurations" in body) patch.configurations = cleanConfigurations(body.configurations);
  if ("property_types" in body) patch.property_types = cleanPropertyTypes(body.property_types);
  if ("items" in body) {
    const items = await cleanPresetItems(supabase, user.tenantId, body.items);
    if (!items.ok) return NextResponse.json({ error: items.error }, { status: 400 });
    patch.items = items.items;
  }

  const { data, error } = await supabase
    .from("scope_presets").update(patch).eq("id", id).eq("tenant_id", user.tenantId).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not save the preset" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("scope_presets").delete().eq("id", id).eq("tenant_id", guard.user.tenantId);
  if (error) return NextResponse.json({ error: "Could not delete the preset" }, { status: 500 });
  return NextResponse.json({ success: true });
}
