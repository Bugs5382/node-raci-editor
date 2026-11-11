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
import type {
  ActionDef,
  Decision,
  Effect,
  Entry,
  RuleSet,
  TraceMatch,
  TraceStep,
} from "../types.js";
import { closure } from "./closure.js";
import type { LegendItem, ModelInput, ModelIssue, ModelResult, RaciModel } from "../model.js";

const STAR = "*";

/**
 * Evaluate one question under the "nearest" rules. A pure evaluation helper the host may call; the
 * host enforces.
 *
 * Default deny. Walk from the category up through `ruleSet.parents`, then the implicit `"*"`
 * category. The nearest category with a matching entry decides: any deny beats any allow there
 * (the first matching entry of the winning effect is reported). A category with `stopInheriting`
 * ends the walk after its own entries, skipping `"*"`. An unknown asked action is denied with an
 * empty path. The trace always holds one `TraceStep` per visited category; it is kept off the
 * decision, which `decide()` adds on request.
 */
const evaluate = (input: ModelInput): ModelResult => {
  const { ruleSet, actions, person, category, action } = input;
  const trace: TraceStep[] = [];
  const done = (decision: Decision): ModelResult => ({ decision, trace });
  const byId = new Map(actions.map((a) => [a.id, a]));
  if (!byId.has(action)) {
    return done({ allowed: false, reason: "default-deny", path: [] });
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
      return done({ allowed: false, reason: "default-deny", path });
    }
    path.push(current);
    const rules = ruleSet.categories[current];
    const hits: TraceMatch[] = [];
    (rules?.entries ?? []).forEach((entry, index) => {
      if (matches(entry)) {
        const via = entry.action === action ? "direct" : "implied";
        hits.push({ entry, index, via, decisive: false });
      }
    });
    const step: TraceStep = { category: current, matches: hits };
    if (rules?.stopInheriting) step.stopInheriting = true;
    trace.push(step);
    if (hits.length > 0) {
      const win = hits.find((h) => h.entry.effect === "deny") ?? (hits[0] as TraceMatch);
      win.decisive = true;
      return done({
        allowed: win.entry.effect === "allow",
        reason: "entry",
        decidedBy: { category: current, entry: win.entry },
        path,
      });
    }
    if (rules?.stopInheriting) {
      return done({ allowed: false, reason: "default-deny", path, stoppedAt: current });
    }
    next = current === STAR ? undefined : ruleSet.parents[current];
  }
};

/** Escape one JSON pointer segment. */
const segment = (s: string): string => s.replace(/~/g, "~0").replace(/\//g, "~1");

const effects: ReadonlyArray<Effect> = ["allow", "deny"];

/** Today's behaviour, the default model: the nearest category with a matching entry decides. */
export const nearest: RaciModel = {
  id: "nearest",
  label: "Nearest category",
  effects,
  categoryOptions: ["stopInheriting"],
  capabilities: {
    ordering: false,
    ownEffect: false,
    owners: false,
    superuser: false,
    gating: false,
    stopInheriting: true,
    wildcardCategory: true,
  },
  evaluate,
  validate: (ruleSet: RuleSet, _actions: ActionDef[]): ModelIssue[] => {
    const issues: ModelIssue[] = [];
    for (const [id, rules] of Object.entries(ruleSet.categories)) {
      rules.entries.forEach((entry, index) => {
        if (!effects.includes(entry.effect)) {
          issues.push({
            level: "error",
            path: `/categories/${segment(id)}/entries/${index}/effect`,
            message: `Effect "${entry.effect}" is not offered by the "nearest" model.`,
          });
        }
      });
    }
    return issues;
  },
  describeEntry: (entry: Entry): string =>
    `${entry.effect === "deny" ? "Deny" : "Allow"} ${entry.action} for ${entry.subject}`,
  legend: (): LegendItem[] => [
    { id: "allow", label: "legend.allow" },
    { id: "deny", label: "legend.deny" },
    { id: "blank", label: "legend.blank" },
    { id: "inherited", label: "legend.inherited" },
  ],
};
