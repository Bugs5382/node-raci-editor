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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createOrderedModel, registerModel } from "@/index";
import type { PoolPerson, RaciConfig, RuleSet, SubjectOption } from "@/index";
import { Simulator } from "@/react/simulator/Simulator";
import type { SimulatorProps } from "@/react/simulator/Simulator";

registerModel(
  createOrderedModel({
    id: "ordered-admins",
    superusers: { subjects: ["group:admins"], actions: ["read", "author", "approve"] },
  }),
);

const people: SubjectOption[] = [
  { id: "user:alice", label: "Alice Ng" },
  { id: "user:bob", label: "Bob Ray" },
  { id: "user:carol", label: "Carol Diaz" },
  { id: "user:dave", label: "Dave Fox" },
  { id: "user:olga", label: "Olga Park" },
];
const groups: SubjectOption[] = [{ id: "group:admins", label: "Site admins" }];
const match = (all: SubjectOption[], q: string) =>
  all.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

const config: RaciConfig = {
  actions: [
    { id: "read", label: "Read" },
    { id: "author", label: "Author", implies: ["read"] },
    { id: "approve", label: "Approve", requires: ["read"] },
    { id: "ack", label: "Acknowledge", kind: "obligation" },
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
      search: (q) => match(groups, q),
      resolve: (s) => groups.find((g) => g.id === s)?.label,
    },
  ],
  resources: [
    { id: "building", label: "Building", children: [{ id: "door", label: "Door entry" }] },
  ],
};

const ruleSet: RuleSet = {
  model: "ordered",
  parents: { door: "building" },
  categories: {
    building: {
      owners: ["user:olga"],
      entries: [
        { subject: "user:bob", action: "ack", effect: "deny" },
        { subject: "everyone:*", action: "ack", effect: "allow" },
      ],
    },
    door: {
      entries: [
        { subject: "user:carol", action: "approve", effect: "allow" },
        { subject: "user:carol", action: "read", effect: "allow" },
        { subject: "user:dave", action: "author", effect: "allow" },
        { subject: "user:dave", action: "read", effect: "deny" },
      ],
    },
  },
};

const pick = async (user: ReturnType<typeof userEvent.setup>, text: string, option: RegExp) => {
  await user.type(screen.getByRole("combobox", { name: "Person" }), text);
  await user.click(await screen.findByRole("option", { name: option }));
};

const setup = async (
  props: Partial<SimulatorProps>,
  who: [string, RegExp] = ["alice", /Alice/],
) => {
  const user = userEvent.setup();
  const out = render(<Simulator config={config} ruleSet={ruleSet} categoryId="door" {...props} />);
  await pick(user, ...who);
  return { user, ...out };
};

const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("wording by action kind (list)", () => {
  it("reads an access action as allowed or denied and an obligation as required or not", async () => {
    await setup({}, ["bob", /Bob/]);
    expect(row("Read")).toHaveTextContent("Would be denied");
    expect(row("Acknowledge")).toHaveTextContent("Not required");
    expect(row("Acknowledge")).not.toHaveTextContent("Would be");
  });

  it("says required for an obligation that applies", async () => {
    await setup({});
    expect(row("Acknowledge")).toHaveTextContent("Required by");
  });

  it("uses the action's own outcome words first", async () => {
    const custom: RaciConfig = {
      ...config,
      actions: config.actions.map((a) =>
        a.id === "ack" ? { ...a, outcome: { allowed: "Must sign", denied: "Exempt" } } : a,
      ),
    };
    await setup({ config: custom });
    expect(row("Acknowledge")).toHaveTextContent("Must sign by");
  });

  it("takes per-kind strings and keeps simulator.allowed as the access default", async () => {
    await setup(
      {
        config: {
          ...config,
          strings: { "simulator.obligation.allowed": "Due", "simulator.allowed": "Yes" },
        },
      },
      ["carol", /Carol/],
    );
    expect(row("Acknowledge")).toHaveTextContent("Due");
    expect(row("Read")).toHaveTextContent("Yes");
  });
});

describe("access strings", () => {
  it("takes simulator.access.* as the access words", async () => {
    await setup({
      variant: "strips",
      config: {
        ...config,
        strings: { "simulator.access.denied": "Refused", "simulator.access.allowed": "Okay" },
      },
    });
    expect(screen.getByText(/Read - Refused/)).toBeInTheDocument();
  });
});

describe("wording by action kind (boxes and strips)", () => {
  it("boxes", async () => {
    await setup({ variant: "boxes" }, ["bob", /Bob/]);
    expect(screen.getByRole("article", { name: "Acknowledge" })).toHaveTextContent("Not required");
    expect(screen.getByRole("article", { name: "Read" })).toHaveTextContent("Would be denied");
  });

  it("strips", async () => {
    await setup({ variant: "strips" });
    expect(screen.getByText(/Acknowledge - Required/)).toBeInTheDocument();
    expect(screen.getByText(/Read - Would be denied/)).toBeInTheDocument();
  });

  it("strips still honor the older strip strings for access", async () => {
    await setup({
      variant: "strips",
      config: { ...config, strings: { "simulator.strip.no": "Non" } },
    });
    expect(screen.getByText(/Read - Non/)).toBeInTheDocument();
  });
});

describe("decided by", () => {
  it("shows the deciding row and its category in all three views", async () => {
    for (const variant of ["list", "boxes", "strips"] as const) {
      const { unmount } = await setup({ variant });
      expect(screen.getAllByText(/row #2 of Building/).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it("shows row #1 for a red row", async () => {
    await setup({}, ["bob", /Bob/]);
    expect(row("Acknowledge")).toHaveTextContent("row #1 of Building");
  });

  it("names the category an owner owns", async () => {
    await setup({ variant: "strips" }, ["olga", /Olga/]);
    expect(screen.getAllByText(/owner of Building/).length).toBeGreaterThan(0);
  });

  it("says a site administrator always has the action", async () => {
    const user = userEvent.setup();
    render(
      <Simulator
        config={config}
        ruleSet={{ ...ruleSet, model: "ordered-admins" }}
        categoryId="door"
      />,
    );
    await pick(user, "alice", /Alice/);
    await user.type(screen.getByRole("combobox", { name: "Extra memberships" }), "site");
    await user.click(await screen.findByRole("option", { name: /Site admins/ }));
    expect(row("Read")).toHaveTextContent("always has this action");
  });

  it("says needs Read first when the required action is not allowed", async () => {
    const rules: RuleSet = {
      ...ruleSet,
      categories: {
        ...ruleSet.categories,
        door: { entries: [{ subject: "user:carol", action: "approve", effect: "allow" }] },
      },
    };
    await setup({ ruleSet: rules }, ["carol", /Carol/]);
    expect(row("Approve")).toHaveTextContent("needs Read first");
  });

  it("says given by the higher action", async () => {
    await setup({}, ["dave", /Dave/]);
    expect(row("Read")).toHaveTextContent("given by Author");
    expect(row("Read")).toHaveTextContent("Would be allowed");
  });

  it("lets the host reword the pieces", async () => {
    await setup(
      { config: { ...config, strings: { "simulator.by.row": "line {n}, {category}" } } },
      ["bob", /Bob/],
    );
    expect(row("Acknowledge")).toHaveTextContent("line 1, Building");
  });
});

const crowd: PoolPerson[] = [
  { id: "user:carol", subjects: ["user:carol"] },
  { id: "user:olga", subjects: ["user:olga"] },
  { id: "user:alice", subjects: ["user:alice"] },
];
const lists: SimulatorProps["lists"] = [
  { id: "appr", action: "approve", people: crowd },
  { id: "ack", action: "ack", label: "Must acknowledge", people: crowd },
  { id: "auth", action: "author", people: [{ id: "user:alice", subjects: ["user:alice"] }] },
];

const listed = (name: string) => screen.getByRole("list", { name });

describe("pool lists", () => {
  it("lists the people owners first, each with a reason", async () => {
    await setup({ lists });
    expect(screen.getByRole("heading", { level: 3, name: "Who can Approve" })).toBeInTheDocument();
    const items = within(listed("Who can Approve")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Olga Park");
    expect(items[0]).toHaveTextContent("owner of Building");
    expect(items[1]).toHaveTextContent("Carol Diaz");
    expect(items[1]).toHaveTextContent("row #1 of Door entry");
  });

  it("names a superuser in the list by what makes them one, after the owners", async () => {
    await setup({
      ruleSet: { ...ruleSet, model: "ordered-admins" },
      lists: [
        {
          id: "appr",
          action: "approve",
          people: [
            { id: "user:carol", subjects: ["user:carol"] },
            { id: "user:olga", subjects: ["user:olga"] },
            { id: "user:bob", subjects: ["user:bob", "group:admins"] },
          ],
        },
      ],
    });
    const items = within(listed("Who can Approve")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Olga Park");
    expect(items[1]).toHaveTextContent("Bob Ray");
    expect(items[1]).toHaveTextContent("always has this action");
    expect(items[2]).toHaveTextContent("Carol Diaz");
  });

  it("shows everyone instead of names for the Everyone row, with the host's title", async () => {
    await setup({ lists });
    expect(screen.getByRole("heading", { level: 3, name: "Must acknowledge" })).toBeInTheDocument();
    const items = within(listed("Must acknowledge")).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Everyone");
    expect(items[0]).toHaveTextContent("row #2 of Building");
    expect(items[0]).not.toHaveTextContent("Alice");
  });

  it("reads Nobody when the list is empty", async () => {
    await setup({ lists });
    expect(screen.getByText("Nobody")).toBeInTheDocument();
  });

  it("uses must for an obligation title and lets strings reword the empty text", async () => {
    await setup({
      lists: [
        { id: "ack", action: "ack", people: crowd },
        { id: "auth", action: "author", people: [crowd[2]!] },
      ],
      config: { ...config, strings: { "simulator.list.nobody": "No one" } },
    });
    expect(
      screen.getByRole("heading", { level: 3, name: "Who must Acknowledge" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No one")).toBeInTheDocument();
  });

  it("is the same in every view", async () => {
    const texts: string[] = [];
    for (const variant of ["list", "boxes", "strips"] as const) {
      const { unmount, container } = await setup({ lists, variant });
      texts.push(container.querySelector(".raci-lists")?.textContent ?? "");
      unmount();
    }
    expect(texts[0]).not.toBe("");
    expect(texts[1]).toBe(texts[0]);
    expect(texts[2]).toBe(texts[0]);
  });

  it("is shown without a person chosen", () => {
    render(<Simulator config={config} ruleSet={ruleSet} categoryId="door" lists={lists} />);
    expect(screen.getByRole("heading", { level: 3, name: "Who can Approve" })).toBeInTheDocument();
  });

  it("uses the rule set's model", () => {
    // The nearest model has no owners, so Olga is not listed there.
    render(
      <Simulator
        config={config}
        ruleSet={{ ...ruleSet, model: undefined }}
        categoryId="door"
        lists={[lists![0]!]}
      />,
    );
    expect(within(listed("Who can Approve")).queryByText(/Olga/)).not.toBeInTheDocument();
  });

  it("is passed to renderResults, which replaces the built-in lists", async () => {
    let seen: unknown;
    await setup({
      lists,
      renderResults: (view) => {
        seen = view.lists;
        return <p>mine</p>;
      },
    });
    expect(screen.getByText("mine")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(seen).toHaveLength(3);
  });

  it("is skipped when the host evaluates", async () => {
    await setup({
      lists,
      evaluate: async () => ({ decision: { allowed: true, reason: "entry", path: [] } }),
    });
    await screen.findByRole("table");
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });
});
