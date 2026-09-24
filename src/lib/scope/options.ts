/**
 * The shape of a component's options - shared by the options route (what
 * the Scope Sheet draws), the component page and the scope-to-quotation
 * copy (what becomes a line), so none of them disagree about what a tap
 * means. The options themselves are `component_type_offers`: one row per
 * item a component type offers, with what it is priced per.
 *
 * **The offer says which of the three it is** (`ask_as`, set on the
 * component's page) and the shapes below are only the fallback for a row that
 * has not said. Inferring it from a per-piece unit and a missing priced-per
 * was invisible - nobody would guess that dropdown decided whether they were
 * asked "which" or "how many" - and it could not express a per-piece FAMILY,
 * which is how the four drawer grades came out as four steppers (2026-09-24).
 *
 * Every offered item is one of three things:
 *
 *   counted    priced per piece and not quantified by the rule (a tray, a
 *              pull-out): in or out, with a "× n" - a tray is not an answer
 *              to a question.
 *   exclusive  one of several answers to one decision - items in the same
 *              category priced per the same quantity (four carcass grades,
 *              all per front area). They share a `group_key`, and a component
 *              holds exactly one of them: choosing one replaces the last.
 *   auto       marked so on the offer (Shelf per shelves, Exposed Side
 *              Finish per exposed side area): it prices itself from the
 *              measurement and there is nothing to tap, and is skipped
 *              when its quantity is 0. Only right for a quantity that can
 *              be 0; an optional extra that follows the size is a tap.
 */

export const PER_PIECE_UNITS = new Set(["nos", "set", "kg", "ltr", "pcs"]);

export interface Offer {
  cost_item_id: string;
  quantity_key: string | null;
  /** Prices itself from the measurement with nothing to tap - set on the offer, never inferred. */
  auto?: boolean;
  /** How this is asked here: one_of | count | auto. Null falls back to the shapes below. */
  ask_as?: string | null;
}
export interface MenuItem {
  id: string;
  category_id: string | null;
  unit_code: string;
  /** The category's decision, where it shares one with another category. */
  decision?: string | null;
}
export interface OptionShape {
  quantity_key: string | null;
  counted: boolean;
  /** Shared by the answers to one decision; null for a counted item. */
  group_key: string | null;
  auto: boolean;
}

export function shapeOptions(lines: Offer[], items: MenuItem[]): Map<string, OptionShape> {
  const keyByItem = new Map<string, string | null>();
  const autoByItem = new Map<string, boolean>();
  const askByItem = new Map<string, string>();
  for (const l of lines) {
    if (!keyByItem.has(l.cost_item_id) || l.quantity_key) keyByItem.set(l.cost_item_id, l.quantity_key);
    if (l.auto) autoByItem.set(l.cost_item_id, true);
    if (l.ask_as === "one_of" || l.ask_as === "count" || l.ask_as === "auto") askByItem.set(l.cost_item_id, l.ask_as);
  }
  const shapes = new Map<string, OptionShape>();
  for (const it of items) {
    const key = keyByItem.get(it.id) ?? null;
    const said = askByItem.get(it.id);
    // Said wins; otherwise a per-piece thing with nothing to size it by is
    // something you count.
    const counted = said ? said === "count" : PER_PIECE_UNITS.has(String(it.unit_code).toLowerCase()) && !key;
    const group_key = counted ? null : it.decision ? `d:${it.decision}` : `${it.category_id ?? "other"}:${key ?? "face"}`;
    // Automatic needs something to be automatic FROM, so it still requires a
    // quantity: a row that says auto with nothing to follow would price at
    // nothing for ever, invisibly. And it is never inferred from being alone
    // in a group - the only lighting item on a wall unit is an optional extra,
    // not something every wall unit gets (that was inferred until 2026-09-22).
    const auto = !!key && !counted && (said ? said === "auto" : !!autoByItem.get(it.id));
    shapes.set(it.id, { quantity_key: key, counted, group_key, auto });
  }
  return shapes;
}
