import { evaluate, namesIn } from "./formula";

/**
 * A tenant's own rule for measuring and quantifying a component type -
 * stored on component_types.config_schema. The platform holds no rule of
 * its own: what is measured, what is derived, and what each cost line is
 * priced per are all the tenant's words.
 *
 *   fields      what you measure on this component ("run A", "base height",
 *               "blind corner", "drawer count") - a number each. A length is
 *               typed in the row's unit and is IN FEET inside formulas, so a
 *               formula multiplying two lengths gives square feet without
 *               anyone converting.
 *   quantities  what you cost against, each a formula over the fields (and
 *               over quantities defined above it): shutter_sqft, counter_rft,
 *               hinge_count… with the unit it comes out in.
 *
 * A template line then says which quantity it is priced per, and a chosen
 * item quantifies itself the moment the component is measured.
 */

export type FieldKind = "length" | "count" | "number";

export interface CostingField {
  key: string;
  label: string;
  kind: FieldKind;
  /** Shown as a hint; not a default value. */
  hint?: string;
}

export interface CostingQuantity {
  key: string;
  label: string;
  /** The unit the quantity comes out in - a code the catalogue knows (sqft, rft, nos, lot…). */
  unit_code: string;
  formula: string;
}

export interface ComponentCosting {
  fields: CostingField[];
  quantities: CostingQuantity[];
}

export const KEY_RE = /^[a-z][a-z0-9_]*$/;

export function emptyCosting(): ComponentCosting {
  return { fields: [], quantities: [] };
}

export function readCosting(config: unknown): ComponentCosting {
  const c = (config ?? {}) as Partial<ComponentCosting>;
  return {
    fields: Array.isArray(c.fields) ? c.fields.filter((f) => f && KEY_RE.test(String(f.key))) : [],
    quantities: Array.isArray(c.quantities) ? c.quantities.filter((q) => q && KEY_RE.test(String(q.key))) : [],
  };
}

export const hasCosting = (c: ComponentCosting | null | undefined) => !!c && c.fields.length > 0 && c.quantities.length > 0;

const TO_FEET: Record<string, number> = { mm: 0.00328084, cm: 0.0328084, inch: 0.0833333, ft: 1, m: 3.28084 };

/**
 * Every quantity of a component, from its measures. Lengths are converted
 * to feet first; quantities may use quantities defined before them. A
 * formula that fails yields 0 and its error, never a throw - a quotation
 * line must still exist even when a rule is half-written.
 */
export function quantify(
  costing: ComponentCosting,
  measures: Record<string, number | null | undefined> | null | undefined,
  unit: string,
): { values: Record<string, number>; errors: Record<string, string> } {
  const factor = TO_FEET[unit] ?? 1;
  const vars: Record<string, number> = {};
  for (const f of costing.fields) {
    const raw = Number(measures?.[f.key] ?? 0) || 0;
    vars[f.key] = f.kind === "length" ? raw * factor : raw;
  }
  const values: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const q of costing.quantities) {
    const r = evaluate(q.formula, vars);
    if (r.ok) {
      values[q.key] = r.value;
      vars[q.key] = r.value;
    } else {
      values[q.key] = 0;
      vars[q.key] = 0;
      errors[q.key] = r.error;
    }
  }
  return { values, errors };
}

/** Problems a person should fix before the rule is used. */
export function validateCosting(c: ComponentCosting): string[] {
  const problems: string[] = [];
  const fieldKeys = new Set<string>();
  for (const f of c.fields) {
    if (!KEY_RE.test(f.key)) problems.push(`Field key "${f.key}" - lowercase letters, digits and _ only, starting with a letter`);
    if (fieldKeys.has(f.key)) problems.push(`"${f.key}" is used twice`);
    fieldKeys.add(f.key);
  }
  // A quantity may share a field's key - "shelves: shelves" passes the count
  // typed on the sheet through as the quantity a line is priced per, and is
  // the natural way to write it. Two quantities may not share a key.
  const known = new Set(fieldKeys);
  const quantityKeys = new Set<string>();
  for (const q of c.quantities) {
    if (!KEY_RE.test(q.key)) problems.push(`Quantity key "${q.key}" - lowercase letters, digits and _ only`);
    if (quantityKeys.has(q.key)) problems.push(`"${q.key}" is used twice`);
    quantityKeys.add(q.key);
    for (const n of namesIn(q.formula)) {
      if (!known.has(n)) problems.push(`${q.label || q.key}: "${n}" is not a field or an earlier quantity`);
    }
    if (!q.formula.trim()) problems.push(`${q.label || q.key} has no formula`);
    known.add(q.key);
  }
  return problems;
}

/**
 * A rule's `width`, `height` and `length` fields ARE the row's own size
 * columns - the size typed on the Scope list, or the builder's width ×
 * height - never a second copy in `measures`. So a size is entered once,
 * wherever it is entered, and the rule reads it from there; `measures`
 * holds only the rule's other fields (depth, shutters, exposed sides…).
 */
export const DIMENSION_KEYS = ["width", "height", "length"] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];
export const isDimensionKey = (k: string): k is DimensionKey => (DIMENSION_KEYS as readonly string[]).includes(k);

/** The values a rule evaluates over: the size columns laid over `measures`. */
export function mergeMeasures(row: {
  width?: number | null;
  height?: number | null;
  length?: number | null;
  measures?: Record<string, number> | null;
}): Record<string, number> {
  const m: Record<string, number> = { ...(row.measures ?? {}) };
  for (const k of DIMENSION_KEYS) {
    const v = row[k];
    if (v != null && Number.isFinite(Number(v))) m[k] = Number(v);
  }
  return m;
}

/** Splits an edited value set back into the size columns and `measures`. */
export function splitMeasures(values: Record<string, number>): { dims: Partial<Record<DimensionKey, number | null>>; measures: Record<string, number> } {
  const dims: Partial<Record<DimensionKey, number | null>> = {};
  const measures: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (isDimensionKey(k)) dims[k] = v;
    else measures[k] = v;
  }
  return { dims, measures };
}
