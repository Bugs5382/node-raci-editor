import type { Decision, Person, ResourceNode, SubjectKind } from "@/core/types";

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

export interface ReasonContext {
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** The category being asked about. */
  category: string;
  categoryLabel: (id: string) => string;
  subjectLabel: (subject: string) => string;
  actionLabel: (action: string) => string;
}

/** Plain-language reason for a decision. */
export const explainDecision = (decision: Decision, ctx: ReasonContext): string => {
  const { t } = ctx;
  const by = decision.decidedBy;
  if (decision.reason === "entry" && by) {
    const vars = {
      verdict: t(decision.allowed ? "simulator.allowed" : "simulator.denied"),
      subject: ctx.subjectLabel(by.entry.subject),
      action: ctx.actionLabel(by.entry.action),
      category: ctx.categoryLabel(by.category),
    };
    if (by.category === ctx.category) return t("simulator.reason.entry", vars);
    if (by.category === ALL_CATEGORIES) return t("simulator.reason.global", vars);
    return t("simulator.reason.inherited", vars);
  }
  if (decision.stoppedAt !== undefined) {
    return t("simulator.reason.stopped", { category: ctx.categoryLabel(decision.stoppedAt) });
  }
  return t("simulator.reason.default");
};
