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
import { getModel } from "./registry.js";
import { EVERYONE } from "./models/ordered.js";
import type { ActionDef, RuleSet, TraceStep } from "./types.js";

/** One person to consider in a pool: an id the host knows and the matchers that apply to them. */
export interface PoolPerson {
  id: string;
  subjects: string[];
}

/** One entry of a pool: who, and why. */
export interface PoolEntry {
  person: string;
  /**
   * `"owner"` for an owner of the category or an ancestor; `"superuser"` for a host-listed
   * superuser; `"entry"` when a row allowed it.
   */
  reason: "owner" | "superuser" | "entry";
  /** Where the person owns, or where the deciding row is. */
  category: string;
  /** 0-based position of the deciding row, when reason is `"entry"`. */
  row?: number;
  /** True when the deciding row is the built-in Everyone row, so it applies to everyone. */
  everyone?: true;
}

/** What {@link actionPool} needs. */
export interface PoolInput {
  ruleSet: RuleSet;
  actions: ActionDef[];
  category: string;
  /** The people to consider. The package does not know who exists. */
  people: PoolPerson[];
  /** The action whose pool is listed: the approvers, or the people an obligation applies to. */
  action: string;
  /** Model id; else `ruleSet.model`, else `"nearest"`. */
  model?: string;
}

/**
 * The people for whom an action answers allowed in a category, owners first, each with the reason.
 * It is the approver pool for an approve action and the acknowledge list for an acknowledge action.
 * A pure listing; the host decides what to do with it.
 */
export const actionPool = (input: PoolInput): PoolEntry[] => {
  const model = getModel(input.model ?? input.ruleSet.model);
  const owners: PoolEntry[] = [];
  const superusers: PoolEntry[] = [];
  const rows: PoolEntry[] = [];
  for (const person of input.people) {
    const { decision, trace } = model.evaluate({
      ruleSet: input.ruleSet,
      actions: input.actions,
      person: { subjects: person.subjects },
      category: input.category,
      action: input.action,
    });
    if (!decision.allowed) continue;
    if (decision.reason === "owner" || decision.reason === "superuser") {
      // These two decisions always record their own step, which names the category.
      const kind = decision.reason === "owner" ? "owners" : "superuser";
      const step = trace.find((t) => t.kind === kind) as TraceStep;
      const entry: PoolEntry = {
        person: person.id,
        reason: decision.reason,
        category: step.category,
      };
      (decision.reason === "owner" ? owners : superusers).push(entry);
      continue;
    }
    // An allow that is neither of those came from a row, so the deciding entry is recorded.
    const by = decision.decidedBy as NonNullable<typeof decision.decidedBy>;
    const hit = trace.find((s) => s.category === by.category)?.matches.find((m) => m.decisive);
    const entry: PoolEntry = { person: person.id, reason: "entry", category: by.category };
    if (hit?.row !== undefined) entry.row = hit.row;
    if (by.entry.subject === EVERYONE) entry.everyone = true;
    rows.push(entry);
  }
  return [...owners, ...superusers, ...rows];
};
