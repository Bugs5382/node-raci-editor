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

import type { ReactNode } from "react";

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
  /** When true, the walk up to the parent ends at this category. Ignored by the "ordered" model. */
  stopInheriting?: boolean;
  /**
   * Subjects that own this category and everything below it. Read by models that have owners
   * (`"ordered"`); only subjects of the kinds the model allows count. Absent means none.
   */
  owners?: string[];
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
   * do. The editor groups the columns by kind when no `group` is given and both kinds are present.
   */
  kind?: "access" | "obligation";
  /**
   * The column group this action belongs to, a host-chosen id (see `RaciConfig.groups`). Wins over
   * `kind`. With no `group` the group is the `kind`, or `"access"` when there is none.
   */
  group?: string;
  /** Actions that must also be allowed for this one to be allowed (distinct from `implies`). */
  requires?: string[];
  /** Whether a category's owners always have this action. Default: true, except for an obligation. */
  ownerHas?: boolean;
  /** The words for an allowed and a denied result of this action. */
  outcome?: { allowed: string; denied: string };
}

/** The person asking: every subject string that matches them (own id, groups, roles). */
export interface Person {
  /**
   * The matchers that apply to the asker, resolved by the host: `user:alice`, `group:finance`,
   * `can:ack` or any other `kind:id` string. The package never learns how a match is computed.
   */
  subjects: string[];
}

/** The same as `Person`: the list of matchers that apply to whoever or whatever is asking. */
export type Context = Person;

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
  | "default-deny" // nothing matched on the walk
  | "owner" // the category's owner list decided ("ordered" model)
  | "requires" // a required action was not allowed ("ordered" model)
  | "superuser"; // a host-listed superuser subject always has this action ("ordered" model)

/** One entry that matched the asked action while walking a category. */
export interface TraceMatch {
  entry: Entry;
  /** Position of the entry in `category.entries`. */
  index: number;
  /** `direct` when the entry names the asked action, `implied` when it covers it through `implies`. */
  via: "direct" | "implied";
  /** True for the entry that produced the verdict. */
  decisive: boolean;
  /** 0-based position of the entry's row in the category (the "ordered" model). */
  row?: number;
}

/** What `decide()` saw in one visited category. */
export interface TraceStep {
  category: string;
  /** Every matching entry, in entry order. Empty when nothing matched. */
  matches: TraceMatch[];
  /** True when the category stops inheriting, which ends the walk here. */
  stopInheriting?: boolean;
  /** `"category"` when absent. `"owners"`, `"gate"`, `"confer"` and `"superuser"` come from the "ordered" model. */
  kind?: "category" | "owners" | "gate" | "confer" | "superuser";
  /** 0-based position of the step in the evaluation. */
  order?: number;
  /** For a gate step, the required action examined; for a confer step, the higher action that gave the asked one. */
  action?: string;
  /** For an owners or superuser step, the subject that matched. */
  matched?: string;
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
  /** The required action that was not allowed, when reason is "requires". */
  gatedBy?: string;
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

/** The states a grid cell can be drawn in. `none` is an empty cell; `included` is an empty cell another cell covers. */
export type CellStateId =
  | "allow"
  | "deny"
  | "none"
  | "inheritedAllow"
  | "inheritedDeny"
  | "included";

/** Colours of a cell state: CSS colours or `var(--token)`. An absent field keeps the default. */
export interface CellColors {
  fg?: string;
  bg?: string;
  border?: string;
}

/** Shape of a cell state. Never changes the box size, which comes from the size tokens only. */
export interface CellShape {
  radius?: string;
  borderStyle?: "solid" | "dashed" | "dotted" | "none";
  borderWidth?: string;
}

/** How the host draws one cell state. Every field is optional. */
export interface CellStateStyle {
  /** A glyph as text, or a function returning an icon. An empty string draws no glyph. */
  glyph?: string | ((state: CellStateId) => ReactNode);
  /** A word shown beside the glyph. An empty string hides the word. */
  text?: string;
  /** The state's name in the accessible name and the legend. */
  label?: string;
  /** A short form of the label, for narrow grids. */
  shortLabel?: string;
  /** The tooltip. */
  tooltip?: string;
  colors?: CellColors;
  shape?: CellShape;
  /** An extra class on the cell. */
  className?: string;
}

/** The serializable part of {@link CellStateStyle}, which a user can edit and a host can store. */
export interface CellStateSettings {
  glyph?: string;
  text?: string;
  label?: string;
  tooltip?: string;
  colors?: CellColors;
  shape?: CellShape;
  className?: string;
}

/** Cell appearance a user chooses. Overrides `RaciConfig.cellStates`; the package stores nothing. */
export interface CellSettings {
  /** The cell box in px. When absent, the density's size applies. */
  size?: { width: number; height: number };
  states?: Partial<Record<CellStateId, CellStateSettings>>;
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
  /** How each cell state is drawn: glyph, word, label, tooltip, colours, shape and class. */
  cellStates?: Partial<Record<CellStateId, CellStateStyle>>;
  /**
   * The column groups, in the order they are drawn, each with the host's label ("Permissions",
   * "Obligations", or anything). A group id used by an action but not listed here comes after the
   * listed ones.
   */
  groups?: { id: string; label: string }[];
  /**
   * Group labels by group id, for a group `groups` does not label. The ids `access` and
   * `obligation` default to the strings `editor.group.access` and `editor.group.obligation`; any
   * other id with no label shows as the id.
   */
  kindLabels?: Partial<Record<string, string>>;
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
  /** Cell appearance and size; see {@link CellSettings}. Absent means the defaults. */
  cells?: CellSettings;
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
