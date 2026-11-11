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
/** Shared contract for the package. Every module builds against these types. */

/** Allow or deny. */
export type Effect = "allow" | "deny";

/** One rule: a subject (`kind:id`, such as `user:alice`) may or may not do an action. */
export interface Entry {
  subject: string;
  action: string;
  effect: Effect;
}

/** The rules of one category. */
export interface CategoryRules {
  /** When true, the walk up to the parent ends at this category. */
  stopInheriting?: boolean;
  entries: Entry[];
}

/**
 * The wire format, one JSON used by the editor, the simulator, a mock and Go.
 * `categories["*"]` holds entries that apply to every category, as the last stop of every walk.
 */
export interface RuleSet {
  categories: Record<string, CategoryRules>;
  /** child category id -> parent category id */
  parents: Record<string, string>;
  /** Id of the rule model that reads these rules. Absent means `"nearest"`. */
  model?: string;
}

/** An action the host defines. `implies` lists the actions it includes (one level; closure is computed). */
export interface ActionDef {
  id: string;
  label?: string;
  /** A short header for narrow or compact grids (for example one to three letters). Falls back to `label`. */
  shortLabel?: string;
  description?: string;
  implies?: string[];
  /**
   * `"access"` (default) states what a subject may do; `"obligation"` states what a subject must
   * do. The editor groups the columns by kind under two headings when both kinds are present.
   */
  kind?: "access" | "obligation";
}

/** The person asking: every subject string that matches them (own id, groups, roles). */
export interface Person {
  /** Subjects that match this person, such as `user:alice`, `group:finance`, `role:approver`. */
  subjects: string[];
}

/** Everything `decide()` needs: the rules, the action definitions, who asks, and the question. */
export interface DecideInput {
  ruleSet: RuleSet;
  actions: ActionDef[];
  person: Person;
  category: string;
  action: string;
}

/** Why a decision came out the way it did. */
export type DecideReason =
  | "entry" // a matching entry decided
  | "default-deny"; // nothing matched on the walk

/** One entry that matched the asked action while walking a category. */
export interface TraceMatch {
  entry: Entry;
  /** Position of the entry in `category.entries`. */
  index: number;
  /** `direct` when the entry names the asked action, `implied` when it covers it through `implies`. */
  via: "direct" | "implied";
  /** True for the entry that produced the verdict. */
  decisive: boolean;
}

/** What `decide()` saw in one visited category. */
export interface TraceStep {
  category: string;
  /** Every matching entry, in entry order. Empty when nothing matched. */
  matches: TraceMatch[];
  /** True when the category stops inheriting, which ends the walk here. */
  stopInheriting?: boolean;
}

/** Options of `decide()`. */
export interface DecideOptions {
  /** Add `trace` to the decision. Verdicts are identical either way. */
  trace?: boolean;
  /** Id of a registered rule model. Wins over `ruleSet.model`; the default is `"nearest"`. */
  model?: string;
}

/** The result of `decide()`. */
export interface Decision {
  allowed: boolean;
  reason: DecideReason;
  /** The category and entry that decided, when reason is "entry". */
  decidedBy?: { category: string; entry: Entry };
  /** Categories visited, nearest first. */
  path: string[];
  /** True when a stopInheriting category ended the walk without a match. */
  stoppedAt?: string;
  /** One step per visited category, nearest first. Only present when `decide()` was asked for it. */
  trace?: TraceStep[];
}

/** A node of the host's resource tree. */
export interface ResourceNode {
  id: string;
  label: string;
  children?: ResourceNode[];
}

/** One lookup result for a subject picker. */
export interface SubjectOption {
  /** Full subject string, `kind:id`. */
  id: string;
  /** Text shown for the option. */
  label: string;
  /** Optional secondary text, such as an email address. */
  detail?: string;
}

/** A kind of subject (user, group, role, ...) and how the host looks it up and labels it. */
export interface SubjectKind {
  /** The part of the subject string before the colon, such as `user`. */
  kind: string;
  /** Name of the kind shown in the picker. */
  label: string;
  /** Search for subjects of this kind. */
  search: (query: string) => Promise<SubjectOption[]> | SubjectOption[];
  /** Human label for a stored subject id; falls back to the raw subject. */
  resolve?: (subject: string) => string | undefined;
}

/** Everything the host passes to the drop-in pieces. */
export interface RaciConfig {
  /** The actions, in default column order. */
  actions: ActionDef[];
  /** The kinds of subject, each with its lookup. */
  subjectKinds: SubjectKind[];
  /** The resource tree; each node id is a category id in the `RuleSet`. */
  resources: ResourceNode[];
  /** Overrides for any UI string, by key; see the configuration guide for the keys. */
  strings?: Partial<Record<string, string>>;
  /** The headings of the two column groups. Default: the strings `editor.group.access` and `editor.group.obligation`. */
  kindLabels?: { access?: string; obligation?: string };
}

/** Display and behaviour settings the SettingsPanel edits; the editor and simulator read them. */
export interface RaciSettings {
  /** Action ids in column order, and which are shown. */
  visibleActions: string[];
  /** Subject kinds offered in the picker (kind ids). */
  enabledSubjectKinds: string[];
  /** Show entries inherited from ancestor categories, read-only, in the editor. */
  showInherited: boolean;
  /** Ask for confirmation before saving a Deny. */
  confirmDeny: boolean;
  /** Row density. */
  density: "comfortable" | "compact";
}

/** The settings used when the host passes none: every action and kind on, comfortable density. */
export const defaultSettings = (
  config: Pick<RaciConfig, "actions" | "subjectKinds">,
): RaciSettings => ({
  visibleActions: config.actions.map((a) => a.id),
  enabledSubjectKinds: config.subjectKinds.map((k) => k.kind),
  showInherited: true,
  confirmDeny: false,
  density: "comfortable",
});
