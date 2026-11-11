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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RaciConfig, RuleSet } from "@/core/types";
import { RulesEditor } from "@/react/editor/RulesEditor";
import type { RenderCellProps } from "@/react/editor/RulesEditor";

afterEach(cleanup);

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

const inheritedSet: RuleSet = {
  categories: {
    docs: { entries: [{ subject: "user:bob", action: "view", effect: "allow" }] },
    parent: { entries: [{ subject: "user:zed", action: "view", effect: "deny" }] },
  },
  parents: { docs: "parent" },
};

const cells = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>("tbody button.raci-cell"));
const labels = (): (string | null)[] => cells().map((c) => c.getAttribute("aria-label"));

describe("cellVariant", () => {
  it("is the box by default, with no marks classes", () => {
    render(<RulesEditor config={config} ruleSet={ruleSet} categoryId="docs" onChange={() => {}} />);
    expect(cells().length).toBe(6);
    for (const c of cells()) expect(c.className).not.toMatch(/raci-cell--marks/);
    expect(cells()[0]!.querySelector(".raci-cell__text")).not.toBeNull();
  });

  it("marks: a check, an X or nothing, with the same labels and titles as the box", () => {
    const box = render(
      <RulesEditor config={config} ruleSet={ruleSet} categoryId="docs" onChange={() => {}} />,
    );
    const boxLabels = labels();
    const boxTitles = cells().map((c) => c.getAttribute("title"));
    box.unmount();
    render(
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="docs"
        onChange={() => {}}
        cellVariant="marks"
      />,
    );
    expect(labels()).toEqual(boxLabels);
    expect(cells().map((c) => c.getAttribute("title"))).toEqual(boxTitles);
    for (const c of cells()) {
      expect(c).toHaveClass("raci-cell", "raci-cell--marks");
      expect(c.querySelector(".raci-cell__text")).toBeNull();
      expect(c.querySelector(".raci-cell__secondary")).toBeNull();
      const marks = c.querySelectorAll("svg");
      const state = /allow|deny/.exec(c.getAttribute("aria-label") ?? "")?.[0];
      const included = c.classList.contains("raci-cell--included");
      expect(marks.length).toBe(state || included ? 1 : 0);
      expect((c.textContent ?? "").trim()).toBe("");
    }
  });

  it("marks: an included cell shows a dimmed check and says included in its label", () => {
    render(
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="docs"
        onChange={() => {}}
        cellVariant="marks"
      />,
    );
    const included = cells().filter((c) => c.classList.contains("raci-cell--included"));
    expect(included.length).toBe(2);
    for (const c of included) {
      expect(c.getAttribute("aria-label")).toMatch(/included by /);
      expect(c.getAttribute("title")).toMatch(/^Included by /);
      expect(c.querySelector("svg")).not.toBeNull();
    }
  });

  it("marks: a click cycles not set, allow, deny, not set, like the box", async () => {
    const onChange = vi.fn();
    render(
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="docs"
        onChange={onChange}
        cellVariant="marks"
      />,
    );
    const bob = (name: string) => screen.getByRole("button", { name: `user:bob, ${name}` });
    await userEvent.click(bob("Approve: not set"));
    expect(onChange.mock.calls[0]![0].categories.docs.entries).toContainEqual({
      subject: "user:bob",
      action: "approve",
      effect: "allow",
    });
    await userEvent.click(bob("View: allow"));
    expect(onChange.mock.calls[1]![0].categories.docs.entries).toContainEqual({
      subject: "user:bob",
      action: "view",
      effect: "deny",
    });
    await userEvent.click(bob("Review: deny"));
    expect(
      onChange.mock.calls[2]![0].categories.docs.entries.some(
        (e: { subject: string; action: string }) =>
          e.subject === "user:bob" && e.action === "review",
      ),
    ).toBe(false);
  });

  it("marks: keyboard works like the box (Enter and Space on a focused button)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="docs"
        onChange={onChange}
        cellVariant="marks"
      />,
    );
    const first = cells()[0]!;
    expect(first.tagName).toBe("BUTTON");
    first.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("marks: read-only disables every cell, as the box does", () => {
    render(
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="docs"
        onChange={() => {}}
        cellVariant="marks"
        readOnly
      />,
    );
    for (const c of cells()) expect(c).toBeDisabled();
  });

  it("marks: inherited rows draw dimmed marks and keep the label", () => {
    render(
      <RulesEditor
        config={config}
        ruleSet={inheritedSet}
        categoryId="docs"
        onChange={() => {}}
        cellVariant="marks"
      />,
    );
    const inherited = Array.from(
      document.querySelectorAll<HTMLElement>(".raci-table--inherited .raci-cell"),
    );
    expect(inherited.length).toBeGreaterThan(0);
    for (const c of inherited) {
      expect(c).toHaveClass("raci-cell--marks", "raci-cell--inherited");
      expect(c.getAttribute("role")).toBe("img");
      expect(c.getAttribute("aria-label")).toMatch(/deny|allow|not set/);
    }
  });
});

describe("renderCell", () => {
  const seen: RenderCellProps[] = [];
  const renderCell = (p: RenderCellProps) => {
    seen.push(p);
    return (
      <button
        type="button"
        data-testid="mine"
        data-state={p.state}
        data-inherited={String(p.inherited)}
        aria-label={p.label}
        style={{ width: p.size.width, height: p.size.height }}
        disabled={p.readOnly}
        onClick={p.onCycle}
      >
        {p.state}
      </button>
    );
  };

  it("replaces every cell with the host's node", () => {
    seen.length = 0;
    render(
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="docs"
        onChange={() => {}}
        renderCell={renderCell}
      />,
    );
    expect(document.querySelectorAll("tbody .raci-cell").length).toBe(0);
    expect(screen.getAllByTestId("mine")).toHaveLength(6);
  });

  it("passes state, inherited flag, action, subject, label and the size tokens", () => {
    seen.length = 0;
    render(
      <RulesEditor
        config={config}
        ruleSet={inheritedSet}
        categoryId="docs"
        onChange={() => {}}
        renderCell={renderCell}
      />,
    );
    const bobView = seen.find((p) => p.subject === "user:bob" && p.action.id === "view")!;
    expect(bobView.state).toBe("allow");
    expect(bobView.inherited).toBe(false);
    expect(bobView.action.label).toBe("View");
    expect(bobView.size).toEqual({
      width: "var(--raci-cell-width)",
      height: "var(--raci-cell-height)",
    });
    expect(bobView.label).toMatch(/allow/);
    const zed = seen.find((p) => p.subject === "user:zed" && p.action.id === "view")!;
    expect(zed.inherited).toBe(true);
    expect(zed.state).toBe("deny");
    expect(zed.readOnly).toBe(true);
  });

  it("marks a blank cell that another allow includes", () => {
    seen.length = 0;
    render(
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="docs"
        onChange={() => {}}
        renderCell={renderCell}
      />,
    );
    const aliceView = seen.find((p) => p.subject === "user:alice" && p.action.id === "view")!;
    expect(aliceView.state).toBe("blank");
    expect(aliceView.includedBy?.id).toBe("approve");
  });

  it("onCycle and onChange edit the rule set the same way a built-in cell does", () => {
    seen.length = 0;
    const onChange = vi.fn();
    render(
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="docs"
        onChange={onChange}
        renderCell={renderCell}
      />,
    );
    const bobApprove = seen.find((p) => p.subject === "user:bob" && p.action.id === "approve")!;
    bobApprove.onCycle();
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as RuleSet;
    expect(next.categories.docs!.entries).toContainEqual({
      subject: "user:bob",
      action: "approve",
      effect: "allow",
    });
    bobApprove.onChange("deny");
    const next2 = onChange.mock.calls[1]![0] as RuleSet;
    expect(next2.categories.docs!.entries).toContainEqual({
      subject: "user:bob",
      action: "approve",
      effect: "deny",
    });
    bobApprove.onChange(undefined);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("wins over cellVariant", () => {
    render(
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="docs"
        onChange={() => {}}
        cellVariant="marks"
        renderCell={renderCell}
      />,
    );
    expect(screen.getAllByTestId("mine")).toHaveLength(6);
    fireEvent.click(screen.getAllByTestId("mine")[0]!);
  });
});

describe("stylesheet: marks keep the fixed size", () => {
  const css = readFileSync("src/styles/editor.css", "utf8");
  const rule = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf("}", start));
  };
  it("sets no size of its own and has no box chrome", () => {
    const marks = rule(".raci-editor .raci-cell--marks");
    expect(marks).not.toMatch(/(?:^|[\s;{])(width|height|min-width|min-height|padding[\w-]*)\s*:/);
    expect(marks).toMatch(/background:\s*transparent/);
    expect(marks).toMatch(/border-color:\s*transparent/);
  });
  it("keeps the mark centred", () => {
    const mark = rule(".raci-editor .raci-cell--marks");
    expect(mark).toMatch(/justify-content:\s*center/);
    expect(mark).toMatch(/align-items:\s*center/);
  });
  it("dims an included mark", () => {
    expect(rule(".raci-editor .raci-cell--marks.raci-cell--included")).toMatch(/opacity/);
  });
});
