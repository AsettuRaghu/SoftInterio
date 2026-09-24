import { getMeasurementInfo } from "@/components/quotations/types";

/**
 * What a quotation line is still missing before it may be sent to a customer.
 *
 * **Extracted because this has been wrong three times**, each time reporting a
 * problem with a document that was correct:
 *
 *  1. The builder's amber strip demanded a length and width for every area line,
 *     so 43 rule-priced lines read as "need size" (fixed 2026-09-22).
 *  2. The send guard in `PATCH /api/quotations/[id]/status` had the identical
 *     bug and blocked sending 45 such lines (fixed 2026-09-24).
 *  3. Both then treated a derived quantity of **0** as a missing measurement -
 *     which it is not.
 *
 * The third is the interesting one. `corners` on a kitchen rule is a field with
 * `default: 0`, because "blind corners" is exactly the case CLAUDE.md describes
 * as **0 where the honest answer is "only if somebody says so"**. So a Blind
 * Corner Pull-out priced per `corners` on a kitchen with no corners derives 0:
 * the rule ran, and the answer is *none needed*. Nagging about it on every save
 * is noise, and noise is what teaches people to ignore the warning that matters.
 *
 * The distinction that matters is therefore **"the rule cannot price this"**
 * against **"the rule priced it at nothing"**. `deriveQuantities` collapses both
 * to 0 (`values[key] ?? 0`), so the rule's own list of quantities is the only
 * thing that can tell them apart - which is why `ruleQuantities` is a parameter
 * and why the server, which does not have the rule, must not guess.
 */

export interface LineToCheck {
  rate?: number | null;
  /** Set when the line is priced per a quantity of the component's costing rule. */
  quantityKey?: string | null;
  /** What the rule worked out. 0 is a legitimate answer. */
  derivedQuantity?: number | null;
  unitCode?: string | null;
  length?: number | null;
  width?: number | null;
  quantity?: number | null;
}

/**
 * The words for what is missing, or an empty list when the line is ready.
 *
 * `ruleQuantities` is the set of quantity keys the component's rule defines.
 * Pass it where the rule is known (the builder); omit it where it is not (the
 * server), and a rule-priced line is then judged on its rate alone - because
 * the alternative is refusing to send a correct quotation, which is the worse
 * error of the two.
 */
export function lineShortfall(
  item: LineToCheck,
  ruleQuantities?: ReadonlySet<string> | null
): string[] {
  const missing: string[] = [];
  if (!item.rate || Number(item.rate) <= 0) missing.push("rate");

  if (item.quantityKey) {
    // A line priced per a quantity the rule does not define can never be
    // priced - that is a real fault, and a different one from deriving zero.
    if (ruleQuantities && !ruleQuantities.has(item.quantityKey)) {
      missing.push("a measurement");
    }
    return missing;
  }

  const type = getMeasurementInfo(item.unitCode ?? "").type;
  const blank = (v: number | null | undefined) => !v || Number(v) <= 0;
  if (type === "area" && (blank(item.length) || blank(item.width))) missing.push("size");
  else if (type === "length" && blank(item.length)) missing.push("size");
  else if (type === "quantity" && blank(item.quantity)) missing.push("quantity");

  return missing;
}

/** Whether this line would stop the quotation being sent. */
export function lineIsIncomplete(
  item: LineToCheck,
  ruleQuantities?: ReadonlySet<string> | null
): boolean {
  return lineShortfall(item, ruleQuantities).length > 0;
}
