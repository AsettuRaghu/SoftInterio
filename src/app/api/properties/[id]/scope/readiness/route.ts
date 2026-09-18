import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { scopeReadiness } from "@/lib/scope/readiness";

type RouteParams = { params: Promise<{ id: string }> };

/** GET ?lead_id= | ?project_id=  → the two gates and what is missing for each. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const supabase = await createClient();
  const data = await scopeReadiness(supabase, { propertyId: id, leadId: sp.get("lead_id"), projectId: sp.get("project_id") });
  return NextResponse.json({ data });
}
