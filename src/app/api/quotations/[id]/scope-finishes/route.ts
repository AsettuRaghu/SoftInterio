import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * The finish named on each space or component of the scope, keyed by the
 * scope row id the quotation lines carry in metadata.scope_item_id - so the
 * builder can list matching cost items first. Empty for a standalone
 * quotation.
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
  if (!propertyId) return NextResponse.json({ data: {} });

  const { data: rows } = await supabase.from("property_scope_items").select("id, preferred_finish").eq("property_id", propertyId).not("preferred_finish", "is", null);
  return NextResponse.json({ data: Object.fromEntries((rows ?? []).map((r) => [r.id, r.preferred_finish as string])) });
}
