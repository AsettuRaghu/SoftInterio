/**
 * How many questions each component of a property still has to be asked.
 *
 * One read for the whole property, shared by the Scope list (the amber
 * "2 to ask" on a row), the room sheet's header and `scopeReadiness` - so
 * the number on the row, the number in the sheet and the reason the stage
 * is refused can never disagree.
 *
 * The rules are `lib/scope/questions`; this only gathers what they need:
 * what each component type offers, what those items are, what has been
 * picked, and what has been declined.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { questionsOf, stillToAsk } from "./questions";
import type { Offer, MenuItem } from "./options";

export interface ComponentQuestions {
  /** Questions with neither an answer nor a recorded "not needed". */
  unanswered: number;
  total: number;
}

export async function unaskedByComponent(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<Map<string, ComponentQuestions>> {
  const out = new Map<string, ComponentQuestions>();

  const { data: rows } = await supabase
    .from("property_scope_items")
    .select("id, parent_id, component_type_id, cost_item_id, choice_status, scope_owner, declined_decisions")
    .eq("property_id", propertyId);
  const all = rows ?? [];
  const components = all.filter((r) => r.component_type_id);
  if (components.length === 0) return out;

  const typeIds = [...new Set(components.map((c) => c.component_type_id as string))];
  const { data: offers } = await supabase
    .from("component_type_offers")
    .select("component_type_id, cost_item_id, quantity_key, auto, ask_as")
    .in("component_type_id", typeIds);
  if (!offers?.length) return out;

  const { data: items } = await supabase
    .from("quotation_cost_items")
    .select("id, category_id, unit_code, is_active, category:quotation_cost_item_categories(decision)")
    .in("id", [...new Set(offers.map((o) => o.cost_item_id as string))]);

  // An item that has left the catalogue offers nothing to answer, so it
  // must not leave a question standing that can never be cleared.
  const menu = new Map<string, MenuItem>();
  for (const i of items ?? []) {
    if (i.is_active === false) continue;
    menu.set(i.id as string, {
      id: i.id as string,
      category_id: (i.category_id as string | null) ?? null,
      unit_code: i.unit_code as string,
      decision: (i.category as unknown as { decision?: string | null } | null)?.decision ?? null,
    });
  }

  const offersByType = new Map<string, Offer[]>();
  for (const o of offers) {
    if (!menu.has(o.cost_item_id as string)) continue;
    const t = o.component_type_id as string;
    offersByType.set(t, [...(offersByType.get(t) ?? []), { cost_item_id: o.cost_item_id as string, quantity_key: (o.quantity_key as string | null) ?? null, auto: !!o.auto, ask_as: (o.ask_as as string | null) ?? null }]);
  }

  // Only a FIRST preference answers a question. A ② is the alternative and
  // becomes a line only on Option 2, so a question holding nothing but a ②
  // produces no line on the quotation being built - and read as answered it
  // was invisible: a TV unit came out with one line of four while the sheet
  // said nothing was left to ask (2026-09-24, found on LD-202609-005).
  const pickedByParent = new Map<string, string[]>();
  for (const r of all) {
    if (!r.cost_item_id || r.choice_status !== "p1" || !r.parent_id) continue;
    pickedByParent.set(r.parent_id as string, [...(pickedByParent.get(r.parent_id as string) ?? []), r.cost_item_id as string]);
  }

  for (const c of components) {
    const lines = offersByType.get(c.component_type_id as string) ?? [];
    if (lines.length === 0) continue;
    const qs = questionsOf(
      lines,
      lines.map((l) => menu.get(l.cost_item_id)!).filter(Boolean),
      pickedByParent.get(c.id as string) ?? [],
      (c.declined_decisions as string[] | null) ?? [],
    );
    out.set(c.id as string, { unanswered: stillToAsk(qs), total: qs.length });
  }
  return out;
}

/** Only ours: a room the client or a vendor is doing is not ours to ask about. */
export const isOurs = (owner: string | null | undefined) => !owner || owner === "us";
