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
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RaciConfig, RuleSet } from "@/core/types";
import { RulesEditor } from "@/react/editor/RulesEditor";

// jsdom does not lay anything out. These tests pin what decides the size of a state box: the same
// classes, no inline size, the same element structure in every state (one primary line plus one
// reserved secondary line), long text kept out of the primary line, and a stylesheet that sets
// the size once through custom properties and never from a state class.

const config: RaciConfig = {
  actions: [
    { id: "view", label: "View" },
    { id: "review", label: "Review", implies: ["view"] },
    { id: "approve", label: "Approve", implies: ["review"] },
  ],
  subjectKinds: [],
  resources: [{ id: "docs", label: "Documents" }],
};

// alice: approve allow -> review and view are blank and included;
// bob: view allow, review deny, approve blank.
const ruleSet: RuleSet = {
  categories: {
    docs: {
      entries: [
        { subject: "user:alice", action: "approve", effect: "allow" },
        { subject: "user:bob", action: "view", effect: "allow" },
        { subject: "user:bob", action: "review", effect: "deny" },
      ],
    },
  },
  parents: {},
};

const renderEditor = (density: "compact" | "comfortable") =>
  render(
    <RulesEditor
      config={config}
      ruleSet={ruleSet}
      categoryId="docs"
      onChange={() => {}}
      settings={{ density }}
    />,
  );

const cells = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>("tbody button.raci-cell"));
const STATE = /^raci-cell--(blank|allow|deny|included)$/;
const stateOf = (el: Element): string =>
  el.classList.contains("raci-cell--included")
    ? "included"
    : (Array.from(el.classList)
        .find((c) => /^raci-cell--(blank|allow|deny)$/.test(c))
        ?.replace("raci-cell--", "") ?? "?");

describe.each(["comfortable", "compact"] as const)("state boxes in %s density", (density) => {
  it("covers every state: allow, deny, blank and blank included", () => {
    renderEditor(density);
    expect(new Set(cells().map(stateOf))).toEqual(new Set(["allow", "blank", "deny", "included"]));
  });

  it("gives every state the same box classes and no inline size", () => {
    renderEditor(density);
    const boxes = new Set(
      cells().map((c) =>
        c.className
          .split(/\s+/)
          .filter((x) => !STATE.test(x))
          .join(" "),
      ),
    );
    expect([...boxes]).toEqual(["raci-cell"]);
    for (const c of cells()) {
      expect(c.getAttribute("style")).toBeNull();
      for (const el of c.querySelectorAll("*")) expect(el.getAttribute("style")).toBeNull();
    }
  });

  it("renders one primary line and one reserved secondary line in every state", () => {
    renderEditor(density);
    const shape = new Set<string>();
    for (const c of cells()) {
      shape.add(Array.from(c.children, (k) => k.className.split(" ")[0]).join(","));
      const [primary, secondary] = Array.from(c.children) as HTMLElement[];
      expect(primary).toHaveClass("raci-cell__primary");
      expect(secondary).toHaveClass("raci-cell__secondary");
      expect(primary!.querySelectorAll("svg")).toHaveLength(1);
      expect(primary!.querySelectorAll(".raci-cell__text")).toHaveLength(1);
      // the primary line holds only the short state word, never the long text
      expect(primary!.textContent).toMatch(/^(Allow|Deny|Not set)$/);
      expect(c.querySelectorAll("svg")).toHaveLength(1);
    }
    expect([...shape]).toEqual(["raci-cell__primary,raci-cell__secondary"]);
  });

  it("keeps the long text in the secondary line, the title and the aria-label", () => {
    renderEditor(density);
    for (const c of cells()) {
      const secondary = c.querySelector(".raci-cell__secondary") as HTMLElement;
      const included = c.classList.contains("raci-cell--included");
      expect(secondary.textContent).toBe("included");
      expect(secondary.classList.contains("raci-cell__secondary--off")).toBe(!included);
      expect(c.getAttribute("aria-label")).toBeTruthy();
      expect(c.getAttribute("title")).toBeTruthy();
      if (included) {
        expect(c.getAttribute("title")).toMatch(/^Included by /);
        expect(c.getAttribute("aria-label")).toMatch(/included by /);
      }
    }
  });
});

describe("stylesheet fixes one size for every state", () => {
  const css = readFileSync("src/styles/editor.css", "utf8");
  const rule = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf("}", start));
  };
  const decl = (body: string, prop: string): string | undefined =>
    new RegExp(`(?:^|[\\s;{])${prop}:\\s*([^;]+);`).exec(body)?.[1]?.trim();

  it("defines the cell width and height once per density", () => {
    const base = rule(".raci-editor");
    expect(decl(base, "--raci-cell-width")).toBeDefined();
    expect(decl(base, "--raci-cell-height")).toBeDefined();
    const compact = rule(".raci-editor--compact");
    expect(decl(compact, "--raci-cell-width")).toBeDefined();
    expect(decl(compact, "--raci-cell-height")).toBeDefined();
    // defined in no other rule
    expect(css.match(/--raci-cell-width:/g)).toHaveLength(2);
    expect(css.match(/--raci-cell-height:/g)).toHaveLength(2);
  });

  it("sizes the cell from those properties with width and height, not min-", () => {
    const cell = rule(".raci-editor .raci-cell");
    expect(decl(cell, "width")).toBe("var(--raci-cell-width)");
    expect(decl(cell, "height")).toBe("var(--raci-cell-height)");
    expect(decl(cell, "min-width")).toBeUndefined();
    expect(decl(cell, "min-height")).toBeUndefined();
    expect(decl(cell, "overflow")).toBe("hidden");
    expect(rule(".raci-editor--compact .raci-cell")).not.toMatch(/(?:^|[\s;{])(?:min-)?height:/);
    expect(rule(".raci-editor .raci-cell__text")).toMatch(/text-overflow: ellipsis/);
    expect(rule(".raci-editor .raci-cell__secondary")).toMatch(/text-overflow: ellipsis/);
  });

  it("sets no size property in any state class", () => {
    const SIZE =
      /(?:^|[\s;{])(width|height|min-width|max-width|min-height|max-height|padding[\w-]*|margin[\w-]*|border-width|border:|font-size|font|line-height|gap|display|flex[\w-]*)\s*:/;
    for (const s of [
      ".raci-cell--blank",
      ".raci-cell--allow",
      ".raci-cell--deny",
      ".raci-cell--included",
      ".raci-cell--inherited",
    ]) {
      if (css.includes(`.raci-editor ${s} {`)) {
        expect(rule(`.raci-editor ${s}`), s).not.toMatch(SIZE);
      }
    }
  });

  it("contains the absolutely positioned hidden text inside the scroll area", () => {
    // Without a positioned scroll area the hidden header text is placed against the page body, at
    // the table's far edge, and widens the whole page on a narrow screen (issue 21).
    expect(css).toMatch(/\.raci-visually-hidden \{[^}]*position: absolute/);
    expect(decl(rule(".raci-editor__scroll"), "position")).toBe("relative");
  });
});
