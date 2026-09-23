/**
 * What a component still has to be asked.
 *
 * The room sheet is a questionnaire, so "we asked and they said no" and
 * "nobody has asked yet" are different answers - and until 2026-09-23 they
 * were the same blank. "Not needed" and "No" merely cleared the picks, so
 * a wardrobe nobody had discussed looked exactly like one whose customer
 * wanted no lighting, and the quotation quietly came out short a line.
 *
 * A DECLINE IS NOW STORED, on the component row
 * (`property_scope_items.declined_decisions`, an array of question keys),
 * which is why a question can be answered with nothing picked.
 *
 * A question is a group of options that are neither counted nor automatic
 * - the same grouping the sheet draws, keyed by `group_key ?? cost_item_id`
 * so two categories sharing a decision ("How do the doors open?") are one
 * question. Counted items are an "Add:" row, not a question; automatic ones
 * state themselves. The one exception is a category holding a single
 * counted item and nothing else - the sheet draws that as "Sensor light?
 * No · Yes", so it is a question too.
 *
 * Answered means something in the group is picked, or the key is declined.
 */

import { shapeOptions, type Offer, type MenuItem } from "./options";

export interface QuestionState {
  /** `group_key ?? cost_item_id` - what a decline is recorded against. */
  key: string;
  costItemIds: string[];
  answered: boolean;
}

export function questionsOf(
  offers: Offer[],
  items: MenuItem[],
  picked: Iterable<string>,
  declined: Iterable<string> = [],
): QuestionState[] {
  const shapes = shapeOptions(offers, items);
  const chosen = new Set(picked);
  const no = new Set(declined);

  const groups = new Map<string, string[]>();
  const byCategory = new Map<string, { counted: string[]; other: number }>();

  for (const it of items) {
    const s = shapes.get(it.id);
    if (!s) continue;
    const cat = it.category_id ?? "other";
    const c = byCategory.get(cat) ?? { counted: [], other: 0 };
    if (s.auto) c.other++;
    else if (s.counted) c.counted.push(it.id);
    else {
      c.other++;
      const key = s.group_key ?? it.id;
      groups.set(key, [...(groups.get(key) ?? []), it.id]);
    }
    byCategory.set(cat, c);
  }

  // "Sensor light? No · Yes" - a category with one counted thing and
  // nothing else is drawn as a question, so it is one.
  for (const [, c] of byCategory) {
    if (c.other === 0 && c.counted.length === 1) groups.set(c.counted[0], [c.counted[0]]);
  }

  return [...groups.entries()].map(([key, costItemIds]) => ({
    key,
    costItemIds,
    answered: no.has(key) || costItemIds.some((id) => chosen.has(id)),
  }));
}

/** How many of a component's questions are still to ask. */
export function stillToAsk(questions: QuestionState[]): number {
  return questions.filter((q) => !q.answered).length;
}
