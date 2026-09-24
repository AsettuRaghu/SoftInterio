import { describe, it, expect } from "vitest";
import { lineShortfall, lineIsIncomplete } from "./line-completeness";

/**
 * The regressions this file exists to stop, each one a real report:
 * "43 lines need size", "45 lines still need a measurement", and
 * "2 lines still need details" on every save of a correct quotation.
 */
describe("a rule-priced line", () => {
  const rules = new Set(["shutter_sqft", "corners", "hinges"]);

  it("is ready on its rate alone - length and width are meaningless for it", () => {
    // The 45-line false alarm: quantity 95.91 from the rule, no length or width.
    expect(
      lineShortfall(
        { rate: 650, quantityKey: "shutter_sqft", derivedQuantity: 95.91, unitCode: "sqft" },
        rules
      )
    ).toEqual([]);
  });

  it("is ready when the rule derives ZERO, because none needed is an answer", () => {
    // Blind Corner Pull-out per `corners` on a kitchen with no corners. The
    // field defaults to 0 on purpose; this is not a missing measurement.
    expect(
      lineShortfall({ rate: 16000, quantityKey: "corners", derivedQuantity: 0, unitCode: "nos" }, rules)
    ).toEqual([]);
  });

  it("is short when the rule has no such quantity - it can never be priced", () => {
    expect(
      lineShortfall({ rate: 900, quantityKey: "dado_sqft", derivedQuantity: 0, unitCode: "sqft" }, rules)
    ).toEqual(["a measurement"]);
  });

  it("is short without a rate, whatever the rule says", () => {
    expect(
      lineShortfall({ rate: 0, quantityKey: "shutter_sqft", derivedQuantity: 95.91, unitCode: "sqft" }, rules)
    ).toEqual(["rate"]);
  });

  it("is judged on its rate alone where the rule is unknown - the server's case", () => {
    // Omitting the rule must never invent a fault: refusing to send a correct
    // quotation is the worse error.
    expect(lineShortfall({ rate: 650, quantityKey: "anything", derivedQuantity: 0 })).toEqual([]);
    expect(lineShortfall({ rate: null, quantityKey: "anything" })).toEqual(["rate"]);
  });
});

describe("a line priced on its own measurement", () => {
  it("needs both sides of an area", () => {
    expect(lineShortfall({ rate: 600, unitCode: "sqft", length: 10, width: 8 })).toEqual([]);
    expect(lineShortfall({ rate: 600, unitCode: "sqft", length: 10 })).toEqual(["size"]);
    expect(lineShortfall({ rate: 600, unitCode: "sqft" })).toEqual(["size"]);
  });

  it("needs a run for a length, and a count per piece", () => {
    expect(lineShortfall({ rate: 220, unitCode: "rft", length: 12 })).toEqual([]);
    expect(lineShortfall({ rate: 220, unitCode: "rft" })).toEqual(["size"]);
    expect(lineShortfall({ rate: 1500, unitCode: "nos", quantity: 2 })).toEqual([]);
    expect(lineShortfall({ rate: 1500, unitCode: "nos" })).toEqual(["quantity"]);
  });

  it("reports the rate and the measurement together", () => {
    expect(lineShortfall({ rate: 0, unitCode: "sqft" })).toEqual(["rate", "size"]);
    expect(lineIsIncomplete({ rate: 0, unitCode: "sqft" })).toBe(true);
  });
});
