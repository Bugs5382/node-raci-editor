import type { ActionDef, Decision, DecideInput, Entry } from "./types.js";

const STAR = "*";

/** Every action an entry on `id` covers: itself plus all it implies, transitively. Cycle safe. */
const closure = (id: string, byId: Map<string, ActionDef>): Set<string> => {
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length > 0) {
    const next = byId.get(queue.pop() as string);
    for (const implied of next?.implies ?? []) {
      if (!seen.has(implied)) {
        seen.add(implied);
        queue.push(implied);
      }
    }
  }
  return seen;
};

/**
 * Decide whether a person may perform an action in a category.
 *
 * Default deny. Walk from the category up through `ruleSet.parents`, then the implicit `"*"`
 * category. The nearest category with a matching entry decides: any deny beats any allow there
 * (the first matching entry of the winning effect is reported). A category with `stopInheriting`
 * ends the walk after its own entries, skipping `"*"`. An unknown asked action is denied with an
 * empty path.
 */
export const decide = (input: DecideInput): Decision => {
  const { ruleSet, actions, person, category, action } = input;
  const byId = new Map(actions.map((a) => [a.id, a]));
  if (!byId.has(action)) {
    return { allowed: false, reason: "default-deny", path: [] };
  }
  const subjects = new Set(person.subjects);
  const closures = new Map<string, Set<string>>();
  const matches = (entry: Entry): boolean => {
    if (!subjects.has(entry.subject)) return false;
    let c = closures.get(entry.action);
    if (!c) {
      c = closure(entry.action, byId);
      closures.set(entry.action, c);
    }
    return c.has(action);
  };

  const path: string[] = [];
  // Visit the chain nearest first, then the implicit "*" stop unless the chain already had it.
  let next: string | undefined = category;
  while (true) {
    let current: string;
    if (next !== undefined && !path.includes(next)) {
      current = next;
    } else if (!path.includes(STAR)) {
      current = STAR;
    } else {
      return { allowed: false, reason: "default-deny", path };
    }
    path.push(current);
    const rules = ruleSet.categories[current];
    const hits = (rules?.entries ?? []).filter(matches);
    if (hits.length > 0) {
      const entry = hits.find((h) => h.effect === "deny") ?? (hits[0] as Entry);
      return {
        allowed: entry.effect === "allow",
        reason: "entry",
        decidedBy: { category: current, entry },
        path,
      };
    }
    if (rules?.stopInheriting) {
      return { allowed: false, reason: "default-deny", path, stoppedAt: current };
    }
    next = current === STAR ? undefined : ruleSet.parents[current];
  }
};
