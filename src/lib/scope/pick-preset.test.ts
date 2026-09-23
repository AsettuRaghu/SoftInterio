import { describe, it, expect } from "vitest";
import { pickPreset } from "./apply-preset";
import type { ScopePreset } from "@/types/property-scope";

const p = (name: string, configurations: string[] = [], property_types: string[] = []): ScopePreset => ({
  id: name, name, description: null, items: [], display_order: 0, is_active: true, configurations, property_types,
});

describe("pickPreset", () => {
  it("takes the preset that names the configuration, whatever it is called", () => {
    const list = [p("Compact home", ["1bhk"]), p("Family home", ["3bhk"])];
    expect(pickPreset(list, "3bhk", null)?.name).toBe("Family home");
  });

  it("no longer depends on the name - a renamed preset still works", () => {
    const list = [p("3 Bedroom Flat", ["3bhk"])];
    expect(pickPreset(list, "3bhk", null)?.name).toBe("3 Bedroom Flat");
  });

  it("lets one preset answer several configurations", () => {
    const list = [p("Large home", ["4bhk", "5bhk_plus"])];
    expect(pickPreset(list, "5bhk_plus", null)?.name).toBe("Large home");
  });

  it("prefers a preset narrowed to the property type", () => {
    const list = [p("4 BHK", ["4bhk"]), p("Villa", [], ["villa", "farmhouse"])];
    expect(pickPreset(list, "4bhk", "villa")?.name).toBe("Villa");
    expect(pickPreset(list, "4bhk", "apartment")?.name).toBe("4 BHK");
  });

  it("does not apply a property-type preset to another kind of building", () => {
    const list = [p("Villa", ["4bhk"], ["villa"])];
    expect(pickPreset(list, "4bhk", "apartment")).toBeUndefined();
  });

  it("falls back to the name only for a preset that declares nothing", () => {
    const list = [p("3 BHK")];
    expect(pickPreset(list, "3bhk", null)?.name).toBe("3 BHK");
    // ...and a declared one is never overridden by a name that happens to match
    const both = [p("Nothing like it", ["3bhk"]), p("3 BHK")];
    expect(pickPreset(both, "3bhk", null)?.name).toBe("Nothing like it");
  });

  it("answers nothing when no preset claims the configuration", () => {
    expect(pickPreset([p("1 BHK", ["1bhk"])], "studio", null)).toBeUndefined();
  });

  it("breaks a tie by list order", () => {
    const first = p("First", ["2bhk"]);
    const second = p("Second", ["2bhk"]);
    expect(pickPreset([first, second], "2bhk", null)?.name).toBe("First");
  });
});
