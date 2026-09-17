/**
 * "Add to library" from a project's Documents tab.
 *
 *   POST /api/library/promote { document_id | document_ids[], title?, space_type_id?, component_type_id?, cost_item_id?, style_code?, tags?, kind?, visible_to_customer? }
 *
 * Makes an entry of kind "our_work" (by default) whose image IS the
 * project's document - a reference, not a copy. The entry remembers the
 * project it came from.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { ENTRY_SELECT, LIBRARY_KINDS, cleanTags, shapeEntries } from "@/lib/library/shape";

export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.create"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const documentIds: string[] = Array.isArray(body.document_ids)
    ? body.document_ids.map(String).filter(Boolean)
    : body.document_id
      ? [String(body.document_id)]
      : [];
  if (documentIds.length === 0) return NextResponse.json({ error: "document_id is required" }, { status: 400 });
  const made: string[] = [];
  for (const documentId of documentIds) {

  const { data: doc } = await supabase
    .from("documents")
    .select("id, tenant_id, original_name, title, file_type, file_size, storage_bucket, storage_path, linked_type, linked_id, parent_linked_type, parent_linked_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) {
    if (documentIds.length === 1) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    continue;
  }
  if (!(doc.file_type || "").startsWith("image/")) {
    if (documentIds.length === 1) return NextResponse.json({ error: "Only an image can go in the library" }, { status: 400 });
    continue;
  }

  const projectId =
    doc.linked_type === "project" ? doc.linked_id : doc.parent_linked_type === "project" ? doc.parent_linked_id : null;
  const kind = (LIBRARY_KINDS as readonly string[]).includes(body.kind) ? body.kind : "our_work";

  const { data: entry, error } = await supabase
    .from("library_entries")
    .insert({
      tenant_id: user.tenantId,
      kind,
      title: (documentIds.length === 1 && String(body.title ?? "").trim()) || doc.title || doc.original_name || "Untitled",
      description: String(body.description ?? "").trim() || null,
      space_type_id: body.space_type_id || null,
      component_type_id: body.component_type_id || null,
      cost_item_id: body.cost_item_id || null,
      style_code: body.style_code || null,
      tags: cleanTags(body.tags),
      visible_to_customer: body.visible_to_customer !== false,
      project_id: projectId,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !entry) {
    if (documentIds.length === 1) return NextResponse.json({ error: "Could not add to the library" }, { status: 500 });
    continue;
  }

  await supabase.from("library_entry_images").insert({
    tenant_id: user.tenantId,
    entry_id: entry.id,
    storage_bucket: doc.storage_bucket || "documents",
    storage_path: doc.storage_path,
    file_type: doc.file_type,
    file_size: doc.file_size,
    document_id: doc.id,
    display_order: 0,
  });
  made.push(entry.id);
  }
  const { data: rows } = made.length ? await supabase.from("library_entries").select(ENTRY_SELECT).in("id", made) : { data: [] };
  const shaped = await shapeEntries(rows ?? []);
  return NextResponse.json({ success: true, data: documentIds.length === 1 ? shaped[0] : shaped, count: made.length }, { status: 201 });
}
