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
import type { ActionDef, Decision, Person, ResourceNode, SubjectKind } from "@/core/types";

/** One category of the resource tree, flattened in display order. */
export interface FlatCategory {
  id: string;
  label: string;
  depth: number;
}

/** The implicit rule category that applies to every category. */
export const ALL_CATEGORIES = "*";

/** The person asking: every picked subject once, in the order picked, blanks dropped. */
export const personFromPicks = (picks: readonly string[]): Person => {
  return { subjects: [...new Set(picks.filter((p) => p.length > 0))] };
};

/** Walk the resource tree depth first, parents before children. */
export const flattenResources = (nodes: readonly ResourceNode[], depth = 0): FlatCategory[] => {
  return nodes.flatMap((n) => [
    { id: n.id, label: n.label, depth },
    ...flattenResources(n.children ?? [], depth + 1),
  ]);
};

/** Label of a category, the "all categories" label for `*`, or the raw id when unknown. */
export const categoryLabel = (
  flat: readonly FlatCategory[],
  id: string,
  allLabel: string,
): string => {
  if (id === ALL_CATEGORIES) return allLabel;
  return flat.find((c) => c.id === id)?.label ?? id;
};

/** Human label for a subject: the kind's `resolve`, else the raw `kind:id`. */
export const subjectLabel = (kinds: readonly SubjectKind[], subject: string): string => {
  const kind = kinds.find((k) => subject.startsWith(`${k.kind}:`));
  return kind?.resolve?.(subject) ?? subject;
};

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * The word for a result: the action's own `outcome`, else the string for its kind. An access
 * action reads allowed or denied, an obligation reads required or not required. With `strip` an
 * access action uses the strips' own keys, which follow the access words unless a host set them.
 */
export const verdictWord = (
  action: ActionDef | undefined,
  allowed: boolean,
  t: T,
  strip = false,
): string => {
  if (action?.outcome) return allowed ? action.outcome.allowed : action.outcome.denied;
  const side = allowed ? "allowed" : "denied";
  if (action?.kind === "obligation") return t(`simulator.obligation.${side}`);
  return t(strip ? `simulator.strip.${allowed ? "yes" : "no"}` : `simulator.${side}`);
};

export interface ReasonContext {
  t: T;
  /** The category being asked about. */
  category: string;
  categoryLabel: (id: string) => string;
  subjectLabel: (subject: string) => string;
  actionLabel: (action: string) => string;
  /** The action asked about, for the wording of its kind. Without it the access words are used. */
  action?: ActionDef;
}

/**
 * Short text for what decided, from the decision and its trace: the row and its category, the
 * owner, a host-listed subject that always has the action, the action needed first, or the higher
 * action that gave this one. Nothing when no rule decided or the model does not number its rows.
 */
export const decidedByText = (decision: Decision, ctx: ReasonContext): string | undefined => {
  const { t } = ctx;
  const trace = decision.trace ?? [];
  if (decision.reason === "requires" && decision.gatedBy) {
    return t("simulator.by.requires", { action: ctx.actionLabel(decision.gatedBy) });
  }
  const confer = trace.find((s) => s.kind === "confer");
  if (confer?.action) return t("simulator.by.confer", { action: ctx.actionLabel(confer.action) });
  if (decision.reason === "superuser") return t("simulator.by.superuser");
  if (decision.reason === "owner") {
    const at = trace.find((s) => s.kind === "owners")?.category ?? decision.path.at(-1);
    return at === undefined
      ? undefined
      : t("simulator.by.owner", { category: ctx.categoryLabel(at) });
  }
  const by = decision.decidedBy;
  if (decision.reason !== "entry" || !by) return undefined;
  const row = trace.flatMap((s) => s.matches).find((m) => m.decisive)?.row;
  if (row === undefined) return undefined;
  return t("simulator.by.row", { n: row + 1, category: ctx.categoryLabel(by.category) });
};

/** Plain-language reason for a decision. */
export const explainDecision = (decision: Decision, ctx: ReasonContext): string => {
  const { t } = ctx;
  const by = decision.decidedBy;
  const verdict = verdictWord(ctx.action, decision.allowed, t);
  const plain = ctx.action?.kind !== "obligation" && !ctx.action?.outcome;
  if (decision.reason === "entry" && by) {
    const vars = {
      verdict,
      subject: ctx.subjectLabel(by.entry.subject),
      action: ctx.actionLabel(by.entry.action),
      category: ctx.categoryLabel(by.category),
    };
    if (by.category === ctx.category) return t("simulator.reason.entry", vars);
    if (by.category === ALL_CATEGORIES) return t("simulator.reason.global", vars);
    return t("simulator.reason.inherited", vars);
  }
  if (decision.reason === "owner") return t("simulator.reason.owner", { verdict });
  if (decision.reason === "superuser") {
    const denial = decision.configuredBlock;
    if (!denial) return t("simulator.reason.superuser", { verdict });
    return t("simulator.reason.superuserBlocked", {
      verdict,
      subject: ctx.subjectLabel(denial.entry.subject),
      action: ctx.actionLabel(denial.entry.action),
      category: ctx.categoryLabel(denial.category),
    });
  }
  if (decision.reason === "requires") {
    return t("simulator.reason.requires", {
      verdict,
      action: ctx.actionLabel(decision.gatedBy ?? ""),
    });
  }
  if (decision.stoppedAt !== undefined) {
    const category = ctx.categoryLabel(decision.stoppedAt);
    return plain
      ? t("simulator.reason.stopped", { category })
      : t("simulator.reason.stoppedFor", { verdict, category });
  }
  return plain ? t("simulator.reason.default") : t("simulator.reason.defaultFor", { verdict });
};
