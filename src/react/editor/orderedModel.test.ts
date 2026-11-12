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
import type { Entry, RuleSet } from "@/core/types";
import {
  addOwner,
  inheritedOwners,
  inheritedRows,
  moveItem,
  orderedRows,
  removeOwner,
  reorderEntries,
} from "@/react/editor/model";

const e = (subject: string, action: string, effect: "allow" | "deny" = "allow"): Entry => ({
  subject,
  action,
  effect,
});

const rs = (): RuleSet => ({
  parents: { child: "mid", mid: "top" },
  categories: {
    top: { owners: ["user:zed"], entries: [e("user:ann", "view"), e("user:bob", "view", "deny")] },
    mid: { owners: ["user:yan"], entries: [e("user:cy", "edit")] },
    child: {
      entries: [e("user:bob", "view"), e("user:ann", "edit"), e("user:bob", "edit")],
    },
  },
});

describe("moveItem", () => {
  it("moves one item and leaves the input alone", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(list, 2, 0)).toEqual(["c", "a", "b"]);
    expect(list).toEqual(["a", "b", "c"]);
  });
  it("clamps and ignores no-ops", () => {
    expect(moveItem(["a", "b"], 0, 9)).toEqual(["b", "a"]);
    expect(moveItem(["a", "b"], 1, -4)).toEqual(["b", "a"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

describe("reorderEntries", () => {
  it("moves a subject's entries together and keeps their relative order", () => {
    const set = rs();
    const next = reorderEntries(set, "child", ["user:ann", "user:bob"]);
    expect(next.categories.child!.entries).toEqual([
      e("user:ann", "edit"),
      e("user:bob", "view"),
      e("user:bob", "edit"),
    ]);
  });
  it("never mutates its input and keeps the other categories", () => {
    const set = rs();
    const before = JSON.stringify(set);
    const next = reorderEntries(set, "child", ["user:ann", "user:bob"]);
    expect(JSON.stringify(set)).toBe(before);
    expect(next.categories.top).toBe(set.categories.top);
  });
  it("puts subjects the order does not name after the named ones", () => {
    const next = reorderEntries(rs(), "child", ["user:ann"]);
    expect(next.categories.child!.entries.map((x) => x.subject)).toEqual([
      "user:ann",
      "user:bob",
      "user:bob",
    ]);
  });
  it("copes with a category that does not exist", () => {
    expect(reorderEntries(rs(), "nope", ["x"]).categories.nope).toEqual({ entries: [] });
  });
});

describe("orderedRows", () => {
  const entries = [e("a", "x"), e("b", "x"), e("c", "x")];
  it("is the first-appearance order when nothing was remembered", () => {
    expect(orderedRows([], entries, [])).toEqual(["a", "b", "c"]);
  });
  it("puts added subjects without a cell at the end", () => {
    expect(orderedRows([], entries, ["z"])).toEqual(["a", "b", "c", "z"]);
  });
  it("keeps an empty row where it was", () => {
    expect(orderedRows(["a", "z", "b", "c"], entries, ["z"])).toEqual(["a", "z", "b", "c"]);
  });
  it("follows the entries for rows that have cells, so a discarded move shows the saved order", () => {
    expect(orderedRows(["c", "b", "a"], entries, [])).toEqual(["a", "b", "c"]);
  });
});

describe("inheritedRows", () => {
  it("lists ancestor rows nearest first, one row per subject, in each category's own order", () => {
    const rows = inheritedRows(rs(), "child");
    expect(rows.map((r) => `${r.categoryId}:${r.subject}`)).toEqual([
      "mid:user:cy",
      "top:user:ann",
      "top:user:bob",
    ]);
    expect(rows[2]!.entries).toEqual([e("user:bob", "view", "deny")]);
  });
  it("ignores stopInheriting and has no star category", () => {
    const set = rs();
    set.categories.mid = { stopInheriting: true, entries: set.categories.mid!.entries };
    set.categories["*"] = { entries: [e("user:all", "view")] };
    expect(inheritedRows(set, "child")).toHaveLength(3);
  });
  it("survives a parent cycle and a missing parent", () => {
    const cyc: RuleSet = {
      parents: { a: "b", b: "a" },
      categories: { b: { entries: [e("s", "x")] } },
    };
    expect(inheritedRows(cyc, "a").map((r) => r.categoryId)).toEqual(["b"]);
    expect(inheritedRows({ parents: {}, categories: {} }, "q")).toEqual([]);
  });
});

describe("owners", () => {
  it("lists inherited owners with the category they come from, nearest first", () => {
    expect(inheritedOwners(rs(), "child")).toEqual([
      { categoryId: "mid", owner: "user:yan" },
      { categoryId: "top", owner: "user:zed" },
    ]);
  });
  it("adds an owner once and never mutates", () => {
    const set = rs();
    const before = JSON.stringify(set);
    const next = addOwner(set, "child", "user:ann");
    expect(next.categories.child!.owners).toEqual(["user:ann"]);
    expect(addOwner(next, "child", "user:ann")).toBe(next);
    expect(JSON.stringify(set)).toBe(before);
    expect(next.categories.child!.entries).toBe(set.categories.child!.entries);
  });
  it("removes an owner", () => {
    const next = removeOwner(rs(), "top", "user:zed");
    expect(next.categories.top!.owners).toEqual([]);
    expect(removeOwner(rs(), "child", "user:x").categories.child!.owners).toEqual([]);
  });
});
