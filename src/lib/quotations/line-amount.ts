import { calculateSqft, convertToFeet, getMeasurementInfo, type LineItem } from "@/components/quotations/types";

/**
 * What one line costs. THE one arithmetic - the builder's totals, the
 * space and component cards, the sidebar, the row and Reprice all call it.
 *
 * Five copies of this existed and four of them ignored `quantityKey`, so
 * every line priced per a costing rule counted as zero in a component
 * total, a space total and the sidebar's summary. The first real quotation
 * read ₹52 lakh in the header and ~₹14 lakh down the side, which is the
 * same document disagreeing with itself (2026-09-22).
 *
 * A line is priced one of four ways:
 *   rule      `quantityKey` set: the derived quantity `deriveQuantities`
 *             attached, times the rate. The component must have been put
 *             through `deriveQuantities` or the quantity is not there.
 *   area      sqft of the line's own length × width, times the rate
 *   length    feet of the line's length, times the rate
 *   quantity  how many, times the rate; `fixed` is the rate itself
 */
export function lineAmount(item: LineItem): number {
  if (item.quantityKey) return (item.derivedQuantity ?? 0) * item.rate;
  const unit = item.measurementUnit || "mm";
  switch (getMeasurementInfo(item.unitCode).type) {
    case "area":
      return calculateSqft(item.length, item.width, unit) * item.rate;
    case "length":
      return convertToFeet(item.length || 0, unit) * item.rate;
    case "fixed":
      return item.rate;
    default:
      return (item.quantity || 0) * item.rate;
  }
}

/** The square feet a line covers - 0 for anything not priced by area. */
export function lineSqft(item: LineItem): number {
  if (item.quantityKey) return getMeasurementInfo(item.unitCode).type === "area" ? (item.derivedQuantity ?? 0) : 0;
  if (getMeasurementInfo(item.unitCode).type !== "area") return 0;
  return calculateSqft(item.length, item.width, item.measurementUnit || "mm");
}

export const componentAmount = (lineItems: LineItem[]) => lineItems.reduce((sum, i) => sum + lineAmount(i), 0);
