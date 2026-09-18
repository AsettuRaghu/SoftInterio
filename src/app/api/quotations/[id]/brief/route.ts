import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * What the customer asked for, for the builder: the services wanted (so the
 * sidebar can tick them off as they are quoted), the finishes they lean to,
 * and any finish named on a particular space or component - keyed by the
 * scope row id the quotation lines carry in metadata.scope_item_id.
 * Empty for a standalone quotation.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();

  const { data: q } = await supabase.from("quotations").select("lead_id, project_id").eq("id", id).eq("tenant_id", guard.user.tenantId).maybeSingle();
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

  let propertyId: string | null = null;
  if (q.lead_id) propertyId = (await supabase.from("leads").select("property_id").eq("id", q.lead_id).maybeSingle()).data?.property_id ?? null;
  else if (q.project_id) propertyId = (await supabase.from("projects").select("property_id").eq("id", q.project_id).maybeSingle()).data?.property_id ?? null;
  if (!propertyId) return NextResponse.json({ data: { services: [], finishes: [], rowFinishes: {} } });

  const [{ data: brief }, { data: rows }] = await Promise.all([
    supabase.from("property_scope_brief").select("services_wanted, preferred_finishes").eq("property_id", propertyId).maybeSingle(),
    supabase.from("property_scope_items").select("id, preferred_finish").eq("property_id", propertyId).not("preferred_finish", "is", null),
  ]);
  const ids = brief?.services_wanted ?? [];
  const { data: cats } = ids.length
    ? await supabase.from("quotation_cost_item_categories").select("id, name").in("id", ids)
    : { data: [] as { id: string; name: string }[] };

  return NextResponse.json({
    data: {
      services: (cats ?? []).map((c) => ({ id: c.id, name: c.name })),
      finishes: brief?.preferred_finishes ?? [],
      rowFinishes: Object.fromEntries((rows ?? []).map((r) => [r.id, r.preferred_finish as string])),
    },
  });
}
