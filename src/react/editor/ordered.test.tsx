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
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrderedModel } from "@/core/models/ordered";
import { getModel } from "@/core/registry";
import type { RaciConfig, RuleSet, SubjectKind } from "@/core/types";
import { RulesEditor } from "@/react/editor/RulesEditor";
import type { RulesEditorProps } from "@/react/editor/RulesEditor";

afterEach(cleanup);

const names: Record<string, string> = {
  "user:alice": "Alice",
  "user:bob": "Bob",
  "user:cy": "Cy",
  "user:zed": "Zed",
  "group:ops": "Ops",
};

const kind = (name: string, label: string): SubjectKind => ({
  kind: name,
  label,
  search: (q) =>
    Object.entries(names)
      .filter(([id, l]) => id.startsWith(`${name}:`) && l.toLowerCase().includes(q.toLowerCase()))
      .map(([id, l]) => ({ id, label: l })),
  resolve: (s) => names[s],
});

const config: RaciConfig = {
  actions: [
    { id: "view", label: "View" },
    { id: "edit", label: "Edit", implies: ["view"] },
  ],
  subjectKinds: [kind("user", "People"), kind("group", "Teams")],
  resources: [{ id: "top", label: "Top", children: [{ id: "child", label: "Child" }] }],
};

const ruleSet = (): RuleSet => ({
  model: "ordered",
  parents: { child: "top" },
  categories: {
    top: {
      owners: ["user:zed"],
      entries: [
        { subject: "user:cy", action: "view", effect: "allow" },
        { subject: "group:ops", action: "view", effect: "deny" },
      ],
    },
    child: {
      owners: ["user:bob"],
      entries: [
        { subject: "user:alice", action: "view", effect: "allow" },
        { subject: "user:alice", action: "edit", effect: "deny" },
        { subject: "user:bob", action: "view", effect: "deny" },
      ],
    },
  },
});

const base = (extra: Partial<RulesEditorProps> = {}): RulesEditorProps => ({
  config,
  ruleSet: ruleSet(),
  categoryId: "child",
  onChange: () => {},
  ...extra,
});

const rowIds = () =>
  Array.from(document.querySelectorAll<HTMLElement>("tbody tr")).map(
    (tr) => `${tr.dataset.row}:${tr.dataset.subject}`,
  );
const btn = (name: string | RegExp) => screen.queryByRole("button", { name });
const addGroupRow = async (user: ReturnType<typeof userEvent.setup>) => {
  const picker = screen.getByRole("group", { name: "Add subject" });
  await user.selectOptions(within(picker).getByRole("combobox", { name: "Subject type" }), "group");
  await user.type(within(picker).getByRole("combobox", { name: "Search" }), "op");
  await user.click(await within(picker).findByRole("option", { name: /Ops/ }));
};
const last = <T,>(fn: { mock: { calls: T[][] } }): T => fn.mock.calls.at(-1)![0]!;
const subjectsOf = (set: RuleSet, cat = "child") => [
  ...new Set(set.categories[cat]!.entries.map((e) => e.subject)),
];

describe("the model prop", () => {
  it("defaults to the rule set's model, then to nearest", () => {
    const { unmount } = render(<RulesEditor {...base()} />);
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
    unmount();
    render(<RulesEditor {...base({ ruleSet: { ...ruleSet(), model: undefined } })} />);
    expect(screen.queryByRole("columnheader", { name: "#" })).toBeNull();
  });

  it("takes an id or a model object, and the prop wins over the rule set", () => {
    const { unmount } = render(<RulesEditor {...base({ model: "nearest" })} />);
    expect(screen.queryByRole("columnheader", { name: "#" })).toBeNull();
    unmount();
    render(
      <RulesEditor
        {...base({ ruleSet: { ...ruleSet(), model: undefined }, model: getModel("ordered") })}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
  });
});

describe("the nearest model draws nothing new", () => {
  it("has no rank column, move controls, legend or owners, and keeps stop inheriting", () => {
    render(<RulesEditor {...base({ model: "nearest" })} />);
    expect(screen.queryByRole("columnheader", { name: "#" })).toBeNull();
    expect(btn(/^Move /)).toBeNull();
    expect(btn(/^Reorder /)).toBeNull();
    expect(screen.queryByRole("list", { name: "Legend" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Owners" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Stop inheriting" })).toBeInTheDocument();
  });
});

describe("capabilities", () => {
  it("hides stop inheriting for ordered and shows it when the model asks", () => {
    const { unmount } = render(<RulesEditor {...base()} />);
    expect(screen.queryByRole("checkbox", { name: "Stop inheriting" })).toBeNull();
    unmount();
    const model = { ...getModel("ordered"), id: "x" };
    model.capabilities = { ...model.capabilities, stopInheriting: true };
    render(<RulesEditor {...base({ model })} />);
    expect(screen.getByRole("checkbox", { name: "Stop inheriting" })).toBeInTheDocument();
  });

  it("draws rank, move controls and legend only with ordering", () => {
    const model = { ...getModel("ordered"), id: "y" };
    model.capabilities = { ...model.capabilities, ordering: false };
    render(<RulesEditor {...base({ model })} />);
    expect(screen.queryByRole("columnheader", { name: "#" })).toBeNull();
    expect(btn(/^Move /)).toBeNull();
    expect(screen.queryByRole("list", { name: "Legend" })).toBeNull();
  });

  it("hides the owners block when there are no owner kinds or no owners capability", () => {
    const { unmount } = render(
      <RulesEditor {...base({ model: createOrderedModel({ id: "none", ownerKinds: [] }) })} />,
    );
    expect(screen.queryByRole("group", { name: "Owners" })).toBeNull();
    unmount();
    const model = { ...getModel("ordered"), id: "z" };
    model.capabilities = { ...model.capabilities, owners: false };
    render(<RulesEditor {...base({ model })} />);
    expect(screen.queryByRole("group", { name: "Owners" })).toBeNull();
  });
});

describe("the ordered grid", () => {
  it("numbers own rows, then inherited rows, in one grid", () => {
    render(<RulesEditor {...base()} />);
    expect(rowIds()).toEqual([
      "own:user:alice",
      "own:user:bob",
      "inherited:user:cy",
      "inherited:group:ops",
    ]);
    const ranks = Array.from(document.querySelectorAll("tbody .raci-table__rank")).map(
      (c) => c.textContent,
    );
    expect(ranks).toEqual(["1", "2", "3", "4"]);
    expect(document.querySelectorAll("table")).toHaveLength(1);
  });

  it("labels inherited rows from their category and makes them read-only", () => {
    render(<RulesEditor {...base()} />);
    const row = document.querySelector<HTMLElement>(
      'tr[data-row="inherited"][data-subject="user:cy"]',
    )!;
    expect(within(row).getByText("from Top")).toBeInTheDocument();
    expect(within(row).queryByRole("button")).toBeNull();
    expect(row.querySelectorAll(".raci-cell")).toHaveLength(2);
    expect(row.querySelector(".raci-cell--inherited")).not.toBeNull();
    expect(btn("Move Cy up")).toBeNull();
    expect(btn("Remove Cy")).toBeNull();
  });

  it("does not show inherited rows when the settings hide them", () => {
    render(<RulesEditor {...base({ settings: { showInherited: false } })} />);
    expect(rowIds()).toEqual(["own:user:alice", "own:user:bob"]);
  });

  it("lists the same subject again from the parent: own rows come first and decide", () => {
    const set = ruleSet();
    set.categories.top!.entries.push({ subject: "user:alice", action: "view", effect: "deny" });
    render(<RulesEditor {...base({ ruleSet: set })} />);
    expect(rowIds().filter((r) => r.endsWith("user:alice"))).toEqual([
      "own:user:alice",
      "inherited:user:alice",
    ]);
    const decision = getModel("ordered").evaluate({
      ruleSet: set,
      actions: config.actions,
      person: { subjects: ["user:alice"] },
      category: "child",
      action: "view",
    }).decision;
    expect(decision.allowed).toBe(true);
  });

  it("keeps the same box on every cell of every state", () => {
    render(<RulesEditor {...base()} />);
    const cells = Array.from(document.querySelectorAll("tbody .raci-cell"));
    expect(cells).toHaveLength(8);
    for (const cell of cells) {
      expect(cell.className).toMatch(/raci-cell--(allow|deny|blank)/);
      expect(cell.getAttribute("style")).toBeNull();
    }
    expect(document.querySelectorAll(".raci-cell--allow").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".raci-cell--deny").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".raci-cell--blank").length).toBeGreaterThan(0);
  });
});

describe("cells", () => {
  it("cycles empty, green, red, empty with one entry per subject and action", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RulesEditor {...base({ onChange, settings: { confirmDeny: false } })} />);
    await user.click(screen.getByRole("button", { name: "Bob, Edit: not set" }));
    expect(last<RuleSet>(onChange).categories.child!.entries).toContainEqual({
      subject: "user:bob",
      action: "edit",
      effect: "allow",
    });
    await user.click(screen.getByRole("button", { name: "Alice, View: allow" }));
    expect(last<RuleSet>(onChange).categories.child!.entries).toContainEqual({
      subject: "user:alice",
      action: "view",
      effect: "deny",
    });
    await user.click(screen.getByRole("button", { name: "Alice, Edit: deny" }));
    const entries = last<RuleSet>(onChange).categories.child!.entries;
    expect(entries.filter((e) => e.subject === "user:alice" && e.action === "edit")).toEqual([]);
  });

  it("still asks before a deny when confirmDeny is on", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RulesEditor {...base({ onChange, settings: { confirmDeny: true } })} />);
    await user.click(screen.getByRole("button", { name: "Alice, View: allow" }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Deny" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("works with the marks variant and a host renderCell", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(
      <RulesEditor
        {...base({ onChange, cellVariant: "marks", settings: { confirmDeny: false } })}
      />,
    );
    expect(document.querySelectorAll("tbody .raci-cell--marks").length).toBe(8);
    await user.click(screen.getByRole("button", { name: "Bob, Edit: not set" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    unmount();
    const seen: { inherited: boolean; state: string }[] = [];
    render(
      <RulesEditor
        {...base({
          renderCell: (c) => {
            seen.push({ inherited: c.inherited, state: c.state });
            return (
              <button type="button" disabled={c.readOnly} onClick={c.onCycle}>
                {c.label}
              </button>
            );
          },
        })}
      />,
    );
    expect(seen.filter((s) => s.inherited)).toHaveLength(4);
    expect(seen.filter((s) => !s.inherited)).toHaveLength(4);
  });
});

describe("a legend under the grid", () => {
  it("lists the model's cell looks with words from the string tables", () => {
    render(<RulesEditor {...base()} />);
    const legend = screen.getByRole("list", { name: "Legend" });
    const items = within(legend)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(items).toEqual([
      "Allow",
      "Deny",
      "Not set, skipped",
      "From a parent category",
      "Locked",
    ]);
    const table = document.querySelector("table")!;
    expect(table.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is host-overridable", () => {
    render(
      <RulesEditor
        {...base({
          config: { ...config, strings: { "legend.allow": "Yes", "editor.legend": "Key" } },
        })}
      />,
    );
    expect(screen.getByRole("list", { name: "Key" })).toHaveTextContent("Yes");
  });
});

describe("moving rows with buttons", () => {
  it("has a move up and a move down per own row, disabled at the ends", () => {
    render(<RulesEditor {...base()} />);
    expect(btn("Move Alice up")).toBeDisabled();
    expect(btn("Move Alice down")).toBeEnabled();
    expect(btn("Move Bob up")).toBeEnabled();
    expect(btn("Move Bob down")).toBeDisabled();
  });

  it("moves a subject's entries together and keeps their relative order", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const input = ruleSet();
    const before = JSON.stringify(input);
    render(<RulesEditor {...base({ ruleSet: input, onChange })} />);
    await user.click(btn("Move Alice down")!);
    const next = last<RuleSet>(onChange);
    expect(next.categories.child!.entries.map((e) => `${e.subject}/${e.action}`)).toEqual([
      "user:bob/view",
      "user:alice/view",
      "user:alice/edit",
    ]);
    expect(JSON.stringify(input)).toBe(before);
    expect(next).not.toBe(input);
    expect(next.categories.top).toBe(input.categories.top);
  });

  it("moves the row on screen and renumbers, without replacing any cell element", async () => {
    const user = userEvent.setup();
    const Host = () => {
      const [set, setSet] = useState(ruleSet());
      return <RulesEditor {...base({ ruleSet: set, onChange: setSet })} />;
    };
    render(<Host />);
    const cell = screen.getByRole("button", { name: "Alice, View: allow" });
    const row = cell.closest("tr");
    await user.click(btn("Move Alice down")!);
    expect(rowIds().slice(0, 2)).toEqual(["own:user:bob", "own:user:alice"]);
    expect(screen.getByRole("button", { name: "Alice, View: allow" })).toBe(cell);
    expect(cell.closest("tr")).toBe(row);
    expect(btn("Move Alice up")).toBeEnabled();
    expect(btn("Move Alice down")).toBeDisabled();
  });

  it("keeps focus on a move button that is still usable", async () => {
    const user = userEvent.setup();
    const Host = () => {
      const [set, setSet] = useState(ruleSet());
      return <RulesEditor {...base({ ruleSet: set, onChange: setSet })} />;
    };
    render(<Host />);
    await user.click(btn("Move Alice down")!);
    expect(btn("Move Alice up")).toHaveFocus();
  });

  it("lets a row without cells yet move on screen and leaves the rule set alone", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RulesEditor {...base({ onChange })} />);
    await addGroupRow(user);
    expect(rowIds().slice(0, 3)).toEqual(["own:user:alice", "own:user:bob", "own:group:ops"]);
    await user.click(btn("Move Ops up")!);
    expect(rowIds().slice(0, 3)).toEqual(["own:user:alice", "own:group:ops", "own:user:bob"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("puts a new row at the end once it has a cell", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RulesEditor {...base({ onChange, settings: { confirmDeny: false } })} />);
    await addGroupRow(user);
    await user.click(screen.getByRole("button", { name: "Ops, View: not set" }));
    expect(subjectsOf(last<RuleSet>(onChange))).toEqual(["user:alice", "user:bob", "group:ops"]);
  });
});

describe("moving rows with the keyboard", () => {
  const Host = (props: { onChange?: (s: RuleSet) => void }) => {
    const [set, setSet] = useState(ruleSet());
    return (
      <RulesEditor
        {...base({
          ruleSet: set,
          onChange: (s) => {
            props.onChange?.(s);
            setSet(s);
          },
        })}
      />
    );
  };

  it("picks up with Space, moves with the arrows, drops with Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const handle = btn("Reorder Alice")!;
    expect(handle).toHaveAttribute("aria-pressed", "false");
    handle.focus();
    await user.keyboard(" ");
    expect(handle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Picked up Alice, position 1 of 2");
    await user.keyboard("{ArrowDown}");
    expect(rowIds().slice(0, 2)).toEqual(["own:user:bob", "own:user:alice"]);
    expect(screen.getByRole("status")).toHaveTextContent("Alice moved to position 2 of 2");
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(handle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Alice dropped at position 2 of 2");
    expect(subjectsOf(last<RuleSet>(onChange))).toEqual(["user:bob", "user:alice"]);
    expect(handle).toHaveFocus();
  });

  it("drops with Space too and stays inside the list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    btn("Reorder Bob")!.focus();
    await user.keyboard(" {ArrowDown}{ArrowUp}{ArrowUp}{ArrowUp} ");
    expect(subjectsOf(last<RuleSet>(onChange))).toEqual(["user:bob", "user:alice"]);
  });

  it("puts everything back on Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const handle = btn("Reorder Alice")!;
    handle.focus();
    await user.keyboard(" {ArrowDown}{Escape}");
    expect(rowIds().slice(0, 2)).toEqual(["own:user:alice", "own:user:bob"]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Move cancelled. Alice is back at position 1 of 2",
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(handle).toHaveAttribute("aria-pressed", "false");
  });

  it("ignores the arrows when nothing is picked up, and cancels when focus moves on", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const handle = btn("Reorder Alice")!;
    handle.focus();
    await user.keyboard("{ArrowDown}");
    expect(rowIds().slice(0, 2)).toEqual(["own:user:alice", "own:user:bob"]);
    await user.keyboard(" {ArrowDown}");
    await user.tab();
    expect(handle).toHaveAttribute("aria-pressed", "false");
    expect(onChange).not.toHaveBeenCalled();
    expect(rowIds().slice(0, 2)).toEqual(["own:user:alice", "own:user:bob"]);
  });
});

describe("dragging rows", () => {
  it("moves a row dropped on another row", () => {
    const onChange = vi.fn();
    render(<RulesEditor {...base({ onChange })} />);
    const alice = document.querySelector<HTMLElement>('tr[data-subject="user:alice"]')!;
    const bob = document.querySelector<HTMLElement>('tr[data-subject="user:bob"]')!;
    fireEvent.pointerDown(btn("Reorder Alice")!);
    expect(alice).toHaveAttribute("draggable", "true");
    expect(bob).not.toHaveAttribute("draggable", "true");
    fireEvent.dragStart(alice, { dataTransfer: { setData: () => {}, effectAllowed: "" } });
    fireEvent.dragOver(bob, { dataTransfer: { dropEffect: "" } });
    expect(bob).toHaveClass("raci-row--over");
    fireEvent.drop(bob);
    expect(subjectsOf(last<RuleSet>(onChange))).toEqual(["user:bob", "user:alice"]);
    expect(alice).not.toHaveAttribute("draggable", "true");
    expect(bob).not.toHaveClass("raci-row--over");
  });

  it("changes nothing when dropped on itself, or when the drag ends elsewhere", () => {
    const onChange = vi.fn();
    render(<RulesEditor {...base({ onChange })} />);
    const alice = document.querySelector<HTMLElement>('tr[data-subject="user:alice"]')!;
    fireEvent.pointerDown(btn("Reorder Alice")!);
    fireEvent.dragStart(alice, { dataTransfer: { setData: () => {}, effectAllowed: "" } });
    fireEvent.dragOver(alice);
    fireEvent.drop(alice);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(btn("Reorder Alice")!);
    fireEvent.dragStart(alice);
    fireEvent.dragEnd(alice);
    expect(alice).not.toHaveAttribute("draggable", "true");
    fireEvent.drop(alice);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not drag an inherited row or drop onto one", () => {
    const onChange = vi.fn();
    render(<RulesEditor {...base({ onChange })} />);
    const cy = document.querySelector<HTMLElement>(
      'tr[data-row="inherited"][data-subject="user:cy"]',
    )!;
    expect(cy).not.toHaveAttribute("draggable");
    fireEvent.pointerDown(btn("Reorder Alice")!);
    fireEvent.dragStart(document.querySelector('tr[data-subject="user:alice"]')!);
    fireEvent.dragOver(cy);
    fireEvent.drop(cy);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("owners", () => {
  it("shows this category's owners and the inherited ones as locked chips", () => {
    render(<RulesEditor {...base()} />);
    const owners = screen.getByRole("group", { name: "Owners" });
    expect(within(owners).getByText("Bob")).toBeInTheDocument();
    expect(btn("Remove Bob from owners")).toBeEnabled();
    const inherited = within(owners).getByText("Zed").closest("li")!;
    expect(inherited).toHaveTextContent("from Top");
    expect(within(inherited).queryByRole("button")).toBeNull();
  });

  it("sits above the grid", () => {
    render(<RulesEditor {...base()} />);
    const owners = screen.getByRole("group", { name: "Owners" });
    expect(
      owners.compareDocumentPosition(document.querySelector("table")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("removes an owner immutably through onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const input = ruleSet();
    const before = JSON.stringify(input);
    render(<RulesEditor {...base({ ruleSet: input, onChange })} />);
    await user.click(btn("Remove Bob from owners")!);
    expect(last<RuleSet>(onChange).categories.child!.owners).toEqual([]);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("adds an owner from the allowed kinds only", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RulesEditor {...base({ onChange })} />);
    const owners = screen.getByRole("group", { name: "Owners" });
    expect(within(owners).queryByRole("combobox", { name: "Kind" })).toBeNull();
    expect(owners.querySelector("select")).toBeNull();
    const search = within(owners).getByRole("combobox", { name: "Search owners" });
    await user.type(search, "op");
    expect(await within(owners).findByText("No matches.")).toBeInTheDocument();
    expect(within(owners).queryByRole("option")).toBeNull();
    await user.clear(search);
    await user.type(search, "ali");
    await user.click(await within(owners).findByRole("option", { name: /Alice/ }));
    expect(last<RuleSet>(onChange).categories.child!.owners).toEqual(["user:bob", "user:alice"]);
  });

  it("offers a kind chooser when several kinds may own", async () => {
    const user = userEvent.setup();
    const model = createOrderedModel({ id: "multi", ownerKinds: ["user", "group"] });
    const onChange = vi.fn();
    render(<RulesEditor {...base({ model, onChange })} />);
    const owners = screen.getByRole("group", { name: "Owners" });
    const select = owners.querySelector("select")!;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["user", "group"]);
    await user.selectOptions(select, "group");
    await user.type(within(owners).getByRole("combobox", { name: "Search owners" }), "op");
    await user.click(await within(owners).findByRole("option", { name: /Ops/ }));
    expect(last<RuleSet>(onChange).categories.child!.owners).toContain("group:ops");
  });

  it("uses the host's heading", () => {
    render(
      <RulesEditor
        {...base({ config: { ...config, strings: { "editor.owners": "Stewards" } } })}
      />,
    );
    expect(screen.getByRole("group", { name: "Stewards" })).toBeInTheDocument();
  });

  it("hides the add control and removal with readOnly", () => {
    render(<RulesEditor {...base({ readOnly: true })} />);
    const owners = screen.getByRole("group", { name: "Owners" });
    expect(within(owners).queryByRole("combobox")).toBeNull();
    expect(btn("Remove Bob from owners")).toBeNull();
  });
});

describe("read-only start", () => {
  it("disables reorder, cells, owners and removal in view mode, and enables them in edit mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RulesEditor {...base({ defaultMode: "view", onChange })} />);
    for (const name of [
      "Reorder Alice",
      "Move Alice down",
      "Move Bob up",
      "Remove Alice",
      "Remove Bob from owners",
    ]) {
      expect(btn(name)).toBeDisabled();
    }
    expect(screen.getByRole("combobox", { name: "Search owners" })).toBeDisabled();
    for (const cell of document.querySelectorAll("tbody button.raci-cell")) {
      expect(cell).toBeDisabled();
    }
    await user.click(btn("Move Alice down")!);
    expect(onChange).not.toHaveBeenCalled();
    await user.click(btn("Edit")!);
    expect(btn("Move Alice down")).toBeEnabled();
    expect(btn("Reorder Alice")).toBeEnabled();
    expect(btn("Remove Bob from owners")).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Search owners" })).toBeEnabled();
  });

  it("saves the working copy with its new order and owners", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<RulesEditor {...base({ defaultMode: "view", onSave })} />);
    await user.click(btn("Edit")!);
    await user.click(btn("Move Alice down")!);
    await user.click(btn("Remove Bob from owners")!);
    await user.click(btn("Save")!);
    const saved = last<RuleSet>(onSave);
    expect(subjectsOf(saved)).toEqual(["user:bob", "user:alice"]);
    expect(saved.categories.child!.owners).toEqual([]);
  });

  it("shows the saved order again after Cancel", async () => {
    const user = userEvent.setup();
    const Host = () => {
      const [set, setSet] = useState(ruleSet());
      return <RulesEditor {...base({ ruleSet: set, onChange: setSet, defaultMode: "view" })} />;
    };
    render(<Host />);
    await user.click(btn("Edit")!);
    await user.click(btn("Move Alice down")!);
    expect(rowIds().slice(0, 2)).toEqual(["own:user:bob", "own:user:alice"]);
    await user.click(btn("Cancel")!);
    await user.click(btn("Discard")!);
    expect(rowIds().slice(0, 2)).toEqual(["own:user:alice", "own:user:bob"]);
  });
});

describe("strings", () => {
  it("lets the host rename the controls", () => {
    render(
      <RulesEditor
        {...base({
          config: {
            ...config,
            strings: { "editor.moveUp": "Up: {subject}", "editor.fromCategory": "via {category}" },
          },
        })}
      />,
    );
    expect(btn("Up: Bob")).toBeInTheDocument();
    expect(screen.getAllByText("via Top").length).toBeGreaterThan(0);
  });
});

describe("stylesheet: a row keeps its height wherever it is", () => {
  it("keeps the last row's border in the ordered grid, so moving a row never changes its height", () => {
    const css = readFileSync("src/styles/editor.css", "utf8");
    expect(css).toMatch(
      /\.raci-table--ordered tbody tr:last-child > \*\s*\{[^}]*border-bottom:\s*1px solid transparent/,
    );
  });
});
