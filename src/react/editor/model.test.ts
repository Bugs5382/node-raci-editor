import { describe, expect, it } from "vitest";
import type { ActionDef, RuleSet } from "@/core/types";
import {
  cellEffect,
  deriveRows,
  impliedActions,
  inheritedGroups,
  nextEffect,
  removeSubject,
  setCell,
  setStopInheriting,
} from "@/react/editor/model";

const actions: ActionDef[] = [
  { id: "approve", implies: ["review"] },
  { id: "review", implies: ["view"] },
  { id: "view" },
  { id: "loop-a", implies: ["loop-b"] },
  { id: "loop-b", implies: ["loop-a"] },
];

const base = (): RuleSet => ({
  categories: {
    docs: {
      entries: [
        { subject: "user:alice", action: "view", effect: "allow" },
        { subject: "user:bob", action: "view", effect: "deny" },
      ],
    },
  },
  parents: { docs: "root", root: "top" },
});

describe("impliedActions", () => {
  it("returns the transitive closure without the action", () => {
    expect(impliedActions(actions, "approve")).toEqual(["review", "view"]);
  });
  it("is empty for a leaf or an unknown action", () => {
    expect(impliedActions(actions, "view")).toEqual([]);
    expect(impliedActions(actions, "nope")).toEqual([]);
  });
  it("survives cycles", () => {
    expect(impliedActions(actions, "loop-a")).toEqual(["loop-b"]);
  });
});

describe("cellEffect and nextEffect", () => {
  const entries = [
    { subject: "s", action: "a", effect: "allow" as const },
    { subject: "s", action: "b", effect: "allow" as const },
    { subject: "s", action: "b", effect: "deny" as const },
  ];
  it("reads the effect, deny winning", () => {
    expect(cellEffect(entries, "s", "a")).toBe("allow");
    expect(cellEffect(entries, "s", "b")).toBe("deny");
    expect(cellEffect(entries, "s", "c")).toBeUndefined();
    expect(cellEffect(entries, "t", "a")).toBeUndefined();
  });
  it("cycles blank, allow, deny, blank", () => {
    expect(nextEffect(undefined)).toBe("allow");
    expect(nextEffect("allow")).toBe("deny");
    expect(nextEffect("deny")).toBeUndefined();
  });
});

describe("deriveRows", () => {
  it("orders by first entry then extras, without duplicates", () => {
    const entries = base().categories.docs!.entries;
    expect(deriveRows(entries, ["user:carol", "user:alice"])).toEqual([
      "user:alice",
      "user:bob",
      "user:carol",
    ]);
  });
  it("defaults extras to none", () => {
    expect(deriveRows([])).toEqual([]);
  });
});

describe("setCell", () => {
  it("adds, replaces and removes an entry without mutating", () => {
    const rs = base();
    const frozen = JSON.stringify(rs);
    const added = setCell(rs, "docs", "user:alice", "approve", "allow");
    expect(added.categories.docs!.entries).toContainEqual({
      subject: "user:alice",
      action: "approve",
      effect: "allow",
    });
    const flipped = setCell(added, "docs", "user:alice", "approve", "deny");
    expect(flipped.categories.docs!.entries.filter((e) => e.action === "approve")).toEqual([
      { subject: "user:alice", action: "approve", effect: "deny" },
    ]);
    const cleared = setCell(flipped, "docs", "user:alice", "approve", undefined);
    expect(cleared.categories.docs!.entries).toHaveLength(2);
    expect(JSON.stringify(rs)).toBe(frozen);
    expect(rs.categories.docs!.entries).not.toBe(added.categories.docs!.entries);
  });
  it("creates a missing category and keeps parents and flags", () => {
    const rs = setStopInheriting(base(), "docs", true);
    const next = setCell(rs, "new", "user:x", "view", "allow");
    expect(next.categories.new).toEqual({
      entries: [{ subject: "user:x", action: "view", effect: "allow" }],
    });
    expect(next.parents).toBe(rs.parents);
    expect(setCell(rs, "docs", "user:x", "view", "allow").categories.docs!.stopInheriting).toBe(
      true,
    );
  });
});

describe("removeSubject", () => {
  it("drops all entries of the subject only", () => {
    const rs = base();
    const next = removeSubject(
      setCell(rs, "docs", "user:alice", "approve", "allow"),
      "docs",
      "user:alice",
    );
    expect(next.categories.docs!.entries).toEqual([
      { subject: "user:bob", action: "view", effect: "deny" },
    ]);
    expect(rs.categories.docs!.entries).toHaveLength(2);
  });
  it("is harmless for an unknown category", () => {
    expect(removeSubject(base(), "zzz", "user:a").categories.zzz).toEqual({ entries: [] });
  });
});

describe("stopInheriting", () => {
  it("sets the flag explicitly without mutating", () => {
    const rs = base();
    expect(setStopInheriting(rs, "docs", true).categories.docs!.stopInheriting).toBe(true);
    expect(setStopInheriting(rs, "docs", false).categories.docs!.stopInheriting).toBe(false);
    expect(rs.categories.docs!.stopInheriting).toBeUndefined();
  });
});

describe("inheritedGroups", () => {
  const rs = (): RuleSet => ({
    categories: {
      root: { entries: [{ subject: "g:a", action: "view", effect: "allow" }] },
      top: { entries: [] },
      "*": { entries: [{ subject: "g:b", action: "view", effect: "deny" }] },
    },
    parents: { docs: "root", root: "top" },
  });
  it("walks parents then star, skipping empty categories", () => {
    expect(inheritedGroups(rs(), "docs", false).map((g) => g.categoryId)).toEqual(["root", "*"]);
  });
  it("is empty when the category stops inheriting", () => {
    expect(inheritedGroups(rs(), "docs", true)).toEqual([]);
  });
  it("ends after an ancestor that stops inheriting, keeping its entries", () => {
    const set = rs();
    set.categories.root = { stopInheriting: true, entries: set.categories.root!.entries };
    expect(inheritedGroups(set, "docs", false).map((g) => g.categoryId)).toEqual(["root"]);
  });
  it("survives parent cycles and a star category of its own", () => {
    const cyc: RuleSet = {
      categories: { a: { entries: [{ subject: "s", action: "x", effect: "allow" }] } },
      parents: { c: "a", a: "c" },
    };
    expect(inheritedGroups(cyc, "c", false).map((g) => g.categoryId)).toEqual(["a"]);
    expect(inheritedGroups(rs(), "*", false)).toEqual([]);
  });
  it("handles a category with no parent", () => {
    expect(inheritedGroups({ categories: {}, parents: {} }, "x", false)).toEqual([]);
  });
});
