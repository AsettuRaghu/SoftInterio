import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { COMMENT_COLUMNS, withAuthors } from "@/lib/scope/conversation";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * The discussion on a scope - per space or component, or about the scope as
 * a whole (no item). Each entry is a note or a decision; one may be flagged
 * as needing rework and turned into a task. Tenant team only - nothing here
 * is customer-facing (decided 2026-09-18).
 *
 * GET  ?item=<scope item id> | ?item=none (scope-level) | omitted (all) · &decisions=1
 * POST { scope_item_id?, body, is_decision?, needs_rework? }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const item = request.nextUrl.searchParams.get("item");
  const decisionsOnly = request.nextUrl.searchParams.get("decisions") === "1";
  let q = supabase.from("scope_item_comments").select(COMMENT_COLUMNS).eq("property_id", id).order("created_at", { ascending: true });
  // ?item=<id> one row's thread · ?item=none the scope-level thread · omitted: everything
  if (item === "none") q = q.is("scope_item_id", null);
  else if (item) q = q.eq("scope_item_id", item);
  if (decisionsOnly) q = q.eq("is_decision", true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Could not load the discussion" }, { status: 500 });
  return NextResponse.json({ data: await withAuthors(supabase, data ?? []) });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const text = String(body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Write something first" }, { status: 400 });

  if (body.scope_item_id) {
    const { data: item } = await supabase.from("property_scope_items").select("id").eq("id", body.scope_item_id).eq("property_id", id).maybeSingle();
    if (!item) return NextResponse.json({ error: "That space is not on this property" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("scope_item_comments")
    .insert({
      tenant_id: user.tenantId,
      property_id: id,
      scope_item_id: body.scope_item_id || null,
      body: text,
      is_decision: !!body.is_decision,
      needs_rework: !!body.needs_rework,
      created_by: user.id,
    })
    .select(COMMENT_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  const [row] = await withAuthors(supabase, [data]);
  return NextResponse.json({ data: row }, { status: 201 });
}
