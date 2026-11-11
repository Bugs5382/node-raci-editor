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
