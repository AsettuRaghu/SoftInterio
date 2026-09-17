/** PATCH /api/library/collections/:id { name?, description?, lead_id? } · DELETE */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in body) {
    const n = String(body.name ?? "").trim();
    if (!n) return NextResponse.json({ error: "A collection needs a name" }, { status: 400 });
    patch.name = n;
  }
  if ("description" in body) patch.description = String(body.description ?? "").trim() || null;
  if ("lead_id" in body) patch.lead_id = body.lead_id || null;
  const { error } = await supabase.from("library_collections").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save the collection" }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.delete"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("library_collections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete the collection" }, { status: 500 });
  return NextResponse.json({ success: true });
}
