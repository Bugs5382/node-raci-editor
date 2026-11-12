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
import type { LegendItem, ModelInput, ModelIssue, ModelResult, RaciModel } from "../model.js";
import { closure } from "./closure.js";

/** The built-in subject every asker has. A host labels it; it is not tied to any user directory. */
export const EVERYONE = "everyone:*";

/** Options of {@link createOrderedModel}. */
export interface OrderedOptions {
  /** Registry id. Default `"ordered"`. */
  id?: string;
  /** Label of the model. */
  label?: string;
  /** The subject kinds that may own a category. Default `["user"]`; an empty list switches owners off. */
  ownerKinds?: string[];
  /** Subjects every asker has. Default `[EVERYONE]`. */
  implicitSubjects?: string[];
  /** The actions owners always have. Default: each action's `ownerHas`, else every non-obligation action. */
  ownerActions?: string[];
  /**
   * The root seat: subjects that always have the listed actions, whatever any row says. Nothing
   * can take it away, as for owners, but it is supplied by the host and not tied to a category.
   * Off unless configured. Only access actions (Read, Author, Manage) can be listed to any effect:
   * an obligation (Approve, Acknowledge) is never exempt, even when listed, and follows the rows
   * like anyone else's. A deny that would have applied is ignored but reported as
   * `configuredBlock` on the decision.
   */
  superusers?: { subjects: string[]; actions: string[] };
}

const kindOf = (subject: string): string => {
  const at = subject.indexOf(":");
  return at < 0 ? "" : subject.slice(0, at);
};

const segment = (s: string): string => s.replace(/~/g, "~0").replace(/\//g, "~1");

const effects: ReadonlyArray<Effect> = ["allow", "deny"];

interface Row {
  subject: string;
  items: { entry: Entry; index: number }[];
}

/** The rows of a category: one per subject, in order of first appearance. */
const rowsOf = (entries: Entry[]): Row[] => {
  const rows = new Map<string, Row>();
  entries.forEach((entry, index) => {
    const row = rows.get(entry.subject) ?? { subject: entry.subject, items: [] };
    row.items.push({ entry, index });
    rows.set(entry.subject, row);
  });
  return [...rows.values()];
};

/**
 * Build an "ordered" model. Per action, rows are read from the top of the effective list (the
 * category's own rows, then its parent's, and so on); the first row that matches and has a green
 * or red cell for the action decides, and an empty cell is skipped: a cell answers only its own
 * action. Owners are checked before any row. An allowed higher action gives the lower ones it
 * `implies` even over an explicit deny of the lower one; `requires` narrows a final verdict. A pure evaluation
 * helper the host may call; the host enforces.
 */
export const createOrderedModel = (options: OrderedOptions = {}): RaciModel => {
  const ownerKinds = options.ownerKinds ?? ["user"];
  const implicit = options.implicitSubjects ?? [EVERYONE];

  const evaluate = (input: ModelInput): ModelResult => {
    const { ruleSet, actions, person, category, action } = input;
    const trace: TraceStep[] = [];
    const finish = (decision: Decision): ModelResult => {
      trace.forEach((step, order) => {
        step.order = order;
      });
      return { decision, trace };
    };
    const byId = new Map(actions.map((a) => [a.id, a]));
    if (!byId.has(action)) return finish({ allowed: false, reason: "default-deny", path: [] });

    const subjects = new Set([...person.subjects, ...implicit]);
    const chain: string[] = [];
    for (let at: string | undefined = category; at !== undefined && !chain.includes(at);) {
      chain.push(at);
      at = ruleSet.parents[at];
    }
    const ownerHas = (id: string): boolean => {
      if (options.ownerActions) return options.ownerActions.includes(id);
      const def = byId.get(id);
      return def?.ownerHas ?? def?.kind !== "obligation";
    };
    // Approve and Acknowledge are never global for the seat, whatever the host lists.
    const superuserHas = (id: string): boolean =>
      options.superusers?.actions.includes(id) === true &&
      byId.get(id)?.kind !== "obligation" &&
      id !== "approve" &&
      id !== "ack";
    const covers = (from: string, to: string): boolean => closure(from, byId).has(to);

    // One action, no gating. `record` adds owner and category steps to the trace. `rulesOnly`
    // leaves the superuser seat out, to find the entry that would have denied it.
    const core = (act: string, record: boolean, rulesOnly = false): Decision => {
      if (!rulesOnly && superuserHas(act)) {
        const matched = options.superusers?.subjects.find((s) => subjects.has(s));
        if (matched !== undefined) {
          if (record) trace.push({ category, matches: [], kind: "superuser", matched });
          return { allowed: true, reason: "superuser", path: [category] };
        }
      }
      if (ownerHas(act)) {
        for (const [i, cat] of chain.entries()) {
          const matched = (ruleSet.categories[cat]?.owners ?? []).find(
            (o) => ownerKinds.includes(kindOf(o)) && subjects.has(o),
          );
          if (matched !== undefined) {
            if (record) {
              trace.push({ category: cat, matches: [], kind: "owners", matched });
            }
            return { allowed: true, reason: "owner", path: chain.slice(0, i + 1) };
          }
        }
      }
      const path: string[] = [];
      for (const cat of chain) {
        path.push(cat);
        const hits: TraceMatch[] = [];
        rowsOf(ruleSet.categories[cat]?.entries ?? []).forEach((row, rowIndex) => {
          if (!subjects.has(row.subject)) return;
          const hit = row.items.find((it) => it.entry.action === act);
          if (hit) {
            hits.push({
              entry: hit.entry,
              index: hit.index,
              via: "direct",
              decisive: false,
              row: rowIndex,
            });
          }
        });
        if (record) trace.push({ category: cat, matches: hits });
        const win = hits[0];
        if (win) {
          win.decisive = true;
          return {
            allowed: win.entry.effect === "allow",
            reason: "entry",
            decidedBy: { category: cat, entry: win.entry },
            path,
          };
        }
      }
      return { allowed: false, reason: "default-deny", path };
    };

    // An allowed higher action gives every action it implies, even over an explicit deny of the
    // lower one: Author gives Read whatever a row says about Read. Only downward, and only from
    // what a row or an owner allows (no chaining through other gifts).
    const confer = (act: string, record: boolean, rulesOnly = false): Decision | undefined => {
      for (const higher of actions) {
        if (higher.id === act || !covers(higher.id, act)) continue;
        const d = core(higher.id, false, rulesOnly);
        if (!d.allowed) continue;
        if (record) trace.push({ category, matches: [], kind: "confer", action: higher.id });
        return { ...d };
      }
      return undefined;
    };
    const answer = (act: string, record: boolean, rulesOnly = false): Decision => {
      const d = core(act, record, rulesOnly);
      return d.allowed ? d : (confer(act, record, rulesOnly) ?? d);
    };

    const decision = answer(action, true);
    if (decision.reason === "superuser") {
      const rules = answer(action, false, true);
      if (!rules.allowed && rules.decidedBy) decision.configuredBlock = rules.decidedBy;
    }
    if (decision.allowed && decision.reason === "entry") {
      for (const required of byId.get(action)?.requires ?? []) {
        const gate = answer(required, false);
        trace.push({ category, matches: [], kind: "gate", action: required });
        if (!gate.allowed) {
          return finish({
            allowed: false,
            reason: "requires",
            path: decision.path,
            gatedBy: required,
          });
        }
      }
    }
    return finish(decision);
  };

  return {
    id: options.id ?? "ordered",
    label: options.label ?? "Ordered rows",
    effects,
    categoryOptions: ["owners"],
    capabilities: {
      ordering: true,
      ownEffect: false,
      owners: ownerKinds.length > 0,
      superuser: options.superusers !== undefined,
      gating: true,
      stopInheriting: false,
      wildcardCategory: false,
    },
    evaluate,
    validate: (ruleSet: RuleSet, actions: ActionDef[]): ModelIssue[] => {
      const issues: ModelIssue[] = [];
      const known = new Set(actions.map((a) => a.id));
      for (const [id, rules] of Object.entries(ruleSet.categories)) {
        const base = `/categories/${segment(id)}`;
        const seen = new Set<string>();
        rules.entries.forEach((entry, index) => {
          if (!effects.includes(entry.effect)) {
            issues.push({
              level: "error",
              path: `${base}/entries/${index}/effect`,
              message: `Effect "${entry.effect}" is not offered by the ordered model.`,
            });
          }
          const key = `${entry.subject}\u0000${entry.action}`;
          if (seen.has(key)) {
            issues.push({
              level: "error",
              path: `${base}/entries/${index}`,
              message: `A second entry for ${entry.subject} and ${entry.action}; a row has one cell per action.`,
            });
          }
          seen.add(key);
          if (!known.has(entry.action)) {
            issues.push({
              level: "warning",
              path: `${base}/entries/${index}/action`,
              message: `The action "${entry.action}" is not defined.`,
            });
          }
        });
        (rules.owners ?? []).forEach((owner, index) => {
          if (!ownerKinds.includes(kindOf(owner))) {
            issues.push({
              level: "error",
              path: `${base}/owners/${index}`,
              message: `The subject "${owner}" is not of a kind that may own a category.`,
            });
          }
        });
        if (rules.stopInheriting) {
          issues.push({
            level: "warning",
            path: `${base}/stopInheriting`,
            message: "The ordered model ignores stopInheriting; inherited rows always apply.",
          });
        }
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
      { id: "locked", label: "legend.locked" },
    ],
  };
};

/** The built-in "ordered" model with the default options. */
export const ordered: RaciModel = createOrderedModel();
