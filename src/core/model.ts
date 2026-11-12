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
  DecideInput,
  Effect,
  Entry,
  RuleSet,
  TraceStep,
} from "./types.js";

/** Everything a model needs to answer one question: the same shape `decide()` takes. */
export type ModelInput = DecideInput;

/** What a model returns. The trace is always filled; `decide()` keeps it opt-in. */
export interface ModelResult {
  decision: Decision;
  trace: TraceStep[];
}

/** Which affordances the editor and simulator draw for a model. A false flag draws nothing. */
export interface ModelCapabilities {
  /** Entry order matters: show the # column and move up and down. */
  ordering: boolean;
  /** A third cell state "own". */
  ownEffect: boolean;
  /** An owners block, evaluated before rules. */
  owners: boolean;
  /** A superuser person is honoured and the simulator shows the step. */
  superuser: boolean;
  /** Required actions gate a verdict. */
  gating: boolean;
  /** The category toggle "stop inheriting". */
  stopInheriting: boolean;
  /** The "*" category exists and is the last stop of a walk. */
  wildcardCategory: boolean;
}

/** One cell look in the legend. */
export interface LegendItem {
  /** `allow`, `deny`, `own`, `blank`, `inherited`, `locked` or a custom id. */
  id: string;
  /** String key, resolved through `config.strings`. */
  label: string;
  description?: string;
}

/** One finding of `RaciModel.validate`. */
export interface ModelIssue {
  level: "error" | "warning";
  /** JSON pointer into the rule set. */
  path: string;
  message: string;
}

/**
 * A rule model: how a rule set is evaluated and which affordances are shown for it. A model only
 * describes how rules read and preview; the host enforces.
 */
export interface RaciModel {
  /** `"nearest"` or the host's own id. */
  id: string;
  label: string;
  /** Effects an entry may carry, in cycle order. */
  effects: ReadonlyArray<Effect>;
  /** Per-category fields the model reads, so the editor knows which controls to draw. */
  categoryOptions: ReadonlyArray<"stopInheriting" | "precedence" | "owners">;
  capabilities: ModelCapabilities;
  /**
   * The subject kinds that may own a category, for models with owners. The editor offers only
   * these in its owners picker. Left undefined, every kind is offered.
   */
  ownerKinds?: readonly string[];
  /** Pure evaluation of one question. A preview only; the host enforces. */
  evaluate(input: ModelInput): ModelResult;
  /** Check a rule set before it is shown or saved. */
  validate(ruleSet: RuleSet, actions: ActionDef[]): ModelIssue[];
  /** One sentence for an entry, used by tooltips and the simulator. */
  describeEntry(entry: Entry): string;
  /** The cell looks the legend shows for this model, in display order. */
  legend(): LegendItem[];
}
