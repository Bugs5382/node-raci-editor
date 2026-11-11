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
