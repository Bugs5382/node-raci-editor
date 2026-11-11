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
