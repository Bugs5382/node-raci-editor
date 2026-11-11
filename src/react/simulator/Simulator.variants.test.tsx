import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Decision, RaciConfig, RuleSet, SubjectOption } from "@/core/types";
import { Simulator } from "@/react/simulator/Simulator";
import type { SimulatorProps } from "@/react/simulator/Simulator";

const people: SubjectOption[] = [
  { id: "user:alice", label: "Alice Ng" },
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
      search: (q) => match(groups, q),
      resolve: (s) => groups.find((g) => g.id === s)?.label,
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
        { subject: "group:staff", action: "approve", effect: "deny" },
        { subject: "group:staff", action: "approve", effect: "allow" },
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

const card = (name: string) => screen.getByRole("article", { name });

const setup = async (
  props: Partial<SimulatorProps>,
  who = ["Person", "bob", /Bob Ray/] as const,
) => {
  const user = userEvent.setup();
  const out = render(<Simulator config={config} ruleSet={ruleSet} {...props} />);
  await pick(user, who[0], who[1], who[2]);
  return { user, ...out };
};

describe("variant list (default)", () => {
  it("keeps the table and omits the new views", async () => {
    await setup({ categoryId: "finance" });
    expect(screen.getByRole("table", { name: "Results" })).toBeInTheDocument();
    expect(document.querySelector(".raci-walk")).not.toBeNull();
    expect(document.querySelector(".raci-boxes")).toBeNull();
    expect(document.querySelector(".raci-strips")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Extra memberships" })).toBeInTheDocument();
  });

  it("is the same when variant is set to list", async () => {
    await setup({ categoryId: "finance", variant: "list" });
    expect(screen.getByRole("table", { name: "Results" })).toBeInTheDocument();
  });
});

describe("variant boxes", () => {
  it("renders one card per visible action with an accessible name", async () => {
    await setup({
      variant: "boxes",
      categoryId: "finance",
      settings: { visibleActions: ["read", "approve"] },
    });
    expect(screen.getByRole("list", { name: "Results" })).toHaveClass("raci-boxes");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(card("Read")).toBeInTheDocument();
    expect(card("approve")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a default deny with no rule matched and every category walked", async () => {
    await setup({ variant: "boxes", categoryId: "legal" });
    const read = card("Read");
    expect(read).toHaveClass("raci-box--deny");
    expect(within(read).getByText("Denied")).toBeInTheDocument();
    expect(within(read).getByText("Denied: no rule matched (default deny)")).toBeInTheDocument();
    expect(within(read).getByText("No rule matched")).toBeInTheDocument();
    expect(within(read).getAllByText("no match")).toHaveLength(2);
    expect(within(read).getByText("Legal")).toBeInTheDocument();
    expect(within(read).getByText("All categories")).toBeInTheDocument();
    expect(within(read).queryByText(/Overridden/)).not.toBeInTheDocument();
  });

  it("shows an allowed, inherited decision with subject, effect, category and entry number", async () => {
    const { user } = await setup({ variant: "boxes", categoryId: "finance" });
    await pick(user, "Extra memberships", "sta", /Staff/);
    const read = card("Read");
    expect(read).toHaveClass("raci-box--allow");
    expect(within(read).getByText("Allowed")).toBeInTheDocument();
    expect(
      within(read).getByText("Allowed by Staff (Read), inherited from Company"),
    ).toBeInTheDocument();
    const by = read.querySelector(".raci-box-by") as HTMLElement;
    expect(by).toHaveTextContent("Staff");
    expect(by).toHaveTextContent("Allow");
    expect(by).toHaveTextContent("Company");
    expect(by).toHaveTextContent("Entry #1");
    const steps = read.querySelectorAll(".raci-box-walk > ol > li");
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent("Finance");
    expect(steps[0]).toHaveTextContent("no match");
    expect(steps[1]).toHaveAttribute("data-decided", "true");
    expect(steps[1]?.querySelector("[data-decisive]")).toHaveTextContent("deciding");
    expect(steps[1]?.querySelector("[data-decisive]")).toHaveTextContent("direct");
  });

  it("tags implied matches", async () => {
    const { user } = await setup({ variant: "boxes", categoryId: "finance" });
    await pick(user, "Extra memberships", "fin", /Finance team/);
    const read = card("Read");
    expect(read.querySelector(".raci-box-match")).toHaveTextContent("implied");
  });

  it("lists the losing match in a collapsed Overridden element when deny beats allow", async () => {
    const { user } = await setup({ variant: "boxes", categoryId: "finance" });
    await pick(user, "Extra memberships", "sta", /Staff/);
    const approve = card("approve");
    expect(approve).toHaveClass("raci-box--deny");
    const details = approve.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getByText("Overridden (1)")).toBeInTheDocument();
    expect(details).toHaveTextContent("Allow");
    expect(details).toHaveTextContent("Entry #3");
    const by = approve.querySelector(".raci-box-by") as HTMLElement;
    expect(by).toHaveTextContent("Deny");
    expect(by).toHaveTextContent("Entry #2");
  });

  it("marks where inheriting stopped", async () => {
    await setup({ variant: "boxes", categoryId: "reports" });
    const read = card("Read");
    expect(within(read).getByText("Inheriting stopped here")).toBeInTheDocument();
    expect(
      within(read).getByText("Denied: no rule matched, and inheriting stopped at Reports"),
    ).toBeInTheDocument();
  });

  it("follows the empty states", () => {
    render(<Simulator config={config} ruleSet={ruleSet} variant="boxes" />);
    expect(screen.getByText("Choose a person to see what they can do.")).toBeInTheDocument();
  });

  it("shows empty category and action states", async () => {
    const { rerender } = await setup({ variant: "boxes", categoryId: "finance" });
    rerender(
      <Simulator
        config={config}
        ruleSet={ruleSet}
        variant="boxes"
        categoryId="finance"
        settings={{ visibleActions: [] }}
      />,
    );
    expect(screen.getByText("There are no actions to show.")).toBeInTheDocument();
  });
});

describe("variant strips", () => {
  it("renders N strips for N visible actions with icon words and one reason line", async () => {
    const { user } = await setup({ variant: "strips", categoryId: "finance" });
    await pick(user, "Extra memberships", "fin", /Finance team/);
    const strips = within(screen.getByRole("list", { name: "Results" })).getAllByRole("listitem");
    expect(strips).toHaveLength(3);
    expect(screen.getByRole("list", { name: "Results" })).toHaveClass("raci-strips");
    expect(strips[0]).toHaveClass("raci-strip", "raci-strip--allow");
    expect(strips[0]).toHaveTextContent("Read - Yes");
    expect(strips[2]).toHaveClass("raci-strip--deny");
    expect(strips[2]).toHaveTextContent("approve - No");
    expect(strips[2]?.querySelectorAll(".raci-strip-reason")).toHaveLength(1);
    expect(strips[2]?.querySelector(".raci-strip-icon")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("takes one strip per configured action, not a fixed count", async () => {
    await setup({
      variant: "strips",
      categoryId: "finance",
      settings: { visibleActions: ["author"] },
    });
    expect(
      within(screen.getByRole("list", { name: "Results" })).getAllByRole("listitem"),
    ).toHaveLength(1);
  });

  it("uses overridden strings", async () => {
    await setup({
      variant: "strips",
      categoryId: "finance",
      config: { ...config, strings: { "simulator.strip.yes": "Oui", "simulator.strip.no": "Non" } },
    });
    expect(screen.getAllByText(/- Non$/)).toHaveLength(3);
  });
});

describe("renderResults", () => {
  it("replaces only the results region and receives the view", async () => {
    const render1 = vi.fn((v) => <p>custom {v.results.length}</p>);
    await setup({ renderResults: render1, variant: "boxes", categoryId: "finance" });
    expect(screen.getByText("custom 3")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Extra memberships" })).toBeInTheDocument();
    const view = render1.mock.calls[0]?.[0];
    expect(view.status).toBe("ready");
    expect(view.person.subjects).toEqual(["user:bob"]);
    expect(view.results[0].decision.trace).toBeDefined();
    expect(view.labelOf("*")).toBe("All categories");
    expect(view.subjectLabel("user:bob")).toBe("Bob Ray");
    expect(view.t("simulator.allowed")).toBe("Allowed");
  });
});

describe("show", () => {
  it("hides the memberships picker when asked", () => {
    render(<Simulator config={config} ruleSet={ruleSet} show={{ memberships: false }} />);
    expect(screen.queryByRole("combobox", { name: "Extra memberships" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Person" })).toBeInTheDocument();
  });

  it("keeps the memberships picker for true or omitted flags", () => {
    const { unmount } = render(
      <Simulator config={config} ruleSet={ruleSet} show={{ memberships: true }} />,
    );
    expect(screen.getByRole("combobox", { name: "Extra memberships" })).toBeInTheDocument();
    unmount();
    render(<Simulator config={config} ruleSet={ruleSet} />);
    expect(screen.getByRole("combobox", { name: "Extra memberships" })).toBeInTheDocument();
  });
});

const decision = (allowed: boolean): Decision => ({
  allowed,
  reason: allowed ? "entry" : "default-deny",
  path: ["finance"],
  ...(allowed
    ? {
        decidedBy: {
          category: "finance",
          entry: { subject: "user:bob", action: "read", effect: "allow" as const },
        },
      }
    : {}),
});

type Deferred = {
  resolve: (v: { decision: Decision; reasonText?: string }) => void;
  reject: (e: unknown) => void;
};
const deferredEvaluate = () => {
  const calls: Array<Deferred & { person: string[]; action: string }> = [];
  const evaluate: NonNullable<SimulatorProps["evaluate"]> = (q) =>
    new Promise((resolve, reject) => {
      calls.push({ resolve, reject, person: q.person.subjects, action: q.action });
    });
  return { calls, evaluate };
};

describe("evaluate", () => {
  it("shows loading, then host results and host wording, without running decide", async () => {
    const { calls, evaluate } = deferredEvaluate();
    await setup({ evaluate, categoryId: "finance", variant: "strips" });
    expect(screen.getByText("Checking access...")).toBeInTheDocument();
    expect(document.querySelectorAll(".raci-strip--skeleton")).toHaveLength(3);
    expect(calls).toHaveLength(3);
    calls.forEach((c, i) =>
      c.resolve({ decision: decision(i === 0), reasonText: `host says ${i}` }),
    );
    expect(await screen.findByText("host says 0")).toBeInTheDocument();
    expect(screen.getByText("Read - Yes")).toBeInTheDocument();
    expect(screen.getByText("Author - No")).toBeInTheDocument();
    expect(screen.queryByText("Checking access...")).not.toBeInTheDocument();
  });

  it("falls back to the package wording when the host gives no reasonText", async () => {
    const evaluate = vi.fn(async () => ({ decision: decision(false) }));
    await setup({ evaluate, categoryId: "finance" });
    const rows = await screen.findAllByText("Denied: no rule matched (default deny)");
    expect(rows).toHaveLength(3);
  });

  it("shows a plain loading line outside the strips variant", async () => {
    const { evaluate } = deferredEvaluate();
    await setup({ evaluate, categoryId: "finance" });
    expect(screen.getByText("Checking access...")).toHaveClass("raci-loading");
  });

  it("renders host decisions without a trace in the boxes view", async () => {
    const evaluate = vi.fn(async () => ({ decision: decision(true), reasonText: "host" }));
    await setup({ evaluate, categoryId: "finance", variant: "boxes" });
    const read = await screen.findByRole("article", { name: "Read" });
    expect(read).toHaveTextContent("host");
    expect(read.querySelector(".raci-box-by")).not.toHaveTextContent("Entry #");
    expect(read.querySelector(".raci-box-muted")).toBeNull();
    expect(read.querySelector("details")).toBeNull();
  });

  it("shows an error with retry, then recovers", async () => {
    const { calls, evaluate } = deferredEvaluate();
    const { user } = await setup({ evaluate, categoryId: "finance" });
    calls.forEach((c) => c.reject(new Error("down")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not check access.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Checking access...")).toBeInTheDocument();
    await waitFor(() => expect(calls).toHaveLength(6));
    calls.slice(3).forEach((c) => c.resolve({ decision: decision(true), reasonText: "back" }));
    expect(await screen.findAllByText("back")).toHaveLength(3);
  });

  it("shows the error as a danger strip in the strips variant", async () => {
    const evaluate = vi.fn(() => Promise.reject(new Error("down")));
    await setup({ evaluate, categoryId: "finance", variant: "strips" });
    const alert = await screen.findByRole("alert");
    expect(alert.parentElement).toHaveClass("raci-strip", "raci-strip--error");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("drops a stale answer when the person changes while it is pending", async () => {
    const { calls, evaluate } = deferredEvaluate();
    const { user } = await setup({ evaluate, categoryId: "finance" });
    const first = calls.slice(0, 3);
    await user.click(screen.getByRole("button", { name: "Remove Bob Ray" }));
    await pick(user, "Person", "ali", /Alice Ng/);
    await waitFor(() => expect(calls).toHaveLength(6));
    first.forEach((c) => c.resolve({ decision: decision(true), reasonText: "stale answer" }));
    await Promise.resolve();
    expect(screen.queryByText("stale answer")).not.toBeInTheDocument();
    expect(screen.getByText("Checking access...")).toBeInTheDocument();
    calls
      .slice(3)
      .forEach((c) => c.resolve({ decision: decision(false), reasonText: "fresh answer" }));
    expect(await screen.findAllByText("fresh answer")).toHaveLength(3);
  });

  it("drops a stale failure too", async () => {
    const { calls, evaluate } = deferredEvaluate();
    const { user } = await setup({ evaluate, categoryId: "finance" });
    const first = calls.slice(0, 3);
    await user.click(screen.getByRole("button", { name: "Remove Bob Ray" }));
    await pick(user, "Person", "ali", /Alice Ng/);
    first.forEach((c) => c.reject(new Error("late")));
    await Promise.resolve();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not call evaluate until there is something to ask", () => {
    const evaluate = vi.fn();
    render(<Simulator config={config} ruleSet={ruleSet} evaluate={evaluate} />);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("lets renderResults take over once host results are ready", async () => {
    const evaluate = vi.fn(async () => ({ decision: decision(true), reasonText: "x" }));
    await setup({
      evaluate,
      categoryId: "finance",
      renderResults: (v) => (
        <p>
          {v.status} {v.results.length}
        </p>
      ),
    });
    expect(await screen.findByText("ready 3")).toBeInTheDocument();
  });

  it("keeps the results region a polite live region", async () => {
    await setup({ variant: "boxes", categoryId: "finance" });
    expect(document.querySelector(".raci-results")).toHaveAttribute("aria-live", "polite");
  });
});
