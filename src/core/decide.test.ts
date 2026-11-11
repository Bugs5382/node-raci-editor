import { describe, expect, it } from "vitest";
import { decide } from "./decide.js";
import type { ActionDef, DecideInput, Effect, RuleSet } from "./types.js";

const actions: ActionDef[] = [
  { id: "read" },
  { id: "author", implies: ["read"] },
  { id: "approve", implies: ["read"] },
  { id: "manage", implies: ["author", "approve", "read"] },
];

const e = (subject: string, action: string, effect: Effect) => {
  return { subject, action, effect };
};

const input = (
  ruleSet: RuleSet,
  category: string,
  action: string,
  subjects: string[] = ["user:alice"],
  defs: ActionDef[] = actions,
): DecideInput => {
  return { ruleSet, actions: defs, person: { subjects }, category, action };
};

describe("decide", () => {
  it("denies by default with no rules", () => {
    const d = decide(input({ categories: {}, parents: {} }, "a", "read"));
    expect(d).toEqual({ allowed: false, reason: "default-deny", path: ["a", "*"] });
  });

  it("denies an unknown asked action", () => {
    const rs: RuleSet = {
      categories: { a: { entries: [e("user:alice", "nope", "allow")] } },
      parents: {},
    };
    const d = decide(input(rs, "a", "nope"));
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("default-deny");
    expect(d.path).toEqual([]);
  });

  it("allows on a direct entry and reports decidedBy", () => {
    const entry = e("user:alice", "read", "allow");
    const rs: RuleSet = { categories: { a: { entries: [entry] } }, parents: {} };
    const d = decide(input(rs, "a", "read"));
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe("entry");
    expect(d.decidedBy).toEqual({ category: "a", entry });
    expect(d.path).toEqual(["a"]);
  });

  it("walks to the parent when the child has no match", () => {
    const rs: RuleSet = {
      categories: {
        child: { entries: [e("user:bob", "read", "deny")] },
        root: { entries: [e("user:alice", "read", "allow")] },
      },
      parents: { child: "root" },
    };
    const d = decide(input(rs, "child", "read"));
    expect(d.allowed).toBe(true);
    expect(d.decidedBy?.category).toBe("root");
    expect(d.path).toEqual(["child", "root"]);
  });

  it("lets the nearest category win over a farther one", () => {
    const rs: RuleSet = {
      categories: {
        child: { entries: [e("user:alice", "read", "deny")] },
        root: { entries: [e("user:alice", "read", "allow")] },
      },
      parents: { child: "root" },
    };
    const d = decide(input(rs, "child", "read"));
    expect(d.allowed).toBe(false);
    expect(d.decidedBy?.category).toBe("child");
    expect(d.path).toEqual(["child"]);
  });

  it("lets a child re-allow over a parent deny", () => {
    const rs: RuleSet = {
      categories: {
        child: { entries: [e("user:alice", "read", "allow")] },
        root: { entries: [e("user:alice", "read", "deny")] },
      },
      parents: { child: "root" },
    };
    expect(decide(input(rs, "child", "read")).allowed).toBe(true);
  });

  it("lets deny beat allow in the same category, in either order", () => {
    for (const entries of [
      [e("user:alice", "read", "allow"), e("group:g", "read", "deny")],
      [e("group:g", "read", "deny"), e("user:alice", "read", "allow")],
    ]) {
      const rs: RuleSet = { categories: { a: { entries } }, parents: {} };
      const d = decide(input(rs, "a", "read", ["user:alice", "group:g"]));
      expect(d.allowed).toBe(false);
      expect(d.decidedBy?.entry.effect).toBe("deny");
    }
  });

  it("reports the first matching entry among several of the same effect", () => {
    const first = e("user:alice", "read", "allow");
    const rs: RuleSet = {
      categories: { a: { entries: [first, e("group:g", "read", "allow")] } },
      parents: {},
    };
    const d = decide(input(rs, "a", "read", ["user:alice", "group:g"]));
    expect(d.decidedBy?.entry).toBe(first);
  });

  it("matches through implication but not the other way", () => {
    const rs: RuleSet = {
      categories: { a: { entries: [e("user:alice", "manage", "allow")] } },
      parents: {},
    };
    expect(decide(input(rs, "a", "read")).allowed).toBe(true);
    expect(decide(input(rs, "a", "author")).allowed).toBe(true);
    const rs2: RuleSet = {
      categories: { a: { entries: [e("user:alice", "read", "allow")] } },
      parents: {},
    };
    expect(decide(input(rs2, "a", "author")).allowed).toBe(false);
  });

  it("applies a deny on a higher action to the implied action", () => {
    const rs: RuleSet = {
      categories: {
        a: {
          entries: [e("user:alice", "read", "allow"), e("user:alice", "manage", "deny")],
        },
      },
      parents: {},
    };
    expect(decide(input(rs, "a", "read")).allowed).toBe(false);
  });

  it("computes the implication closure transitively and tolerates cycles", () => {
    const defs: ActionDef[] = [
      { id: "a", implies: ["b"] },
      { id: "b", implies: ["c", "a", "ghost"] },
      { id: "c" },
      { id: "d", implies: [] },
    ];
    const rs: RuleSet = {
      categories: { x: { entries: [e("user:alice", "a", "allow")] } },
      parents: {},
    };
    expect(decide(input(rs, "x", "c", ["user:alice"], defs)).allowed).toBe(true);
    expect(decide(input(rs, "x", "d", ["user:alice"], defs)).allowed).toBe(false);
  });

  it("tolerates an entry on an unknown action", () => {
    const rs: RuleSet = {
      categories: { a: { entries: [e("user:alice", "ghost", "allow")] } },
      parents: {},
    };
    expect(decide(input(rs, "a", "read")).allowed).toBe(false);
  });

  it("ignores entries for other subjects", () => {
    const rs: RuleSet = {
      categories: { a: { entries: [e("user:bob", "read", "allow")] } },
      parents: {},
    };
    expect(decide(input(rs, "a", "read")).reason).toBe("default-deny");
  });

  it("stops inheriting after a match in the stopping category", () => {
    const rs: RuleSet = {
      categories: {
        child: { stopInheriting: true, entries: [e("user:alice", "read", "allow")] },
        root: { entries: [e("user:alice", "read", "deny")] },
        "*": { entries: [e("user:alice", "read", "deny")] },
      },
      parents: { child: "root" },
    };
    const d = decide(input(rs, "child", "read"));
    expect(d.allowed).toBe(true);
    expect(d.stoppedAt).toBeUndefined();
  });

  it("ends the walk at a stopping category with no match, skipping the star", () => {
    const rs: RuleSet = {
      categories: {
        child: { stopInheriting: true, entries: [] },
        root: { entries: [e("user:alice", "read", "allow")] },
        "*": { entries: [e("user:alice", "read", "allow")] },
      },
      parents: { child: "root" },
    };
    const d = decide(input(rs, "child", "read"));
    expect(d).toEqual({
      allowed: false,
      reason: "default-deny",
      path: ["child"],
      stoppedAt: "child",
    });
  });

  it("falls back to the star category after the root", () => {
    const rs: RuleSet = {
      categories: {
        root: { entries: [] },
        "*": { entries: [e("user:alice", "read", "allow")] },
      },
      parents: { child: "root" },
    };
    const d = decide(input(rs, "child", "read"));
    expect(d.allowed).toBe(true);
    expect(d.decidedBy?.category).toBe("*");
    expect(d.path).toEqual(["child", "root", "*"]);
  });

  it("handles the star category as the starting category", () => {
    const rs: RuleSet = {
      categories: { "*": { entries: [e("user:alice", "read", "allow")] } },
      parents: {},
    };
    const d = decide(input(rs, "*", "read"));
    expect(d.allowed).toBe(true);
    expect(d.path).toEqual(["*"]);
  });

  it("does not loop forever on a parent cycle", () => {
    const rs: RuleSet = {
      categories: { "*": { entries: [e("user:alice", "read", "allow")] } },
      parents: { a: "b", b: "a" },
    };
    const d = decide(input(rs, "a", "read"));
    expect(d.allowed).toBe(true);
    expect(d.path).toEqual(["a", "b", "*"]);
  });

  it("does not loop on a self parent", () => {
    const rs: RuleSet = { categories: {}, parents: { a: "a" } };
    expect(decide(input(rs, "a", "read")).path).toEqual(["a", "*"]);
  });
});

describe("decide trace", () => {
  it("omits trace by default and when trace is false", () => {
    const rs: RuleSet = {
      categories: { a: { entries: [e("user:alice", "read", "allow")] } },
      parents: {},
    };
    expect("trace" in decide(input(rs, "a", "read"))).toBe(false);
    expect("trace" in decide(input(rs, "a", "read"), {})).toBe(false);
    expect("trace" in decide(input(rs, "a", "read"), { trace: false })).toBe(false);
  });

  it("returns an empty trace for an unknown action", () => {
    const d = decide(input({ categories: {}, parents: {} }, "a", "nope"), { trace: true });
    expect(d.trace).toEqual([]);
  });

  it("lists a step with no matches for every visited category", () => {
    const d = decide(input({ categories: {}, parents: { b: "a" } }, "b", "read"), { trace: true });
    expect(d.trace).toEqual([
      { category: "b", matches: [] },
      { category: "a", matches: [] },
      { category: "*", matches: [] },
    ]);
  });

  it("marks the deciding entry, direct and implied matches, and entry indexes", () => {
    const allow = e("user:alice", "manage", "allow");
    const other = e("user:bob", "read", "allow");
    const deny = e("group:g", "read", "deny");
    const rs: RuleSet = {
      categories: { a: { entries: [allow, other, deny] } },
      parents: {},
    };
    const d = decide(input(rs, "a", "read", ["user:alice", "group:g"]), { trace: true });
    expect(d.allowed).toBe(false);
    expect(d.trace).toEqual([
      {
        category: "a",
        matches: [
          { entry: allow, index: 0, via: "implied", decisive: false },
          { entry: deny, index: 2, via: "direct", decisive: true },
        ],
      },
    ]);
  });

  it("marks the first match decisive when there is no deny, and walks to a parent", () => {
    const inherited = e("user:alice", "read", "allow");
    const rs: RuleSet = {
      categories: { p: { entries: [inherited] }, c: { entries: [] } },
      parents: { c: "p" },
    };
    const d = decide(input(rs, "c", "read"), { trace: true });
    expect(d.trace).toEqual([
      { category: "c", matches: [] },
      { category: "p", matches: [{ entry: inherited, index: 0, via: "direct", decisive: true }] },
    ]);
  });

  it("flags stopInheriting on the step where the walk ended", () => {
    const rs: RuleSet = {
      categories: { c: { stopInheriting: true, entries: [] }, p: { entries: [] } },
      parents: { c: "p" },
    };
    const d = decide(input(rs, "c", "read"), { trace: true });
    expect(d.stoppedAt).toBe("c");
    expect(d.trace).toEqual([{ category: "c", matches: [], stopInheriting: true }]);
  });
});
