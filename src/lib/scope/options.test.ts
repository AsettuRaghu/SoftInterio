import { describe, expect, it } from "vitest";
import { shapeOptions } from "./options";

// The wardrobe's offer, reduced to what the shape depends on.
const CARCASS = "cat-carcass", HINGES = "cat-hinges", INTERNALS = "cat-internals", FINISH = "cat-finish", LABOUR = "cat-labour";
const items = [
  { id: "carcass-std", category_id: CARCASS, unit_code: "sqft" },
  { id: "carcass-prem", category_id: CARCASS, unit_code: "sqft" },
  { id: "hinge-std", category_id: HINGES, unit_code: "nos" },
  { id: "hinge-prem", category_id: HINGES, unit_code: "nos" },
  { id: "shelf", category_id: INTERNALS, unit_code: "nos" },
  { id: "wooden-drawer", category_id: INTERNALS, unit_code: "nos" },
  { id: "tandem-box", category_id: INTERNALS, unit_code: "nos" },
  { id: "tray", category_id: INTERNALS, unit_code: "nos" },
  { id: "exposed-side", category_id: FINISH, unit_code: "sqft" },
  { id: "installation", category_id: LABOUR, unit_code: "sqft" },
  { id: "rod", category_id: INTERNALS, unit_code: "rft" },
];
const offer = [
  { cost_item_id: "carcass-std", quantity_key: "shutter_sqft" },
  { cost_item_id: "carcass-prem", quantity_key: "shutter_sqft" },
  { cost_item_id: "hinge-std", quantity_key: "hinges" },
  { cost_item_id: "hinge-prem", quantity_key: "hinges" },
  { cost_item_id: "shelf", quantity_key: "shelves", auto: true },
  { cost_item_id: "wooden-drawer", quantity_key: null },
  { cost_item_id: "tandem-box", quantity_key: null },
  { cost_item_id: "tray", quantity_key: null },
  { cost_item_id: "exposed-side", quantity_key: "exposed_side_sqft", auto: true },
  { cost_item_id: "installation", quantity_key: "shutter_sqft" },
  { cost_item_id: "rod", quantity_key: null },
];

describe("shapeOptions - what a tap on the Scope Sheet means", () => {
  const s = shapeOptions(offer, items);

  it("two grades priced per the same quantity in one category are alternatives", () => {
    expect(s.get("carcass-std")!.group_key).toBe(s.get("carcass-prem")!.group_key);
    expect(s.get("carcass-std")!.counted).toBe(false);
    expect(s.get("carcass-std")!.auto).toBe(false);
  });

  it("hinge grades are alternatives among themselves and never with the carcass", () => {
    expect(s.get("hinge-std")!.group_key).toBe(s.get("hinge-prem")!.group_key);
    expect(s.get("hinge-std")!.group_key).not.toBe(s.get("carcass-std")!.group_key);
  });

  it("every drawer type is a counted accessory, not a decision - two wooden and one tandem are two rows with counts", () => {
    expect(s.get("wooden-drawer")).toMatchObject({ counted: true, group_key: null, auto: false });
    expect(s.get("tandem-box")).toMatchObject({ counted: true, group_key: null, auto: false });
  });

  it("a per-piece item with no rule quantity is counted, with no preference", () => {
    expect(s.get("tray")).toMatchObject({ counted: true, group_key: null, auto: false });
  });

  it("an item marked automatic on the offer prices itself", () => {
    expect(s.get("shelf")!.auto).toBe(true);
    expect(s.get("exposed-side")!.auto).toBe(true);
  });

  it("being alone in a group never makes an item automatic - a lone installation line, or the only light on a wall unit, is a tap", () => {
    expect(s.get("installation")!.auto).toBe(false);
    expect(s.get("installation")!.counted).toBe(false);
  });

  it("automatic needs a quantity to follow", () => {
    const t = shapeOptions([{ cost_item_id: "tray", quantity_key: null, auto: true }], [items[7]]);
    expect(t.get("tray")!.auto).toBe(false);
  });

  it("an area or length item with no rule quantity is priced on the one face and is not counted", () => {
    expect(s.get("rod")).toMatchObject({ counted: false, auto: false });
    expect(s.get("rod")!.group_key).toMatch(/:face$/);
  });

  it("same key in different categories are different decisions (carcass vs installation, both per front area)", () => {
    expect(s.get("carcass-std")!.group_key).not.toBe(s.get("installation")!.group_key);
  });

  it("an item on the offer twice keeps the priced-per that is set", () => {
    const twice = shapeOptions([{ cost_item_id: "shelf", quantity_key: null }, { cost_item_id: "shelf", quantity_key: "shelves" }], [items[4]]);
    expect(twice.get("shelf")!.quantity_key).toBe("shelves");
  });
});

describe("two categories that answer one question", () => {
  // Handles and profiles are both "How do the doors open?", so a profile
  // chosen must demote a handle - one decision, not two.
  const items = [
    { id: "handle-std", category_id: "cat-handles", unit_code: "nos", decision: "door_opening" },
    { id: "handle-prem", category_id: "cat-handles", unit_code: "nos", decision: "door_opening" },
    { id: "gola", category_id: "cat-profiles", unit_code: "rft", decision: "door_opening" },
    { id: "carcass", category_id: "cat-carcass", unit_code: "sqft", decision: null },
  ];
  const offer = [
    { cost_item_id: "handle-std", quantity_key: "handles" },
    { cost_item_id: "handle-prem", quantity_key: "handles" },
    { cost_item_id: "gola", quantity_key: "counter_rft" },
    { cost_item_id: "carcass", quantity_key: "shutter_sqft" },
  ];
  const s = shapeOptions(offer, items);

  it("puts them in one group though they are different categories and different units", () => {
    expect(s.get("handle-std")!.group_key).toBe(s.get("gola")!.group_key);
    expect(s.get("handle-std")!.group_key).toBe("d:door_opening");
  });
  it("leaves a category with no decision as its own question", () => {
    expect(s.get("carcass")!.group_key).not.toBe(s.get("gola")!.group_key);
  });
  it("a per-piece handle in a decision is still a choice, not a counted extra", () => {
    expect(s.get("handle-std")!.counted).toBe(false);
  });
});

describe("an offer says how it is asked", () => {
  const four = ["d-b", "d-s", "d-p", "d-l"].map((id) => ({ id, category_id: "drawers", unit_code: "nos", decision: null }));

  it("makes a per-piece family one question when the offer says so", () => {
    // The Drawer Systems case: four grades, all `nos`, no quantity to size
    // them by. Inference made four steppers; saying one_of makes one question.
    const shapes = shapeOptions(four.map((f) => ({ cost_item_id: f.id, quantity_key: null, ask_as: "one_of" })), four);
    expect([...shapes.values()].every((s) => !s.counted)).toBe(true);
    expect(new Set([...shapes.values()].map((s) => s.group_key)).size).toBe(1);
  });

  it("counts something that would otherwise be a question", () => {
    const sqft = [{ id: "x", category_id: "c", unit_code: "sqft", decision: null }];
    const shapes = shapeOptions([{ cost_item_id: "x", quantity_key: "area", ask_as: "count" }], sqft);
    expect(shapes.get("x")!.counted).toBe(true);
    expect(shapes.get("x")!.group_key).toBeNull();
  });

  it("falls back to the inference when the offer has not said", () => {
    const shapes = shapeOptions(four.map((f) => ({ cost_item_id: f.id, quantity_key: null })), four);
    expect([...shapes.values()].every((s) => s.counted)).toBe(true);
  });

  it("refuses automatic with nothing to be automatic from", () => {
    const one = [{ id: "s", category_id: "c", unit_code: "nos", decision: null }];
    expect(shapeOptions([{ cost_item_id: "s", quantity_key: null, ask_as: "auto" }], one).get("s")!.auto).toBe(false);
    expect(shapeOptions([{ cost_item_id: "s", quantity_key: "shelves", ask_as: "auto" }], one).get("s")!.auto).toBe(true);
  });

  it("ignores a value it does not know", () => {
    const shapes = shapeOptions(four.map((f) => ({ cost_item_id: f.id, quantity_key: null, ask_as: "nonsense" })), four);
    expect([...shapes.values()].every((s) => s.counted)).toBe(true);
  });
});
