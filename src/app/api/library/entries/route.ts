/**
 * The Design Library. See the migration 20260917130000 for the model.
 *
 *   GET  /api/library/entries          every entry, with signed image URLs
 *   POST /api/library/entries          multipart: fields + image files
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { ENTRY_SELECT, LIBRARY_KINDS, cleanTags, shapeEntries } from "@/lib/library/shape";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const { data, error } = await supabase.from("library_entries").select(ENTRY_SELECT).order("created_at", { ascending: false });
  if (error) {
    console.error("[library] list failed", error);
    return NextResponse.json({ error: "Could not load the library" }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: await shapeEntries(data ?? []) });
}

export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.create"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const supabase = await createClient();
  const admin = createAdminClient();
  const form = await request.formData();

  const title = String(form.get("title") ?? "").trim();
  const kind = String(form.get("kind") ?? "inspiration");
  if (!title) return NextResponse.json({ error: "Give the entry a title" }, { status: 400 });
  if (!(LIBRARY_KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "Add at least one image" }, { status: 400 });
  for (const f of files) {
    if (!f.type.startsWith("image/")) return NextResponse.json({ error: `${f.name} is not an image` }, { status: 400 });
    if (f.size > MAX_FILE_SIZE) return NextResponse.json({ error: `${f.name} is over 20MB` }, { status: 400 });
  }

  const { data: entry, error } = await supabase
    .from("library_entries")
    .insert({
      tenant_id: user.tenantId,
      kind,
      title,
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
      partner_id: String(form.get("partner_id") ?? "") || null,
      source_url: String(form.get("source_url") ?? "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !entry) {
    console.error("[library] create failed", error);
    return NextResponse.json({ error: "Could not create the entry" }, { status: 500 });
  }

  let order = 0;
  for (const f of files) {
    const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")) : "";
    const path = `${user.tenantId}/library/${entry.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const { error: upErr } = await admin.storage.from("documents").upload(path, f, { contentType: f.type, upsert: false });
    if (upErr) {
      console.error("[library] upload failed", upErr);
      continue;
    }
    await supabase.from("library_entry_images").insert({
      tenant_id: user.tenantId,
      entry_id: entry.id,
      storage_bucket: "documents",
      storage_path: path,
      file_type: f.type,
      file_size: f.size,
      display_order: order++,
    });
  }

  const { data: row } = await supabase.from("library_entries").select(ENTRY_SELECT).eq("id", entry.id).single();
  const [shaped] = await shapeEntries(row ? [row] : []);
  return NextResponse.json({ success: true, data: shaped }, { status: 201 });
}
