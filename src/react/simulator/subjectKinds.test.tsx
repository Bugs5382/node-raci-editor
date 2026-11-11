import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RaciConfig, RuleSet, SubjectKind } from "@/core/types";
import { subjectLabel } from "@/react/simulator/model";
import { Simulator } from "@/react/simulator/Simulator";

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
  actions: [{ id: "view", label: "View" }],
  subjectKinds,
  resources: [{ id: "docs", label: "Documents" }],
});

const rules = (subject: string): RuleSet => ({
  parents: {},
  categories: { docs: { entries: [{ subject, action: "view", effect: "allow" }] } },
});

const pick = async (user: ReturnType<typeof userEvent.setup>, name: string, text: string) => {
  await user.type(screen.getByRole("combobox", { name }), text);
  await user.click(await screen.findByRole("option", { name: new RegExp(text, "i") }));
};

describe.each([
  ["group only", [kind("group", "Group", { "group:ops": "Ops crew" })], "group:ops", "Ops crew"],
  ["team only", [kind("team", "Squad", { "team:eng": "Engineering" })], "team:eng", "Engineering"],
])("Simulator for a host with %s", (_n, kinds, subject, label) => {
  it.each(["list", "boxes", "strips"] as const)("picks the person and decides (%s)", async (v) => {
    const user = userEvent.setup();
    render(
      <Simulator config={make(kinds)} ruleSet={rules(subject)} categoryId="docs" variant={v} />,
    );
    expect(screen.queryByRole("combobox", { name: "Extra memberships" })).not.toBeInTheDocument();
    await pick(user, "Person", label.slice(0, 3));
    expect(screen.getAllByText(/Would be allowed/).length).toBeGreaterThan(0);
    expect(document.body).toHaveTextContent(label);
  });
});

describe("Simulator person kind fallback", () => {
  it("uses the first configured kind when there is no user kind, memberships from the rest", async () => {
    const user = userEvent.setup();
    const config = make([
      kind("team", "Team", { "team:eng": "Engineering" }),
      kind("department", "Department", { "department:it": "IT dept" }),
    ]);
    render(<Simulator config={config} ruleSet={rules("department:it")} categoryId="docs" />);
    await pick(user, "Person", "Eng");
    expect(screen.getAllByText(/Would be denied/)[0]).toBeInTheDocument();
    await pick(user, "Extra memberships", "IT");
    expect(screen.getByText(/Would be allowed by IT dept/)).toBeInTheDocument();
  });

  it("keeps user as the person kind when the host has one", async () => {
    const user = userEvent.setup();
    const config = make([
      kind("team", "Team", { "team:eng": "Engineering" }),
      kind("user", "User", { "user:amy": "Amy" }),
    ]);
    render(<Simulator config={config} ruleSet={rules("team:eng")} categoryId="docs" />);
    await pick(user, "Person", "Amy");
    expect(screen.getAllByText(/Would be denied/)[0]).toBeInTheDocument();
    await pick(user, "Extra memberships", "Eng");
    expect(screen.getByText(/Would be allowed by Engineering/)).toBeInTheDocument();
  });

  it("still honours an explicit personKind", async () => {
    const user = userEvent.setup();
    const config = make([
      kind("team", "Team", { "team:eng": "Engineering" }),
      kind("service", "Service", { "service:ci": "CI runner" }),
    ]);
    render(
      <Simulator
        config={config}
        ruleSet={rules("service:ci")}
        categoryId="docs"
        personKind="service"
      />,
    );
    await pick(user, "Person", "CI");
    expect(screen.getByText(/Would be allowed by CI runner/)).toBeInTheDocument();
  });

  it("does not name group or role in the memberships placeholder", () => {
    const config = make([kind("user", "User", {}), kind("team", "Team", {})]);
    render(<Simulator config={config} ruleSet={rules("team:eng")} categoryId="docs" />);
    const box = screen.getByRole("combobox", { name: "Extra memberships" });
    expect(box.getAttribute("placeholder")).not.toMatch(/group|role/i);
  });
});

describe("subject labels for unknown kinds", () => {
  const kinds = [kind("team", "Team", { "team:eng": "Engineering" })];
  it("resolves known and shows unknown or colonless subjects as stored", () => {
    expect(subjectLabel(kinds, "team:eng")).toBe("Engineering");
    expect(subjectLabel(kinds, "dept:legal")).toBe("dept:legal");
    expect(subjectLabel(kinds, "everyone")).toBe("everyone");
  });
});
