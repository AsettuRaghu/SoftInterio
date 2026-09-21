import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { scopeDrift } from "@/lib/quotations/scope-drift";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/quotations/[id]/scope-drift - how far the scope has moved from
 * this quotation. Read only; see lib/quotations/scope-drift. Answers for a
 * quotation on a lead or project in the caller's tenant; a standalone
 * quotation has no scope and gets an empty answer.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["quotations.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotations").select("id, lead_id, project_id").eq("id", id).eq("tenant_id", guard.user.tenantId).maybeSingle();
  if (!q) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  const drift = await scopeDrift(supabase, guard.user.tenantId, id, q.lead_id, q.project_id);
  return NextResponse.json({ data: drift });
}
