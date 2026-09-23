import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { shapeOptions } from "@/lib/scope/options";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

/**
 * What a component can carry, and what has been picked.
 *
 * The options are `component_type_offers` for this component type - what
 * the business says a wardrobe can carry, edited on the component's page
 * under Settings → Catalogue - grouped by cost category. An item picked
 * here that the type no longer offers still shows, under its category.
 *
 * What each item IS - counted, one of several alternatives, or automatic
 * - is decided in `lib/scope/options` (shared with the quotation copy);
 * `trg_scope_choice_alternatives` keeps one ① and one ② per group on every
 * write, and the sheet mirrors that rule locally so nothing repaints.
 *
 * GET  -> { groups: [{ category, items: [{ cost_item_id, name, tier, counted, group_key, quantity, status, row_id, scope_owner }] }], from_templates }
 *
 * `quantity` on a COUNTED item is how many; on one of several alternatives
 * it is a SHARE - how many of the component's doors take this finish - and
 * several first preferences may then stand together (two glass, four
 * leather), each taking its fraction of the quantity in the quotation.
 * PUT  { cost_item_id, status: "p1" | "p2" | null, scope_owner?, quantity? }
 *      quantity: how many, for an item priced per piece (two wooden drawers)
 *      p1 = first preference (what a quotation starts from), p2 = second;
 *      null removes the row. scope_owner (us / client / vendor / excluded)
 *      is who does that item - used on the project, kept for the sale.
 *      Prices never come through here; the tier is a word.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.view"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { id, itemId } = await params;
  const supabase = await createClient();

  const { data: component } = await supabase
    .from("property_scope_items")
    .select("id, component_type_id")
    .eq("id", itemId)
    .eq("property_id", id)
    .maybeSingle();
  if (!component?.component_type_id) return NextResponse.json({ error: "Not a component" }, { status: 400 });

  const [templated, { data: picked }] = await Promise.all([
    offersOf(supabase, component.component_type_id),
    supabase.from("property_scope_items").select("id, cost_item_id, choice_status, scope_owner, choice_quantity").eq("parent_id", itemId).not("cost_item_id", "is", null),
  ]);
  const templateIds = new Set(templated.lines.map((l) => l.cost_item_id));
  const pickedByItem = new Map((picked ?? []).map((p) => [p.cost_item_id as string, p]));
  const ids = [...new Set([...templateIds, ...pickedByItem.keys()])];
  if (ids.length === 0) return NextResponse.json({ data: { groups: [], from_templates: false } });

  const { data: costItems } = await supabase
    .from("quotation_cost_items")
    .select("id, name, category_id, quality_tier, unit_code, display_order, category:quotation_cost_item_categories(id, name, display_order, question, decision)")
    .in("id", ids)
    .eq("is_active", true)
    .order("display_order")
    .order("name");

  // Shapes are worked out over the OFFERED items only - an item picked from
  // outside the offer is shown, but it neither joins a group nor prices itself.
  const shapes = shapeOptions(
    templated.lines,
    (costItems ?? []).filter((c) => templateIds.has(c.id)).map((c) => ({
      id: c.id as string,
      category_id: (c.category_id as string | null) ?? null,
      unit_code: c.unit_code as string,
      decision: (c.category as unknown as { decision?: string | null } | null)?.decision ?? null,
    })),
  );
  const groups = new Map<string, { category: { id: string; name: string; order: number; question: string | null; decision: string | null }; items: { cost_item_id: string; name: string; tier: string | null; unit_code: string; counted: boolean; group_key: string | null; quantity_key: string | null; auto: boolean; quantity: number | null; status: string | null; row_id: string | null; scope_owner: string | null }[] }>();
  for (const c of costItems ?? []) {
    const cat = (c.category as unknown as { id: string; name: string; display_order: number | null; question: string | null; decision: string | null } | null) ?? { id: "other", name: "Other", display_order: 999, question: null, decision: null };
    const g = groups.get(cat.id) ?? { category: { id: cat.id, name: cat.name, order: cat.display_order ?? 999, question: cat.question ?? null, decision: cat.decision ?? null }, items: [] };
    const p = pickedByItem.get(c.id);
    const shape = shapes.get(c.id) ?? { quantity_key: null, counted: PER_PIECE.has(String(c.unit_code).toLowerCase()), group_key: null, auto: false };
    g.items.push({
      cost_item_id: c.id, name: c.name, tier: (c.quality_tier as string | null) ?? null, unit_code: c.unit_code as string,
      counted: shape.counted, group_key: shape.group_key, quantity_key: shape.quantity_key, auto: shape.auto,
      quantity: p?.choice_quantity != null ? Number(p.choice_quantity) : null,
      status: p?.choice_status ?? null, row_id: p?.id ?? null, scope_owner: p?.scope_owner ?? null,
    });
    groups.set(cat.id, g);
  }
  // Two categories with the same decision are one question: the doors take
  // handles or a profile, and that is one thing to decide (2026-09-23).
  const merged = new Map<string, ReturnType<typeof groups.get>>();
  for (const g of [...groups.values()].sort((a, b) => a.category.order - b.category.order || a.category.name.localeCompare(b.category.name))) {
    const key = g!.category.decision ? `d:${g!.category.decision}` : `c:${g!.category.id}`;
    const seen = merged.get(key);
    if (seen) seen!.items.push(...g!.items);
    else merged.set(key, g);
  }
  return NextResponse.json({
    data: {
      groups: [...merged.values()],
      from_templates: templateIds.size > 0,
    },
  });
}

const PER_PIECE = new Set(["nos", "set", "kg", "ltr", "pcs"]);

type Db = Awaited<ReturnType<typeof createClient>>;

/** What the type offers, and what each item is priced per. */
async function offersOf(supabase: Db, componentTypeId: string) {
  const { data } = await supabase.from("component_type_offers").select("cost_item_id, quantity_key, auto").eq("component_type_id", componentTypeId).order("display_order");
  return { lines: (data ?? []).map((r) => ({ cost_item_id: r.cost_item_id as string, quantity_key: (r.quantity_key as string | null) ?? null, auto: !!r.auto })) };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id, itemId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const status = body.status === "p1" || body.status === "p2" ? body.status : null;
  const OWNERS = new Set(["us", "client", "vendor", "excluded"]);
  const owner = typeof body.scope_owner === "string" && OWNERS.has(body.scope_owner) ? body.scope_owner : undefined;
  const quantity = body.quantity === null ? null : Number.isFinite(Number(body.quantity)) && Number(body.quantity) > 0 ? Math.round(Number(body.quantity) * 100) / 100 : undefined;
  if (!body.cost_item_id) return NextResponse.json({ error: "cost_item_id is required" }, { status: 400 });

  const { data: component } = await supabase
    .from("property_scope_items")
    .select("id, component_type_id, display_order")
    .eq("id", itemId)
    .eq("property_id", id)
    .maybeSingle();
  if (!component?.component_type_id) return NextResponse.json({ error: "Not a component" }, { status: 400 });

  const { data: existing } = await supabase
    .from("property_scope_items")
    .select("id")
    .eq("parent_id", itemId)
    .eq("cost_item_id", body.cost_item_id)
    .maybeSingle();

  if (!status) {
    if (existing) await supabase.from("property_scope_items").delete().eq("id", existing.id);
    return NextResponse.json({ data: { row_id: null, status: null } });
  }
  if (existing) {
    const { error } = await supabase
      .from("property_scope_items")
      .update({ choice_status: status, ...(owner ? { scope_owner: owner } : {}), ...(quantity !== undefined ? { choice_quantity: quantity } : {}) })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
    return NextResponse.json({ data: { row_id: existing.id, status } });
  }
  const { data: costItem } = await supabase.from("quotation_cost_items").select("id, name").eq("id", body.cost_item_id).eq("tenant_id", user.tenantId).maybeSingle();
  if (!costItem) return NextResponse.json({ error: "That item is not in the catalogue" }, { status: 400 });
  const { data: row, error } = await supabase
    .from("property_scope_items")
    .insert({
      tenant_id: user.tenantId,
      property_id: id,
      parent_id: itemId,
      cost_item_id: costItem.id,
      choice_status: status,
      ...(owner ? { scope_owner: owner } : {}),
      ...(quantity !== undefined ? { choice_quantity: quantity } : {}),
      name: costItem.name,
      display_order: 0,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    // Two taps a moment apart: the first insert landed after this request
    // looked. It is the same row - update it.
    const { data: again } = await supabase.from("property_scope_items").select("id").eq("parent_id", itemId).eq("cost_item_id", body.cost_item_id).maybeSingle();
    if (again) {
      await supabase.from("property_scope_items").update({ choice_status: status, ...(owner ? { scope_owner: owner } : {}), ...(quantity !== undefined ? { choice_quantity: quantity } : {}) }).eq("id", again.id);
      return NextResponse.json({ data: { row_id: again.id, status } });
    }
  }
  if (error || !row) {
    console.error("[scope options] insert failed", error?.message);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ data: { row_id: row.id, status } });
}
