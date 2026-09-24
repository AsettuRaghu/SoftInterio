/**
 * Answering a component's graded questions in one go.
 *
 * A business sells in grades - budget, standard, premium, luxury - and a
 * seller wants to say "make this whole home Standard" and then argue about
 * the handful of things the customer actually cares about. The tiers are
 * already on the cost items (`quality_tier`), so this needs no configuration
 * at all: for every question whose answers are a graded family, the answer
 * at that grade becomes the answer.
 *
 * **It cannot answer everything, and says so.** A wardrobe's shutter finish
 * is laminate or acrylic or veneer - chosen by kind, not by grade - and it
 * is the most expensive line on the component. `ungraded` carries those
 * groups back so the screen can report what is still to ask rather than
 * leaving the seller thinking the room is done (2026-09-23).
 *
 * The same shape serves a configured package later: a package names the item
 * per question instead of deriving it from the tier, and the rest - what is
 * written, what is skipped, what is left - is identical.
 */

import { shapeOptions, type Offer, type MenuItem } from "./options";

export interface GradedItem extends MenuItem {
  quality_tier?: string | null;
}

export interface GradePlan {
  /** Cost items to choose, one per graded question. */
  pick: { group_key: string; cost_item_id: string }[];
  /** Questions no grade can answer - chosen by kind, not by grade. */
  ungraded: string[];
}

export function gradeChoices(lines: Offer[], items: GradedItem[], tier: string): GradePlan {
  const shapes = shapeOptions(lines, items);
  const byGroup = new Map<string, GradedItem[]>();
  for (const it of items) {
    const s = shapes.get(it.id);
    if (!s || s.counted || s.auto || !s.group_key) continue;
    byGroup.set(s.group_key, [...(byGroup.get(s.group_key) ?? []), it]);
  }

  const pick: GradePlan["pick"] = [];
  const ungraded: string[] = [];
  const want = tier.trim().toLowerCase();
  for (const [group_key, group] of byGroup) {
    // A single-answer question is a yes/no, not a grade to be set - pressing
    // "make it Standard" must not silently add the lighting nobody asked for.
    if (group.length < 2) continue;
    const graded = new Set(group.map((i) => (i.quality_tier ?? "").toLowerCase()).filter(Boolean));
    if (graded.size < 2) {
      ungraded.push(group_key);
      continue;
    }
    const match = group.find((i) => (i.quality_tier ?? "").toLowerCase() === want);
    if (match) pick.push({ group_key, cost_item_id: match.id });
    else ungraded.push(group_key);
  }
  return { pick, ungraded };
}
