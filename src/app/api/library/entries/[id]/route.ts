/**
 *   GET    /api/library/entries/:id
 *   PATCH  /api/library/entries/:id   fields only; images have their own routes
 *   DELETE /api/library/entries/:id   removes uploaded images from storage; promoted ones stay with their document
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { ENTRY_SELECT, LIBRARY_KINDS, cleanTags, shapeEntries } from "@/lib/library/shape";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("library_entries").select(ENTRY_SELECT).eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  const [shaped] = await shapeEntries([data]);
  return NextResponse.json({ success: true, data: shaped });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in body) {
    const t = String(body.title ?? "").trim();
    if (!t) return NextResponse.json({ error: "An entry needs a title" }, { status: 400 });
    patch.title = t;
  }
  if ("kind" in body) {
    if (!(LIBRARY_KINDS as readonly string[]).includes(body.kind)) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
    patch.kind = body.kind;
  }
  for (const f of ["description", "source_url"] as const) if (f in body) patch[f] = String(body[f] ?? "").trim() || null;
  for (const f of ["space_type_id", "component_type_id", "cost_item_id", "cost_category_id", "quality_tier", "stage_key", "style_code", "project_id", "partner_id"] as const)
    if (f in body) patch[f] = body[f] || null;
  if ("tags" in body) patch.tags = cleanTags(body.tags);
  if ("visible_to_customer" in body) patch.visible_to_customer = body.visible_to_customer !== false;

  const { error } = await supabase.from("library_entries").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save the entry" }, { status: 500 });
  const { data } = await supabase.from("library_entries").select(ENTRY_SELECT).eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  const [shaped] = await shapeEntries([data]);
  return NextResponse.json({ success: true, data: shaped });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.delete"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: images } = await supabase.from("library_entry_images").select("storage_path, document_id").eq("entry_id", id);
  // Files the library uploaded itself are its own to remove; a promoted
  // project photo belongs to the project's Documents and stays.
  const own = (images ?? []).filter((i) => !i.document_id).map((i) => i.storage_path);
  if (own.length) await admin.storage.from("documents").remove(own);
  const { error } = await supabase.from("library_entries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete the entry" }, { status: 500 });
  return NextResponse.json({ success: true });
}
