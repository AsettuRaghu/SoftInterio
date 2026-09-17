/** POST /api/library/collections/:id/entries { entry_id } · DELETE ?entry_id= */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const entryId = String(body.entry_id ?? "");
  if (!entryId) return NextResponse.json({ error: "entry_id is required" }, { status: 400 });
  const { error } = await supabase.from("library_collection_entries").upsert({ collection_id: id, entry_id: entryId }, { onConflict: "collection_id,entry_id" });
  if (error) return NextResponse.json({ error: "Could not add to the collection" }, { status: 500 });
  await supabase.from("library_collections").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const entryId = request.nextUrl.searchParams.get("entry_id") || "";
  if (!entryId) return NextResponse.json({ error: "entry_id is required" }, { status: 400 });
  await supabase.from("library_collection_entries").delete().eq("collection_id", id).eq("entry_id", entryId);
  return NextResponse.json({ success: true });
}
