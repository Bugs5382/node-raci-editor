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
/**
 * Runs the code shown in README.md and guides/. Each region between the snippet markers is real,
 * type-checked code that is executed here, and the same text (with the package specifiers) must
 * appear in a Markdown file, so the docs cannot drift from the code.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

// snippet:start quickstart
import { useState } from "react";
import "@/styles/index.css";
import { RulesEditor, SettingsPanel, Simulator, defaultSettings } from "@/index";
import type { RaciConfig, RuleSet } from "@/index";

const people = [
  { id: "user:alice", label: "Alice" },
  { id: "user:bob", label: "Bob" },
];

export const config: RaciConfig = {
  actions: [
    { id: "read", label: "Read" },
    { id: "edit", label: "Edit", implies: ["read"] },
  ],
  subjectKinds: [
    {
      kind: "user",
      label: "Users",
      search: (q) => people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())),
    },
  ],
  resources: [{ id: "docs", label: "Docs", children: [{ id: "specs", label: "Specs" }] }],
};

export const App = () => {
  const [ruleSet, setRuleSet] = useState<RuleSet>({ categories: {}, parents: { specs: "docs" } });
  const [settings, setSettings] = useState(defaultSettings(config));
  return (
    <>
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="specs"
        onChange={setRuleSet}
        settings={settings}
      />
      <Simulator config={config} ruleSet={ruleSet} categoryId="specs" settings={settings} />
      <SettingsPanel config={config} value={settings} onChange={setSettings} />
    </>
  );
};
// snippet:end quickstart

// snippet:start runner
import { isDeepStrictEqual } from "node:util";
import { decide, vectorSubjects } from "@/index";
import type { ActionDef, DecideInput, VectorPerson } from "@/index";
import vectors from "../vectors/decide.json";

interface Case {
  name: string;
  ruleSet: DecideInput["ruleSet"];
  person: VectorPerson;
  category: string;
  action: string;
  expect: { allowed: boolean; reason: string; decidedBy: object | null };
}

/** Returns the names of the cases whose decision differs from `expect`. */
export const runVectors = (): string[] => {
  const file = vectors as unknown as { actions: ActionDef[]; cases: Case[] };
  const failed: string[] = [];
  for (const c of file.cases) {
    const d = decide({
      ruleSet: c.ruleSet,
      actions: file.actions,
      person: { subjects: vectorSubjects(c.person) },
      category: c.category,
      action: c.action,
    });
    const by = d.decidedBy;
    const got = {
      allowed: d.allowed,
      reason: d.reason,
      decidedBy: by
        ? {
            category: by.category,
            subject: by.entry.subject,
            action: by.entry.action,
            effect: by.entry.effect,
          }
        : null,
    };
    if (!isDeepStrictEqual(got, c.expect)) failed.push(c.name);
  }
  return failed;
};
// snippet:end runner

// snippet:start extending
export const extend = (base: RaciConfig): RaciConfig => ({
  ...base,
  actions: [...base.actions, { id: "export", label: "Export", implies: ["read"] }],
  subjectKinds: [
    ...base.subjectKinds,
    {
      kind: "team",
      label: "Teams",
      search: (q) =>
        q.toLowerCase().startsWith("e") ? [{ id: "team:eng", label: "Engineering" }] : [],
      resolve: (subject) => (subject === "team:eng" ? "Engineering" : undefined),
    },
  ],
});

export const compact = (base: RaciConfig) => ({
  ...defaultSettings(base),
  density: "compact" as const,
  confirmDeny: true,
});
// snippet:end extending

// snippet:start host
import { useMemo, useState as useHostState } from "react";
import { RulesEditor as HostRulesEditor, Simulator as HostSimulator } from "@/index";
import type { RaciConfig as HostConfig, ResourceNode } from "@/index";
import type { RuleSet as HostRuleSet } from "@/index";

// The package has no tree component: render your own, pass the nodes in, and keep `parents` in step.
const parentsOf = (nodes: ResourceNode[], parent?: string, out: Record<string, string> = {}) => {
  for (const node of nodes) {
    if (parent) out[node.id] = parent;
    parentsOf(node.children ?? [], node.id, out);
  }
  return out;
};

const idsOf = (nodes: ResourceNode[]): string[] =>
  nodes.flatMap((node) => [node.id, ...idsOf(node.children ?? [])]);

export const HostApp = ({ config, saved }: { config: HostConfig; saved?: string }) => {
  const [ruleSet, setRuleSet] = useHostState<HostRuleSet>(() =>
    saved
      ? (JSON.parse(saved) as HostRuleSet)
      : { categories: {}, parents: parentsOf(config.resources) },
  );
  const [categoryId, setCategoryId] = useHostState(config.resources[0]?.id ?? "");
  const [theme, setTheme] = useHostState<"light" | "dark">("light");
  const json = useMemo(() => JSON.stringify(ruleSet, null, 2), [ruleSet]);
  return (
    <div className="raci-root" data-theme={theme}>
      <select
        aria-label="Resource"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
      >
        {idsOf(config.resources).map((id) => (
          <option key={id}>{id}</option>
        ))}
      </select>
      <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        Theme: {theme}
      </button>
      <HostRulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId={categoryId}
        onChange={setRuleSet}
      />
      <HostSimulator config={config} ruleSet={ruleSet} categoryId={categoryId} />
      <textarea aria-label="Rules as JSON" readOnly value={json} />
    </div>
  );
};
// snippet:end host

// snippet:start examples
import { createOrderedModel, registerModel } from "@/index";
import type { RaciConfig as ExampleConfig, RuleSet as ExampleRules } from "@/index";

// 1. Capabilities only: no users, groups or roles. The host resolves "can:ack" and "can:edit" for
//    whoever is asking, and `contexts` are the named askers the simulator offers.
export const capabilityConfig: ExampleConfig = {
  actions: [
    { id: "read", label: "Read" },
    { id: "edit", label: "Edit", implies: ["read"] },
    { id: "ack", label: "Acknowledge" },
  ],
  subjectKinds: [],
  matchers: [
    { id: "can:edit", label: "Can edit", group: "Access" },
    { id: "can:ack", label: "Can acknowledge", group: "Duties" },
  ],
  contexts: [
    { id: "hire", label: "New hire", subjects: ["can:ack"] },
    { id: "guest", label: "Guest", subjects: [] },
  ],
  resources: [{ id: "policies", label: "Policies", children: [{ id: "leave", label: "Leave" }] }],
};

// 2. A help desk on the ordered model: first matching row from the top wins, owners always have
//    the action, and Everyone is an ordinary row. Short labels, two column groups, and an
//    Acknowledge obligation that needs Read. The root seat (the subject `role:root`, which the host
//    gives to one account) always has Read, Author and Manage; Approve and Acknowledge follow rows.
registerModel(
  createOrderedModel({
    id: "desk",
    label: "Help desk",
    superusers: { subjects: ["role:root"], actions: ["r", "a", "m"] },
  }),
);

export const deskConfig: ExampleConfig = {
  actions: [
    { id: "r", label: "Read", shortLabel: "R", group: "permissions" },
    { id: "a", label: "Author", shortLabel: "A", implies: ["r"], group: "permissions" },
    { id: "m", label: "Manage", shortLabel: "M", implies: ["a", "r"], group: "obligations" },
    {
      id: "ack",
      label: "Acknowledge",
      shortLabel: "ACK",
      kind: "obligation",
      requires: ["r"],
      group: "obligations",
    },
  ],
  subjectKinds: [
    { kind: "user", label: "Person", search: () => [{ id: "user:lena", label: "Lena" }] },
    { kind: "group", label: "Team", search: () => [{ id: "group:agents", label: "Agents" }] },
  ],
  groups: [
    { id: "permissions", label: "Permissions" },
    { id: "obligations", label: "Obligations" },
  ],
  resources: [
    { id: "support", label: "Support", children: [{ id: "escalated", label: "Escalated" }] },
  ],
};

export const deskRules: ExampleRules = {
  model: "desk",
  parents: { escalated: "support" },
  categories: {
    support: {
      owners: ["user:lena"], // inherited by every category below
      entries: [
        { subject: "everyone:*", action: "r", effect: "allow" },
        { subject: "everyone:*", action: "ack", effect: "allow" },
      ],
    },
    escalated: {
      entries: [
        { subject: "group:agents", action: "r", effect: "deny" }, // row order is the rule
        { subject: "role:root", action: "r", effect: "deny" }, // saved, never applied to root
      ],
    },
  },
};
// snippet:end examples

// snippet:start cells
import type { RenderCellProps, RulesEditorProps } from "@/index";

// A host cell: a plain button that keeps the fixed size and the editor's accessible name.
export const HostCell = (cell: RenderCellProps) => (
  <button
    type="button"
    aria-label={cell.label}
    title={cell.title}
    disabled={cell.readOnly}
    style={{ width: cell.size.width, height: cell.size.height }}
    onClick={cell.onCycle}
  >
    {cell.state === "allow" ? "Y" : cell.state === "deny" ? "N" : ""}
  </button>
);

// `cellVariant="marks"` draws a check, an X or nothing; `renderCell` draws the whole cell.
export const MarksEditor = (props: RulesEditorProps) => (
  <RulesEditor {...props} cellVariant="marks" />
);
export const HostCellEditor = (props: RulesEditorProps) => (
  <RulesEditor {...props} renderCell={HostCell} />
);
// snippet:end cells

const SPECIFIERS: [string, string][] = [
  ['"@/styles/index.css"', '"node-raci-editor/styles.css"'],
  ['"../vectors/decide.json"', '"node-raci-editor/vectors/decide.json"'],
  ['"@/index"', '"node-raci-editor"'],
];

const regions = (): Record<string, string> => {
  const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const out: Record<string, string> = {};
  const re = /\/\/ snippet:start (\w+)\n([\s\S]*?)\/\/ snippet:end \1/g;
  for (const m of source.matchAll(re)) {
    let text = m[2] as string;
    for (const [from, to] of SPECIFIERS) text = text.split(from).join(to);
    out[m[1] as string] = text.trimEnd();
  }
  return out;
};

const doc = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

describe("quick start", () => {
  it("renders the editor, simulator and settings together", async () => {
    const user = userEvent.setup();
    render(<App />);
    const editor = screen.getByRole("region", { name: /^Rules for / });
    expect(
      screen.getByRole("group", { name: "Previews what these rules would allow" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();

    await user.type(within(editor).getByPlaceholderText("Search by name"), "ali");
    await user.click(await within(editor).findByText("Alice", {}, { timeout: 2000 }));
    await user.click(within(editor).getByRole("button", { name: /^Alice, Edit: not set/ }));
    expect(within(editor).getByRole("button", { name: /^Alice, Edit: allow/ })).toBeInTheDocument();
    expect(
      within(editor).getByRole("button", { name: /^Alice, Read: not set, included by Edit/ }),
    ).toBeInTheDocument();
  });
});

describe("host app", () => {
  it("renders the editor, the simulator and the JSON together and switches the theme", async () => {
    const user = userEvent.setup();
    const { container } = render(<HostApp config={deskConfig} />);
    expect(screen.getByRole("region", { name: /^Rules for / })).toBeInTheDocument();
    expect(screen.getByLabelText("Rules as JSON")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Theme: light" }));
    expect(container.querySelector(".raci-root")).toHaveAttribute("data-theme", "dark");
  });
});

describe("examples", () => {
  it("shows the short labels and both column groups of the help desk", () => {
    render(
      <RulesEditor
        config={deskConfig}
        ruleSet={deskRules}
        categoryId="escalated"
        onChange={() => {}}
        headerMode="short"
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Acknowledge/ })).toBeInTheDocument();
    expect(screen.getByText("Permissions")).toBeInTheDocument();
    expect(screen.getByText("Obligations")).toBeInTheDocument();
  });
  it("renders the capabilities-only setup without a subject search", () => {
    render(
      <RulesEditor
        config={capabilityConfig}
        ruleSet={{ categories: {}, parents: {} }}
        categoryId="leave"
        onChange={() => {}}
      />,
    );
    expect(screen.queryByPlaceholderText("Search by name")).toBeNull();
  });
});

describe("cells", () => {
  const props: RulesEditorProps = {
    config,
    ruleSet: {
      categories: { docs: { entries: [{ subject: "user:a", action: "read", effect: "allow" }] } },
      parents: {},
    },
    categoryId: "docs",
    onChange: () => {},
  };
  it("draws marks and a host cell from the documented code", () => {
    const marks = render(<MarksEditor {...props} />);
    expect(marks.container.querySelector("tbody .raci-cell--marks")).not.toBeNull();
    marks.unmount();
    const host = render(<HostCellEditor {...props} />);
    expect(host.container.querySelector("tbody .raci-cell")).toBeNull();
    expect(host.container.querySelector("tbody button")?.textContent).toBe("Y");
  });
});

describe("vector runner", () => {
  it("passes every shared vector", () => {
    expect(runVectors()).toEqual([]);
  });
});

describe("extending", () => {
  it("adds an action and a subject kind without touching the base", () => {
    const next = extend(config);
    expect(next.actions.map((a) => a.id)).toEqual(["read", "edit", "export"]);
    expect(next.subjectKinds.map((k) => k.kind)).toEqual(["user", "team"]);
    expect(config.actions).toHaveLength(2);
    expect(compact(next).density).toBe("compact");
  });
});

describe("docs", () => {
  const found = regions();
  it.each([
    ["quickstart", "README.md"],
    ["quickstart", "guides/getting-started.md"],
    ["runner", "guides/test-vectors.md"],
    ["extending", "guides/extending.md"],
    ["host", "guides/getting-started.md"],
    ["examples", "guides/configuration.md"],
    ["cells", "guides/components.md"],
    ["cells", "README.md"],
  ])("shows the %s snippet verbatim in %s", (name, file) => {
    expect(found[name]).toBeTruthy();
    expect(doc(file)).toContain(found[name] as string);
  });
});
