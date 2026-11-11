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
import { nearest } from "./nearest.js";
import type { DecideInput, RuleSet } from "../types.js";

const rules: RuleSet = {
  categories: {
    team: { entries: [{ subject: "user:alice", action: "read", effect: "allow" }] },
  },
  parents: {},
};
const input: DecideInput = {
  ruleSet: rules,
  actions: [{ id: "read" }],
  person: { subjects: ["user:alice"] },
  category: "team",
  action: "read",
};

describe("nearest model", () => {
  it("describes itself", () => {
    expect(nearest.id).toBe("nearest");
    expect(nearest.effects).toEqual(["allow", "deny"]);
    expect(nearest.capabilities.stopInheriting).toBe(true);
    expect(nearest.capabilities.wildcardCategory).toBe(true);
    expect(nearest.capabilities.ordering).toBe(false);
    expect(nearest.capabilities.ownEffect).toBe(false);
    expect(nearest.capabilities.owners).toBe(false);
    expect(nearest.capabilities.superuser).toBe(false);
    expect(nearest.capabilities.gating).toBe(false);
    expect(nearest.categoryOptions).toEqual(["stopInheriting"]);
  });

  it("always fills the trace and leaves it off the decision", () => {
    const { decision, trace } = nearest.evaluate(input);
    expect(decision.allowed).toBe(true);
    expect("trace" in decision).toBe(false);
    expect(trace.map((s) => s.category)).toEqual(["team"]);
  });

  it("ignores RuleSet.model", () => {
    const named = { ...input, ruleSet: { ...rules, model: "other" } };
    expect(nearest.evaluate(named)).toEqual(nearest.evaluate(input));
  });

  it("accepts a clean rule set", () => {
    expect(nearest.validate(rules, input.actions)).toEqual([]);
  });

  it("reports an effect the model does not offer", () => {
    const bad = {
      categories: {
        "a/b": {
          entries: [{ subject: "user:alice", action: "read", effect: "own" }],
        },
      },
      parents: {},
    } as unknown as RuleSet;
    expect(nearest.validate(bad, input.actions)).toEqual([
      {
        level: "error",
        path: "/categories/a~1b/entries/0/effect",
        message: 'Effect "own" is not offered by the "nearest" model.',
      },
    ]);
  });

  it("describes an entry in one sentence", () => {
    expect(
      nearest.describeEntry({ subject: "group:finance", action: "read", effect: "deny" }),
    ).toBe("Deny read for group:finance");
    expect(nearest.describeEntry({ subject: "user:a", action: "read", effect: "allow" })).toBe(
      "Allow read for user:a",
    );
  });

  it("lists allow, deny, blank and inherited in the legend", () => {
    expect(nearest.legend().map((l) => l.id)).toEqual(["allow", "deny", "blank", "inherited"]);
  });
});
