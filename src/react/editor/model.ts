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
import type { ActionDef, CategoryRules, Effect, Entry, RuleSet } from "@/core/types";

const STAR = "*";

/** Everything an action includes through `implies`, transitively, without the action itself. Cycle safe. */
export const impliedActions = (actions: ActionDef[], id: string): string[] => {
  const byId = new Map(actions.map((a) => [a.id, a]));
  const seen = new Set<string>([id]);
  const queue = [id];
  const out: string[] = [];
  while (queue.length > 0) {
    const current = byId.get(queue.pop() as string);
    for (const implied of current?.implies ?? []) {
      if (!seen.has(implied)) {
        seen.add(implied);
        out.push(implied);
        queue.push(implied);
      }
    }
  }
  return out;
};

/** The effect a subject has for an action in a list of entries; deny wins over allow. */
export const cellEffect = (
  entries: Entry[],
  subject: string,
  action: string,
): Effect | undefined => {
  let found: Effect | undefined;
  for (const e of entries) {
    if (e.subject === subject && e.action === action) {
      if (e.effect === "deny") return "deny";
      found = e.effect;
    }
  }
  return found;
};

/** The click cycle: blank, then allow, then deny, then blank again. */
export const nextEffect = (current: Effect | undefined): Effect | undefined => {
  if (current === undefined) return "allow";
  return current === "allow" ? "deny" : undefined;
};

/** Rows to show: subjects in order of first entry, then added subjects that have no entry yet. */
export const deriveRows = (entries: Entry[], extras: string[] = []): string[] => {
  const rows: string[] = [];
  for (const subject of [...entries.map((e) => e.subject), ...extras]) {
    if (!rows.includes(subject)) rows.push(subject);
  }
  return rows;
};

/**
 * Keep rows where they were: subjects of the previous order that are still wanted keep their
 * place, new ones follow in the derived order. Editing a cell never reorders rows.
 */
export const stableRows = (previous: string[], derived: string[]): string[] => {
  const wanted = new Set(derived);
  const kept = previous.filter((s) => wanted.has(s));
  const known = new Set(kept);
  return [...kept, ...derived.filter((s) => !known.has(s))];
};

const withCategory = (
  ruleSet: RuleSet,
  categoryId: string,
  update: (current: CategoryRules) => CategoryRules,
): RuleSet => {
  const current = ruleSet.categories[categoryId] ?? { entries: [] };
  return { ...ruleSet, categories: { ...ruleSet.categories, [categoryId]: update(current) } };
};

/** Set one cell. Any entry for the pair is replaced; a blank effect removes it. Never mutates. */
export const setCell = (
  ruleSet: RuleSet,
  categoryId: string,
  subject: string,
  action: string,
  effect: Effect | undefined,
): RuleSet => {
  return withCategory(ruleSet, categoryId, (current) => {
    const entries: Entry[] = [];
    let placed = false;
    for (const e of current.entries) {
      if (e.subject !== subject || e.action !== action) {
        entries.push(e);
      } else if (!placed && effect) {
        // replace in place so the subject keeps its position in the list
        entries.push({ subject, action, effect });
        placed = true;
      }
    }
    if (!placed && effect) entries.push({ subject, action, effect });
    return { ...current, entries };
  });
};

/** Remove every entry of a subject in a category. */
export const removeSubject = (ruleSet: RuleSet, categoryId: string, subject: string): RuleSet => {
  return withCategory(ruleSet, categoryId, (current) => ({
    ...current,
    entries: current.entries.filter((e) => e.subject !== subject),
  }));
};

/** Set the category's stopInheriting flag explicitly. */
export const setStopInheriting = (
  ruleSet: RuleSet,
  categoryId: string,
  value: boolean,
): RuleSet => {
  return withCategory(ruleSet, categoryId, (current) => ({ ...current, stopInheriting: value }));
};

export interface InheritedGroup {
  categoryId: string;
  entries: Entry[];
}

/**
 * Entries inherited by a category: nearest ancestors first, then "*". Follows the same walk as
 * decide(): a category with stopInheriting ends it (that category's entries still count).
 */
export const inheritedGroups = (
  ruleSet: RuleSet,
  categoryId: string,
  ownStop: boolean,
): InheritedGroup[] => {
  if (ownStop) return [];
  const groups: InheritedGroup[] = [];
  const visited = new Set<string>([categoryId]);
  let next: string | undefined = ruleSet.parents[categoryId];
  while (true) {
    let current: string;
    if (next !== undefined && !visited.has(next)) {
      current = next;
    } else if (!visited.has(STAR)) {
      current = STAR;
    } else {
      break;
    }
    visited.add(current);
    const rules = ruleSet.categories[current];
    if (rules && rules.entries.length > 0) {
      groups.push({ categoryId: current, entries: rules.entries });
    }
    if (rules?.stopInheriting) break;
    next = current === STAR ? undefined : ruleSet.parents[current];
  }
  return groups;
};

/** Move one item of a list to another index (clamped). A new list; an out-of-range `from` changes nothing. */
export const moveItem = <T>(list: readonly T[], from: number, to: number): T[] => {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const target = Math.max(0, Math.min(to, out.length - 1));
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item as T);
  return out;
};

/**
 * Write a row order into a category: each subject's entries move together, keeping their relative
 * order. Subjects the order does not name follow the named ones. Never mutates.
 */
export const reorderEntries = (ruleSet: RuleSet, categoryId: string, order: string[]): RuleSet => {
  return withCategory(ruleSet, categoryId, (current) => {
    const rank = (subject: string): number => {
      const at = order.indexOf(subject);
      return at < 0 ? order.length : at;
    };
    // sort() is stable, so a subject's own entries keep their order
    const entries = [...current.entries].sort((a, b) => rank(a.subject) - rank(b.subject));
    return { ...current, entries };
  });
};

/**
 * Rows of an ordered category. Rows with cells follow the order of their entries; a row without
 * a cell yet (just added, or all its cells cleared) keeps the place it had.
 */
export const orderedRows = (previous: string[], entries: Entry[], extras: string[]): string[] => {
  const stable = stableRows(previous, deriveRows(entries, extras));
  const withCells = deriveRows(entries);
  const have = new Set(withCells);
  let next = 0;
  return stable.map((subject) => (have.has(subject) ? (withCells[next++] as string) : subject));
};

/** One inherited row: a subject of an ancestor category with that category's entries for it. */
export interface InheritedRow {
  categoryId: string;
  subject: string;
  entries: Entry[];
}

/** The ancestors of a category, nearest first. Cycle safe. */
const ancestors = (ruleSet: RuleSet, categoryId: string): string[] => {
  const out: string[] = [];
  let next = ruleSet.parents[categoryId];
  while (next !== undefined && next !== categoryId && !out.includes(next)) {
    out.push(next);
    next = ruleSet.parents[next];
  }
  return out;
};

/**
 * Rows an ordered category inherits: its parent's rows, then the grandparent's, each in that
 * category's own order. There is no "*" category and nothing stops the walk.
 */
export const inheritedRows = (ruleSet: RuleSet, categoryId: string): InheritedRow[] =>
  ancestors(ruleSet, categoryId).flatMap((id) => {
    const entries = ruleSet.categories[id]?.entries ?? [];
    return deriveRows(entries).map((subject) => ({
      categoryId: id,
      subject,
      entries: entries.filter((e) => e.subject === subject),
    }));
  });

/** Owners a category inherits from its ancestors, nearest first, with the category they come from. */
export const inheritedOwners = (
  ruleSet: RuleSet,
  categoryId: string,
): { categoryId: string; owner: string }[] =>
  ancestors(ruleSet, categoryId).flatMap((id) =>
    (ruleSet.categories[id]?.owners ?? []).map((owner) => ({ categoryId: id, owner })),
  );

/** Add a subject to a category's owners; a subject already there changes nothing. Never mutates. */
export const addOwner = (ruleSet: RuleSet, categoryId: string, subject: string): RuleSet => {
  if (ruleSet.categories[categoryId]?.owners?.includes(subject)) return ruleSet;
  return withCategory(ruleSet, categoryId, (current) => ({
    ...current,
    owners: [...(current.owners ?? []), subject],
  }));
};

/** Take a subject off a category's owners. Never mutates. */
export const removeOwner = (ruleSet: RuleSet, categoryId: string, subject: string): RuleSet =>
  withCategory(ruleSet, categoryId, (current) => ({
    ...current,
    owners: (current.owners ?? []).filter((o) => o !== subject),
  }));
