/**
 * The shape of a component's options - shared by the options route (what
 * the room sheet draws) and the scope-to-quotation copy (what becomes a
 * line), so the two never disagree about what a tap means.
 *
 * Every cost item a component type's Options Menu lists is one of three
 * things:
 *
 *   counted    priced per piece and not quantified by the rule (a tray, a
 *              pull-out): in or out, with a "× n". No preference - a tray
 *              is not an answer to a question.
 *   exclusive  one of several answers to one decision - items in the same
 *              category priced per the same quantity (four carcass grades,
 *              all per front area). They share a `group_key`; a component
 *              holds one ① and at most one ② among them.
 *   auto       the only item that follows a rule quantity (Shelf per
 *              shelves, Exposed Side Finish per exposed side area): a
 *              decision with one answer is not a decision, so it prices
 *              itself from the measurement and there is nothing to tap.
 *              It is skipped when its quantity is 0.
 */

export const PER_PIECE_UNITS = new Set(["nos", "set", "kg", "ltr", "pcs"]);

export interface MenuLine {
  cost_item_id: string;
  quantity_key: string | null;
}
export interface MenuItem {
  id: string;
  category_id: string | null;
  unit_code: string;
}
export interface OptionShape {
  quantity_key: string | null;
  counted: boolean;
  /** Shared by the alternatives of one decision; null for a counted item. */
  group_key: string | null;
  auto: boolean;
}

export function shapeOptions(lines: MenuLine[], items: MenuItem[]): Map<string, OptionShape> {
  const keyByItem = new Map<string, string | null>();
  for (const l of lines) if (!keyByItem.has(l.cost_item_id) || l.quantity_key) keyByItem.set(l.cost_item_id, l.quantity_key);
  const shapes = new Map<string, OptionShape>();
  const groupSize = new Map<string, number>();
  for (const it of items) {
    const key = keyByItem.get(it.id) ?? null;
    const counted = PER_PIECE_UNITS.has(String(it.unit_code).toLowerCase()) && !key;
    const group_key = counted ? null : `${it.category_id ?? "other"}:${key ?? "face"}`;
    shapes.set(it.id, { quantity_key: key, counted, group_key, auto: false });
    if (group_key) groupSize.set(group_key, (groupSize.get(group_key) ?? 0) + 1);
  }
  for (const s of shapes.values()) {
    s.auto = !!s.quantity_key && !!s.group_key && groupSize.get(s.group_key) === 1;
  }
  return shapes;
}

/** The lines that define a type's options: its flagged menu(s), else every active template naming it. */
export function menuOf<T extends { template: { is_active?: boolean; is_options_menu?: boolean } | null }>(rows: T[]): T[] {
  const active = rows.filter((r) => r.template?.is_active !== false);
  const menu = active.filter((r) => r.template?.is_options_menu);
  return menu.length ? menu : active;
}
