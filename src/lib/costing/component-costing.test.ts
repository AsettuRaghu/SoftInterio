import { describe, expect, it } from "vitest";
import { mergeMeasures, quantify, readCosting, splitMeasures, validateCosting, type ComponentCosting, overrideKey } from "./component-costing";

// The seeded Wardrobe - Openable rule, as a tenant would have it.
const wardrobe: ComponentCosting = {
  fields: [
    { key: "width", label: "Width", kind: "length" },
    { key: "height", label: "Height", kind: "length" },
    { key: "depth", label: "Depth", kind: "length" },
    { key: "shutters", label: "Shutters", kind: "count" },
    { key: "shelves", label: "Shelves", kind: "count" },
    { key: "drawers", label: "Drawers", kind: "count" },
    { key: "exposed_sides", label: "Exposed sides", kind: "count" },
  ],
  quantities: [
    { key: "shutter_sqft", label: "Front area", unit_code: "sqft", formula: "width * height" },
    { key: "hinges_per_door", label: "Hinges per door", unit_code: "nos", formula: "max(2, ceil(height / 2))" },
    { key: "hinges", label: "Hinges", unit_code: "nos", formula: "shutters * hinges_per_door" },
    { key: "handles", label: "Handles", unit_code: "nos", formula: "shutters" },
    { key: "shelves", label: "Shelves", unit_code: "nos", formula: "shelves" },
    { key: "drawers", label: "Drawers", unit_code: "nos", formula: "drawers" },
    { key: "exposed_side_sqft", label: "Exposed side area", unit_code: "sqft", formula: "exposed_sides * depth * height" },
  ],
};

describe("quantify - a measurement becomes the quantities each line follows", () => {
  it("prices an 8 × 7 ft wardrobe the way the handbook works it", () => {
    const { values, errors } = quantify(wardrobe, { width: 8, height: 7, depth: 2, shutters: 4, shelves: 4, drawers: 2, exposed_sides: 1 }, "ft");
    expect(errors).toEqual({});
    expect(values.shutter_sqft).toBe(56);
    expect(values.hinges_per_door).toBe(4);
    expect(values.hinges).toBe(16);
    expect(values.handles).toBe(4);
    expect(values.exposed_side_sqft).toBe(14);
  });

  it("converts lengths to feet inside formulas, whatever unit was typed; counts stay counts", () => {
    const mm = quantify(wardrobe, { width: 4500, height: 2700, depth: 600, shutters: 4, exposed_sides: 1 }, "mm").values;
    expect(mm.shutter_sqft).toBeCloseTo(130.78, 1);
    expect(mm.hinges_per_door).toBe(5); // 2700 mm is 8.86 ft -> ceil(4.43)
    expect(mm.hinges).toBe(20); // shutters is a count, not converted
    expect(mm.exposed_side_sqft).toBeCloseTo(17.44, 1);
  });

  it("treats an untyped field as 0, so a wardrobe with no loft prices no loft", () => {
    const { values } = quantify(wardrobe, { width: 8, height: 7, shutters: 4 }, "ft");
    expect(values.exposed_side_sqft).toBe(0);
    expect(values.shelves).toBe(0);
  });

  it("gives 0 and names the error for a broken formula, never throws", () => {
    const broken: ComponentCosting = { fields: [{ key: "width", label: "W", kind: "length" }], quantities: [{ key: "a", label: "A", unit_code: "sqft", formula: "width * nothing" }, { key: "b", label: "B", unit_code: "sqft", formula: "a + 1" }] };
    const { values, errors } = quantify(broken, { width: 3 }, "ft");
    expect(values.a).toBe(0);
    expect(errors.a).toMatch(/nothing/);
    expect(values.b).toBe(1); // downstream reads the 0, not a crash
  });
});

describe("validateCosting - what a person must fix before the rule is used", () => {
  it("accepts the wardrobe rule - including a quantity that passes a field's count straight through", () => {
    expect(validateCosting(wardrobe)).toEqual([]);
  });
  it("still refuses two quantities with one key", () => {
    const problems = validateCosting({ fields: [], quantities: [{ key: "a", label: "A", unit_code: "nos", formula: "1" }, { key: "a", label: "A again", unit_code: "nos", formula: "2" }] });
    expect(problems.join("\n")).toMatch(/"a" is used twice/);
  });
  it("catches bad keys, duplicates, unknown names, and quantities used before they exist", () => {
    const problems = validateCosting({
      fields: [{ key: "Width", label: "W", kind: "length" }, { key: "w", label: "w", kind: "length" }, { key: "w", label: "again", kind: "count" }],
      quantities: [{ key: "later", label: "Later", unit_code: "nos", formula: "first + w" }, { key: "first", label: "First", unit_code: "nos", formula: "w" }, { key: "blank", label: "Blank", unit_code: "nos", formula: "" }],
    });
    expect(problems.join("\n")).toMatch(/"Width"/);
    expect(problems.join("\n")).toMatch(/"w" is used twice/);
    expect(problems.join("\n")).toMatch(/"first" is not a field or an earlier quantity/);
    expect(problems.join("\n")).toMatch(/Blank has no formula/);
  });
  it("readCosting drops rows with keys the evaluator could not read", () => {
    const c = readCosting({ fields: [{ key: "ok", label: "", kind: "count" }, { key: "Not OK", label: "", kind: "count" }], quantities: [{ key: "9x", formula: "1" }] });
    expect(c.fields.map((f) => f.key)).toEqual(["ok"]);
    expect(c.quantities).toEqual([]);
  });
});

describe("mergeMeasures / splitMeasures - a size is typed once", () => {
  it("lays the row's size columns over its measures", () => {
    expect(mergeMeasures({ width: 8, height: 7, measures: { depth: 2, width: 99 } })).toEqual({ width: 8, height: 7, depth: 2 });
  });
  it("ignores a null size rather than writing 0 over a measure", () => {
    expect(mergeMeasures({ width: null, height: undefined, measures: { shutters: 4 } })).toEqual({ shutters: 4 });
  });
  it("splits an edited set back into columns and the rest", () => {
    expect(splitMeasures({ width: 8, height: 10, depth: 2, shutters: 4 })).toEqual({ dims: { width: 8, height: 10 }, measures: { depth: 2, shutters: 4 } });
  });
});

describe("quantify: overruling what the rule worked out", () => {
  const costing = {
    fields: [
      { key: "width", label: "Width", kind: "length" as const },
      { key: "height", label: "Height", kind: "length" as const },
      { key: "shutters", label: "Shutters", kind: "count" as const, default: "ceil(width / 2)" },
    ],
    quantities: [
      { key: "hinges_per_door", label: "Hinges per door", unit_code: "nos", formula: "max(2, ceil(height / 2))" },
      { key: "hinges", label: "Hinges", unit_code: "nos", formula: "shutters * hinges_per_door" },
    ],
  };
  const m = { width: 10.83, height: 8.86 };

  it("uses the rule when nothing is overruled", () => {
    const out = quantify(costing, m, "ft");
    expect(out.values.hinges_per_door).toBe(5);
    expect(out.values.hinges).toBe(30);
    expect(out.overridden).toEqual([]);
  });

  it("takes the person's number over the formula, and keeps what the rule said", () => {
    const out = quantify(costing, { ...m, [overrideKey("hinges")]: 36 }, "ft");
    expect(out.values.hinges).toBe(36);
    expect(out.ruled.hinges).toBe(30);
    expect(out.overridden).toEqual(["hinges"]);
  });

  it("carries an override into the quantities that build on it", () => {
    // Six hinges a door rather than five: the total follows, and the total
    // is NOT itself marked overridden - nobody typed it, the rule produced
    // it from the number that now applies. Only what a person changed is
    // shown as changed.
    const out = quantify(costing, { ...m, [overrideKey("hinges_per_door")]: 6 }, "ft");
    expect(out.values.hinges).toBe(36);
    expect(out.ruled.hinges).toBe(36);
    expect(out.overridden).toEqual(["hinges_per_door"]);
  });

  it("ignores a blank or unreadable override", () => {
    expect(quantify(costing, { ...m, [overrideKey("hinges")]: null }, "ft").values.hinges).toBe(30);
    expect(quantify(costing, { ...m, [overrideKey("hinges")]: NaN }, "ft").values.hinges).toBe(30);
  });

  it("does not mistake an override key for a field", () => {
    const out = quantify(costing, { ...m, [overrideKey("shutters")]: 99 }, "ft");
    expect(out.values.hinges).toBe(30); // shutters is a field, not a quantity
  });
});
