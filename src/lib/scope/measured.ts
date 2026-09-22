import { hasCosting, mergeMeasures, readCosting, type ComponentCosting } from "@/lib/costing/component-costing";

/**
 * Which of a component's measurements are still blank.
 *
 * A component whose type has a costing rule needs that rule's fields, or
 * every line priced per a quantity comes out at zero - hinges with no
 * shutter count, a corner solution with no corner count. The first real
 * quotation had nine components with nothing typed and eight lines at
 * zero (2026-09-22), so this is read in three places: the Scope tab marks
 * the row, the room sheet marks the blanks, and the readiness gate refuses
 * Proposal discussion until they are filled.
 *
 * A length field is exempt when the row's own size covers it (width and
 * height are typed on the list), and a field with a default is never
 * blank - the default is what the seller would have typed.
 */
export interface MeasureRow {
  width?: number | null;
  height?: number | null;
  length?: number | null;
  measures?: Record<string, number> | null;
}

export function missingMeasures(row: MeasureRow, costing: ComponentCosting | null | undefined): string[] {
  if (!costing || !hasCosting(costing)) return [];
  const have = mergeMeasures(row);
  return costing.fields
    .filter((f) => {
      const v = have[f.key];
      if (v != null && Number(v) > 0) return false;
      // A count may legitimately be zero, but only when somebody said so:
      // a stored 0 is an answer, a missing key is not.
      return !(f.key in have);
    })
    .map((f) => f.label || f.key);
}

/** Every rule a tenant has, by component type id. */
export function rulesByType(types: { id: string; config_schema?: unknown }[]): Map<string, ComponentCosting> {
  return new Map(types.map((t) => [t.id, readCosting(t.config_schema)]));
}
