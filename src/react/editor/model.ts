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
    const kept = current.entries.filter((e) => !(e.subject === subject && e.action === action));
    return { ...current, entries: effect ? [...kept, { subject, action, effect }] : kept };
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
