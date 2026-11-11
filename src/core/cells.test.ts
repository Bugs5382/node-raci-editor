/*
MIT License

Copyright (c) 2026 Shane

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
import { describe, expect, it } from "vitest";
import {
  CELL_SIZE_LIMITS,
  CELL_STATE_IDS,
  cellStateId,
  normalizeCells,
  resolveCellStyle,
} from "./cells.js";

describe("cell state ids", () => {
  it("lists the six states", () => {
    expect([...CELL_STATE_IDS]).toEqual([
      "allow",
      "deny",
      "none",
      "inheritedAllow",
      "inheritedDeny",
      "included",
    ]);
  });
  it("maps an effect, the inherited flag and the included flag to a state", () => {
    expect(cellStateId("allow", false, false)).toBe("allow");
    expect(cellStateId("deny", false, false)).toBe("deny");
    expect(cellStateId(undefined, false, false)).toBe("none");
    expect(cellStateId(undefined, false, true)).toBe("included");
    expect(cellStateId("allow", true, false)).toBe("inheritedAllow");
    expect(cellStateId("deny", true, false)).toBe("inheritedDeny");
    expect(cellStateId(undefined, true, false)).toBe("none");
  });
});

describe("normalizeCells", () => {
  it("keeps valid values and reports nothing", () => {
    const input = {
      size: { width: 48, height: 32 },
      states: {
        allow: {
          glyph: "Y",
          text: "Yes",
          label: "yes",
          tooltip: "Allowed here",
          colors: { fg: "#0a6", bg: "rgb(0 128 0 / 20%)", border: "var(--mine)" },
          shape: { radius: "50%", borderStyle: "dashed", borderWidth: "2px" },
          className: "mine other",
        },
        none: { glyph: "" },
      },
    };
    const { value, issues } = normalizeCells(input);
    expect(issues).toEqual([]);
    expect(value).toEqual(input);
  });

  it("drops what it cannot use and says why", () => {
    const { value, issues } = normalizeCells({
      size: { width: 5, height: 9999 },
      states: {
        allow: { glyph: "toolong", colors: { fg: "red; background:url(x)", bg: "#123" } },
        bogus: { glyph: "x" },
        deny: { shape: { radius: "javascript:1", borderStyle: "wavy" }, className: "a<b" },
      },
    });
    expect(value).toEqual({ states: { allow: { colors: { bg: "#123" } } } });
    const paths = issues.map((i) => i.path).sort();
    expect(paths).toEqual(
      [
        "size/height",
        "size/width",
        "states/allow/colors/fg",
        "states/allow/glyph",
        "states/bogus",
        "states/deny/className",
        "states/deny/shape/borderStyle",
        "states/deny/shape/radius",
      ].sort(),
    );
    for (const i of issues) expect(i.message).not.toBe("");
  });

  it("accepts anything as input and returns an empty value for junk", () => {
    for (const junk of [undefined, null, 5, "x", [], { states: 3 }, { size: "big" }]) {
      expect(normalizeCells(junk).value).toEqual({});
    }
  });

  it("is idempotent and survives JSON", () => {
    const { value } = normalizeCells({
      size: { width: 64.6, height: 40 },
      states: { deny: { glyph: "N", colors: { fg: "#a00" } } },
    });
    const again = normalizeCells(structuredClone(value));
    expect(again.issues).toEqual([]);
    expect(again.value).toEqual(value);
    expect(value.size).toEqual({ width: 65, height: 40 });
  });

  it("limits the size to a range, smaller than today's defaults allowed", () => {
    expect(CELL_SIZE_LIMITS.width.min).toBeLessThan(96);
    expect(CELL_SIZE_LIMITS.height.min).toBeLessThan(28);
    expect(
      normalizeCells({
        size: { width: CELL_SIZE_LIMITS.width.min, height: CELL_SIZE_LIMITS.height.min },
      }).issues,
    ).toEqual([]);
    expect(
      normalizeCells({ size: { width: CELL_SIZE_LIMITS.width.max + 1, height: 40 } }).issues,
    ).toHaveLength(1);
  });
});

describe("resolveCellStyle", () => {
  it("overlays settings on the host config, field by field", () => {
    const style = resolveCellStyle(
      "allow",
      { allow: { glyph: "A", text: "Ok", colors: { fg: "#111", bg: "#eee" }, className: "host" } },
      { states: { allow: { glyph: "B", colors: { fg: "#222" } } } },
    );
    expect(style).toMatchObject({
      glyph: "B",
      text: "Ok",
      colors: { fg: "#222", bg: "#eee" },
      className: "host",
    });
  });
  it("returns an empty style when nothing is set", () => {
    expect(resolveCellStyle("none", undefined, undefined)).toEqual({});
  });
  it("keeps a host render function for the glyph", () => {
    const glyph = () => "G";
    expect(resolveCellStyle("deny", { deny: { glyph } }, undefined).glyph).toBe(glyph);
  });
});
