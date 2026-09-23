import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { cleanPresetItems, cleanConfigurations, cleanPropertyTypes } from "@/lib/scope/presets";

/**
 * Scope presets - curated starting points for a scope.
 *
 * Gated like the rest of the catalogue: anyone who may see quotations may
 * read them (the add dialog needs them), and editing the catalogue is what
 * lets somebody write one. RLS scopes every query to the caller's tenant.
 *
 * GET  ?all=1 to include inactive (the settings page); default is active only.
 * POST { name, description?, items, configurations?, property_types? }
 *
 * `configurations` is which homes the preset answers - the Configuration
 * dropdown's own values - and replaces guessing it from the preset's name.
 */
export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  let q = supabase.from("scope_presets").select("*").order("display_order").order("name");
  if (request.nextUrl.searchParams.get("all") !== "1") q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Could not load presets" }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "A name is required" }, { status: 400 });
  const items = await cleanPresetItems(supabase, user.tenantId, body.items);
  if (!items.ok) return NextResponse.json({ error: items.error }, { status: 400 });

  const { data: last } = await supabase
    .from("scope_presets").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("scope_presets")
    .insert({
      tenant_id: user.tenantId,
      name,
      description: String(body.description ?? "").trim() || null,
      items: items.items,
      configurations: cleanConfigurations(body.configurations),
      property_types: cleanPropertyTypes(body.property_types),
      display_order: (last?.display_order ?? -1) + 1,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Could not save the preset" }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
