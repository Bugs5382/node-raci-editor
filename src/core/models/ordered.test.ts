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
import { beforeAll, describe, expect, it } from "vitest";
import { decide } from "../decide.js";
import { actionPool } from "../pools.js";
import { getModel, listModels, registerModel } from "../registry.js";
import type { ActionDef, Entry, RuleSet } from "../types.js";
import { createOrderedModel, EVERYONE } from "./ordered.js";

const actions: ActionDef[] = [
  { id: "read" },
  { id: "author", implies: ["read"] },
  { id: "approve", implies: ["read"], kind: "obligation", ownerHas: true },
  { id: "manage", implies: ["author", "read"] },
  { id: "ack", kind: "obligation", requires: ["read"] },
];

const e = (subject: string, action: string, effect: "allow" | "deny"): Entry => ({
  subject,
  action,
  effect,
});

const ask = (ruleSet: RuleSet, subjects: string[], action: string, category = "c", trace = false) =>
  decide({ ruleSet, actions, person: { subjects }, category, action }, { model: "ordered", trace });

const rs = (entries: Entry[], extra: Partial<RuleSet["categories"][string]> = {}): RuleSet => ({
  model: "ordered",
  categories: { c: { entries, ...extra } },
  parents: {},
});

describe("ordered model registration", () => {
  it("is registered next to nearest and describes itself", () => {
    expect(listModels().map((m) => m.id)).toEqual(["nearest", "ordered"]);
    const m = getModel("ordered");
    expect(m.effects).toEqual(["allow", "deny"]);
    expect(m.capabilities).toMatchObject({
      ordering: true,
      owners: true,
      gating: true,
      stopInheriting: false,
      wildcardCategory: false,
      ownEffect: false,
      superuser: false,
    });
    expect(m.categoryOptions).toEqual(["owners"]);
  });

  it("is picked by ruleSet.model with no option", () => {
    const set = rs([e("user:a", "read", "allow")]);
    expect(
      decide({
        ruleSet: set,
        actions,
        person: { subjects: ["user:a"] },
        category: "c",
        action: "read",
      }).allowed,
    ).toBe(true);
  });
});

describe("rows, order and empty cells", () => {
  it("a deny row above an allow row denies; swapped, it allows", () => {
    const a = rs([e("user:d", "read", "deny"), e("group:f", "read", "allow")]);
    const b = rs([e("group:f", "read", "allow"), e("user:d", "read", "deny")]);
    const who = ["user:d", "group:f"];
    expect(ask(a, who, "read")).toMatchObject({ allowed: false, reason: "entry" });
    expect(ask(b, who, "read")).toMatchObject({ allowed: true, reason: "entry" });
  });

  it("skips a row whose cell for the asked action is empty", () => {
    const set = rs([e("user:s", "author", "allow"), e("group:it", "ack", "allow")]);
    const d = ask(set, ["user:s", "group:it"], "ack");
    expect(d).toMatchObject({ allowed: true, reason: "entry" });
    expect(d.decidedBy?.entry.subject).toBe("group:it");
  });

  it("matches the built-in everyone subject for a person with no other subject", () => {
    const set = rs([e(EVERYONE, "ack", "allow"), e(EVERYONE, "read", "allow")]);
    expect(ask(set, [], "ack").allowed).toBe(true);
  });

  it("denies by default and for an unknown action", () => {
    expect(ask(rs([]), ["user:a"], "read")).toMatchObject({
      allowed: false,
      reason: "default-deny",
    });
    expect(ask(rs([e("user:a", "read", "allow")]), ["user:a"], "nope")).toMatchObject({
      allowed: false,
      reason: "default-deny",
      path: [],
    });
  });

  it("a manage cell answers read and author, never approve or ack", () => {
    const set = rs([e("user:a", "manage", "allow")]);
    for (const a of ["read", "author", "manage"]) {
      expect(ask(set, ["user:a"], a).allowed).toBe(true);
    }
    expect(ask(set, ["user:a"], "approve").allowed).toBe(false);
    expect(ask(set, ["user:a"], "ack").allowed).toBe(false);
  });
});

describe("the vCISO example", () => {
  const rows = (vcisoFirst: boolean): RuleSet => {
    const v = [
      e("user:vciso", "read", "allow"),
      e("user:vciso", "author", "allow"),
      e("user:vciso", "ack", "deny"),
    ];
    const it = [
      e("group:it", "read", "allow"),
      e("group:it", "author", "allow"),
      e("group:it", "ack", "allow"),
    ];
    const all = [e(EVERYONE, "read", "allow"), e(EVERYONE, "ack", "allow")];
    return rs(vcisoFirst ? [...v, ...it, ...all] : [...it, ...all, ...v]);
  };
  const who = ["user:vciso"];
  it("read and author allowed, ack denied by his own red row, approve denied by default", () => {
    const set = rows(true);
    expect(ask(set, who, "read").allowed).toBe(true);
    expect(ask(set, who, "author").allowed).toBe(true);
    expect(ask(set, who, "ack")).toMatchObject({ allowed: false, reason: "entry" });
    expect(ask(set, who, "approve")).toMatchObject({ allowed: false, reason: "default-deny" });
  });
  it("moved below the everyone row, ack is required", () => {
    expect(ask(rows(false), who, "ack")).toMatchObject({ allowed: true, reason: "entry" });
  });
});

describe("inheritance", () => {
  const set: RuleSet = {
    model: "ordered",
    categories: {
      it: { entries: [e("group:staff", "read", "allow")] },
      pol: { entries: [e("user:dave", "read", "deny")], stopInheriting: true },
    },
    parents: { pol: "it" },
  };
  it("the child's own row wins over the inherited row", () => {
    expect(ask(set, ["user:dave", "group:staff"], "read", "pol")).toMatchObject({ allowed: false });
    expect(ask(set, ["user:dave", "group:staff"], "read", "it")).toMatchObject({ allowed: true });
  });
  it("an inherited row decides when no child row speaks, and stopInheriting is ignored", () => {
    const d = ask(set, ["group:staff"], "read", "pol");
    expect(d).toMatchObject({ allowed: true, reason: "entry" });
    expect(d.decidedBy?.category).toBe("it");
    expect(d.path).toEqual(["pol", "it"]);
  });
  it("a grandparent's rows come after the parent's and a cycle ends the walk", () => {
    const deep: RuleSet = {
      model: "ordered",
      categories: {
        a: { entries: [e("group:g", "read", "allow")] },
        b: { entries: [e("group:g", "read", "deny")] },
        c: { entries: [] },
      },
      parents: { c: "b", b: "a", a: "c" },
    };
    const d = ask(deep, ["group:g"], "read", "c");
    expect(d).toMatchObject({ allowed: false });
    expect(d.decidedBy?.category).toBe("b");
    expect(ask(deep, [], "read", "c").path).toEqual(["c", "b", "a"]);
  });
});

describe("owners", () => {
  const set: RuleSet = {
    model: "ordered",
    categories: {
      it: { owners: ["user:erin"], entries: [] },
      pol: { entries: [e("user:erin", "read", "deny"), e("user:erin", "ack", "deny")] },
    },
    parents: { pol: "it" },
  };
  it("an owner is allowed over a deny, and an ancestor's owner is an owner below", () => {
    const d = ask(set, ["user:erin"], "read", "pol");
    expect(d).toMatchObject({ allowed: true, reason: "owner" });
    expect(ask(set, ["user:erin"], "approve", "pol")).toMatchObject({
      allowed: true,
      reason: "owner",
    });
    expect(ask(set, ["user:erin"], "manage", "pol").reason).toBe("owner");
  });
  it("is not required to acknowledge: the rows decide", () => {
    expect(ask(set, ["user:erin"], "ack", "pol")).toMatchObject({
      allowed: false,
      reason: "entry",
    });
  });
  it("a subject of a kind the model does not allow is not an owner", () => {
    const g: RuleSet = {
      ...set,
      categories: { ...set.categories, it: { owners: ["group:ops"], entries: [] } },
    };
    expect(ask(g, ["group:ops"], "read", "pol").reason).not.toBe("owner");
  });
  it("owner kinds are a host option; an empty list switches owners off", () => {
    const off = createOrderedModel({ id: "ordered-no-owners", ownerKinds: [] });
    const { decision } = off.evaluate({
      ruleSet: set,
      actions,
      person: { subjects: ["user:erin"] },
      category: "pol",
      action: "read",
    });
    expect(decision.reason).toBe("entry");
    const can = createOrderedModel({ id: "ordered-can", ownerKinds: ["can"] });
    const r = can.evaluate({
      ruleSet: {
        ...set,
        categories: { ...set.categories, it: { owners: ["can:own"], entries: [] } },
      },
      actions,
      person: { subjects: ["can:own"] },
      category: "pol",
      action: "read",
    });
    expect(r.decision.reason).toBe("owner");
  });
});

describe("requires", () => {
  const set = rs([
    e("user:carl", "read", "deny"),
    e(EVERYONE, "read", "allow"),
    e(EVERYONE, "ack", "allow"),
  ]);
  it("ack with a read deny is denied, gated by read", () => {
    expect(ask(set, ["user:carl"], "ack")).toMatchObject({
      allowed: false,
      reason: "requires",
      gatedBy: "read",
    });
  });
  it("ack with read allowed is allowed", () => {
    expect(ask(set, ["user:zed"], "ack")).toMatchObject({ allowed: true, reason: "entry" });
  });
  it("an action with no requires needs no read", () => {
    const only = rs([e("user:a", "author", "allow"), e("user:b", "approve", "allow")]);
    expect(ask(rs([e("user:b", "approve", "allow")]), ["user:b"], "approve").allowed).toBe(true);
    expect(only.model).toBe("ordered");
  });
});

describe("trace and reasons", () => {
  it("always fills ordered steps with row numbers and the deciding row", () => {
    const m = getModel("ordered");
    const set = rs([
      e("user:x", "read", "allow"),
      e("user:a", "author", "allow"),
      e("user:a", "read", "allow"),
    ]);
    const { decision, trace } = m.evaluate({
      ruleSet: set,
      actions,
      person: { subjects: ["user:a"] },
      category: "c",
      action: "read",
    });
    expect(decision.decidedBy?.entry).toEqual(e("user:a", "read", "allow"));
    const step = trace.find((s) => s.category === "c");
    expect(step?.matches.map((x) => x.row)).toEqual([1]);
    expect(step?.matches[0]).toMatchObject({ decisive: true, via: "direct" });
    expect(trace.map((s) => s.order)).toEqual(trace.map((_, i) => i));
  });
  it("records an owners step and a gate step", () => {
    const m = getModel("ordered");
    const ownerSet: RuleSet = {
      model: "ordered",
      categories: { c: { owners: ["user:o"], entries: [] } },
      parents: {},
    };
    const r = m.evaluate({
      ruleSet: ownerSet,
      actions,
      person: { subjects: ["user:o"] },
      category: "c",
      action: "read",
    });
    expect(r.trace[0]).toMatchObject({ kind: "owners", matched: "user:o" });
    const g = m.evaluate({
      ruleSet: rs([e("user:a", "ack", "allow")]),
      actions,
      person: { subjects: ["user:a"] },
      category: "c",
      action: "ack",
    });
    expect(g.trace.some((s) => s.kind === "gate" && s.action === "read")).toBe(true);
  });
});

describe("validate and describe", () => {
  const m = getModel("ordered");
  it("reports duplicates, bad owner kinds, unknown effects and own; warns on stopInheriting", () => {
    const set: RuleSet = {
      model: "ordered",
      categories: {
        c: {
          stopInheriting: true,
          owners: ["group:x"],
          entries: [
            e("user:a", "read", "allow"),
            e("user:a", "read", "deny"),
            { subject: "user:b", action: "read", effect: "own" as never },
          ],
        },
      },
      parents: {},
    };
    const issues = m.validate(set, actions);
    const at = (path: string) => issues.find((i) => i.path === path);
    expect(at("/categories/c/entries/1")?.level).toBe("error");
    expect(at("/categories/c/owners/0")?.level).toBe("error");
    expect(at("/categories/c/entries/2/effect")?.level).toBe("error");
    expect(at("/categories/c/stopInheriting")?.level).toBe("warning");
    expect(m.validate(rs([e("user:a", "read", "allow")]), actions)).toEqual([]);
  });
  it("describes an entry and lists a legend", () => {
    expect(m.describeEntry(e("user:a", "read", "deny"))).toBe("Deny read for user:a");
    expect(m.legend().map((l) => l.id)).toEqual(["allow", "deny", "blank", "inherited", "locked"]);
  });
});

describe("actionPool", () => {
  const set: RuleSet = {
    model: "ordered",
    categories: {
      it: { owners: ["user:erin"], entries: [] },
      pol: { entries: [e("user:ann", "approve", "deny"), e("group:finance", "approve", "allow")] },
    },
    parents: { pol: "it" },
  };
  const people = [
    { id: "erin", subjects: ["user:erin"] },
    { id: "dave", subjects: ["user:dave", "group:finance"] },
    { id: "ann", subjects: ["user:ann", "group:finance"] },
    { id: "bob", subjects: ["user:bob"] },
  ];
  it("lists owners first, then people whose rows allow, with the reason", () => {
    expect(
      actionPool({ ruleSet: set, actions, category: "pol", people, action: "approve" }),
    ).toEqual([
      { person: "erin", reason: "owner", category: "it" },
      { person: "dave", reason: "entry", category: "pol", row: 1 },
    ]);
  });
  it("marks an everyone row instead of implying a list of names", () => {
    const all: RuleSet = {
      model: "ordered",
      categories: { c: { entries: [e(EVERYONE, "read", "allow"), e(EVERYONE, "ack", "allow")] } },
      parents: {},
    };
    const list = actionPool({ ruleSet: all, actions, category: "c", people, action: "ack" });
    expect(list).toHaveLength(4);
    expect(list.every((p) => p.everyone === true)).toBe(true);
  });
});

describe("an allowed higher action gives the lower one, even over a deny", () => {
  const who = ["user:a"];
  it("Author gives Read over a Read deny in the same row", () => {
    const set = rs([e("user:a", "author", "allow"), e("user:a", "read", "deny")]);
    const d = ask(set, who, "read");
    expect(d).toMatchObject({ allowed: true, reason: "entry" });
    expect(d.decidedBy?.entry).toEqual(e("user:a", "author", "allow"));
    expect(ask(set, who, "author").allowed).toBe(true);
  });
  it("Author gives Read over a Read deny in a row above it", () => {
    const set = rs([e("user:a", "read", "deny"), e(EVERYONE, "author", "allow")]);
    expect(ask(set, who, "read")).toMatchObject({ allowed: true, reason: "entry" });
  });
  it("Approve gives Read, and Manage gives Read through Author", () => {
    expect(
      ask(rs([e("user:a", "read", "deny"), e("user:a", "approve", "allow")]), who, "read").allowed,
    ).toBe(true);
    expect(
      ask(rs([e("user:a", "read", "deny"), e("user:a", "manage", "allow")]), who, "read").allowed,
    ).toBe(true);
  });
  it("gives only downward, never sideways or up", () => {
    const set = rs([e("user:a", "author", "allow")]);
    expect(ask(set, who, "approve").allowed).toBe(false);
    expect(ask(set, who, "manage").allowed).toBe(false);
    const readOnly = rs([e("user:a", "read", "allow")]);
    expect(ask(readOnly, who, "author").allowed).toBe(false);
  });
  it("Manage gives Read and Author but never Approve, even over a deny of the lower ones", () => {
    const set = rs([
      e("user:a", "read", "deny"),
      e("user:a", "author", "deny"),
      e("user:a", "manage", "allow"),
    ]);
    expect(ask(set, who, "read").allowed).toBe(true);
    expect(ask(set, who, "author").allowed).toBe(true);
    expect(ask(set, who, "approve").allowed).toBe(false);
  });
  it("a denied Author does not give or take Read", () => {
    const set = rs([e("user:a", "author", "deny"), e("user:a", "read", "allow")]);
    expect(ask(set, who, "read").allowed).toBe(true);
    expect(ask(set, who, "author").allowed).toBe(false);
  });
  it("an owner's action gives the lower ones too", () => {
    const set: RuleSet = {
      model: "ordered",
      categories: { c: { owners: ["user:o"], entries: [e("user:o", "read", "deny")] } },
      parents: {},
    };
    expect(ask(set, ["user:o"], "read")).toMatchObject({ allowed: true, reason: "owner" });
  });
  it("makes acknowledge possible: the conferred Read satisfies requires", () => {
    const set = rs([
      e("user:a", "read", "deny"),
      e("user:a", "author", "allow"),
      e(EVERYONE, "ack", "allow"),
    ]);
    expect(ask(set, who, "ack")).toMatchObject({ allowed: true, reason: "entry" });
    const noAuthor = rs([e("user:a", "read", "deny"), e(EVERYONE, "ack", "allow")]);
    expect(ask(noAuthor, who, "ack")).toMatchObject({
      allowed: false,
      reason: "requires",
      gatedBy: "read",
    });
  });
  it("records the step in the trace", () => {
    const set = rs([e("user:a", "read", "deny"), e("user:a", "author", "allow")]);
    const { trace } = getModel("ordered").evaluate({
      ruleSet: set,
      actions,
      person: { subjects: who },
      category: "c",
      action: "read",
    });
    expect(trace.some((t) => t.kind === "confer" && t.action === "author")).toBe(true);
  });
});

describe("site administrators (superusers), off unless configured", () => {
  const su = createOrderedModel({
    id: "ordered-su",
    superusers: { subjects: ["role:admin"], actions: ["read", "author", "manage"] },
  });
  const ask2 = (set: RuleSet, subjects: string[], action: string) =>
    su.evaluate({ ruleSet: set, actions, person: { subjects }, category: "c", action });
  const admin = ["role:admin"];

  it("is off in the built-in model", () => {
    const set = rs([e("role:admin", "read", "deny")]);
    expect(ask(set, admin, "read").allowed).toBe(false);
  });
  it("lets nothing take away the listed actions, even an explicit deny", () => {
    const set = rs([e("role:admin", "read", "deny"), e(EVERYONE, "manage", "deny")]);
    for (const a of ["read", "manage"]) {
      const { decision } = ask2(set, admin, a);
      expect(decision).toMatchObject({ allowed: true, reason: "superuser" });
      expect(decision.decidedBy).toBeUndefined();
    }
  });
  it("records a superuser step", () => {
    const { trace } = ask2(rs([]), admin, "read");
    expect(trace[0]).toMatchObject({ kind: "superuser", matched: "role:admin" });
  });
  it("does not cover actions that are not listed: Approve and Ack follow the rows", () => {
    const set = rs([e("role:admin", "approve", "deny")]);
    expect(ask2(set, admin, "approve").decision).toMatchObject({ allowed: false, reason: "entry" });
    expect(ask2(rs([]), admin, "approve").decision).toMatchObject({
      allowed: false,
      reason: "default-deny",
    });
  });
  it("an Everyone row still covers a site admin, so an obligation applies to them", () => {
    const set = rs([e(EVERYONE, "read", "allow"), e(EVERYONE, "ack", "allow")]);
    expect(ask2(set, admin, "ack").decision).toMatchObject({ allowed: true, reason: "entry" });
    const overridden = rs([
      e("role:admin", "ack", "deny"),
      e(EVERYONE, "read", "allow"),
      e(EVERYONE, "ack", "allow"),
    ]);
    expect(ask2(overridden, admin, "ack").decision.allowed).toBe(false);
  });
  it("applies only to the listed subjects", () => {
    const set = rs([e("user:x", "read", "deny")]);
    expect(ask2(set, ["user:x"], "read").decision.allowed).toBe(false);
  });
  it("reports the superuser capability only when configured", () => {
    expect(su.capabilities.superuser).toBe(true);
    expect(getModel("ordered").capabilities.superuser).toBe(false);
  });
});

describe("ownerKinds on the model", () => {
  it("is published for the editor, and left out by nearest", () => {
    expect(getModel("ordered").ownerKinds).toEqual(["user"]);
    expect(createOrderedModel({ ownerKinds: ["user", "group"] }).ownerKinds).toEqual([
      "user",
      "group",
    ]);
    expect(createOrderedModel({ ownerKinds: [] }).ownerKinds).toEqual([]);
    expect(getModel("nearest").ownerKinds).toBeUndefined();
  });
});

describe("the remaining branches of the ordered model", () => {
  it("a subject with no kind is not an owner and is reported", () => {
    const set: RuleSet = {
      model: "ordered",
      categories: { c: { owners: ["plain"], entries: [] } },
      parents: {},
    };
    expect(ask(set, ["plain"], "read").reason).toBe("default-deny");
    expect(
      getModel("ordered")
        .validate(set, actions)
        .map((i) => i.path),
    ).toEqual(["/categories/c/owners/0"]);
  });
  it("a valid owner raises no issue", () => {
    const set: RuleSet = {
      model: "ordered",
      categories: { c: { owners: ["user:o"], entries: [] } },
      parents: {},
    };
    expect(getModel("ordered").validate(set, actions)).toEqual([]);
  });
  it("the ownerActions option limits what owners always have", () => {
    const only = createOrderedModel({ id: "ordered-read-owner", ownerActions: ["read"] });
    const set: RuleSet = {
      model: "ordered",
      categories: { c: { owners: ["user:o"], entries: [] } },
      parents: {},
    };
    const q = (action: string) =>
      only.evaluate({
        ruleSet: set,
        actions,
        person: { subjects: ["user:o"] },
        category: "c",
        action,
      }).decision;
    expect(q("read")).toMatchObject({ allowed: true, reason: "owner" });
    expect(q("author")).toMatchObject({ allowed: false, reason: "default-deny" });
  });
  it("an owner satisfies a requirement without a trace step of its own", () => {
    const set: RuleSet = {
      model: "ordered",
      categories: { c: { owners: ["user:o"], entries: [e("user:o", "ack", "allow")] } },
      parents: {},
    };
    const { decision, trace } = getModel("ordered").evaluate({
      ruleSet: set,
      actions,
      person: { subjects: ["user:o"] },
      category: "c",
      action: "ack",
    });
    expect(decision).toMatchObject({ allowed: true, reason: "entry" });
    expect(trace.filter((t) => t.kind === "owners")).toEqual([]);
  });
  it("walks past a category that has no entry in the rule set", () => {
    const set: RuleSet = {
      model: "ordered",
      categories: { top: { entries: [e("user:a", "read", "allow")] } },
      parents: { c: "top" },
    };
    expect(ask(set, ["user:a"], "read", "c")).toMatchObject({ allowed: true, path: ["c", "top"] });
  });
  it("warns about an action that is not defined", () => {
    const issues = getModel("ordered").validate(rs([e("user:a", "mystery", "allow")]), actions);
    expect(issues).toEqual([
      expect.objectContaining({ level: "warning", path: "/categories/c/entries/0/action" }),
    ]);
  });
  it("describes an allow entry", () => {
    expect(getModel("ordered").describeEntry(e("user:a", "read", "allow"))).toBe(
      "Allow read for user:a",
    );
  });
});

describe("actionPool and superusers", () => {
  const su = createOrderedModel({
    id: "ordered-pool-su",
    superusers: { subjects: ["role:admin"], actions: ["read"] },
  });
  beforeAll(() => registerModel(su));
  const set: RuleSet = {
    model: "ordered-pool-su",
    categories: {
      it: { owners: ["user:erin"], entries: [] },
      c: { entries: [e(EVERYONE, "read", "allow")] },
    },
    parents: { c: "it" },
  };
  const people = [
    { id: "admin", subjects: ["role:admin"] },
    { id: "erin", subjects: ["user:erin"] },
    { id: "bob", subjects: ["user:bob"] },
  ];
  it("lists a superuser as one, after the owners and before the rows", () => {
    expect(actionPool({ ruleSet: set, actions, category: "c", people, action: "read" })).toEqual([
      { person: "erin", reason: "owner", category: "it" },
      { person: "admin", reason: "superuser", category: "c" },
      { person: "bob", reason: "entry", category: "c", row: 0, everyone: true },
    ]);
  });
});
