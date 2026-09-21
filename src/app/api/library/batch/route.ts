/**
 * Drop a batch: many pictures at once, one entry each, sharing whatever
 * was set on the batch (kind, space, component, cost item, tags...). The
 * title is the file's name until someone changes it; the point is that
 * thirty site photos land in one go and get tagged together afterwards.
 *
 *   POST /api/library/batch   multipart: images[] + fields
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { ENTRY_SELECT, LIBRARY_KINDS, cleanTags, shapeEntries } from "@/lib/library/shape";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.create"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const supabase = await createClient();
  const admin = createAdminClient();
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "our_work");
  if (!(LIBRARY_KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "Choose some pictures" }, { status: 400 });
  if (files.length > 40) return NextResponse.json({ error: "Up to 40 pictures in one batch" }, { status: 400 });
  for (const f of files) {
    if (!f.type.startsWith("image/")) return NextResponse.json({ error: `${f.name} is not an image` }, { status: 400 });
    if (f.size > MAX_FILE_SIZE) return NextResponse.json({ error: `${f.name} is over 20MB` }, { status: 400 });
  }
  const shared = {
    tenant_id: user.tenantId,
    kind,
    description: String(form.get("description") ?? "").trim() || null,
    space_type_id: String(form.get("space_type_id") ?? "") || null,
    component_type_id: String(form.get("component_type_id") ?? "") || null,
    cost_item_id: String(form.get("cost_item_id") ?? "") || null,
    cost_category_id: String(form.get("cost_category_id") ?? "") || null,
    quality_tier: String(form.get("quality_tier") ?? "") || null,
    stage_key: String(form.get("stage_key") ?? "") || null,
    style_code: String(form.get("style_code") ?? "") || null,
    tags: cleanTags(form.get("tags")),
    visible_to_customer: form.get("visible_to_customer") !== "false",
    project_id: String(form.get("project_id") ?? "") || null,
    created_by: user.id,
  };

  const ids: string[] = [];
  for (const f of files) {
    // A title given on the batch names every entry (pictures of one cost
    // item are all "Shutter - Acrylic"); otherwise the file name does.
    const stem = String(form.get("title") ?? "").trim() || f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled";
    const { data: entry } = await supabase.from("library_entries").insert({ ...shared, title: stem }).select("id").single();
    if (!entry) continue;
    const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")) : "";
    const path = `${user.tenantId}/library/${entry.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const { error } = await admin.storage.from("documents").upload(path, f, { contentType: f.type, upsert: false });
    if (error) {
      await supabase.from("library_entries").delete().eq("id", entry.id);
      continue;
    }
    await supabase.from("library_entry_images").insert({ tenant_id: user.tenantId, entry_id: entry.id, storage_bucket: "documents", storage_path: path, file_type: f.type, file_size: f.size, display_order: 0 });
    ids.push(entry.id);
  }
  const { data: rows } = ids.length ? await supabase.from("library_entries").select(ENTRY_SELECT).in("id", ids) : { data: [] };
  return NextResponse.json({ success: true, data: await shapeEntries(rows ?? []), count: ids.length }, { status: 201 });
}
