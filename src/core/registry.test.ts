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
import { getModel, listModels, registerModel } from "./registry.js";
import type { RaciModel } from "./model.js";
import type { DecideInput } from "./types.js";

const question: DecideInput = {
  ruleSet: { categories: {}, parents: {} },
  actions: [{ id: "read" }],
  person: { subjects: ["user:alice"] },
  category: "a",
  action: "read",
};

const custom = (id: string, allowed: boolean): RaciModel => ({
  id,
  label: id,
  effects: ["allow", "deny"],
  categoryOptions: [],
  capabilities: {
    ordering: false,
    ownEffect: false,
    owners: false,
    superuser: false,
    gating: false,
    stopInheriting: false,
    wildcardCategory: false,
  },
  evaluate: () => ({ decision: { allowed, reason: "entry", path: [] }, trace: [] }),
  validate: () => [],
  describeEntry: (entry) => `${entry.effect} ${entry.action}`,
  legend: () => [],
});

describe("registry", () => {
  it("has nearest registered and listed first", () => {
    expect(listModels()[0]?.id).toBe("nearest");
    expect(getModel("nearest").id).toBe("nearest");
  });

  it("returns the default model without an id", () => {
    expect(getModel()).toBe(getModel("nearest"));
  });

  it("throws a clear error for an unknown id", () => {
    expect(() => getModel("missing")).toThrow(/Unknown rule model "missing".*nearest/);
  });

  it("registers a model and finds it by id", () => {
    const model = custom("reg-find", true);
    registerModel(model);
    expect(getModel("reg-find")).toBe(model);
    expect(listModels().map((m) => m.id)).toContain("reg-find");
  });

  it("throws on a duplicate id and never replaces a built-in", () => {
    registerModel(custom("reg-dup", true));
    expect(() => registerModel(custom("reg-dup", false))).toThrow(/already registered/);
    expect(() => registerModel(custom("nearest", true))).toThrow(/already registered/);
  });

  it("selects a model through decide options or the rule set", () => {
    registerModel(custom("reg-allow", true));
    expect(decide(question).allowed).toBe(false);
    expect(decide(question, { model: "reg-allow" }).allowed).toBe(true);
    const named = { ...question, ruleSet: { ...question.ruleSet, model: "reg-allow" } };
    expect(decide(named).allowed).toBe(true);
    expect(decide(named, { model: "nearest" }).allowed).toBe(false);
  });

  it("throws from decide for an unknown model id", () => {
    expect(() => decide(question, { model: "missing" })).toThrow(/Unknown rule model/);
  });
});
