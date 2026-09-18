import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

/**
 * What a component can carry, and what has been picked.
 *
 * The options are the cost items the business's quotation templates list
 * for this component type - the catalogue's own answer to "what goes in a
 * wardrobe", grouped by cost category. Nothing new to configure: a tenant
 * that wants different options edits the template it already keeps. An item
 * picked here that no template lists (added in the builder, say) still
 * shows, under its category.
 *
 * GET  -> { groups: [{ category, items: [{ cost_item_id, name, tier, status, row_id, scope_owner }] }], from_templates }
 * PUT  { cost_item_id, status: "p1" | "p2" | null, scope_owner? }
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

  const [{ data: templated }, { data: picked }] = await Promise.all([
    supabase
      .from("quotation_template_line_items")
      .select("cost_item_id, template:quotation_templates!inner(is_active)")
      .eq("component_type_id", component.component_type_id)
      .not("cost_item_id", "is", null),
    supabase.from("property_scope_items").select("id, cost_item_id, choice_status, scope_owner").eq("parent_id", itemId).not("cost_item_id", "is", null),
  ]);

  const templateIds = new Set(
    (templated ?? [])
      .filter((t) => (t.template as unknown as { is_active?: boolean } | null)?.is_active !== false)
      .map((t) => t.cost_item_id as string),
  );
  const pickedByItem = new Map((picked ?? []).map((p) => [p.cost_item_id as string, p]));
  const ids = [...new Set([...templateIds, ...pickedByItem.keys()])];
  if (ids.length === 0) return NextResponse.json({ data: { groups: [], from_templates: false } });

  const { data: costItems } = await supabase
    .from("quotation_cost_items")
    .select("id, name, category_id, quality_tier, display_order, category:quotation_cost_item_categories(id, name, display_order)")
    .in("id", ids)
    .eq("is_active", true)
    .order("display_order")
    .order("name");

  const groups = new Map<string, { category: { id: string; name: string; order: number }; items: { cost_item_id: string; name: string; tier: string | null; status: string | null; row_id: string | null; scope_owner: string | null }[] }>();
  for (const c of costItems ?? []) {
    const cat = (c.category as unknown as { id: string; name: string; display_order: number | null } | null) ?? { id: "other", name: "Other", display_order: 999 };
    const g = groups.get(cat.id) ?? { category: { id: cat.id, name: cat.name, order: cat.display_order ?? 999 }, items: [] };
    const p = pickedByItem.get(c.id);
    g.items.push({ cost_item_id: c.id, name: c.name, tier: (c.quality_tier as string | null) ?? null, status: p?.choice_status ?? null, row_id: p?.id ?? null, scope_owner: p?.scope_owner ?? null });
    groups.set(cat.id, g);
  }
  return NextResponse.json({
    data: {
      groups: [...groups.values()].sort((a, b) => a.category.order - b.category.order || a.category.name.localeCompare(b.category.name)),
      from_templates: templateIds.size > 0,
    },
  });
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
      .update({ choice_status: status, ...(owner ? { scope_owner: owner } : {}) })
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
      name: costItem.name,
      display_order: 0,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("[scope options] insert failed", error?.message);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ data: { row_id: row.id, status } });
}
