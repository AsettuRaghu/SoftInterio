/** GET /api/library/styles · POST { label } (library.edit) - shipped styles plus this business's own. */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const { data } = await supabase.from("library_styles").select("code, label, tenant_id").eq("is_active", true).order("display_order").order("label");
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const label = String(body.label ?? "").trim();
  if (!label) return NextResponse.json({ error: "Give the style a name" }, { status: 400 });
  const code = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const { data, error } = await supabase.from("library_styles").insert({ tenant_id: guard.user.tenantId, code, label, display_order: 500 }).select("code, label").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That style already exists" : "Could not add the style" }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
