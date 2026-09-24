import { describe, it, expect } from "vitest";
import { questionsOf, stillToAsk } from "./questions";

const carcass = ["c1", "c2", "c3"].map((id) => ({ id, category_id: "cat-carcass", unit_code: "sqft", decision: null }));
const finish = ["f1", "f2"].map((id) => ({ id, category_id: "cat-finish", unit_code: "sqft", decision: null }));
const offers = [...carcass, ...finish].map((i) => ({ cost_item_id: i.id, quantity_key: "shutter_sqft" }));

describe("questionsOf", () => {
  it("makes one question per group of alternatives", () => {
    const qs = questionsOf(offers, [...carcass, ...finish], []);
    expect(qs).toHaveLength(2);
    expect(stillToAsk(qs)).toBe(2);
  });

  it("counts a question answered when one of its options is picked", () => {
    const qs = questionsOf(offers, [...carcass, ...finish], ["c2"]);
    expect(stillToAsk(qs)).toBe(1);
  });

  it("counts a declined question as answered - the point of storing it", () => {
    const qs = questionsOf(offers, [...carcass, ...finish], [], [qKey(carcass)]);
    expect(qs.find((q) => q.key === qKey(carcass))?.answered).toBe(true);
    expect(stillToAsk(qs)).toBe(1);
  });

  it("merges two categories that share a decision into one question", () => {
    const handles = { id: "h1", category_id: "cat-handles", unit_code: "nos", decision: "door_opening" };
    const profile = { id: "p1", category_id: "cat-profiles", unit_code: "rft", decision: "door_opening" };
    const lines = [
      { cost_item_id: "h1", quantity_key: "handles" },
      { cost_item_id: "p1", quantity_key: "counter_rft" },
    ];
    const qs = questionsOf(lines, [handles, profile], []);
    expect(qs).toHaveLength(1);
    expect(qs[0].costItemIds.sort()).toEqual(["h1", "p1"]);
  });

  it("does not ask about counted accessories - they are an Add row", () => {
    const trays = ["t1", "t2", "t3"].map((id) => ({ id, category_id: "cat-internals", unit_code: "nos", decision: null }));
    const qs = questionsOf(trays.map((t) => ({ cost_item_id: t.id, quantity_key: null })), trays, []);
    expect(qs).toHaveLength(0);
  });

  it("asks about a lone counted item, because the sheet draws it as No / Yes", () => {
    const light = { id: "l1", category_id: "cat-lighting", unit_code: "nos", decision: null };
    const qs = questionsOf([{ cost_item_id: "l1", quantity_key: null }], [light], []);
    expect(qs).toHaveLength(1);
    expect(qs[0].key).toBe("l1");
    expect(stillToAsk(questionsOf([{ cost_item_id: "l1", quantity_key: null }], [light], ["l1"]))).toBe(0);
  });

  it("does not ask about an automatic item - there is nothing to tap", () => {
    const shelf = { id: "s1", category_id: "cat-internals", unit_code: "nos", decision: null };
    const qs = questionsOf([{ cost_item_id: "s1", quantity_key: "shelves", auto: true }], [shelf], []);
    expect(qs).toHaveLength(0);
  });

  it("a lone counted item beside an automatic one is not a yes/no question", () => {
    const items = [
      { id: "s1", category_id: "cat-internals", unit_code: "nos", decision: null },
      { id: "t1", category_id: "cat-internals", unit_code: "nos", decision: null },
    ];
    const qs = questionsOf(
      [{ cost_item_id: "s1", quantity_key: "shelves", auto: true }, { cost_item_id: "t1", quantity_key: null }],
      items,
      [],
    );
    expect(qs).toHaveLength(0);
  });
});

function qKey(items: { id: string; category_id: string | null }[]) {
  return `${items[0].category_id}:shutter_sqft`;
}

describe("only an answer answers", () => {
  const carcass = ["c1", "c2"].map((id) => ({ id, category_id: "cat-carcass", unit_code: "sqft", decision: null }));
  const offers = carcass.map((i) => ({ cost_item_id: i.id, quantity_key: "shutter_sqft" }));

  it("counts a question with nothing chosen as still to ask", () => {
    // `questionsOf` is told the chosen items only - a row carrying no choice
    // produces no line on the quotation, so the question is still open.
    expect(stillToAsk(questionsOf(offers, carcass, []))).toBe(1);
    expect(stillToAsk(questionsOf(offers, carcass, ["c1"]))).toBe(0);
  });
});
