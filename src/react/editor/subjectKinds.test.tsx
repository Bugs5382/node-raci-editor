import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RaciConfig, RuleSet, SubjectKind } from "@/core/types";
import { RulesEditor } from "@/react/editor/RulesEditor";

const kind = (name: string, label: string, hits: Record<string, string>): SubjectKind => ({
  kind: name,
  label,
  search: (q) =>
    Object.entries(hits)
      .filter(([, l]) => l.toLowerCase().includes(q.toLowerCase()))
      .map(([id, l]) => ({ id, label: l })),
  resolve: (s) => hits[s],
});

const make = (subjectKinds: SubjectKind[]): RaciConfig => ({
  actions: [
    { id: "view", label: "View" },
    { id: "edit", label: "Edit", implies: ["view"] },
  ],
  subjectKinds,
  resources: [{ id: "docs", label: "Documents" }],
});

const setup = (config: RaciConfig, ruleSet: RuleSet) => {
  const onChange = vi.fn();
  render(<RulesEditor config={config} ruleSet={ruleSet} categoryId="docs" onChange={onChange} />);
  return onChange;
};

const empty: RuleSet = { parents: {}, categories: {} };

describe("a host with one subject kind", () => {
  it.each([
    ["group", "Groups", { "group:ops": "Ops crew" }],
    ["team", "Squads", { "team:eng": "Engineering" }],
  ])("searches %s directly, with no kind chooser", async (name, label, hits) => {
    const user = userEvent.setup();
    setup(make([kind(name, label, hits)]), empty);
    expect(document.querySelector("select")).toBeNull();
    expect(screen.queryByText(label)).not.toBeInTheDocument();
    await user.type(screen.getByRole("combobox"), "e");
    expect(await screen.findByRole("option")).toBeInTheDocument();
  });

  it("still shows the chooser when there are several kinds", () => {
    setup(make([kind("team", "Teams", {}), kind("department", "Departments", {})]), empty);
    expect(document.querySelector("select")).not.toBeNull();
  });

  it("labels rows of a custom kind through resolve and falls back to the raw subject", () => {
    const rules: RuleSet = {
      parents: {},
      categories: {
        docs: {
          entries: [
            { subject: "team:eng", action: "view", effect: "allow" },
            { subject: "team:ghost", action: "view", effect: "allow" },
          ],
        },
      },
    };
    setup(make([kind("team", "Teams", { "team:eng": "Engineering" })]), rules);
    const table = screen.getAllByRole("table")[0]!;
    expect(within(table).getByRole("rowheader", { name: "Engineering" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "team:ghost" })).toBeInTheDocument();
  });
});

describe("unknown kinds in stored rules", () => {
  const rules: RuleSet = {
    parents: {},
    categories: {
      docs: {
        entries: [
          { subject: "dept:legal", action: "view", effect: "allow" },
          { subject: "everyone", action: "view", effect: "deny" },
          { subject: "team:eng", action: "view", effect: "allow" },
        ],
      },
    },
  };

  it("shows them as stored and keeps them when another cell changes", async () => {
    const user = userEvent.setup();
    const onChange = setup(make([kind("team", "Teams", { "team:eng": "Engineering" })]), rules);
    const table = screen.getAllByRole("table")[0]!;
    expect(within(table).getByRole("rowheader", { name: "dept:legal" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "everyone" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Engineering, Edit: not set" }));
    const next = onChange.mock.calls.at(-1)?.[0] as RuleSet;
    const subjects = next.categories["docs"]!.entries.map((e) => e.subject);
    expect(subjects).toEqual(expect.arrayContaining(["dept:legal", "everyone", "team:eng"]));
    expect(next.categories["docs"]!.entries).toHaveLength(4);
  });

  it("lets the unknown subject itself be edited", async () => {
    const user = userEvent.setup();
    const onChange = setup(make([kind("team", "Teams", {})]), rules);
    await user.click(screen.getByRole("button", { name: "dept:legal, Edit: not set" }));
    const next = onChange.mock.calls.at(-1)?.[0] as RuleSet;
    expect(next.categories["docs"]!.entries).toContainEqual({
      subject: "dept:legal",
      action: "edit",
      effect: "allow",
    });
  });
});
