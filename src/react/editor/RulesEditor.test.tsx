import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RaciConfig, RuleSet, SubjectOption } from "@/core/types";
import { RulesEditor } from "@/react/editor/RulesEditor";

const people: SubjectOption[] = [
  { id: "user:alice", label: "Alice", detail: "alice@example.test" },
  { id: "user:bob", label: "Bob" },
  { id: "user:carol", label: "Carol" },
];

const makeConfig = (over: Partial<RaciConfig> = {}): RaciConfig => ({
  actions: [
    { id: "view", label: "View" },
    { id: "review", label: "Review", implies: ["view"] },
    { id: "approve", label: "Approve", implies: ["review"] },
  ],
  subjectKinds: [
    {
      kind: "user",
      label: "Users",
      search: (q) => people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())),
      resolve: (s) => (s === "user:alice" ? "alice" : undefined),
    },
    { kind: "group", label: "Groups", search: () => [{ id: "group:ops", label: "Ops" }] },
  ],
  resources: [{ id: "root", label: "Company", children: [{ id: "docs", label: "Documents" }] }],
  ...over,
});

const makeRuleSet = (): RuleSet => ({
  categories: {
    docs: {
      entries: [
        { subject: "user:alice", action: "approve", effect: "allow" },
        { subject: "user:bob", action: "view", effect: "deny" },
      ],
    },
    root: { entries: [{ subject: "group:ops", action: "view", effect: "allow" }] },
    "*": { entries: [{ subject: "user:zed", action: "review", effect: "deny" }] },
  },
  parents: { docs: "root" },
});

const setup = (
  props: Partial<React.ComponentProps<typeof RulesEditor>> = {},
  ruleSet = makeRuleSet(),
) => {
  const onChange = vi.fn();
  const config = props.config ?? makeConfig();
  const view = render(
    <RulesEditor
      config={config}
      ruleSet={ruleSet}
      categoryId="docs"
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, ruleSet, config, ...view };
};

const lastRuleSet = (fn: ReturnType<typeof vi.fn>): RuleSet => fn.mock.calls.at(-1)?.[0] as RuleSet;

describe("rendering", () => {
  it("renders a row per subject and a column per action", () => {
    const { container } = setup();
    expect(container.firstElementChild).toHaveClass("raci-root", "raci-editor");
    const table = screen.getAllByRole("table")[0]!;
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(expect.arrayContaining(["View", "Review", "Approve"]));
    expect(within(table).getByRole("rowheader", { name: "alice" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "user:bob" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "alice, Approve: allow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "user:bob, View: deny" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "user:bob, Approve: not set" })).toBeInTheDocument();
  });

  it("uses an action id when it has no label and shows the empty state", () => {
    const config = makeConfig({ actions: [{ id: "run" }] });
    setup({ config, categoryId: "nothing" });
    expect(screen.getByText("No subjects have rules in this category yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "run" })[0]).toBeInTheDocument();
  });

  it("respects visibleActions and density, and merges className", () => {
    const { container } = setup({
      settings: { visibleActions: ["view"], density: "compact" },
      className: "mine",
    });
    expect(container.firstElementChild).toHaveClass("raci-editor--compact", "mine");
    expect(screen.queryByRole("columnheader", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "View" })[0]).toBeInTheDocument();
  });

  it("applies host string overrides", () => {
    setup({ config: makeConfig({ strings: { "editor.stopInheriting": "Cut the chain" } }) });
    expect(screen.getByLabelText("Cut the chain")).toBeInTheDocument();
  });
});

describe("cycling cells", () => {
  it("cycles blank, allow, deny, blank by click", async () => {
    const user = userEvent.setup();
    const { onChange, ruleSet } = setup();
    await user.click(
      screen.getByRole("button", { name: "alice, View: not set, included by Approve" }),
    );
    // alice already holds approve, so view is shown included; the click sets an explicit allow
    expect(lastRuleSet(onChange).categories.docs!.entries).toContainEqual({
      subject: "user:alice",
      action: "view",
      effect: "allow",
    });
    await user.click(screen.getByRole("button", { name: "user:bob, Approve: not set" }));
    expect(lastRuleSet(onChange).categories.docs!.entries).toContainEqual({
      subject: "user:bob",
      action: "approve",
      effect: "allow",
    });
    await user.click(screen.getByRole("button", { name: "user:bob, View: deny" }));
    expect(
      lastRuleSet(onChange).categories.docs!.entries.some((e) => e.subject === "user:bob"),
    ).toBe(false);
    expect(ruleSet).toEqual(makeRuleSet());
  });

  it("advances through the whole cycle as the host feeds changes back", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const config = makeConfig();
    const { rerender } = render(
      <RulesEditor config={config} ruleSet={makeRuleSet()} categoryId="docs" onChange={onChange} />,
    );
    const states: string[] = [];
    let current = makeRuleSet();
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole("button", { name: /^user:bob, Review:/ }));
      current = lastRuleSet(onChange);
      rerender(
        <RulesEditor config={config} ruleSet={current} categoryId="docs" onChange={onChange} />,
      );
      states.push(
        current.categories.docs!.entries.find(
          (e) => e.subject === "user:bob" && e.action === "review",
        )?.effect ?? "blank",
      );
    }
    expect(states).toEqual(["allow", "deny", "blank"]);
    // the row stays after its last cell is cleared
    expect(screen.getByRole("rowheader", { name: "user:bob" })).toBeInTheDocument();
  });

  it("cycles by keyboard with Space and Enter", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    screen.getByRole("button", { name: "user:bob, Approve: not set" }).focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("keeps an all-blank row in the UI but emits no entries for it", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("button", { name: "user:bob, View: deny" }));
    const next = lastRuleSet(onChange);
    expect(next.categories.docs!.entries.map((e) => e.subject)).not.toContain("user:bob");
    expect(screen.getByRole("rowheader", { name: "user:bob" })).toBeInTheDocument();
  });
});

describe("implications", () => {
  it("marks columns implied by an allowed cell as included", () => {
    setup();
    const review = screen.getByRole("button", {
      name: "alice, Review: not set, included by Approve",
    });
    expect(review).toHaveClass("raci-cell--included");
    expect(within(review).getByText("included")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "alice, View: not set, included by Approve" }),
    ).toBeInTheDocument();
    // not for another subject, and not for the allowed cell itself
    expect(screen.getByRole("button", { name: "user:bob, Review: not set" })).not.toHaveClass(
      "raci-cell--included",
    );
    expect(screen.getByRole("button", { name: "alice, Approve: allow" })).not.toHaveClass(
      "raci-cell--included",
    );
  });

  it("does not mark a cell that has its own entry", () => {
    const rs = makeRuleSet();
    rs.categories.docs!.entries.push({ subject: "user:alice", action: "view", effect: "deny" });
    setup({}, rs);
    expect(screen.getByRole("button", { name: "alice, View: deny" })).not.toHaveClass(
      "raci-cell--included",
    );
  });
});

describe("confirmDeny", () => {
  it("asks before saving a deny and applies it on confirm", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ settings: { confirmDeny: true } });
    await user.click(screen.getByRole("button", { name: "alice, Approve: allow" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Deny Approve for alice?");
    expect(onChange).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Deny" }));
    expect(lastRuleSet(onChange).categories.docs!.entries).toContainEqual({
      subject: "user:alice",
      action: "approve",
      effect: "deny",
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cancels by button and by Escape without changing anything", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ settings: { confirmDeny: true } });
    await user.click(screen.getByRole("button", { name: "alice, Approve: allow" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "alice, Approve: allow" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not ask for allow or for clearing a deny", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ settings: { confirmDeny: true } });
    await user.click(screen.getByRole("button", { name: "user:bob, Approve: not set" }));
    await user.click(screen.getByRole("button", { name: "user:bob, View: deny" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("remove", () => {
  it("removes every entry of a subject", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("button", { name: "Remove alice" }));
    const next = lastRuleSet(onChange);
    expect(next.categories.docs!.entries).toEqual([
      { subject: "user:bob", action: "view", effect: "deny" },
    ]);
    expect(next.parents).toEqual({ docs: "root" });
    expect(next.categories.root).toEqual(makeRuleSet().categories.root);
  });

  it("drops a subject that was added but has no entries", async () => {
    const user = userEvent.setup();
    setup();
    await addViaSearch(user, "Carol");
    expect(screen.getByRole("rowheader", { name: "Carol" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Carol" }));
    expect(screen.queryByRole("rowheader", { name: "Carol" })).not.toBeInTheDocument();
  });
});

const addViaSearch = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  const box = screen.getByRole("combobox", { name: "Search" });
  await user.click(box);
  await user.type(box, text);
  const option = await screen.findByRole("option", { name: new RegExp(text) });
  await user.click(option);
};

describe("add subject", () => {
  it("adds an all-blank row via search without emitting entries", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await addViaSearch(user, "Car");
    expect(screen.getByRole("rowheader", { name: "Carol" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carol, View: not set" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Carol, View: not set" }));
    expect(lastRuleSet(onChange).categories.docs!.entries).toContainEqual({
      subject: "user:carol",
      action: "view",
      effect: "allow",
    });
  });

  it("selects with the keyboard and hides subjects already listed", async () => {
    const user = userEvent.setup();
    setup();
    const box = screen.getByRole("combobox", { name: "Search" });
    await user.type(box, "o");
    await screen.findByRole("option", { name: /Carol/ });
    // Bob and Alice are rows already; only Carol matches "o"
    expect(screen.queryByRole("option", { name: /Bob/ })).not.toBeInTheDocument();
    expect(box).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(await screen.findByRole("rowheader", { name: "Carol" })).toBeInTheDocument();
    expect(box).toHaveValue("");
  });

  it("moves the active option with the arrow keys and closes on Escape", async () => {
    const user = userEvent.setup();
    const config = makeConfig();
    config.subjectKinds[0]!.search = () => [
      { id: "user:p", label: "Pat", detail: "pat@example.test" },
      { id: "user:q", label: "Quinn" },
    ];
    setup({ config });
    const box = screen.getByRole("combobox", { name: "Search" });
    await user.type(box, "x");
    await screen.findByRole("option", { name: /Pat/ });
    expect(screen.getByText("pat@example.test")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /Quinn/ })).toHaveAttribute("aria-selected", "true");
    expect(box).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /Quinn/ }).id,
    );
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: /Quinn/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(box).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowDown}");
    expect(box).toHaveAttribute("aria-expanded", "true");
    await user.hover(screen.getByRole("option", { name: /Pat/ }));
    expect(screen.getByRole("option", { name: /Pat/ })).toHaveAttribute("aria-selected", "true");
    await user.tab();
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("ignores Enter when nothing is listed", async () => {
    const user = userEvent.setup();
    setup();
    const box = screen.getByRole("combobox", { name: "Search" });
    await user.type(box, "{Enter}");
    expect(box).toHaveValue("");
    await user.type(box, "qqq");
    expect(await screen.findByText("No matches.")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(box).toHaveValue("qqq");
  });

  it("shows loading, then results from an async search", async () => {
    const user = userEvent.setup();
    let release: (v: SubjectOption[]) => void = () => {};
    const config = makeConfig();
    let searched = false;
    config.subjectKinds[0]!.search = () =>
      new Promise((r) => {
        searched = true;
        release = r;
      });
    setup({ config });
    await user.type(screen.getByRole("combobox", { name: "Search" }), "c");
    expect(screen.getByRole("status")).toHaveTextContent("Searching...");
    await waitFor(() => expect(searched).toBe(true));
    release([{ id: "user:late", label: "Late" }]);
    expect(await screen.findByRole("option", { name: /Late/ })).toBeInTheDocument();
  });

  it("shows an error state when the search fails or throws", async () => {
    const user = userEvent.setup();
    const config = makeConfig();
    config.subjectKinds[0]!.search = () => Promise.reject(new Error("boom"));
    setup({ config });
    await user.type(screen.getByRole("combobox", { name: "Search" }), "c");
    expect(await screen.findByRole("alert")).toHaveTextContent("Search failed. Try again.");
  });

  it("drops a stale response and clears results when the query empties", async () => {
    const user = userEvent.setup();
    const resolvers: Array<(v: SubjectOption[]) => void> = [];
    const config = makeConfig();
    config.subjectKinds[0]!.search = () => new Promise((r) => resolvers.push(r));
    setup({ config });
    const box = screen.getByRole("combobox", { name: "Search" });
    await user.type(box, "a");
    await waitFor(() => expect(resolvers).toHaveLength(1));
    await user.clear(box);
    resolvers[0]!([{ id: "user:stale", label: "Stale" }]);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("option", { name: /Stale/ })).not.toBeInTheDocument();
    await user.type(box, "b");
    await waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[1]!([{ id: "user:fresh", label: "Fresh" }]);
    expect(await screen.findByRole("option", { name: /Fresh/ })).toBeInTheDocument();
  });

  it("ignores a failure from a superseded request", async () => {
    const user = userEvent.setup();
    const rejecters: Array<(e: Error) => void> = [];
    const config = makeConfig();
    config.subjectKinds[0]!.search = () => new Promise((_r, rej) => rejecters.push(rej));
    setup({ config });
    const box = screen.getByRole("combobox", { name: "Search" });
    await user.type(box, "a");
    await waitFor(() => expect(rejecters).toHaveLength(1));
    await user.clear(box);
    rejecters[0]!(new Error("late"));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers only enabled kinds and searches the chosen one", async () => {
    const user = userEvent.setup();
    setup({ settings: { enabledSubjectKinds: ["group", "user"] } });
    const select = screen.getByRole("combobox", { name: "Subject type" });
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Users", "Groups"]);
    await user.selectOptions(select, "user");
    await user.type(screen.getByRole("combobox", { name: "Search" }), "Car");
    expect(await screen.findByRole("option", { name: /Carol/ })).toBeInTheDocument();
  });

  it("uses the option label for a subject the kind cannot resolve", async () => {
    const user = userEvent.setup();
    setup({ settings: { enabledSubjectKinds: ["group"] } });
    await user.type(screen.getByRole("combobox", { name: "Search" }), "o");
    await user.click(await screen.findByRole("option", { name: /Ops/ }));
    expect(
      within(screen.getAllByRole("table")[0]!).getByRole("rowheader", { name: "Ops" }),
    ).toBeInTheDocument();
  });

  it("hides the picker when no kind is enabled", () => {
    setup({ settings: { enabledSubjectKinds: [] } });
    expect(screen.queryByRole("combobox", { name: "Search" })).not.toBeInTheDocument();
  });

  it("clears added rows when the category changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const config = makeConfig();
    const rs = makeRuleSet();
    const { rerender } = render(
      <RulesEditor config={config} ruleSet={rs} categoryId="docs" onChange={onChange} />,
    );
    await addViaSearch(user, "Car");
    rerender(<RulesEditor config={config} ruleSet={rs} categoryId="root" onChange={onChange} />);
    expect(screen.queryByRole("rowheader", { name: "Carol" })).not.toBeInTheDocument();
  });
});

describe("stopInheriting", () => {
  it("reflects the stored flag and toggles it", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    const box = screen.getByRole("checkbox", { name: "Stop inheriting" });
    expect(box).not.toBeChecked();
    await user.click(box);
    const next = lastRuleSet(onChange);
    expect(next.categories.docs!.stopInheriting).toBe(true);
    expect(next.categories.docs!.entries).toHaveLength(2);
  });

  it("unchecks a stored true flag", async () => {
    const user = userEvent.setup();
    const rs = makeRuleSet();
    rs.categories.docs!.stopInheriting = true;
    const { onChange } = setup({}, rs);
    const box = screen.getByRole("checkbox", { name: "Stop inheriting" });
    expect(box).toBeChecked();
    expect(screen.getByText("Inheritance stops at this category.")).toBeInTheDocument();
    expect(screen.queryByText("Inherited from Company")).not.toBeInTheDocument();
    await user.click(box);
    expect(lastRuleSet(onChange).categories.docs!.stopInheriting).toBe(false);
  });

  it("falls back to defaultStopInheriting when the category has no flag", () => {
    setup({ settings: { defaultStopInheriting: true } });
    expect(screen.getByRole("checkbox", { name: "Stop inheriting" })).toBeChecked();
  });
});

describe("inherited entries", () => {
  it("shows ancestors then all-categories, read-only and labelled", () => {
    setup();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Inherited from Company", "Inherited from All categories"]);
    const inherited = screen.getByRole("img", { name: "group:ops, View: allow" });
    expect(inherited).toHaveClass("raci-cell--inherited");
    expect(screen.getByRole("img", { name: "user:zed, Review: deny" })).toBeInTheDocument();
    expect(screen.getAllByText("Read-only. Change these in their own category.")).toHaveLength(2);
  });

  it("falls back to the raw id when the ancestor has no label", () => {
    const rs = makeRuleSet();
    rs.parents = { docs: "mystery" };
    rs.categories.mystery = { entries: [{ subject: "user:m", action: "view", effect: "allow" }] };
    setup({}, rs);
    expect(screen.getByRole("heading", { name: "Inherited from mystery" })).toBeInTheDocument();
  });

  it("is hidden when showInherited is false", () => {
    setup({ settings: { showInherited: false } });
    expect(screen.queryByText("Inherited from Company")).not.toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("shows a blank inherited cell where the subject has nothing", () => {
    setup();
    expect(screen.getByRole("img", { name: "group:ops, Approve: not set" })).toBeInTheDocument();
  });
});

describe("readOnly", () => {
  it("disables every control and hides add and remove", () => {
    setup({ readOnly: true });
    expect(screen.getByRole("checkbox", { name: "Stop inheriting" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "alice, Approve: allow" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Remove alice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Search" })).not.toBeInTheDocument();
  });

  it("does not call onChange on click", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ readOnly: true });
    await user.click(screen.getByRole("button", { name: "alice, Approve: allow" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("immutability and payload", () => {
  it("never mutates the input and emits a fresh, complete rule set", async () => {
    const user = userEvent.setup();
    const rs = makeRuleSet();
    const frozen = JSON.stringify(rs);
    Object.freeze(rs);
    Object.freeze(rs.categories);
    Object.freeze(rs.parents);
    Object.freeze(rs.categories.docs);
    Object.freeze(rs.categories.docs!.entries);
    const { onChange } = setup({}, rs);
    await user.click(screen.getByRole("button", { name: "user:bob, Approve: not set" }));
    await user.click(screen.getByRole("checkbox", { name: "Stop inheriting" }));
    await user.click(screen.getByRole("button", { name: "Remove alice" }));
    expect(JSON.stringify(rs)).toBe(frozen);
    for (const call of onChange.mock.calls) {
      const next = call[0] as RuleSet;
      expect(next).not.toBe(rs);
      expect(next.parents).toEqual(rs.parents);
      expect(Object.keys(next.categories).sort()).toEqual(["*", "docs", "root"]);
    }
  });

  it("emits a category that did not exist yet", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ categoryId: "fresh" });
    await addViaSearch(user, "Car");
    await user.click(screen.getByRole("button", { name: "Carol, Approve: not set" }));
    expect(lastRuleSet(onChange).categories.fresh).toEqual({
      entries: [{ subject: "user:carol", action: "approve", effect: "allow" }],
    });
  });
});
