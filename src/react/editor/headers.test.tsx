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
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RaciConfig, RaciSettings, RuleSet } from "@/core/types";
import { RulesEditor } from "@/react/editor/RulesEditor";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const config = (extra: Partial<RaciConfig> = {}): RaciConfig => ({
  actions: [
    { id: "r", label: "Read", shortLabel: "R", description: "See the content" },
    { id: "a", label: "Author", shortLabel: "A", implies: ["r"] },
    { id: "m", label: "Manage", shortLabel: "M", implies: ["a", "r"] },
    { id: "apv", label: "Approve", shortLabel: "APV", kind: "obligation" },
    { id: "ack", label: "Acknowledge", shortLabel: "ACK", kind: "obligation" },
  ],
  subjectKinds: [],
  resources: [{ id: "docs", label: "Documents" }],
  ...extra,
});

const ruleSet: RuleSet = {
  categories: {
    docs: {
      entries: [
        { subject: "everyone:*", action: "ack", effect: "allow" },
        { subject: "user:bob", action: "r", effect: "allow" },
      ],
    },
  },
  parents: {},
};

const show = (
  cfg: RaciConfig,
  props: { headerMode?: "full" | "short" | "auto"; settings?: Partial<RaciSettings> } = {},
) =>
  render(
    <RulesEditor config={cfg} ruleSet={ruleSet} categoryId="docs" onChange={() => {}} {...props} />,
  );

const heads = () =>
  Array.from(document.querySelectorAll<HTMLElement>("thead tr:last-child th[scope=col]")).map(
    (th) => th.textContent?.trim() ?? "",
  );

describe("headerMode", () => {
  it("shows the full label by default (auto, comfortable, wide)", () => {
    show(config());
    expect(heads().slice(1, 6)).toEqual(["Read", "Author", "Manage", "Approve", "Acknowledge"]);
  });

  it("short shows the short labels, with the full label as name and tooltip", () => {
    show(config(), { headerMode: "short" });
    expect(heads().slice(1, 6)).toEqual(["R", "A", "M", "APV", "ACK"]);
    const th = screen.getByRole("columnheader", { name: "Acknowledge" });
    expect(th).toHaveTextContent("ACK");
    expect(th).toHaveAttribute("title", "Acknowledge");
    expect(screen.getByRole("columnheader", { name: "Read" })).toHaveAttribute(
      "title",
      "Read: See the content",
    );
  });

  it("full keeps the full label even at compact density", () => {
    show(config(), { headerMode: "full", settings: { density: "compact" } });
    expect(heads()[1]).toBe("Read");
  });

  it("auto uses short labels at compact density", () => {
    show(config(), { headerMode: "auto", settings: { density: "compact" } });
    expect(heads().slice(1, 3)).toEqual(["R", "A"]);
  });

  it("auto uses short labels when the grid is narrow", () => {
    let notify: (width: number) => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: (e: { contentRect: { width: number } }[]) => void) {
          notify = (width) => cb([{ contentRect: { width } }]);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    show(config());
    expect(heads()[1]).toBe("Read");
    act(() => notify(300));
    expect(heads()[1]).toBe("R");
    act(() => notify(1200));
    expect(heads()[1]).toBe("Read");
  });

  it("an action with no short label keeps its label in every mode", () => {
    const cfg = config();
    cfg.actions[0] = { id: "r", label: "Read" };
    show(cfg, { headerMode: "short" });
    expect(heads()[1]).toBe("Read");
  });

  it("cells keep naming the action in full", () => {
    show(config(), { headerMode: "short" });
    expect(screen.getByRole("button", { name: "user:bob, Read: allow" })).toBeInTheDocument();
  });

  it("works with host ids and labels of any kind", () => {
    const cfg: RaciConfig = {
      actions: [
        { id: "x1", label: "Open the gate", shortLabel: "OG" },
        { id: "x2", label: "Close the gate", shortLabel: "CG", implies: ["x1"] },
      ],
      subjectKinds: [],
      resources: [{ id: "docs", label: "Documents" }],
    };
    show(cfg, { headerMode: "short" });
    expect(heads().slice(1, 3)).toEqual(["OG", "CG"]);
    expect(screen.getByRole("columnheader", { name: "Close the gate" })).toBeInTheDocument();
  });
});

describe("grouped columns", () => {
  const groupHeads = () =>
    Array.from(document.querySelectorAll<HTMLElement>("thead tr:first-child th")).map((th) => ({
      text: th.textContent?.trim() ?? "",
      span: th.getAttribute("colspan"),
    }));

  it("groups access and obligation columns under two headings", () => {
    show(config());
    const g = groupHeads().filter((h) => h.text);
    expect(g).toEqual([
      { text: "Access", span: "3" },
      { text: "Obligations", span: "2" },
    ]);
    expect(document.querySelectorAll("thead tr")).toHaveLength(2);
  });

  it("the group headings are host labels, from config.kindLabels or strings", () => {
    show(config({ kindLabels: { access: "Can do", obligation: "Must do" } }));
    expect(groupHeads().map((h) => h.text)).toEqual(expect.arrayContaining(["Can do", "Must do"]));
    cleanup();
    show(config({ strings: { "editor.group.obligation": "Duties" } }));
    expect(groupHeads().map((h) => h.text)).toEqual(expect.arrayContaining(["Access", "Duties"]));
  });

  it("puts access columns first, whatever the order they were listed in", () => {
    const cfg = config();
    cfg.actions = [cfg.actions[3]!, cfg.actions[0]!, cfg.actions[4]!, cfg.actions[1]!];
    show(cfg, { headerMode: "short" });
    expect(heads().slice(1, 5)).toEqual(["R", "A", "APV", "ACK"]);
  });

  it("draws no heading row when every action has the same kind", () => {
    const cfg = config();
    cfg.actions = cfg.actions.slice(0, 3);
    show(cfg);
    expect(document.querySelectorAll("thead tr")).toHaveLength(1);
    cleanup();
    const plain = config();
    plain.actions = plain.actions.map(({ kind: _kind, ...a }) => a);
    show(plain);
    expect(document.querySelectorAll("thead tr")).toHaveLength(1);
  });

  it("every header cell still belongs to the table's own header", () => {
    show(config());
    const table = document.querySelector("table") as HTMLElement;
    expect(within(table).getAllByRole("columnheader").length).toBeGreaterThanOrEqual(7);
  });
});

describe("the built-in everyone subject", () => {
  it("is labelled from a string, not shown as its id", () => {
    show(config());
    expect(screen.getByRole("rowheader", { name: "Everyone" })).toBeInTheDocument();
    cleanup();
    show(config({ strings: { "editor.everyone": "All callers" } }));
    expect(screen.getByRole("rowheader", { name: "All callers" })).toBeInTheDocument();
  });
});

describe("headings are consistent across the grid and the inherited tables", () => {
  const withParent = (): RuleSet => ({
    categories: {
      docs: ruleSet.categories.docs!,
      parent: { entries: [{ subject: "user:zed", action: "r", effect: "allow" }] },
    },
    parents: { docs: "parent" },
  });
  const showInherited = (headerMode: "full" | "short" | "auto" = "full") =>
    render(
      <RulesEditor
        config={config()}
        ruleSet={withParent()}
        categoryId="docs"
        onChange={() => {}}
        headerMode={headerMode}
      />,
    );
  const tables = () => Array.from(document.querySelectorAll<HTMLElement>("table.raci-table"));

  it("gives every table the same group headings, in the same order", () => {
    showInherited();
    const groups = tables().map((t) =>
      Array.from(t.querySelectorAll("thead .raci-table__group")).map((g) => [
        g.textContent,
        g.getAttribute("colspan"),
      ]),
    );
    expect(groups).toHaveLength(2);
    for (const g of groups) {
      expect(g).toEqual([
        ["Access", "3"],
        ["Obligations", "2"],
      ]);
    }
  });

  it("gives the inherited headings a tooltip and the full name when short", () => {
    showInherited("short");
    const inherited = document.querySelector("table.raci-table--inherited") as HTMLElement;
    const ths = Array.from(inherited.querySelectorAll("thead tr:last-child th[scope=col]")).slice(
      1,
      6,
    );
    expect(ths.map((t) => t.textContent)).toEqual(["R", "A", "M", "APV", "ACK"]);
    expect(ths.map((t) => t.getAttribute("title"))).toEqual([
      "Read: See the content",
      "Author",
      "Manage",
      "Approve",
      "Acknowledge",
    ]);
    expect(ths.map((t) => t.getAttribute("aria-label"))).toEqual([
      "Read",
      "Author",
      "Manage",
      "Approve",
      "Acknowledge",
    ]);
  });

  it("marks where the second group starts, in every table's headings", () => {
    showInherited();
    for (const t of tables()) {
      const starts = Array.from(t.querySelectorAll("thead .raci-col-group-start"));
      expect(starts).toHaveLength(2);
      expect(starts.map((s) => s.textContent)).toEqual(["Obligations", "Approve"]);
    }
  });

  it("styles the group row's corner cells like the heading row", () => {
    showInherited();
    const corners = document.querySelectorAll(
      "table.raci-table:not(.raci-table--inherited) thead .raci-table__corner",
    );
    expect(corners).toHaveLength(2);
  });
});

describe("the key for short headings", () => {
  it("is shown with short labels, naming each one in full", () => {
    show(config(), { headerMode: "short" });
    const key = document.querySelector(".raci-editor__key") as HTMLElement;
    expect(key).not.toBeNull();
    expect(key.textContent).toBe(
      "Key: Access: R Read, A Author, M Manage; Obligations: APV Approve, ACK Acknowledge",
    );
  });
  it("is not shown with full labels, or when no action has a short label", () => {
    show(config(), { headerMode: "full" });
    expect(document.querySelector(".raci-editor__key")).toBeNull();
    cleanup();
    const cfg = config();
    cfg.actions = cfg.actions.map(({ shortLabel: _s, ...a }) => a);
    show(cfg, { headerMode: "short" });
    expect(document.querySelector(".raci-editor__key")).toBeNull();
  });
  it("follows auto: shown at compact density", () => {
    show(config(), { settings: { density: "compact" } });
    expect(document.querySelector(".raci-editor__key")).not.toBeNull();
  });
});

describe("stylesheet: the group row reads as part of the header", () => {
  it("gives the corner cells the heading background and the groups a divider and an underline", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles/editor.css", "utf8");
    const rule = (sel: string) => {
      const i = css.indexOf(`${sel} {`);
      expect(i, sel).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf("}", i));
    };
    expect(rule(".raci-editor .raci-table__corner")).toMatch(/background/);
    expect(rule(".raci-editor .raci-table__group")).toMatch(/border-bottom:\s*2px/);
    expect(rule(".raci-editor .raci-col-group-start")).toMatch(/border-inline-start/);
  });
});

describe("host-configured groups", () => {
  // Read, Author and Approve are permissions; Manage and Acknowledge are obligations.
  const groupConfig = (extra: Partial<RaciConfig> = {}): RaciConfig => ({
    actions: [
      { id: "r", label: "Read", shortLabel: "R", group: "perm" },
      { id: "a", label: "Author", shortLabel: "A", group: "perm", implies: ["r"] },
      { id: "m", label: "Manage", shortLabel: "M", group: "duty", implies: ["a", "r"] },
      { id: "apv", label: "Approve", shortLabel: "APV", group: "perm", implies: ["r"] },
      { id: "ack", label: "Acknowledge", shortLabel: "ACK", group: "duty" },
    ],
    subjectKinds: [],
    resources: [{ id: "docs", label: "Documents" }],
    groups: [
      { id: "perm", label: "Permissions" },
      { id: "duty", label: "Obligations" },
    ],
    ...extra,
  });
  const main = () =>
    document.querySelector("table.raci-table:not(.raci-table--inherited)") as HTMLElement;
  const headings = () =>
    Array.from(main().querySelectorAll("thead .raci-table__group")).map((g) => [
      g.textContent,
      g.getAttribute("colspan"),
    ]);
  const columns = () =>
    Array.from(main().querySelectorAll("thead tr:last-child th[scope=col]"))
      .slice(1, 6)
      .map((t) => t.textContent);

  it("groups the columns by the host's group ids, in the host's order and labels", () => {
    show(groupConfig(), { headerMode: "short" });
    expect(headings()).toEqual([
      ["Permissions", "3"],
      ["Obligations", "2"],
    ]);
    expect(columns()).toEqual(["R", "A", "APV", "M", "ACK"]);
  });

  it("names the groups whatever the host calls them", () => {
    show(
      groupConfig({
        groups: [
          { id: "perm", label: "Can do" },
          { id: "duty", label: "Must do" },
        ],
      }),
    );
    expect(headings().map((h) => h[0])).toEqual(["Can do", "Must do"]);
  });

  it("takes a label for a group with none from kindLabels or strings, else shows its id", () => {
    show(groupConfig({ groups: undefined }));
    expect(headings().map((h) => h[0])).toEqual(["perm", "duty"]);
    cleanup();
    show(groupConfig({ groups: undefined, kindLabels: { perm: "Rights" } as never }));
    expect(headings().map((h) => h[0])).toEqual(["Rights", "duty"]);
  });

  it("a group id wins over kind, and kind still groups when there is no group id", () => {
    const cfg = groupConfig();
    cfg.actions[0] = { ...cfg.actions[0]!, kind: "obligation" };
    show(cfg);
    expect(headings()[0]).toEqual(["Permissions", "3"]);
    cleanup();
    show(config()); // kind only: the default words
    expect(headings().map((h) => h[0])).toEqual(["Access", "Obligations"]);
  });

  it("supports three groups, with a divider before each group after the first", () => {
    const cfg = groupConfig({
      groups: [
        { id: "perm", label: "Permissions" },
        { id: "duty", label: "Obligations" },
        { id: "more", label: "Other" },
      ],
    });
    cfg.actions[4] = { ...cfg.actions[4]!, group: "more" };
    show(cfg);
    expect(headings()).toEqual([
      ["Permissions", "3"],
      ["Obligations", "1"],
      ["Other", "1"],
    ]);
    const starts = Array.from(main().querySelectorAll("thead .raci-col-group-start")).map(
      (s) => s.textContent,
    );
    expect(starts).toEqual(["Obligations", "Other", "Manage", "Acknowledge"]);
  });

  it("gives the inherited tables and the key the same groups", () => {
    render(
      <RulesEditor
        config={groupConfig()}
        ruleSet={{
          categories: {
            docs: { entries: [] },
            parent: { entries: [{ subject: "user:z", action: "r", effect: "allow" }] },
          },
          parents: { docs: "parent" },
        }}
        categoryId="docs"
        onChange={() => {}}
        headerMode="short"
      />,
    );
    const inherited = document.querySelector("table.raci-table--inherited") as HTMLElement;
    expect(
      Array.from(inherited.querySelectorAll("thead .raci-table__group")).map((g) => g.textContent),
    ).toEqual(["Permissions", "Obligations"]);
    expect(document.querySelector(".raci-editor__key")?.textContent).toBe(
      "Key: Permissions: R Read, A Author, APV Approve; Obligations: M Manage, ACK Acknowledge",
    );
  });

  it("draws no heading row when every action is in the same group", () => {
    const cfg = groupConfig();
    cfg.actions = cfg.actions.map((a) => ({ ...a, group: "perm" }));
    show(cfg);
    expect(document.querySelectorAll("thead tr")).toHaveLength(1);
  });
});
