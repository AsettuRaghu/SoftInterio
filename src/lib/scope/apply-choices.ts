/**
 * Writing a set of answers onto a scope - the one path a blanket takes.
 *
 * A grade works out its answers from `quality_tier`; a package reads them
 * from `scope_package_items`. What happens next is identical, so it happens
 * here: which components are in range, what is already answered, what is
 * therefore written, and what could not be answered at all.
 *
 * Two rules the callers must not each re-implement:
 *
 *   * **only what is unanswered changes**, unless the caller asks to
 *     replace. A blanket is a starting point, not a correction, and that is
 *     what makes it safe to press twice - the same rule as
 *     `copyScopeToQuotation`, which only ever adds.
 *   * **what could not be answered is reported**, never swallowed. A grade
 *     cannot choose a shutter finish; a package with a gap in it cannot
 *     either. A seller who is not told walks away thinking the room is done.

 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ComponentPlan {
  componentId: string;
  /** One answer per question: the item to choose. */
  pick: { group_key: string; cost_item_id: string }[];
  /** Accessories given as standard, with how many. */
  counted: { cost_item_id: string; quantity: number }[];
  /** Questions this blanket has no answer for. */
  unanswered: string[];
}

export interface ApplyResult {
  components: number;
  answered: number;
  kept: number;
  unanswered: number;
}

export async function applyChoices(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    userId: string;
    propertyId: string;
    plans: ComponentPlan[];
    /** Every scope row on the property, so existing answers are known. */
    rows: { id: string; parent_id: string | null; cost_item_id: string | null; choice_status: string | null }[];
    names: Map<string, string>;
    replace?: boolean;
  },
): Promise<ApplyResult> {
  const picked = new Map<string, { id: string; cost_item_id: string; status: string | null }[]>();
  for (const r of args.rows) {
    if (!r.cost_item_id || !r.parent_id) continue;
    picked.set(r.parent_id, [...(picked.get(r.parent_id) ?? []), { id: r.id, cost_item_id: r.cost_item_id, status: r.choice_status }]);
  }

  let answered = 0;
  let kept = 0;
  const unanswered = new Set<string>();
  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; quantity: number | null }[] = [];

  for (const plan of args.plans) {
    const mine = picked.get(plan.componentId) ?? [];
    const groupOf = new Map(plan.pick.map((p) => [p.cost_item_id, p.group_key]));
    // A question counts as answered when any of the items this blanket would
    // put there already holds the place being written.
    const done = new Set(
      mine.filter((m) => m.status === "p1").map((m) => groupOf.get(m.cost_item_id)).filter(Boolean) as string[],
    );

    const wanted: { cost_item_id: string; quantity: number | null; group_key: string | null }[] = [
      ...plan.pick.map((p) => ({ cost_item_id: p.cost_item_id, quantity: null, group_key: p.group_key })),
      ...plan.counted.map((c) => ({ cost_item_id: c.cost_item_id, quantity: c.quantity, group_key: null as string | null })),
    ];

    for (const w of wanted) {
      const already = mine.find((m) => m.cost_item_id === w.cost_item_id);
      if (already?.status === "p1") { kept++; continue; }
      // An accessory somebody removed is not put back by a blanket; only a
      // question nobody has answered is filled.
      if (!args.replace && w.group_key && done.has(w.group_key)) { kept++; continue; }
      answered++;
      if (already) updates.push({ id: already.id, quantity: w.quantity });
      else
        inserts.push({
          tenant_id: args.tenantId,
          property_id: args.propertyId,
          parent_id: plan.componentId,
          cost_item_id: w.cost_item_id,
          choice_status: "p1",
          ...(w.quantity != null ? { choice_quantity: w.quantity } : {}),
          name: args.names.get(w.cost_item_id) ?? "Item",
          display_order: 0,
          created_by: args.userId,
        });
    }
    for (const u of plan.unanswered) unanswered.add(u);
  }

  for (const u of updates) {
    const { error } = await supabase
      .from("property_scope_items")
      .update({ choice_status: "p1", ...(u.quantity != null ? { choice_quantity: u.quantity } : {}) })
      .eq("id", u.id);
    if (error) throw new Error("Could not apply that");
  }
  if (inserts.length) {
    // The one-answer-per-question trigger sorts the rest out: a new choice
    // removes whatever else answered that question.
    const { error } = await supabase.from("property_scope_items").insert(inserts);
    if (error) throw new Error("Could not apply that");
  }

  return { components: args.plans.length, answered, kept, unanswered: unanswered.size };
}

/** The components a blanket covers: a component, a room's components, or all of ours. */
export function componentsInRange(
  rows: { id: string; parent_id: string | null; component_type_id: string | null; scope_owner: string | null }[],
  target: string | null,
) {
  const ours = (o: string | null) => !o || o === "us";
  return rows.filter((r) => {
    if (!r.component_type_id || !ours(r.scope_owner)) return false;
    if (!target) return true;
    return r.id === target || r.parent_id === target;
  });
}
