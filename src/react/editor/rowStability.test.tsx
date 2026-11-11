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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { RaciConfig, RuleSet } from "@/core/types";
import { setCell } from "@/react/editor/model";
import { RulesEditor } from "@/react/editor/RulesEditor";

// jsdom does not lay anything out, so these tests pin the facts that decide layout: row identity,
// row order, which elements exist per state, and which classes and CSS declarations size the boxes.

const config: RaciConfig = {
  actions: [
    { id: "view", label: "View" },
    { id: "review", label: "Review", implies: ["view"] },
    { id: "approve", label: "Approve", implies: ["review"] },
  ],
  subjectKinds: [
    {
      kind: "user",
      label: "Users",
      search: (q) =>
        [
          { id: "user:bob", label: "Bob" },
          { id: "user:carol", label: "Carol" },
        ].filter((p) => p.label.toLowerCase().includes(q.toLowerCase())),
    },
  ],
  resources: [{ id: "docs", label: "Documents" }],
};

const initial = (): RuleSet => ({
  categories: {
    docs: {
      entries: [
        { subject: "user:alice", action: "view", effect: "allow" },
        { subject: "user:bob", action: "view", effect: "deny" },
        { subject: "user:carol", action: "review", effect: "allow" },
      ],
    },
  },
  parents: {},
});

const Harness = ({ start }: { start: RuleSet }) => {
  const [ruleSet, setRuleSet] = useState(start);
  return (
    <RulesEditor
      config={config}
      ruleSet={ruleSet}
      categoryId="docs"
      onChange={setRuleSet}
      settings={{ confirmDeny: false }}
    />
  );
};

const rowEls = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>("tbody tr[data-subject]"));
const order = (): string[] => rowEls().map((r) => r.getAttribute("data-subject") as string);
const cellsOf = (subject: string): HTMLElement[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(`tr[data-subject="${subject}"] button.raci-cell`),
  );

const STATE = /^raci-cell--(blank|allow|deny|included)$/;
const boxClasses = (el: Element): string =>
  el.className
    .split(/\s+/)
    .filter((c) => !STATE.test(c))
    .join(" ");

const addViaSearch = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  const box = screen.getByRole("combobox", { name: "Search" });
  await user.click(box);
  await user.type(box, text);
  await user.click(await screen.findByRole("option", { name: new RegExp(text) }));
};

const expectSameNodes = (nodes: HTMLElement[]) =>
  rowEls().forEach((row, i) => expect(row).toBe(nodes[i]));

describe("row identity and order when a cell changes", () => {
  it("keeps every row node and the row order through blank, allow, deny, blank on every cell", async () => {
    const user = userEvent.setup();
    render(<Harness start={initial()} />);
    const nodes = rowEls();
    const before = order();
    expect(before).toEqual(["user:alice", "user:bob", "user:carol"]);
    for (const subject of before) {
      for (let col = 0; col < 3; col++) {
        // three clicks walk the full cycle and return the cell to where it began
        for (let click = 0; click < 3; click++) {
          await user.click(cellsOf(subject)[col] as HTMLElement);
          expect(order()).toEqual(before);
          expectSameNodes(nodes);
        }
      }
    }
  });

  it("does not move a row when its only entry is removed or its first entry is added", async () => {
    const user = userEvent.setup();
    const two: RuleSet = {
      categories: {
        docs: {
          entries: [
            { subject: "user:alice", action: "view", effect: "allow" },
            { subject: "user:bob", action: "view", effect: "allow" },
          ],
        },
      },
      parents: {},
    };
    render(<Harness start={two} />);
    const nodes = rowEls();
    // allow -> deny -> blank removes alice's last entry
    await user.click(cellsOf("user:alice")[0] as HTMLElement);
    await user.click(cellsOf("user:alice")[0] as HTMLElement);
    expect(order()).toEqual(["user:alice", "user:bob"]);
    // and a first entry again
    await user.click(cellsOf("user:alice")[1] as HTMLElement);
    expect(order()).toEqual(["user:alice", "user:bob"]);
    expectSameNodes(nodes);
  });

  it("keeps added subjects where they were added when each gets its first entry", async () => {
    const user = userEvent.setup();
    const one: RuleSet = {
      categories: {
        docs: { entries: [{ subject: "user:alice", action: "view", effect: "allow" }] },
      },
      parents: {},
    };
    render(<Harness start={one} />);
    await addViaSearch(user, "Bob");
    await addViaSearch(user, "Carol");
    expect(order()).toEqual(["user:alice", "user:bob", "user:carol"]);
    const nodes = rowEls();
    // Carol gains an entry first, then Bob: neither may move
    await user.click(cellsOf("user:carol")[0] as HTMLElement);
    expect(order()).toEqual(["user:alice", "user:bob", "user:carol"]);
    await user.click(cellsOf("user:bob")[0] as HTMLElement);
    expect(order()).toEqual(["user:alice", "user:bob", "user:carol"]);
    // editing the oldest row again must not move it behind the others
    await user.click(cellsOf("user:alice")[1] as HTMLElement);
    expect(order()).toEqual(["user:alice", "user:bob", "user:carol"]);
    expectSameNodes(nodes);
  });

  it("keeps rows and nodes when stopInheriting is toggled", async () => {
    const user = userEvent.setup();
    render(<Harness start={initial()} />);
    const nodes = rowEls();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("checkbox"));
    expect(order()).toEqual(["user:alice", "user:bob", "user:carol"]);
    expectSameNodes(nodes);
  });
});

describe("setCell keeps entry positions", () => {
  it("replaces an entry in place and keeps the other subjects where they are", () => {
    const next = setCell(initial(), "docs", "user:alice", "view", "deny");
    expect(next.categories.docs!.entries.map((e) => e.subject)).toEqual([
      "user:alice",
      "user:bob",
      "user:carol",
    ]);
    expect(next.categories.docs!.entries[0]!.effect).toBe("deny");
  });
});

describe("reserved space in every state", () => {
  it("renders the hint slot in every cell, visible only for included cells", async () => {
    const user = userEvent.setup();
    render(<Harness start={initial()} />);
    const check = () => {
      for (const subject of order()) {
        for (const cell of cellsOf(subject)) {
          const hint = cell.querySelector(".raci-cell__secondary");
          expect(hint).not.toBeNull();
          const included = cell.classList.contains("raci-cell--included");
          expect(hint!.classList.contains("raci-cell__secondary--off")).toBe(!included);
          // same text in both states so the slot is the same size
          expect(hint!.textContent).toBe("included");
          expect(cell.querySelectorAll("svg").length).toBe(1);
          expect(cell.querySelector(".raci-cell__text")).not.toBeNull();
        }
      }
    };
    check();
    // allow Approve on alice (implies review and view), then step it through deny and blank
    await user.click(cellsOf("user:alice")[2] as HTMLElement);
    check();
    await user.click(cellsOf("user:alice")[2] as HTMLElement);
    check();
    await user.click(cellsOf("user:alice")[2] as HTMLElement);
    check();
  });

  it("gives every cell the same box classes in blank, allow, deny and included states", async () => {
    const user = userEvent.setup();
    render(<Harness start={initial()} />);
    const seen = new Set<string>();
    const states = new Set<string>();
    const record = () => {
      for (const subject of order()) {
        for (const cell of cellsOf(subject)) {
          seen.add(boxClasses(cell));
          for (const c of cell.classList) if (STATE.test(c)) states.add(c);
          // exactly one base state class, never a differently sized variant
          expect(
            Array.from(cell.classList).filter((c) => /^raci-cell--(blank|allow|deny)$/.test(c)),
          ).toHaveLength(1);
          expect(cell.getAttribute("style")).toBeNull();
        }
      }
    };
    record();
    await user.click(cellsOf("user:alice")[2] as HTMLElement); // allow approve: included hints
    record();
    await user.click(cellsOf("user:bob")[0] as HTMLElement); // blank
    record();
    await user.click(cellsOf("user:bob")[0] as HTMLElement); // allow
    record();
    await user.click(cellsOf("user:bob")[0] as HTMLElement); // deny
    record();
    expect([...states].sort()).toEqual([
      "raci-cell--allow",
      "raci-cell--blank",
      "raci-cell--deny",
      "raci-cell--included",
    ]);
    expect([...seen]).toEqual(["raci-cell"]);
  });
});

describe("stylesheet reserves the same box for every state", () => {
  const css = readFileSync("src/styles/editor.css", "utf8");
  const rule = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf("}", start));
  };
  const BOX =
    /(padding|margin|border-width|border:|min-height|height|width|line-height|display|gap)/;

  it("sets no box-affecting property in a state modifier", () => {
    for (const s of [".raci-cell--allow", ".raci-cell--deny", ".raci-cell--included"]) {
      expect(rule(`.raci-editor ${s}`)).not.toMatch(BOX);
    }
  });

  it("fixes the cell border width, line height, icon box and hint slot", () => {
    const cell = rule(".raci-editor .raci-cell");
    expect(cell).toMatch(/border: 1px solid/);
    expect(cell).toMatch(/line-height:/);
    expect(cell).toMatch(/\sheight:/);
    expect(rule(".raci-editor .raci-cell .raci-icon")).toMatch(/flex: none/);
    const hint = rule(".raci-editor .raci-cell__secondary");
    expect(hint).toMatch(/line-height:/);
    expect(hint).toMatch(/white-space: nowrap/);
    expect(rule(".raci-editor .raci-cell__secondary--off")).toMatch(/visibility: hidden/);
  });
});
