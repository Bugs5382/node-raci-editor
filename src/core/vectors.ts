import type { ActionDef, Effect, Person, RuleSet } from "./types.js";

/** A person as written in the shared vectors file. */
export interface VectorPerson {
  id: string;
  groups: string[];
  roles: string[];
}

/** The decided-by summary a vector case expects. */
export interface VectorDecidedBy {
  category: string;
  subject: string;
  action: string;
  effect: Effect;
}

export interface VectorCase {
  name: string;
  ruleSet: RuleSet;
  person: VectorPerson;
  category: string;
  action: string;
  expect: {
    allowed: boolean;
    reason: "entry" | "default-deny";
    decidedBy: VectorDecidedBy | null;
  };
}

export interface VectorFile {
  version: 1;
  actions: ActionDef[];
  cases: VectorCase[];
}

/** Derive the subject strings for a vector person: `user:<id>`, `group:<g>`, `role:<r>`. */
export const vectorSubjects = (person: VectorPerson): Person["subjects"] => {
  return [
    `user:${person.id}`,
    ...person.groups.map((g) => `group:${g}`),
    ...person.roles.map((r) => `role:${r}`),
  ];
};
