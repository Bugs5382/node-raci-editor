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

// snippet:start demo
import "@/styles/index.css";
import "@/demo/index.css";
import { RaciDemo } from "@/demo/index";

export const DemoPage = () => <RaciDemo initialPreset="other" initialTheme="dark" />;
// snippet:end demo

const SPECIFIERS: [string, string][] = [
  ['"@/demo/index.css"', '"node-raci-editor/demo.css"'],
  ['"@/demo/index"', '"node-raci-editor/demo"'],
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

describe("demo", () => {
  it("renders the packaged demo on the chosen preset and theme", () => {
    const { container } = render(<DemoPage />);
    expect(screen.getByRole("columnheader", { name: "Publish" })).toBeInTheDocument();
    expect(container.querySelector(".demo-app")).toHaveAttribute("data-theme", "dark");
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
    ["demo", "README.md"],
    ["demo", "guides/demo.md"],
  ])("shows the %s snippet verbatim in %s", (name, file) => {
    expect(found[name]).toBeTruthy();
    expect(doc(file)).toContain(found[name] as string);
  });
});
