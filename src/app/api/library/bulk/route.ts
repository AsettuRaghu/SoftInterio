/**
 * Tag many entries at once. Only the fields sent are changed; tags are
 * added to what each entry has (remove_tags takes some away).
 *
 *   PATCH /api/library/bulk { ids[], kind?, space_type_id?, component_type_id?, cost_item_id?, cost_category_id?, quality_tier?, stage_key?, style_code?, project_id?, visible_to_customer?, add_tags?, remove_tags? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { ENTRY_SELECT, LIBRARY_KINDS, cleanTags, shapeEntries } from "@/lib/library/shape";

export async function PATCH(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Nothing selected" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("kind" in body) {
    if (!(LIBRARY_KINDS as readonly string[]).includes(body.kind)) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
    patch.kind = body.kind;
  }
  for (const f of ["space_type_id", "component_type_id", "cost_item_id", "cost_category_id", "quality_tier", "stage_key", "style_code", "project_id"] as const)
    if (f in body) patch[f] = body[f] || null;
  if ("visible_to_customer" in body) patch.visible_to_customer = body.visible_to_customer !== false;

  const add = cleanTags(body.add_tags);
  const remove = new Set(cleanTags(body.remove_tags));
  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString();
    const { error } = await supabase.from("library_entries").update(patch).in("id", ids);
    if (error) return NextResponse.json({ error: "Could not update the entries" }, { status: 500 });
  }
  if (add.length || remove.size) {
    const { data: rows } = await supabase.from("library_entries").select("id, tags").in("id", ids);
    for (const r of rows ?? []) {
      const next = [...new Set([...(r.tags ?? []).filter((t: string) => !remove.has(t)), ...add])];
      await supabase.from("library_entries").update({ tags: next, updated_at: new Date().toISOString() }).eq("id", r.id);
    }
  }
  const { data } = await supabase.from("library_entries").select(ENTRY_SELECT).in("id", ids);
  return NextResponse.json({ success: true, data: await shapeEntries(data ?? []) });
}
