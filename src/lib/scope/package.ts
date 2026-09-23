/**
 * Turning a package into a plan per component.
 *
 * A package row says "in a Wardrobe - Openable, choose Carcass - Standard"
 * or "…and two Tandem Box Drawers". This works out, for each component in
 * range, which of those are answers to questions and which are accessories -
 * by asking the offer, not the package, because that is where the shape of
 * an option lives. A package entry the component type no longer offers is
 * dropped rather than written: a menu is pruned more often than a package is
 * revisited.
 *
 * It also reports what the package does NOT answer, so a gap in a package
 * reads the same way as a question a grade cannot reach - the seller is told
 * either way.
 */

import { shapeOptions, type Offer } from "./options";
import type { GradedItem } from "./grade";
import type { ComponentPlan } from "./apply-choices";

export function packagePlans(args: {
  components: { id: string; component_type_id: string }[];
  entries: { component_type_id: string; cost_item_id: string; quantity: number | null }[];
  offersByType: Map<string, Offer[]>;
  items: Map<string, GradedItem>;
}): ComponentPlan[] {
  const byType = new Map<string, typeof args.entries>();
  for (const e of args.entries) byType.set(e.component_type_id, [...(byType.get(e.component_type_id) ?? []), e]);

  const plans: ComponentPlan[] = [];
  for (const c of args.components) {
    const lines = args.offersByType.get(c.component_type_id) ?? [];
    const said = byType.get(c.component_type_id) ?? [];
    if (lines.length === 0 || said.length === 0) continue;

    const list = lines.map((l) => args.items.get(l.cost_item_id)!).filter(Boolean);
    const shapes = shapeOptions(lines, list);

    const pick: ComponentPlan["pick"] = [];
    const counted: ComponentPlan["counted"] = [];
    const answers = new Set<string>();
    for (const e of said) {
      const shape = shapes.get(e.cost_item_id);
      if (!shape) continue; // no longer offered here
      if (shape.auto) continue; // prices itself; nothing to choose
      if (shape.counted) counted.push({ cost_item_id: e.cost_item_id, quantity: Math.max(1, Math.round(Number(e.quantity) || 1)) });
      else if (shape.group_key) { pick.push({ group_key: shape.group_key, cost_item_id: e.cost_item_id }); answers.add(shape.group_key); }
    }

    // Every question this component asks that the package is silent about.
    const unanswered: string[] = [];
    const groups = new Map<string, number>();
    for (const it of list) {
      const s = shapes.get(it.id);
      if (!s || s.counted || s.auto || !s.group_key) continue;
      groups.set(s.group_key, (groups.get(s.group_key) ?? 0) + 1);
    }
    for (const [g] of groups) if (!answers.has(g)) unanswered.push(g);

    if (pick.length || counted.length) plans.push({ componentId: c.id, pick, counted, unanswered });
  }
  return plans;
}
