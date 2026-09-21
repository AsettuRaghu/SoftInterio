import { describe, expect, it } from "vitest";
import { evaluate, namesIn } from "./formula";

const ok = (src: string, vars: Record<string, number> = {}) => {
  const r = evaluate(src, vars);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
};
const bad = (src: string, vars: Record<string, number> = {}) => {
  const r = evaluate(src, vars);
  if (r.ok) throw new Error(`expected an error, got ${r.value}`);
  return r.error;
};

describe("evaluate - the arithmetic a tenant writes in a costing rule", () => {
  it("does ordinary arithmetic with precedence and brackets", () => {
    expect(ok("2 + 3 * 4")).toBe(14);
    expect(ok("(2 + 3) * 4")).toBe(20);
    expect(ok("10 / 4")).toBe(2.5);
    expect(ok("7 - 2 - 1")).toBe(4);
  });

  it("reads fields and earlier quantities by name", () => {
    expect(ok("width * height", { width: 8, height: 7 })).toBe(56);
    expect(ok("shutters * hinges_per_door", { shutters: 4, hinges_per_door: 4 })).toBe(16);
  });

  it("has the five functions and nothing else", () => {
    expect(ok("ceil(7 / 2)")).toBe(4);
    expect(ok("floor(7 / 2)")).toBe(3);
    expect(ok("round(2.5)")).toBe(3);
    expect(ok("max(2, ceil(2 / 2))")).toBe(2);
    expect(ok("min(3, 5)")).toBe(3);
    expect(ok("abs(0 - 4)")).toBe(4);
    expect(bad("sqrt(4)")).toMatch(/sqrt/);
  });

  it("hinges by door height: max(2, ceil(height / 2)) per door", () => {
    const per = (height: number) => ok("max(2, ceil(height / 2))", { height });
    expect(per(7)).toBe(4);
    expect(per(10)).toBe(5);
    expect(per(2)).toBe(2); // a loft door never gets fewer than two
  });

  it("names a missing field instead of guessing", () => {
    expect(bad("width * depth", { width: 8 })).toMatch(/depth/);
  });

  it("refuses what is not arithmetic", () => {
    expect(bad("")).toMatch(/Empty/);
    expect(bad("width +", { width: 1 })).toBeTruthy();
    expect(bad("1 / 0")).toMatch(/zero/i);
    expect(bad("width = 3", { width: 1 })).toBeTruthy();
  });

  it("lists the names a formula depends on", () => {
    expect(namesIn("exposed_sides * depth * (height + loft_height)").sort()).toEqual(["depth", "exposed_sides", "height", "loft_height"]);
    expect(namesIn("max(2, ceil(height / 2))")).toEqual(["height"]);
  });
});
