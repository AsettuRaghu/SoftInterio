import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { ENTRY_SELECT, shapeEntries } from "@/lib/library/shape";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

/**
 * Library entries pinned to a scope row - "they liked this one".
 * GET -> shaped entries · POST { library_entry_id } · DELETE ?entry=
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { itemId } = await params;
  const supabase = await createClient();
  const { data: pins } = await supabase.from("scope_item_library_pins").select("library_entry_id").eq("scope_item_id", itemId);
  const ids = (pins ?? []).map((p) => p.library_entry_id);
  if (ids.length === 0) return NextResponse.json({ data: [] });
  const { data } = await supabase.from("library_entries").select(ENTRY_SELECT).in("id", ids);
  return NextResponse.json({ data: await shapeEntries(data ?? []) });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id, itemId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  if (!body.library_entry_id) return NextResponse.json({ error: "library_entry_id is required" }, { status: 400 });
  const { data: item } = await supabase.from("property_scope_items").select("id").eq("id", itemId).eq("property_id", id).maybeSingle();
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await supabase.from("scope_item_library_pins").upsert(
    { scope_item_id: itemId, library_entry_id: body.library_entry_id, tenant_id: guard.user.tenantId, pinned_by: guard.user.id },
    { onConflict: "scope_item_id,library_entry_id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: "Could not pin" }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { itemId } = await params;
  const entry = request.nextUrl.searchParams.get("entry");
  if (!entry) return NextResponse.json({ error: "entry is required" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("scope_item_library_pins").delete().eq("scope_item_id", itemId).eq("library_entry_id", entry);
  if (error) return NextResponse.json({ error: "Could not unpin" }, { status: 500 });
  return NextResponse.json({ success: true });
}
