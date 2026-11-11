import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decide } from "./decide.js";
import { vectorSubjects } from "./vectors.js";
import type { VectorFile } from "./vectors.js";

const file = JSON.parse(
  readFileSync(new URL("../../vectors/decide.json", import.meta.url), "utf8"),
) as VectorFile;

describe("vectorSubjects", () => {
  it("derives user, group and role subjects", () => {
    expect(vectorSubjects({ id: "a", groups: ["g1", "g2"], roles: ["r"] })).toEqual([
      "user:a",
      "group:g1",
      "group:g2",
      "role:r",
    ]);
  });

  it("derives only the user subject when there are no groups or roles", () => {
    expect(vectorSubjects({ id: "a", groups: [], roles: [] })).toEqual(["user:a"]);
  });
});

describe("shared vectors", () => {
  it("has the expected version and enough cases", () => {
    expect(file.version).toBe(1);
    expect(file.cases.length).toBeGreaterThanOrEqual(40);
  });

  it("has unique case names", () => {
    const names = file.cases.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const tc of file.cases) {
    it(tc.name, () => {
      const d = decide({
        ruleSet: tc.ruleSet,
        actions: file.actions,
        person: { subjects: vectorSubjects(tc.person) },
        category: tc.category,
        action: tc.action,
      });
      expect(d.allowed).toBe(tc.expect.allowed);
      expect(d.reason).toBe(tc.expect.reason);
      if (tc.expect.decidedBy === null) {
        expect(d.decidedBy).toBeUndefined();
      } else {
        expect(d.decidedBy).toEqual({
          category: tc.expect.decidedBy.category,
          entry: {
            subject: tc.expect.decidedBy.subject,
            action: tc.expect.decidedBy.action,
            effect: tc.expect.decidedBy.effect,
          },
        });
      }
    });
  }
});

describe("trace does not change verdicts", () => {
  it("gives identical allowed, reason and decidedBy with trace on and off", () => {
    for (const tc of file.cases) {
      const base = {
        ruleSet: tc.ruleSet,
        actions: file.actions,
        person: { subjects: vectorSubjects(tc.person) },
        category: tc.category,
        action: tc.action,
      };
      const plain = decide(base);
      const traced = decide(base, { trace: true });
      expect(traced.allowed, tc.name).toBe(plain.allowed);
      expect(traced.reason, tc.name).toBe(plain.reason);
      expect(traced.decidedBy, tc.name).toEqual(plain.decidedBy);
      expect(traced.path, tc.name).toEqual(plain.path);
      expect(traced.stoppedAt, tc.name).toBe(plain.stoppedAt);
      expect("trace" in plain, tc.name).toBe(false);
      expect(
        traced.trace?.map((s) => s.category),
        tc.name,
      ).toEqual(plain.path);
    }
  });
});
