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
}

/** An action the host defines. `implies` lists the actions it includes (one level; closure is computed). */
export interface ActionDef {
  id: string;
  label?: string;
  description?: string;
  implies?: string[];
}

/** The person asking: every subject string that matches them (own id, groups, roles). */
export interface Person {
  /** Subjects that match this person, such as `user:alice`, `group:finance`, `role:approver`. */
  subjects: string[];
}

export interface DecideInput {
  ruleSet: RuleSet;
  actions: ActionDef[];
  person: Person;
  category: string;
  action: string;
}

export type DecideReason =
  | "entry" // a matching entry decided
  | "default-deny"; // nothing matched on the walk

export interface Decision {
  allowed: boolean;
  reason: DecideReason;
  /** The category and entry that decided, when reason is "entry". */
  decidedBy?: { category: string; entry: Entry };
  /** Categories visited, nearest first. */
  path: string[];
  /** True when a stopInheriting category ended the walk without a match. */
  stoppedAt?: string;
}

/** A node of the host's resource tree. */
export interface ResourceNode {
  id: string;
  label: string;
  children?: ResourceNode[];
}

/** One lookup result for a subject picker. */
export interface SubjectOption {
  id: string; // full subject string, `kind:id`
  label: string;
  detail?: string;
}

/** A kind of subject (user, group, role, ...) and how the host looks it up and labels it. */
export interface SubjectKind {
  kind: string; // the part before the colon
  label: string;
  /** Search for subjects of this kind. */
  search: (query: string) => Promise<SubjectOption[]> | SubjectOption[];
  /** Human label for a stored subject id; falls back to the raw subject. */
  resolve?: (subject: string) => string | undefined;
}

/** Everything the host passes to the drop-in pieces. */
export interface RaciConfig {
  actions: ActionDef[];
  subjectKinds: SubjectKind[];
  resources: ResourceNode[];
  strings?: Partial<Record<string, string>>;
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
  /** Initial value of stopInheriting for a category that has none. */
  defaultStopInheriting: boolean;
}

export const defaultSettings = (
  config: Pick<RaciConfig, "actions" | "subjectKinds">,
): RaciSettings => ({
  visibleActions: config.actions.map((a) => a.id),
  enabledSubjectKinds: config.subjectKinds.map((k) => k.kind),
  showInherited: true,
  confirmDeny: false,
  density: "comfortable",
  defaultStopInheriting: false,
});
