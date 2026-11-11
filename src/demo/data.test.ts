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
import { describe, expect, it, vi } from "vitest";
import { getModel } from "@/core/registry";
import { decide } from "@/index";
import type { Person } from "@/index";
import {
  demoPresets,
  demoRuleSet,
  memoryKind,
  nodeIds,
  nodeLabel,
  parentsOf,
  presetById,
  presets,
} from "./data";
import { parseRuleSet, readTheme, serializeRuleSet, writeTheme } from "./io";

const person = (...subjects: string[]): Person => ({ subjects });

describe("seed validity", () => {
  for (const preset of presets) {
    describe(preset.label, () => {
      const actionIds = preset.config.actions.map((a) => a.id);
      const ids = nodeIds(preset.config.resources);
      const kinds = new Set(preset.config.subjectKinds.map((k) => k.kind));

      it("only uses known actions, categories and subject kinds", () => {
        for (const [category, rules] of Object.entries(preset.seed.categories)) {
          if (category !== "*") expect(ids).toContain(category);
          for (const entry of rules.entries) {
            expect(actionIds).toContain(entry.action);
            const known =
              kinds.has(entry.subject.split(":")[0]!) ||
              entry.subject === "everyone:*" ||
              (preset.config.matchers ?? []).some((m) => m.id === entry.subject);
            expect(known, entry.subject).toBe(true);
          }
        }
        for (const [child, parent] of Object.entries(preset.seed.parents)) {
          expect(ids).toContain(child);
          expect(ids).toContain(parent);
        }
        expect(ids).toContain(preset.initialCategory);
      });

      it("has 10 to 12 tree nodes", () => {
        expect(ids.length).toBeGreaterThanOrEqual(10);
        expect(ids.length).toBeLessThanOrEqual(12);
      });

      it("survives the import validator", () => {
        expect(parseRuleSet(serializeRuleSet(preset.seed), actionIds)).toEqual(preset.seed);
      });
    });
  }

  it("decides the sample cases as described", () => {
    const { config, seed } = presetById("org");
    const ask = (category: string, action: string, ...subjects: string[]) =>
      decide({
        ruleSet: seed,
        actions: config.actions,
        person: person(...subjects),
        category,
        action,
      }).allowed;
    expect(ask("payroll", "read", "user:carol")).toBe(true); // manage implies read
    expect(ask("payroll", "read", "user:bob", "group:finance")).toBe(false); // deny case
    expect(ask("payroll", "read", "user:zed", "group:everyone")).toBe(false); // stopInheriting
    expect(ask("reports", "read", "user:dave", "group:everyone")).toBe(false); // child deny
    expect(ask("reports", "read", "user:alice", "group:everyone")).toBe(true); // inherited allow
    expect(ask("contracts", "read", "user:erin", "group:contractors")).toBe(true); // re-allow
    expect(ask("disputes", "read", "user:x", "group:contractors")).toBe(false);
  });

  it("runs the short-labels preset on the ordered model, with site administrators for Read, Author and Manage", () => {
    const { config, seed } = presetById("short");
    expect(seed.model).toBe("demo-ordered");
    expect(getModel("demo-ordered").capabilities.superuser).toBe(true);
    const ask = (category: string, action: string, ...subjects: string[]) =>
      decide({
        ruleSet: seed,
        actions: config.actions,
        person: person(...subjects),
        category,
        action,
      });
    // Everyone reads and must acknowledge; Ines's own red row above it lifts the duty for her.
    expect(ask("access", "r", "user:tess").allowed).toBe(true);
    expect(ask("access", "ack", "user:tess").allowed).toBe(true);
    expect(ask("access", "ack", "user:ines").allowed).toBe(false);
    // A finance deny on Read in networks, which a site administrator keeps over.
    expect(ask("networks", "r", "group:finance").allowed).toBe(false);
    expect(ask("networks", "r", "group:finance", "role:admin")).toMatchObject({
      allowed: true,
      reason: "superuser",
    });
    // The administrator's list is Read, Author and Manage: Approve and Acknowledge follow the rows.
    expect(ask("access", "m", "role:admin").reason).toBe("superuser");
    expect(ask("access", "apv", "role:admin")).toMatchObject({
      allowed: false,
      reason: "default-deny",
    });
    expect(ask("access", "ack", "role:admin")).toMatchObject({ allowed: true, reason: "entry" });
    // An owner of IT, inherited into Door entry, approves through the owner list.
    expect(ask("access", "apv", "user:omar")).toMatchObject({ allowed: true, reason: "owner" });
    expect(ask("access", "apv", "user:tess").allowed).toBe(false);
  });

  it("decides the capabilities-only preset through decide(), with no users, groups or roles", () => {
    const { config, seed } = presetById("capabilities");
    expect(config.subjectKinds).toEqual([]);
    const ask = (category: string, action: string, ...subjects: string[]) =>
      decide({
        ruleSet: seed,
        actions: config.actions,
        person: person("everyone:*", ...subjects),
        category,
        action,
      });
    expect(ask("access", "read").allowed).toBe(true); // everyone reads
    expect(ask("access", "ack").allowed).toBe(false);
    expect(ask("access", "ack", "can:ack").allowed).toBe(true);
    expect(ask("access", "approve", "has:approve").allowed).toBe(true);
    expect(ask("access", "approve", "can:ack").allowed).toBe(false);
    expect(ask("onboarding", "ack", "can:ack").decidedBy?.category).toBe("policies"); // inherited
  });

  it("runs the ordered preset on the ordered model, where the order of rows decides", () => {
    const { config, seed } = presetById("ordered");
    expect(seed.model).toBe("ordered");
    const ask = (category: string, action: string, ...subjects: string[]) =>
      decide({
        ruleSet: seed,
        actions: config.actions,
        person: person(...subjects),
        category,
        action,
      });
    // Ravi's own red rows sit above his team's green ones; any other agent reads.
    expect(ask("escalated", "read", "user:ravi", "group:agents").allowed).toBe(false);
    expect(ask("escalated", "read", "user:tess", "group:agents").allowed).toBe(true);
    // The owner of Support, inherited into Escalated, is not affected by that red row.
    expect(ask("escalated", "read", "user:lena")).toMatchObject({ allowed: true, reason: "owner" });
    // Everyone reads in Support; the row is inherited into Escalated as its last row.
    expect(ask("escalated", "read", "user:kim").allowed).toBe(true);
  });

  it("falls back to the first preset for an unknown id", () => {
    expect(presetById("nope")).toBe(presets[0]);
  });

  it("gives the second preset different actions and strings", () => {
    const other = presetById("other");
    expect(other.config.actions.map((a) => a.id)).toEqual(["view", "edit", "publish"]);
    expect(other.config.strings?.["editor.title"]).toBe("Permissions for {category}");
  });
});

describe("tree helpers", () => {
  const tree = [{ id: "a", label: "A", children: [{ id: "b", label: "B" }] }];
  it("walks ids, labels and parents", () => {
    expect(nodeIds(tree)).toEqual(["a", "b"]);
    expect(nodeLabel(tree, "b")).toBe("B");
    expect(nodeLabel(tree, "zz")).toBe("zz");
    expect(parentsOf(tree)).toEqual({ b: "a" });
  });
});

describe("memoryKind", () => {
  it("searches after a delay and resolves labels", async () => {
    vi.useFakeTimers();
    const kind = memoryKind("user", "User", [
      { id: "user:a", label: "Ann" },
      { id: "user:b", label: "Bo" },
    ]);
    const pending = kind.search("an");
    await vi.advanceTimersByTimeAsync(150);
    expect(await pending).toEqual([{ id: "user:a", label: "Ann" }]);
    const all = kind.search("");
    await vi.advanceTimersByTimeAsync(150);
    expect(await all).toHaveLength(2);
    vi.useRealTimers();
    expect(kind.resolve("user:b")).toBe("Bo");
    expect(kind.resolve("user:q")).toBeUndefined();
  });
});

describe("parseRuleSet", () => {
  const ok = { categories: { c: { entries: [] } }, parents: {} };
  const bad: [string, unknown][] = [
    ["not an object", []],
    ["missing parents", { categories: {} }],
    ["non-string parent", { categories: {}, parents: { a: 1 } }],
    ["category without entries", { categories: { c: {} }, parents: {} }],
    [
      "bad effect",
      {
        categories: { c: { entries: [{ subject: "user:a", action: "read", effect: "x" }] } },
        parents: {},
      },
    ],
    [
      "subject without kind",
      {
        categories: { c: { entries: [{ subject: "a", action: "read", effect: "allow" }] } },
        parents: {},
      },
    ],
    [
      "unknown action",
      {
        categories: { c: { entries: [{ subject: "user:a", action: "zap", effect: "allow" }] } },
        parents: {},
      },
    ],
  ];
  it("accepts a valid rule set", () => {
    expect(parseRuleSet(JSON.stringify(ok), ["read"])).toEqual(ok);
  });
  it("rejects malformed input with a message", () => {
    expect(() => parseRuleSet("{", ["read"])).toThrow("Not valid JSON.");
    for (const [, value] of bad) {
      expect(() => parseRuleSet(JSON.stringify(value), ["read"])).toThrow();
    }
  });
});

describe("theme storage", () => {
  it("round trips and tolerates blocked storage", () => {
    window.localStorage.clear();
    expect(readTheme()).toBe("system");
    writeTheme("dark");
    expect(readTheme()).toBe("dark");
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readTheme()).toBe("system");
    expect(() => writeTheme("light")).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});

describe("public builders", () => {
  it("lists both presets with their seed and first category", () => {
    const list = demoPresets();
    expect(list.map((p) => p.id)).toEqual([
      "org",
      "other",
      "short",
      "cells",
      "capabilities",
      "ordered",
    ]);
    expect(list[0]!.seed).toEqual(presetById("org").seed);
    expect(list[1]!.initialCategory).toBe("drafts");
  });

  it("hands out fresh rule sets that can be changed freely", () => {
    const a = demoRuleSet("org");
    a.categories.payroll!.entries.length = 0;
    expect(demoRuleSet("org").categories.payroll!.entries).toHaveLength(3);
    expect(demoPresets()[0]!.seed).not.toBe(demoPresets()[0]!.seed);
  });

  it("defaults to the first preset and falls back for an unknown id", () => {
    expect(demoRuleSet()).toEqual(presetById("org").seed);
    expect(demoRuleSet("nope")).toEqual(presetById("org").seed);
  });
});
