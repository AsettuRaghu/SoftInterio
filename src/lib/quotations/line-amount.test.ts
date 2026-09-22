import { describe, expect, it } from "vitest";
import { lineAmount, lineSqft } from "./line-amount";
import type { LineItem } from "@/components/quotations/types";

const line = (p: Partial<LineItem>): LineItem =>
  ({ id: "1", costItemId: "c", costItemName: "x", categoryName: "c", categoryColor: "#000", unitCode: "sqft", rate: 100, defaultRate: 100, companyCost: 0, vendorCost: 0, length: null, width: null, measurementUnit: "mm", quantity: 1, amount: 0, notes: "", followsComponent: false, quantityKey: null, ...p }) as LineItem;

describe("lineAmount - the one arithmetic behind every total", () => {
  it("a rule-priced line is its derived quantity times the rate", () => {
    expect(lineAmount(line({ quantityKey: "shutter_sqft", derivedQuantity: 130.78, rate: 3200 }))).toBeCloseTo(418496, 0);
  });

  it("a rule-priced line with no derived quantity is zero, not the stored amount", () => {
    // The component was not put through deriveQuantities: showing the stored
    // amount would hide that, and showing 1 × rate would invent money.
    expect(lineAmount(line({ quantityKey: "hinges", rate: 1000, amount: 20000 }))).toBe(0);
  });

  it("an area line is the sqft of its own size", () => {
    expect(lineAmount(line({ unitCode: "sqft", length: 4500, width: 2700, measurementUnit: "mm", rate: 2000 }))).toBeCloseTo(261563, 0);
  });

  it("a length line is its feet", () => {
    expect(lineAmount(line({ unitCode: "rft", length: 3600, measurementUnit: "mm", rate: 350 }))).toBeCloseTo(4134, 0);
  });

  it("a per-piece line is how many, and a fixed one is the rate", () => {
    expect(lineAmount(line({ unitCode: "nos", quantity: 4, rate: 1900 }))).toBe(7600);
    expect(lineAmount(line({ unitCode: "lot", quantity: 3, rate: 6000 }))).toBe(6000);
  });

  it("counts square feet only where the line is priced by area", () => {
    expect(lineSqft(line({ quantityKey: "shutter_sqft", derivedQuantity: 56 }))).toBe(56);
    expect(lineSqft(line({ quantityKey: "hinges", unitCode: "nos", derivedQuantity: 16 }))).toBe(0);
    expect(lineSqft(line({ unitCode: "sqft", length: 3000, width: 3000, measurementUnit: "mm" }))).toBeCloseTo(96.88, 1);
  });
});
