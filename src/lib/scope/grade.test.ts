import { describe, it, expect } from "vitest";
import { gradeChoices } from "./grade";

const item = (id: string, category_id: string, quality_tier: string | null = null, unit_code = "sqft") => ({
  id, category_id, unit_code, decision: null, quality_tier,
});
const per = (ids: string[], quantity_key: string | null = "shutter_sqft") => ids.map((id) => ({ cost_item_id: id, quantity_key }));

describe("gradeChoices", () => {
  const carcass = [item("c-b", "carcass", "basic"), item("c-s", "carcass", "standard"), item("c-p", "carcass", "premium")];
  const finish = [item("f-lam", "finish"), item("f-acr", "finish"), item("f-pu", "finish")];

  it("answers a graded question at the grade asked for", () => {
    const p = gradeChoices(per(carcass.map((i) => i.id)), carcass, "standard");
    expect(p.pick).toEqual([{ group_key: "carcass:shutter_sqft", cost_item_id: "c-s" }]);
    expect(p.ungraded).toEqual([]);
  });

  it("reports a by-kind question as unanswerable rather than guessing", () => {
    const p = gradeChoices(per([...carcass, ...finish].map((i) => i.id)), [...carcass, ...finish], "standard");
    expect(p.pick.map((x) => x.cost_item_id)).toEqual(["c-s"]);
    expect(p.ungraded).toEqual(["finish:shutter_sqft"]);
  });

  it("reports a grade the family does not offer, instead of falling back", () => {
    const p = gradeChoices(per(carcass.map((i) => i.id)), carcass, "luxury");
    expect(p.pick).toEqual([]);
    expect(p.ungraded).toEqual(["carcass:shutter_sqft"]);
  });

  it("leaves counted accessories alone", () => {
    const trays = [item("t1", "internals", null, "nos"), item("t2", "internals", null, "nos")];
    const p = gradeChoices(trays.map((t) => ({ cost_item_id: t.id, quantity_key: null })), trays, "standard");
    expect(p.pick).toEqual([]);
    expect(p.ungraded).toEqual([]);
  });

  it("leaves an automatic item alone", () => {
    const shelf = [item("s1", "internals", null, "nos")];
    const p = gradeChoices([{ cost_item_id: "s1", quantity_key: "shelves", auto: true }], shelf, "standard");
    expect(p.pick).toEqual([]);
  });

  it("does not answer a lone yes/no - that is not a grade", () => {
    const light = [item("l1", "lighting", null, "nos")];
    const p = gradeChoices([{ cost_item_id: "l1", quantity_key: null }], light, "standard");
    expect(p.pick).toEqual([]);
    expect(p.ungraded).toEqual([]);
  });

  it("matches the tier whatever its casing", () => {
    expect(gradeChoices(per(carcass.map((i) => i.id)), carcass, "  Standard ").pick[0].cost_item_id).toBe("c-s");
  });
});
