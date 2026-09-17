/** GET /api/library/collections · POST { name, description?, lead_id? } */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

const SELECT = "id, name, description, lead_id, created_by, created_at, updated_at, lead:leads(id, lead_number, client:clients(name)), entries:library_collection_entries(entry_id)";

const shape = (c: any) => {
  const lead = Array.isArray(c.lead) ? c.lead[0] : c.lead;
  const client = lead ? (Array.isArray(lead.client) ? lead.client[0] : lead.client) : null;
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    lead_id: c.lead_id,
    lead: lead ? { id: lead.id, lead_number: lead.lead_number, client_name: client?.name ?? null } : null,
    entry_ids: (c.entries ?? []).map((e: any) => e.entry_id),
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
};

export async function GET(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const { data, error } = await supabase.from("library_collections").select(SELECT).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load collections" }, { status: 500 });
  return NextResponse.json({ success: true, data: (data ?? []).map(shape) });
}

export async function POST(request: NextRequest) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["library.create"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Give the collection a name" }, { status: 400 });
  const { data, error } = await supabase
    .from("library_collections")
    .insert({ tenant_id: guard.user.tenantId, name, description: String(body.description ?? "").trim() || null, lead_id: body.lead_id || null, created_by: guard.user.id })
    .select(SELECT)
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not create the collection" }, { status: 500 });
  return NextResponse.json({ success: true, data: shape(data) }, { status: 201 });
}
