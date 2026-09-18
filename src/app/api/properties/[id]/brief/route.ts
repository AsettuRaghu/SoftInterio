import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

type RouteParams = { params: Promise<{ id: string }> };

const BRIEF_COLUMNS =
  "property_id, services_wanted, brief_notes, style_codes, preferred_finishes, updated_at";
const emptyBrief = (id: string) => ({
  property_id: id,
  services_wanted: [],
  brief_notes: null,
  style_codes: [],
  preferred_finishes: [],
  updated_at: null,
});

/**
 * The brief beside a property's scope: services wanted and the notes of
 * the first conversation. Same permissions as the scope rows themselves;
 * RLS keeps it to the tenant. One row per property, created on first save.
 *
 * GET -> { data: { property_id, services_wanted, brief_notes, style_codes,
 *                  preferred_finishes, updated_at } }
 * Budget, timeline and service type are the lead's; the Scope tab edits
 * them on the lead, not here.
 * PUT any subset of those (not property_id / updated_at)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_scope_brief")
    .select(BRIEF_COLUMNS)
    .eq("property_id", id)
    .maybeSingle();
  return NextResponse.json({ data: data ?? emptyBrief(id) });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase.from("properties").select("id").eq("id", id).eq("tenant_id", user.tenantId).maybeSingle();
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const row: Record<string, unknown> = {
    property_id: id,
    tenant_id: user.tenantId,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  if (Array.isArray(body.services_wanted)) {
    const ids = [...new Set(body.services_wanted.map(String))];
    if (ids.length) {
      const { data: cats } = await supabase
        .from("quotation_cost_item_categories").select("id").in("id", ids).eq("tenant_id", user.tenantId);
      if ((cats ?? []).length !== ids.length) return NextResponse.json({ error: "A service is not in the catalogue" }, { status: 400 });
    }
    row.services_wanted = ids;
  }
  if ("brief_notes" in body) row.brief_notes = String(body.brief_notes ?? "").trim() || null;
  if (Array.isArray(body.style_codes)) row.style_codes = [...new Set(body.style_codes.map(String))].slice(0, 20);
  if (Array.isArray(body.preferred_finishes)) {
    row.preferred_finishes = [...new Set(body.preferred_finishes.map((x: unknown) => String(x).trim()).filter(Boolean))].slice(0, 30);
  }

  const { data, error } = await supabase
    .from("property_scope_brief")
    .upsert(row, { onConflict: "property_id" })
    .select(BRIEF_COLUMNS)
    .single();
  if (error) {
    console.error("[scope brief] save failed", error.message);
    return NextResponse.json({ error: "Could not save the brief" }, { status: 500 });
  }
  return NextResponse.json({ data });
}
