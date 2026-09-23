import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { gradeChoices, type GradedItem } from "@/lib/scope/grade";
import type { Offer } from "@/lib/scope/options";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * "Make this Standard" - answers every graded question on a component, a
 * room, or the whole scope in one press.
 *
 * POST { tier, scope_item_id?, replace? }
 *   tier          basic | standard | premium | luxury, or any word the
 *                 tenant's own ladder uses - `quality_tier` is text, and a
 *                 business defines what it sells.
 *   scope_item_id a component (just it), a space (its components), or
 *                 absent (every component of ours on the property).
 *   replace       false by default: an answer somebody has already given is
 *                 left alone, because a blanket is a starting point and not
 *                 a correction. The same rule as `copyScopeToQuotation`,
 *                 which only ever adds - it is what makes this safe to press
 *                 twice.
 *
 * -> { components, answered, kept, unanswered } so the screen can say what
 *    is still to ask: a grade cannot choose a shutter finish, and that is
 *    the most expensive line on a wardrobe.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id: propertyId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const tier = String(body.tier ?? "").trim();
  if (!tier) return NextResponse.json({ error: "Which grade?" }, { status: 400 });
  const replace = body.replace === true;

  const { data: rows } = await supabase
    .from("property_scope_items")
    .select("id, parent_id, component_type_id, cost_item_id, choice_status, scope_owner")
    .eq("property_id", propertyId);
  const all = rows ?? [];
  if (all.length === 0) return NextResponse.json({ error: "Nothing in this scope yet" }, { status: 400 });

  const ours = (o: string | null) => !o || o === "us";
  const target = body.scope_item_id ? String(body.scope_item_id) : null;
  const components = all.filter((r) => {
    if (!r.component_type_id || !ours(r.scope_owner)) return false;
    if (!target) return true;
    return r.id === target || r.parent_id === target;
  });
  if (components.length === 0) return NextResponse.json({ error: "No components of ours to grade" }, { status: 400 });

  const typeIds = [...new Set(components.map((c) => c.component_type_id as string))];
  const { data: offers } = await supabase
    .from("component_type_offers")
    .select("component_type_id, cost_item_id, quantity_key, auto")
    .in("component_type_id", typeIds);
  if (!offers?.length) return NextResponse.json({ error: "These components offer nothing to choose" }, { status: 400 });

  const { data: items } = await supabase
    .from("quotation_cost_items")
    .select("id, name, category_id, unit_code, quality_tier, is_active, category:quotation_cost_item_categories(decision)")
    .in("id", [...new Set(offers.map((o) => o.cost_item_id as string))]);
  const menu = new Map<string, GradedItem & { name: string }>();
  for (const i of items ?? []) {
    if (i.is_active === false) continue;
    menu.set(i.id as string, {
      id: i.id as string,
      name: i.name as string,
      category_id: (i.category_id as string | null) ?? null,
      unit_code: i.unit_code as string,
      quality_tier: (i.quality_tier as string | null) ?? null,
      decision: (i.category as unknown as { decision?: string | null } | null)?.decision ?? null,
    });
  }

  const offersByType = new Map<string, Offer[]>();
  for (const o of offers) {
    if (!menu.has(o.cost_item_id as string)) continue;
    const k = o.component_type_id as string;
    offersByType.set(k, [...(offersByType.get(k) ?? []), { cost_item_id: o.cost_item_id as string, quantity_key: (o.quantity_key as string | null) ?? null, auto: !!o.auto }]);
  }

  // What each component already answers, by the group the answer belongs to.
  const pickedByParent = new Map<string, { cost_item_id: string; id: string; status: string | null }[]>();
  for (const r of all) {
    if (!r.cost_item_id || !r.parent_id) continue;
    pickedByParent.set(r.parent_id as string, [
      ...(pickedByParent.get(r.parent_id as string) ?? []),
      { cost_item_id: r.cost_item_id as string, id: r.id as string, status: (r.choice_status as string | null) ?? null },
    ]);
  }

  let answered = 0;
  let kept = 0;
  const unanswered = new Set<string>();
  const inserts: Record<string, unknown>[] = [];
  const updates: string[] = [];

  for (const c of components) {
    const lines = offersByType.get(c.component_type_id as string) ?? [];
    if (lines.length === 0) continue;
    const list = lines.map((l) => menu.get(l.cost_item_id)!).filter(Boolean);
    const plan = gradeChoices(lines, list, tier);

    // A group is answered when any of its items is a first preference.
    const shapesOf = new Map(plan.pick.map((p) => [p.cost_item_id, p.group_key]));
    const picked = pickedByParent.get(c.id as string) ?? [];
    const groupsAnswered = new Set<string>();
    for (const p of picked) {
      if (p.status !== "p1") continue;
      const g = shapesOf.get(p.cost_item_id);
      if (g) groupsAnswered.add(g);
    }

    for (const p of plan.pick) {
      const already = picked.find((x) => x.cost_item_id === p.cost_item_id);
      if (already?.status === "p1") { kept++; continue; }
      if (!replace && groupsAnswered.has(p.group_key)) { kept++; continue; }
      answered++;
      if (already) updates.push(already.id);
      else
        inserts.push({
          tenant_id: user.tenantId,
          property_id: propertyId,
          parent_id: c.id,
          cost_item_id: p.cost_item_id,
          choice_status: "p1",
          name: menu.get(p.cost_item_id)?.name ?? "Item",
          display_order: 0,
          created_by: user.id,
        });
    }
    for (const g of plan.ungraded) unanswered.add(g);
  }

  // The one-first-preference-per-question trigger sorts the rest out: a new
  // p1 moves whatever held that place to second, so applying a grade over an
  // existing answer keeps the old one as the alternative rather than losing it.
  if (updates.length) {
    const { error } = await supabase.from("property_scope_items").update({ choice_status: "p1" }).in("id", updates);
    if (error) return NextResponse.json({ error: "Could not apply the grade" }, { status: 500 });
  }
  if (inserts.length) {
    const { error } = await supabase.from("property_scope_items").insert(inserts);
    if (error) {
      console.error("[scope] apply-grade insert failed", error.message);
      return NextResponse.json({ error: "Could not apply the grade" }, { status: 500 });
    }
  }

  return NextResponse.json({
    data: { components: components.length, answered, kept, unanswered: unanswered.size },
  });
}
