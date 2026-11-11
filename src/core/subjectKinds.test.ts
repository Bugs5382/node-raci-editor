import { describe, expect, it } from "vitest";
import { decide } from "./decide.js";
import { defaultSettings } from "./types.js";
import type { ActionDef, RuleSet } from "./types.js";

const actions: ActionDef[] = [{ id: "read" }, { id: "write", implies: ["read"] }];

const rules: RuleSet = {
  parents: {},
  categories: {
    docs: {
      entries: [
        { subject: "team:eng", action: "write", effect: "allow" },
        { subject: "svc-account:ci", action: "read", effect: "allow" },
        { subject: "everyone", action: "read", effect: "allow" },
        { subject: "team:legal", action: "read", effect: "deny" },
      ],
    },
  },
};

const ask = (subjects: string[], action: string) =>
  decide({ ruleSet: rules, actions, person: { subjects }, category: "docs", action });

describe("subjects are plain strings", () => {
  it("treats a custom kind like any subject", () => {
    expect(ask(["team:eng"], "write").allowed).toBe(true);
    expect(ask(["team:eng"], "read").allowed).toBe(true);
    expect(ask(["team:ops"], "write").allowed).toBe(false);
  });

  it("evaluates subjects of a kind nobody configured, with or without a colon", () => {
    expect(ask(["svc-account:ci"], "read").allowed).toBe(true);
    const d = ask(["everyone"], "read");
    expect(d.allowed).toBe(true);
    expect(d.decidedBy?.entry.subject).toBe("everyone");
  });

  it("lets a deny of a custom kind beat an allow", () => {
    expect(ask(["team:legal", "everyone"], "read").allowed).toBe(false);
  });

  it("defaults settings from whatever kinds the host has", () => {
    const s = defaultSettings({
      actions,
      subjectKinds: [{ kind: "team", label: "Team", search: () => [] }],
    });
    expect(s.enabledSubjectKinds).toEqual(["team"]);
  });
});
