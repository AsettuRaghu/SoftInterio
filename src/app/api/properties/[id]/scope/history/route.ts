import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { namesOf } from "@/lib/notifications/notify";

type RouteParams = { params: Promise<{ id: string }> };

/** GET ?item=<scope item id>&limit=  - the change log, newest first. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "50", 10) || 50));
  let q = supabase
    .from("property_scope_item_history")
    .select("id, scope_item_id, item_name, action, changes, reason, changed_by, changed_at")
    .eq("property_id", id)
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (sp.get("item")) q = q.eq("scope_item_id", sp.get("item")!);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Could not load the history" }, { status: 500 });
  const nameOf = await namesOf(supabase, (data ?? []).map((r) => r.changed_by));
  return NextResponse.json({
    data: (data ?? []).map((r) => ({ ...r, changed_by_name: r.changed_by ? nameOf(r.changed_by) : "System" })),
  });
}
