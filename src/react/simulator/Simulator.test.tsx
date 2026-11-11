import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RaciConfig, RuleSet, SubjectOption } from "@/core/types";
import { Simulator } from "@/react/simulator/Simulator";

const people: SubjectOption[] = [
  { id: "user:alice", label: "Alice Ng", detail: "alice@example.test" },
  { id: "user:bob", label: "Bob Ray" },
];
const groups: SubjectOption[] = [
  { id: "group:finance", label: "Finance team" },
  { id: "group:staff", label: "Staff" },
  { id: "role:contractor", label: "Contractor" },
];
const match = (all: SubjectOption[], q: string) =>
  all.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

const config: RaciConfig = {
  actions: [
    { id: "read", label: "Read" },
    { id: "author", label: "Author", implies: ["read"] },
    { id: "approve" },
  ],
  subjectKinds: [
    {
      kind: "user",
      label: "User",
      search: (q) => match(people, q),
      resolve: (s) => people.find((p) => p.id === s)?.label,
    },
    {
      kind: "group",
      label: "Group",
      search: async (q) =>
        match(
          groups.filter((g) => g.id.startsWith("group:")),
          q,
        ),
      resolve: (s) => groups.find((g) => g.id === s)?.label,
    },
    {
      kind: "role",
      label: "Role",
      search: (q) =>
        match(
          groups.filter((g) => g.id.startsWith("role:")),
          q,
        ),
    },
  ],
  resources: [
    {
      id: "company",
      label: "Company",
      children: [
        { id: "finance", label: "Finance", children: [{ id: "reports", label: "Reports" }] },
      ],
    },
    { id: "legal", label: "Legal" },
  ],
};

const ruleSet: RuleSet = {
  parents: { finance: "company", reports: "finance" },
  categories: {
    company: { entries: [{ subject: "group:staff", action: "read", effect: "allow" }] },
    finance: {
      entries: [
        { subject: "group:finance", action: "author", effect: "allow" },
        { subject: "role:contractor", action: "author", effect: "deny" },
      ],
    },
    reports: { stopInheriting: true, entries: [] },
    "*": { entries: [{ subject: "user:alice", action: "approve", effect: "allow" }] },
  },
};

const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  field: string,
  text: string,
  option: RegExp,
) => {
  await user.type(screen.getByRole("combobox", { name: field }), text);
  await user.click(await screen.findByRole("option", { name: option }));
};

const row = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}`) });

describe("Simulator", () => {
  it("shows empty states and the labelled controls", () => {
    render(<Simulator config={config} ruleSet={ruleSet} />);
    expect(screen.getByRole("group", { name: "Access simulator" })).toHaveClass(
      "raci-root",
      "raci-simulator",
    );
    expect(screen.getByRole("combobox", { name: "Person" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Extra memberships" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeInTheDocument();
    expect(screen.getByText("Choose a person to see what they can do.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("indents the category tree", () => {
    render(<Simulator config={config} ruleSet={ruleSet} />);
    const opts = within(screen.getByRole("combobox", { name: "Category" })).getAllByRole("option");
    expect(opts.map((o) => o.textContent?.trim())).toEqual([
      "Company",
      "Finance",
      "Reports",
      "Legal",
    ]);
    expect(opts[2]?.textContent?.startsWith("    ")).toBe(true);
  });

  it("picks a person and shows allowed with the rule that decided it", async () => {
    const user = userEvent.setup();
    render(<Simulator config={config} ruleSet={ruleSet} categoryId="finance" />);
    await pick(user, "Person", "ali", /Alice Ng/);
    expect(screen.getByRole("button", { name: "Remove Alice Ng" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Person" })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Results" })).toBeInTheDocument();
    // approve comes from the rule for all categories
    const approve = row("approve");
    expect(within(approve).getByText("Allowed")).toBeInTheDocument();
    expect(approve).toHaveTextContent(
      "Allowed by Alice Ng (approve), from the rules for all categories",
    );
    // no rule for read or author: default deny after walking up
    expect(row("Read")).toHaveTextContent("Denied");
    expect(row("Read")).toHaveTextContent("Denied: no rule matched (default deny)");
  });

  it("adds and removes memberships, which feed the decision", async () => {
    const user = userEvent.setup();
    render(<Simulator config={config} ruleSet={ruleSet} categoryId="finance" />);
    await pick(user, "Person", "bob", /Bob Ray/);
    await pick(user, "Extra memberships", "fin", /Finance team/);
    expect(row("Author")).toHaveTextContent("Allowed by Finance team in Finance (Author)");
    // implied action
    expect(row("Read")).toHaveTextContent("Allowed by Finance team in Finance (Author)");

    await user.click(screen.getByRole("button", { name: "Remove Finance team" }));
    expect(row("Author")).toHaveTextContent("Denied: no rule matched (default deny)");
  });

  it("lets a deny beat an allow in the same category", async () => {
    const user = userEvent.setup();
    render(<Simulator config={config} ruleSet={ruleSet} categoryId="finance" />);
    await pick(user, "Person", "bob", /Bob Ray/);
    await pick(user, "Extra memberships", "fin", /Finance team/);
    await pick(user, "Extra memberships", "contr", /Contractor/);
    const author = row("Author");
    expect(within(author).getByText("Denied")).toBeInTheDocument();
    expect(author).toHaveTextContent("Denied by role:contractor in Finance (Author)");
  });

  it("shows an inherited reason and the walk path", async () => {
    const user = userEvent.setup();
    render(<Simulator config={config} ruleSet={ruleSet} categoryId="finance" />);
    await pick(user, "Person", "bob", /Bob Ray/);
    await pick(user, "Extra memberships", "sta", /Staff/);
    const read = row("Read");
    expect(read).toHaveTextContent("Allowed by Staff (Read), inherited from Company");
    const walk = within(read).getByRole("list", { name: "Checked, nearest first" });
    expect(
      within(walk)
        .getAllByRole("listitem")
        .map((i) => i.textContent),
    ).toEqual(["Finance", "Company"]);
  });

  it("explains where inheriting stopped", async () => {
    const user = userEvent.setup();
    render(<Simulator config={config} ruleSet={ruleSet} categoryId="reports" />);
    await pick(user, "Person", "bob", /Bob Ray/);
    await pick(user, "Extra memberships", "sta", /Staff/);
    const read = row("Read");
    expect(within(read).getByText("Denied")).toBeInTheDocument();
    expect(read).toHaveTextContent("Denied: no rule matched, and inheriting stopped at Reports");
  });

  it("denies by default and labels the all-categories stop in the path", async () => {
    const user = userEvent.setup();
    render(<Simulator config={config} ruleSet={ruleSet} categoryId="legal" />);
    await pick(user, "Person", "bob", /Bob Ray/);
    const read = row("Read");
    expect(read).toHaveTextContent("Denied: no rule matched (default deny)");
    const items = within(read)
      .getAllByRole("listitem")
      .map((i) => i.textContent);
    expect(items).toEqual(["Legal", "All categories"]);
  });

  it("uses an uncontrolled category and reports changes", async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    render(<Simulator config={config} ruleSet={ruleSet} onCategoryChange={onCategoryChange} />);
    const select = screen.getByRole("combobox", { name: "Category" });
    expect(select).toHaveValue("company");
    await pick(user, "Person", "bob", /Bob Ray/);
    await pick(user, "Extra memberships", "sta", /Staff/);
    expect(row("Read")).toHaveTextContent("Allowed by Staff in Company (Read)");
    await user.selectOptions(select, "reports");
    expect(onCategoryChange).toHaveBeenCalledWith("reports");
    expect(select).toHaveValue("reports");
    expect(row("Read")).toHaveTextContent("inheriting stopped at Reports");
  });

  it("follows a controlled category and does not change it itself", async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    render(
      <Simulator
        config={config}
        ruleSet={ruleSet}
        categoryId="legal"
        onCategoryChange={onCategoryChange}
      />,
    );
    const select = screen.getByRole("combobox", { name: "Category" });
    await user.selectOptions(select, "finance");
    expect(onCategoryChange).toHaveBeenCalledWith("finance");
    expect(select).toHaveValue("legal");
  });

  it("honours visible actions from settings and falls back to ids", async () => {
    const user = userEvent.setup();
    render(
      <Simulator
        config={config}
        ruleSet={ruleSet}
        settings={{ visibleActions: ["approve", "ghost", "read"] }}
      />,
    );
    await pick(user, "Person", "ali", /Alice Ng/);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/^approve/);
    expect(rows[1]).toHaveTextContent(/^Read/);
  });

  it("limits memberships to enabled subject kinds", async () => {
    const user = userEvent.setup();
    render(
      <Simulator
        config={config}
        ruleSet={ruleSet}
        settings={{ enabledSubjectKinds: ["user", "group"] }}
      />,
    );
    await user.type(screen.getByRole("combobox", { name: "Extra memberships" }), "contr");
    expect(await screen.findByText("No matches")).toBeInTheDocument();
  });

  it("shows empty states for no categories and no actions", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Simulator config={{ ...config, resources: [] }} ruleSet={ruleSet} />,
    );
    await pick(user, "Person", "ali", /Alice Ng/);
    expect(screen.getByText("There are no categories to check.")).toBeInTheDocument();
    rerender(<Simulator config={config} ruleSet={ruleSet} settings={{ visibleActions: [] }} />);
    expect(screen.getByText("There are no actions to show.")).toBeInTheDocument();
  });

  it("reports when a search finds nothing and ignores failures", async () => {
    const user = userEvent.setup();
    const failing: RaciConfig = {
      ...config,
      subjectKinds: [
        {
          kind: "user",
          label: "User",
          search: () => Promise.reject(new Error("down")),
        },
      ],
    };
    render(<Simulator config={failing} ruleSet={ruleSet} />);
    await user.type(screen.getByRole("combobox", { name: "Person" }), "x");
    expect(await screen.findByText("No matches")).toBeInTheDocument();
  });

  it("supports the keyboard in the picker", async () => {
    const user = userEvent.setup();
    render(<Simulator config={config} ruleSet={ruleSet} categoryId="finance" />);
    const input = screen.getByRole("combobox", { name: "Person" });
    await user.type(input, "b");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByRole("button", { name: /^Remove / })).toBeInTheDocument();
  });

  it("closes the list on blur and lets the person be changed", async () => {
    const user = userEvent.setup();
    render(<Simulator config={config} ruleSet={ruleSet} />);
    await user.type(screen.getByRole("combobox", { name: "Person" }), "a");
    await screen.findByRole("listbox");
    await user.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Person" }));
    await user.click(await screen.findByRole("option", { name: /Alice Ng/ }));
    await user.click(screen.getByRole("button", { name: "Remove Alice Ng" }));
    expect(screen.getByRole("combobox", { name: "Person" })).toBeInTheDocument();
    expect(screen.getByText("Choose a person to see what they can do.")).toBeInTheDocument();
  });

  it("uses host string overrides and a custom class", () => {
    render(
      <Simulator
        config={{ ...config, strings: { "simulator.title": "Try it" } }}
        ruleSet={ruleSet}
        className="mine"
      />,
    );
    expect(screen.getByRole("group", { name: "Try it" })).toHaveClass("mine");
  });
});
