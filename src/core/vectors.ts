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
import type { ActionDef, Effect, Person, RuleSet } from "./types.js";

/** A person as written in the shared vectors file. */
export interface VectorPerson {
  /** The user id; empty or absent when the person has no user subject (a matcher-only context). */
  id?: string;
  groups: string[];
  roles: string[];
  /** Extra matchers that apply, such as `can:ack`, added after the derived ones. */
  subjects?: string[];
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
    reason: "entry" | "default-deny" | "owner" | "requires";
    decidedBy: VectorDecidedBy | null;
    /** For reason `"requires"`, the required action that was not allowed. */
    gatedBy?: string;
  };
  /** Set (to the difference number in the design guide) when the case follows an open question. */
  pending?: string;
}

/** One pool case: who an action answers allowed for in a category, owners first. */
export interface VectorPool {
  name: string;
  ruleSet: RuleSet;
  people: { id: string; subjects: string[] }[];
  category: string;
  action: string;
  expect: {
    person: string;
    reason: "owner" | "entry";
    category: string;
    row?: number;
    everyone?: true;
  }[];
}

export interface VectorFile {
  version: 1;
  /** Id of the rule model the file's cases belong to. Absent means `"nearest"`. */
  model?: string;
  actions: ActionDef[];
  cases: VectorCase[];
  /** Approver pool and obligation lists, for models that have them. */
  pools?: VectorPool[];
}

/** Derive the subject strings for a vector person: `user:<id>`, `group:<g>`, `role:<r>`. */
export const vectorSubjects = (person: VectorPerson): Person["subjects"] => {
  return [
    ...(person.id ? [`user:${person.id}`] : []),
    ...person.groups.map((g) => `group:${g}`),
    ...person.roles.map((r) => `role:${r}`),
    ...(person.subjects ?? []),
  ];
};
