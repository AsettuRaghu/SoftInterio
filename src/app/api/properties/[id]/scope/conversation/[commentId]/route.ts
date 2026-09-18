import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { COMMENT_COLUMNS, withAuthors } from "@/lib/scope/conversation";

type RouteParams = { params: Promise<{ id: string; commentId: string }> };

/** PATCH { body?, is_decision?, needs_rework? } · DELETE */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id, commentId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("body" in body) {
    const text = String(body.body ?? "").trim();
    if (!text) return NextResponse.json({ error: "Write something first" }, { status: 400 });
    patch.body = text;
  }
  if ("is_decision" in body) patch.is_decision = !!body.is_decision;
  if ("needs_rework" in body) patch.needs_rework = !!body.needs_rework;
  const { data, error } = await supabase
    .from("scope_item_comments").update(patch).eq("id", commentId).eq("property_id", id).select(COMMENT_COLUMNS).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await withAuthors(supabase, [data]);
  return NextResponse.json({ data: row });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id, commentId } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("scope_item_comments").delete().eq("id", commentId).eq("property_id", id);
  if (error) return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  return NextResponse.json({ success: true });
}
