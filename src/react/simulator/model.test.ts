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
import { describe, expect, it } from "vitest";
import type { Decision, SubjectKind } from "@/core/types";
import {
  categoryLabel,
  explainDecision,
  flattenResources,
  personFromPicks,
  subjectLabel,
  type ReasonContext,
} from "@/react/simulator/model";

describe("personFromPicks", () => {
  it("keeps order, drops duplicates and blanks", () => {
    expect(personFromPicks(["user:a", "group:g", "user:a", ""]).subjects).toEqual([
      "user:a",
      "group:g",
    ]);
  });
  it("is empty for no picks", () => {
    expect(personFromPicks([]).subjects).toEqual([]);
  });
});

describe("flattenResources", () => {
  it("lists parents before children with depth", () => {
    const flat = flattenResources([
      {
        id: "a",
        label: "A",
        children: [{ id: "b", label: "B", children: [{ id: "c", label: "C" }] }],
      },
      { id: "d", label: "D" },
    ]);
    expect(flat.map((f) => [f.id, f.depth])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 0],
    ]);
  });
});

describe("categoryLabel", () => {
  const flat = flattenResources([{ id: "a", label: "Alpha" }]);
  it("resolves known, star and unknown ids", () => {
    expect(categoryLabel(flat, "a", "All")).toBe("Alpha");
    expect(categoryLabel(flat, "*", "All")).toBe("All");
    expect(categoryLabel(flat, "zzz", "All")).toBe("zzz");
  });
});

describe("subjectLabel", () => {
  const kinds: SubjectKind[] = [
    {
      kind: "group",
      label: "Group",
      search: () => [],
      resolve: (s) => (s === "group:f" ? "Finance" : undefined),
    },
    { kind: "role", label: "Role", search: () => [] },
  ];
  it("uses resolve, else the raw subject", () => {
    expect(subjectLabel(kinds, "group:f")).toBe("Finance");
    expect(subjectLabel(kinds, "group:x")).toBe("group:x");
    expect(subjectLabel(kinds, "role:r")).toBe("role:r");
    expect(subjectLabel(kinds, "other:z")).toBe("other:z");
  });
});

describe("explainDecision", () => {
  const ctx: ReasonContext = {
    t: (k, v) => `${k}|${JSON.stringify(v ?? {})}`,
    category: "fin",
    categoryLabel: (id) => id.toUpperCase(),
    subjectLabel: (s) => s,
    actionLabel: (a) => a,
  };
  const entry = (category: string, effect: "allow" | "deny"): Decision => ({
    allowed: effect === "allow",
    reason: "entry",
    decidedBy: { category, entry: { subject: "group:f", action: "author", effect } },
    path: [category],
  });

  it("explains a rule on the asked category", () => {
    expect(explainDecision(entry("fin", "allow"), ctx)).toBe(
      'simulator.reason.entry|{"verdict":"simulator.allowed|{}","subject":"group:f","action":"author","category":"FIN"}',
    );
  });
  it("explains a denial", () => {
    expect(explainDecision(entry("fin", "deny"), ctx)).toContain("simulator.denied");
  });
  it("explains an inherited rule", () => {
    const text = explainDecision(entry("root", "allow"), ctx);
    expect(text).toContain("simulator.reason.inherited");
    expect(text).toContain('"category":"ROOT"');
  });
  it("explains a rule for all categories", () => {
    expect(explainDecision(entry("*", "allow"), ctx)).toContain("simulator.reason.global");
  });
  it("explains a stop", () => {
    const d: Decision = { allowed: false, reason: "default-deny", path: ["fin"], stoppedAt: "fin" };
    expect(explainDecision(d, ctx)).toBe('simulator.reason.stopped|{"category":"FIN"}');
  });
  it("explains default deny", () => {
    const d: Decision = { allowed: false, reason: "default-deny", path: [] };
    expect(explainDecision(d, ctx)).toBe("simulator.reason.default|{}");
  });
});

describe("explainDecision for the ordered model's reasons", () => {
  const ctx: ReasonContext = {
    t: (k, v) => `${k}|${JSON.stringify(v ?? {})}`,
    category: "fin",
    categoryLabel: (id) => id.toUpperCase(),
    subjectLabel: (s) => s,
    actionLabel: (a) => `<${a}>`,
  };
  it("explains an owner, a superuser and a missing requirement", () => {
    expect(explainDecision({ allowed: true, reason: "owner", path: ["fin"] }, ctx)).toBe(
      'simulator.reason.owner|{"verdict":"simulator.allowed|{}"}',
    );
    expect(explainDecision({ allowed: true, reason: "superuser", path: ["fin"] }, ctx)).toBe(
      'simulator.reason.superuser|{"verdict":"simulator.allowed|{}"}',
    );
    expect(
      explainDecision(
        {
          allowed: true,
          reason: "superuser",
          path: ["fin"],
          configuredBlock: {
            category: "fin",
            entry: { subject: "user:root", action: "read", effect: "deny" },
          },
        },
        ctx,
      ),
    ).toBe(
      'simulator.reason.superuserBlocked|{"verdict":"simulator.allowed|{}","subject":"user:root","action":"<read>","category":"FIN"}',
    );
    expect(
      explainDecision({ allowed: false, reason: "requires", gatedBy: "read", path: ["fin"] }, ctx),
    ).toBe('simulator.reason.requires|{"verdict":"simulator.denied|{}","action":"<read>"}');
  });
});
