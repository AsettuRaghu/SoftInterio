/**
 * The two reads a blanket needs, in one place: the scope's own rows, and what
 * the component types in it offer. Shared by the grade and the package so
 * they see the same catalogue and cannot disagree about what a component can
 * carry.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Offer } from "./options";
import type { GradedItem } from "./grade";

export async function scopeRowsOf(supabase: SupabaseClient, propertyId: string) {
  const { data } = await supabase
    .from("property_scope_items")
    .select("id, parent_id, component_type_id, cost_item_id, choice_status, scope_owner")
    .eq("property_id", propertyId);
  return (data ?? []) as {
    id: string; parent_id: string | null; component_type_id: string | null;
    cost_item_id: string | null; choice_status: string | null; scope_owner: string | null;
  }[];
}

export async function loadOfferMenu(supabase: SupabaseClient, componentTypeIds: string[]) {
  const types = [...new Set(componentTypeIds.filter(Boolean))];
  const empty = { offersByType: new Map<string, Offer[]>(), items: new Map<string, GradedItem>(), names: new Map<string, string>() };
  if (types.length === 0) return empty;

  const { data: offers } = await supabase
    .from("component_type_offers")
    .select("component_type_id, cost_item_id, quantity_key, auto")
    .in("component_type_id", types);
  if (!offers?.length) return empty;

  const { data: rows } = await supabase
    .from("quotation_cost_items")
    .select("id, name, category_id, unit_code, quality_tier, is_active, category:quotation_cost_item_categories(decision)")
    .in("id", [...new Set(offers.map((o) => o.cost_item_id as string))]);

  // An item that has left the catalogue offers nothing, so it must not leave
  // a question standing that no blanket can ever fill.
  const items = new Map<string, GradedItem>();
  const names = new Map<string, string>();
  for (const i of rows ?? []) {
    if (i.is_active === false) continue;
    items.set(i.id as string, {
      id: i.id as string,
      category_id: (i.category_id as string | null) ?? null,
      unit_code: i.unit_code as string,
      quality_tier: (i.quality_tier as string | null) ?? null,
      decision: (i.category as unknown as { decision?: string | null } | null)?.decision ?? null,
    });
    names.set(i.id as string, i.name as string);
  }

  const offersByType = new Map<string, Offer[]>();
  for (const o of offers) {
    if (!items.has(o.cost_item_id as string)) continue;
    const k = o.component_type_id as string;
    offersByType.set(k, [...(offersByType.get(k) ?? []), {
      cost_item_id: o.cost_item_id as string,
      quantity_key: (o.quantity_key as string | null) ?? null,
      auto: !!o.auto,
    }]);
  }
  return { offersByType, items, names };
}
