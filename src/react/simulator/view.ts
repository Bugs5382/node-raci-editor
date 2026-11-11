import type { ActionDef, Decision, Person } from "@/core/types";

/** Which built-in results view the simulator shows. `list` is the default table. */
export type SimulatorVariant = "list" | "boxes" | "strips";

/** What a view shows for one action. The simulator builds it, or the host's `evaluate` supplies it. */
export interface ActionResult {
  action: ActionDef;
  /** From `decide()` with a trace, or from the host. */
  decision: Decision;
  /** One sentence: the package wording, or the host's own text. */
  reasonText: string;
}

/** What a built-in view and the `renderResults` slot receive. */
export interface SimulatorViewProps {
  person: Person | null;
  category: string;
  /** One result per visible action, in display order. */
  results: ActionResult[];
  status: "idle" | "loading" | "error" | "ready";
  /** Set when the status is `error`. */
  retry?: () => void;
  labelOf: (categoryId: string) => string;
  subjectLabel: (subject: string) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}
