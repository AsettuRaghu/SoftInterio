import type { BuilderSpace } from "@/components/quotations/types";
import type { ComponentType } from "@/types/quotations";
import { hasCosting, quantify, readCosting } from "./component-costing";

/**
 * Attaches each component's costing rule (from master data) and works out
 * the quantity every rule-priced line follows, from the component's
 * measures. Pure and cheap; the builder applies it at render, for totals
 * and on save, so the derived numbers are never stored as state of their own.
 */
export function deriveQuantities(spaces: BuilderSpace[], componentTypes: ComponentType[]): BuilderSpace[] {
  const rules = new Map(componentTypes.map((t) => [t.id, readCosting(t.config_schema)]));
  return spaces.map((space) => ({
    ...space,
    components: space.components.map((comp) => {
      const costing = rules.get(comp.componentTypeId);
      if (!costing || !hasCosting(costing)) return { ...comp, costing: null };
      const { values } = quantify(costing, comp.measures, comp.measurementUnit || "mm");
      return {
        ...comp,
        costing,
        lineItems: comp.lineItems.map((li) => (li.quantityKey ? { ...li, derivedQuantity: values[li.quantityKey] ?? 0 } : li)),
      };
    }),
  }));
}
