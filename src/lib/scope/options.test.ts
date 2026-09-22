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

describe("shapeOptions - what a tap on the room sheet means", () => {
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
