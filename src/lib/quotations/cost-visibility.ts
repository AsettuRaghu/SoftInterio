import { hasPermission } from "@/lib/auth/service";

/**
 * Who may see what a job actually costs.
 *
 * Internal costs and margin are commercially sensitive: a designer or sales
 * executive builds quotations all day and has no business seeing the company's
 * buying price or its profit on the deal. cost_items.pricing already gates
 * exactly this in the cost item library and is held only by owner and admin,
 * so quotations reuse it rather than inventing a second, drifting rule.
 *
 * The stripping happens on the server. Hiding these fields in the UI alone
 * would still ship them to the browser, where anyone can read them off the
 * network tab - which is not a safeguard at all.
 */

export const COST_VISIBILITY_PERMISSION = "cost_items.pricing";

/** Fields that must never reach a user without the permission. */
const SENSITIVE_LINE_ITEM_FIELDS = [
  "company_cost",
  "vendor_cost",
  "margin_amount",
] as const;

export async function canViewCosts(): Promise<boolean> {
  return hasPermission(COST_VISIBILITY_PERMISSION);
}

/**
 * Removes internal cost fields from line items unless the caller may see them.
 *
 * Deletes the keys rather than nulling them, so a client cannot tell a
 * suppressed value from a genuinely empty one, and so nothing downstream
 * mistakes null for "zero margin".
 */
export function stripCostFields<T extends Record<string, unknown>>(
  lineItems: T[],
  allowed: boolean
): T[] {
  if (allowed) return lineItems;
  return lineItems.map((item) => {
    const copy = { ...item } as Record<string, unknown>;
    for (const field of SENSITIVE_LINE_ITEM_FIELDS) {
      delete copy[field];
    }
    // The joined cost item carries the same numbers by another route.
    const costItem = copy.quotation_cost_item as
      | Record<string, unknown>
      | undefined;
    if (costItem) {
      const cleaned = { ...costItem };
      delete cleaned.company_cost;
      delete cleaned.vendor_cost;
      delete cleaned.retail_price;
      delete cleaned.margin_percent;
      copy.quotation_cost_item = cleaned;
    }
    return copy as T;
  });
}
