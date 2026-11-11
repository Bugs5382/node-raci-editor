/** The public entry points export no tree component: the host renders its own tree. */
import { describe, expect, it } from "vitest";
import * as library from "@/index";
import * as demo from "@/demo/index";

describe("public surface", () => {
  it("exports no tree component or tree helper", () => {
    for (const name of [...Object.keys(library), ...Object.keys(demo)]) {
      expect(name).not.toMatch(/tree/i);
    }
  });

  it("keeps the demo surface to the component and the data builders", () => {
    expect(Object.keys(demo).sort()).toEqual(["RaciDemo", "demoPresets", "demoRuleSet"]);
  });
});
