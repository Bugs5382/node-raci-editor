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
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RaciConfig, RaciSettings, RuleSet } from "@/core/types";
import { RulesEditor } from "@/react/editor/RulesEditor";

afterEach(cleanup);

const base: RaciConfig = {
  actions: [
    { id: "view", label: "View" },
    { id: "edit", label: "Edit", implies: ["view"] },
  ],
  subjectKinds: [],
  resources: [{ id: "docs", label: "Documents" }],
};

// alice: edit allow -> view blank and included; bob: view allow, edit deny; parent: zed view allow, yan edit deny.
const ruleSet: RuleSet = {
  categories: {
    docs: {
      entries: [
        { subject: "user:alice", action: "edit", effect: "allow" },
        { subject: "user:bob", action: "view", effect: "allow" },
        { subject: "user:bob", action: "edit", effect: "deny" },
      ],
    },
    parent: {
      entries: [
        { subject: "user:zed", action: "view", effect: "allow" },
        { subject: "user:yan", action: "view", effect: "deny" },
      ],
    },
  },
  parents: { docs: "parent" },
};

const show = (config: RaciConfig, settings: Partial<RaciSettings> = {}) =>
  render(
    <RulesEditor
      config={config}
      ruleSet={ruleSet}
      categoryId="docs"
      onChange={() => {}}
      settings={settings}
    />,
  );

const cell = (name: string): HTMLElement => {
  const all = Array.from(document.querySelectorAll<HTMLElement>(".raci-cell"));
  const found = all.find((c) => c.getAttribute("aria-label")?.startsWith(name));
  if (!found) throw new Error(`no cell ${name}`);
  return found;
};

describe("default look is unchanged", () => {
  it("adds no inline style, glyph class or root size without any setting", () => {
    show(base);
    for (const c of document.querySelectorAll<HTMLElement>("tbody .raci-cell")) {
      expect(c.getAttribute("style")).toBeNull();
    }
    expect(document.querySelector(".raci-editor")!.getAttribute("style")).toBeNull();
    expect(cell("user:bob, View").querySelector(".raci-cell__text")).toHaveTextContent("Allow");
  });
});

describe("config.cellStates", () => {
  const config: RaciConfig = {
    ...base,
    cellStates: {
      allow: {
        glyph: "Y",
        text: "Yes",
        label: "yes",
        tooltip: "Allowed",
        colors: { fg: "#064", bg: "#cfc", border: "#0a0" },
        shape: { radius: "50%", borderStyle: "dashed", borderWidth: "2px" },
        className: "host-allow",
      },
      deny: { glyph: () => <b data-testid="no">N</b>, text: "" },
      none: { glyph: "" },
      included: { glyph: "+", text: "via" },
      inheritedAllow: { glyph: "ia" },
      inheritedDeny: { glyph: "id", colors: { fg: "#900" } },
    },
  };

  it("draws a custom glyph, word, colours, shape and class", () => {
    show(config);
    const c = cell("user:bob, View");
    expect(c).toHaveClass("host-allow");
    expect(c.querySelector(".raci-cell__glyph")).toHaveTextContent("Y");
    expect(c.querySelector(".raci-cell__text")).toHaveTextContent("Yes");
    expect(c.style.color).toBe("rgb(0, 102, 68)");
    expect(c.style.backgroundColor).toBe("rgb(204, 255, 204)");
    expect(c.style.borderColor).toBe("rgb(0, 170, 0)");
    expect(c.style.borderRadius).toBe("50%");
    expect(c.style.borderStyle).toBe("dashed");
    expect(c.style.borderWidth).toBe("2px");
  });

  it("uses the state's label and tooltip for the accessible name and title", () => {
    show(config);
    const c = cell("user:bob, View");
    expect(c.getAttribute("aria-label")).toBe("user:bob, View: yes");
    expect(c).toHaveAttribute("title", "Allowed");
  });

  it("takes an icon from a render function and can hide the word or the glyph", () => {
    show(config);
    const d = cell("user:bob, Edit");
    expect(d.querySelector("[data-testid=no]")).not.toBeNull();
    expect(d.querySelector(".raci-cell__text")).toHaveTextContent("");
    const n = cell("user:alice, View");
    expect(n.querySelector(".raci-cell__glyph")).toHaveTextContent("+");
    expect(n.querySelector(".raci-cell__text")).toHaveTextContent("via");
    expect(cell("user:alice, Edit").className).toContain("raci-cell--allow");
  });

  it("styles an empty cell with the none state and inherited cells with theirs", () => {
    show(config);
    const none = cell("user:bob, Edit");
    expect(none).toBeDefined();
    const inherited = Array.from(
      document.querySelectorAll<HTMLElement>(".raci-table--inherited .raci-cell"),
    );
    const texts = inherited.map((c) => c.querySelector(".raci-cell__glyph")?.textContent);
    expect(texts).toContain("ia");
    expect(texts).toContain("id");
    const denied = inherited.find(
      (c) => c.querySelector(".raci-cell__glyph")?.textContent === "id",
    )!;
    expect(denied.style.color).toBe("rgb(153, 0, 0)");
  });

  it("keeps the markup that fixes the size and centring, whatever the content", () => {
    show({
      ...base,
      cellStates: { allow: { glyph: "WWWW", text: "A very long word that cannot fit in the box" } },
    });
    const c = cell("user:bob, View");
    expect(c.className.split(" ")[0]).toBe("raci-cell");
    expect(c.style.width).toBe("");
    expect(c.style.height).toBe("");
    expect(c.children).toHaveLength(2);
    expect(c.children[0]).toHaveClass("raci-cell__primary");
    expect(c.children[1]).toHaveClass("raci-cell__secondary");
  });
});

describe("settings.cells", () => {
  it("overrides the host's cellStates field by field", () => {
    show(
      { ...base, cellStates: { allow: { glyph: "Y", text: "Yes", colors: { fg: "#111" } } } },
      { cells: { states: { allow: { glyph: "OK", colors: { bg: "#eee" } } } } },
    );
    const c = cell("user:bob, View");
    expect(c.querySelector(".raci-cell__glyph")).toHaveTextContent("OK");
    expect(c.querySelector(".raci-cell__text")).toHaveTextContent("Yes");
    expect(c.style.color).toBe("rgb(17, 17, 17)");
    expect(c.style.backgroundColor).toBe("rgb(238, 238, 238)");
  });

  it("sets the cell size tokens on the editor root, never on a cell", () => {
    show(base, { cells: { size: { width: 48, height: 32 } } });
    const root = document.querySelector(".raci-editor") as HTMLElement;
    expect(root.style.getPropertyValue("--raci-cell-width")).toBe("48px");
    expect(root.style.getPropertyValue("--raci-cell-height")).toBe("32px");
    for (const c of document.querySelectorAll<HTMLElement>(".raci-cell")) {
      expect(c.style.width).toBe("");
      expect(c.style.height).toBe("");
    }
  });

  it("ignores invalid settings rather than drawing them", () => {
    show(base, {
      cells: { size: { width: 1, height: 1 }, states: { allow: { colors: { fg: "red; x:y" } } } },
    });
    const root = document.querySelector(".raci-editor") as HTMLElement;
    expect(root.getAttribute("style")).toBeNull();
    expect(cell("user:bob, View").getAttribute("style")).toBeNull();
  });
});
