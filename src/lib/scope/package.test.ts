import { describe, it, expect } from "vitest";
import { packagePlans } from "./package";
import type { GradedItem } from "./grade";

const T = "type-wardrobe";
const item = (id: string, category_id: string, unit_code = "sqft", quality_tier: string | null = null): GradedItem =>
  ({ id, category_id, unit_code, quality_tier, decision: null });

const items = new Map<string, GradedItem>([
  ["c-s", item("c-s", "carcass", "sqft", "standard")],
  ["c-p", item("c-p", "carcass", "sqft", "premium")],
  ["f-lam", item("f-lam", "finish")],
  ["f-acr", item("f-acr", "finish")],
  ["rod", item("rod", "internals", "nos")],
  ["tray", item("tray", "internals", "nos")],
  ["shelf", item("shelf", "internals", "nos")],
]);
const offersByType = new Map([[T, [
  { cost_item_id: "c-s", quantity_key: "shutter_sqft" },
  { cost_item_id: "c-p", quantity_key: "shutter_sqft" },
  { cost_item_id: "f-lam", quantity_key: "shutter_sqft" },
  { cost_item_id: "f-acr", quantity_key: "shutter_sqft" },
  { cost_item_id: "rod", quantity_key: null },
  { cost_item_id: "tray", quantity_key: null },
  { cost_item_id: "shelf", quantity_key: "shelves", auto: true },
]]]);
const components = [{ id: "comp-1", component_type_id: T }];

describe("packagePlans", () => {
  it("separates the answers from the accessories by asking the offer", () => {
    const [plan] = packagePlans({
      components, offersByType, items,
      entries: [
        { component_type_id: T, cost_item_id: "c-s", quantity: null },
        { component_type_id: T, cost_item_id: "f-lam", quantity: null },
        { component_type_id: T, cost_item_id: "rod", quantity: 2 },
      ],
    });
    expect(plan.pick.map((p) => p.cost_item_id).sort()).toEqual(["c-s", "f-lam"]);
    expect(plan.counted).toEqual([{ cost_item_id: "rod", quantity: 2 }]);
    expect(plan.unanswered).toEqual([]);
  });

  it("answers the by-kind question a grade cannot - the whole point of a package", () => {
    const [plan] = packagePlans({
      components, offersByType, items,
      entries: [{ component_type_id: T, cost_item_id: "f-acr", quantity: null }],
    });
    expect(plan.pick).toEqual([{ group_key: "finish:shutter_sqft", cost_item_id: "f-acr" }]);
    // The carcass is still to ask, and is reported rather than assumed.
    expect(plan.unanswered).toEqual(["carcass:shutter_sqft"]);
  });

  it("drops an entry the component type no longer offers", () => {
    const [plan] = packagePlans({
      components, offersByType, items,
      entries: [
        { component_type_id: T, cost_item_id: "c-s", quantity: null },
        { component_type_id: T, cost_item_id: "gone", quantity: null },
      ],
    });
    expect(plan.pick.map((p) => p.cost_item_id)).toEqual(["c-s"]);
  });

  it("ignores an automatic item - it prices itself, there is nothing to choose", () => {
    const plans = packagePlans({
      components, offersByType, items,
      entries: [{ component_type_id: T, cost_item_id: "shelf", quantity: 4 }],
    });
    expect(plans).toEqual([]);
  });

  it("says nothing about a component type the package does not mention", () => {
    const plans = packagePlans({
      components: [{ id: "comp-2", component_type_id: "type-bed" }],
      offersByType, items,
      entries: [{ component_type_id: T, cost_item_id: "c-s", quantity: null }],
    });
    expect(plans).toEqual([]);
  });

  it("floors an accessory count at one", () => {
    const [plan] = packagePlans({
      components, offersByType, items,
      entries: [{ component_type_id: T, cost_item_id: "tray", quantity: 0 }],
    });
    expect(plan.counted).toEqual([{ cost_item_id: "tray", quantity: 1 }]);
  });

  it("plans every component of the same type", () => {
    const plans = packagePlans({
      components: [{ id: "a", component_type_id: T }, { id: "b", component_type_id: T }],
      offersByType, items,
      entries: [{ component_type_id: T, cost_item_id: "c-s", quantity: null }],
    });
    expect(plans.map((p) => p.componentId)).toEqual(["a", "b"]);
  });
});

describe("a blanket as the alternative", () => {
  // applyChoices needs a database, so these check the rule it depends on:
  // a package plan is the same either way, and the preference only changes
  // what is written. The p2-specific rules are asserted in the route's own
  // shape - here we pin the two facts the plan must carry for them to work.
  it("separates answers from accessories, so p2 can skip the accessories", () => {
    const [plan] = packagePlans({
      components, offersByType, items,
      entries: [
        { component_type_id: T, cost_item_id: "c-s", quantity: null },
        { component_type_id: T, cost_item_id: "rod", quantity: 2 },
      ],
    });
    expect(plan.pick).toHaveLength(1);
    expect(plan.counted).toHaveLength(1);
  });

  it("gives every answer its question, so p2 knows which alternative it replaces", () => {
    const [plan] = packagePlans({
      components, offersByType, items,
      entries: [
        { component_type_id: T, cost_item_id: "c-p", quantity: null },
        { component_type_id: T, cost_item_id: "f-acr", quantity: null },
      ],
    });
    expect(plan.pick.every((p) => !!p.group_key)).toBe(true);
    expect(new Set(plan.pick.map((p) => p.group_key)).size).toBe(2);
  });
});
