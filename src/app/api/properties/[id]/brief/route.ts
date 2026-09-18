import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * The brief beside a property's scope: services wanted and the notes of
 * the first conversation. Same permissions as the scope rows themselves;
 * RLS keeps it to the tenant. One row per property, created on first save.
 *
 * GET -> { data: { property_id, services_wanted, brief_notes, updated_at } }
 * PUT { services_wanted?: uuid[], brief_notes?: string }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_scope_brief")
    .select("property_id, services_wanted, brief_notes, updated_at")
    .eq("property_id", id)
    .maybeSingle();
  return NextResponse.json({
    data: data ?? { property_id: id, services_wanted: [], brief_notes: null, updated_at: null },
  });
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

  const { data, error } = await supabase
    .from("property_scope_brief")
    .upsert(row, { onConflict: "property_id" })
    .select("property_id, services_wanted, brief_notes, updated_at")
    .single();
  if (error) {
    console.error("[scope brief] save failed", error.message);
    return NextResponse.json({ error: "Could not save the brief" }, { status: 500 });
  }
  return NextResponse.json({ data });
}
