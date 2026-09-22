import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { scopeDrift } from "@/lib/quotations/scope-drift";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/quotations/[id]/to-scope - "Add to the scope".
 *
 * The other direction, and the only writing it does: cost items priced on
 * this quotation that the room sheet does not list become first-preference
 * choices on the matching scope component. A quotation may be ahead of the
 * scope as easily as behind it - somebody adds a line in the builder - and
 * until now nothing said so, let alone offered to put it right.
 *
 * It only ever ADDS choices, mirroring the pull the other way: nothing on
 * the scope is changed or removed, and a line whose component has no scope
 * row of its own is left for a person, because there is nowhere to put it.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id } = await params;
  const supabase = await createClient();

  const { data: quotation } = await supabase.from("quotations").select("id, lead_id, project_id").eq("id", id).eq("tenant_id", user.tenantId).maybeSingle();
  if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

  const drift = await scopeDrift(supabase, user.tenantId, id, quotation.lead_id, quotation.project_id);
  const wanted = drift.not_in_scope.filter((l) => l.cost_item_id && l.scope_item_id);
  if (wanted.length === 0) {
    return NextResponse.json({ success: true, added: 0, message: "Everything priced here is already on the room sheet." });
  }

  const [{ data: items }, { data: parents }] = await Promise.all([
    supabase.from("quotation_cost_items").select("id, name").eq("tenant_id", user.tenantId).in("id", wanted.map((w) => w.cost_item_id as string)),
    supabase.from("property_scope_items").select("id, property_id").eq("tenant_id", user.tenantId).in("id", wanted.map((w) => w.scope_item_id as string)),
  ]);
  const itemById = new Map((items ?? []).map((i) => [i.id as string, i.name as string]));
  const parentById = new Map((parents ?? []).map((p) => [p.id as string, p.property_id as string]));

  const rows = wanted
    .filter((w) => itemById.has(w.cost_item_id!) && parentById.has(w.scope_item_id!))
    .map((w) => ({
      tenant_id: user.tenantId,
      property_id: parentById.get(w.scope_item_id!)!,
      parent_id: w.scope_item_id,
      cost_item_id: w.cost_item_id,
      choice_status: "p1" as const,
      name: itemById.get(w.cost_item_id!)!,
      display_order: 0,
      created_by: user.id,
    }));
  if (rows.length === 0) return NextResponse.json({ success: true, added: 0, message: "Nothing could be matched to a room on the sheet." });

  // The unique index on (parent, cost item) makes this safe to repeat.
  const { data: inserted, error } = await supabase.from("property_scope_items").upsert(rows, { onConflict: "parent_id,cost_item_id", ignoreDuplicates: true }).select("id");
  if (error) {
    console.error("[to-scope] insert failed", error.message);
    return NextResponse.json({ error: "Could not add these to the scope" }, { status: 500 });
  }
  const added = inserted?.length ?? 0;
  return NextResponse.json({
    success: true,
    added,
    message: added === 0 ? "Already on the room sheet." : `Added ${added} item${added === 1 ? "" : "s"} to the room sheet as first preferences.`,
  });
}
