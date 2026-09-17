/** POST /api/library/entries/:id/images  multipart "images" - add pictures to an entry. */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { ENTRY_SELECT, shapeEntries } from "@/lib/library/shape";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: entry } = await supabase.from("library_entries").select("id").eq("id", id).maybeSingle();
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  const form = await request.formData();
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0 && f.type.startsWith("image/"));
  if (files.length === 0) return NextResponse.json({ error: "Add at least one image" }, { status: 400 });
  const { data: last } = await supabase.from("library_entry_images").select("display_order").eq("entry_id", id).order("display_order", { ascending: false }).limit(1).maybeSingle();
  let order = (last?.display_order ?? -1) + 1;
  for (const f of files) {
    const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")) : "";
    const path = `${guard.user.tenantId}/library/${id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const { error } = await admin.storage.from("documents").upload(path, f, { contentType: f.type, upsert: false });
    if (error) continue;
    await supabase.from("library_entry_images").insert({
      tenant_id: guard.user.tenantId, entry_id: id, storage_bucket: "documents", storage_path: path, file_type: f.type, file_size: f.size, display_order: order++,
    });
  }
  const { data } = await supabase.from("library_entries").select(ENTRY_SELECT).eq("id", id).single();
  const [shaped] = await shapeEntries(data ? [data] : []);
  return NextResponse.json({ success: true, data: shaped });
}
