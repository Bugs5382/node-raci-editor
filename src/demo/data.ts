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
import type { RaciConfig, RaciSettings, ResourceNode, RuleSet, SubjectOption } from "@/core/types";

/** A named bundle of host configuration and a seed rule set, to show nothing is hard-coded. */
export interface Preset {
  id: string;
  label: string;
  config: RaciConfig;
  seed: RuleSet;
  /** Category selected first. */
  initialCategory: string;
  /** Settings the demo starts with, checked like any stored settings. */
  settings?: Partial<RaciSettings>;
}

/** Pretend network latency for subject search, in milliseconds. */
export const SEARCH_LATENCY_MS = 150;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Build a subject kind that searches an in-memory list after a short delay. */
export const memoryKind = (
  kind: string,
  label: string,
  options: SubjectOption[],
  latency = SEARCH_LATENCY_MS,
) => ({
  kind,
  label,
  search: async (query: string): Promise<SubjectOption[]> => {
    await sleep(latency);
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => q === "" || o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
    );
  },
  resolve: (subject: string): string | undefined => options.find((o) => o.id === subject)?.label,
});

/** Every node id in a tree, depth first. */
export const nodeIds = (nodes: ResourceNode[]): string[] =>
  nodes.flatMap((n) => [n.id, ...nodeIds(n.children ?? [])]);

/** The label of a node, or the id when unknown. */
export const nodeLabel = (nodes: ResourceNode[], id: string): string => {
  for (const n of nodes) {
    if (n.id === id) return n.label;
    const inner = nodeLabel(n.children ?? [], id);
    if (inner !== id) return inner;
  }
  return id;
};

/** Derive the child -> parent map of a tree. */
export const parentsOf = (nodes: ResourceNode[], parent?: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const n of nodes) {
    if (parent !== undefined) out[n.id] = parent;
    Object.assign(out, parentsOf(n.children ?? [], n.id));
  }
  return out;
};

const orgTree: ResourceNode[] = [
  {
    id: "company",
    label: "Company",
    children: [
      {
        id: "finance",
        label: "Finance",
        children: [
          { id: "payroll", label: "Payroll" },
          { id: "reports", label: "Reports" },
        ],
      },
      {
        id: "legal",
        label: "Legal",
        children: [
          { id: "contracts", label: "Contracts" },
          { id: "disputes", label: "Disputes" },
        ],
      },
      {
        id: "hr",
        label: "People",
        children: [{ id: "recruiting", label: "Recruiting" }],
      },
      {
        id: "it",
        label: "IT",
        children: [{ id: "security", label: "Security" }],
      },
    ],
  },
];

const orgUsers: SubjectOption[] = [
  { id: "user:alice", label: "Alice Ng", detail: "alice@example.test" },
  { id: "user:bob", label: "Bob Ray", detail: "bob@example.test" },
  { id: "user:carol", label: "Carol Diaz", detail: "carol@example.test" },
  { id: "user:dave", label: "Dave Kim", detail: "dave@example.test" },
  { id: "user:erin", label: "Erin Okoye", detail: "erin@example.test" },
];
const orgGroups: SubjectOption[] = [
  { id: "group:everyone", label: "Everyone" },
  { id: "group:finance", label: "Finance team" },
  { id: "group:legal", label: "Legal team" },
  { id: "group:contractors", label: "Contractors" },
];
const orgRoles: SubjectOption[] = [
  { id: "role:admin", label: "Administrator" },
  { id: "role:approver", label: "Approver" },
  { id: "role:auditor", label: "Auditor" },
];

const orgConfig: RaciConfig = {
  actions: [
    { id: "read", label: "Read", description: "See the content" },
    { id: "author", label: "Author", description: "Create and change", implies: ["read"] },
    { id: "approve", label: "Approve", description: "Sign off", implies: ["read"] },
    {
      id: "manage",
      label: "Manage",
      description: "Full control",
      implies: ["author", "approve", "read"],
    },
  ],
  subjectKinds: [
    memoryKind("user", "User", orgUsers),
    memoryKind("group", "Group", orgGroups),
    memoryKind("role", "Role", orgRoles),
  ],
  resources: orgTree,
};

const orgSeed: RuleSet = {
  parents: parentsOf(orgTree),
  categories: {
    "*": { entries: [{ subject: "role:admin", action: "read", effect: "allow" }] },
    company: {
      entries: [
        { subject: "group:everyone", action: "read", effect: "allow" },
        { subject: "role:admin", action: "manage", effect: "allow" },
      ],
    },
    finance: {
      entries: [
        { subject: "group:finance", action: "author", effect: "allow" },
        { subject: "role:approver", action: "approve", effect: "allow" },
      ],
    },
    payroll: {
      stopInheriting: true,
      entries: [
        { subject: "group:finance", action: "read", effect: "allow" },
        { subject: "user:carol", action: "manage", effect: "allow" },
        { subject: "user:bob", action: "read", effect: "deny" },
      ],
    },
    reports: {
      entries: [
        { subject: "user:dave", action: "read", effect: "deny" },
        { subject: "role:auditor", action: "read", effect: "allow" },
      ],
    },
    legal: {
      entries: [
        { subject: "group:legal", action: "author", effect: "allow" },
        { subject: "group:contractors", action: "read", effect: "deny" },
      ],
    },
    contracts: {
      entries: [
        { subject: "user:erin", action: "read", effect: "allow" },
        { subject: "user:erin", action: "approve", effect: "allow" },
      ],
    },
  },
};

const docsTree: ResourceNode[] = [
  {
    id: "workspace",
    label: "Workspace",
    children: [
      {
        id: "docs",
        label: "Documents",
        children: [
          { id: "drafts", label: "Drafts" },
          { id: "published", label: "Published" },
          { id: "archive", label: "Archive" },
        ],
      },
      {
        id: "media",
        label: "Media library",
        children: [
          { id: "images", label: "Images" },
          { id: "videos", label: "Videos" },
          { id: "audio", label: "Audio" },
        ],
      },
      { id: "site-settings", label: "Site settings" },
    ],
  },
];

const docsPeople: SubjectOption[] = [
  { id: "user:maya", label: "Maya Lopez", detail: "maya@example.test" },
  { id: "user:noah", label: "Noah Fischer", detail: "noah@example.test" },
  { id: "user:ravi", label: "Ravi Patel", detail: "ravi@example.test" },
];
const docsTeams: SubjectOption[] = [
  { id: "group:editors", label: "Editorial" },
  { id: "group:design", label: "Design" },
  { id: "group:guests", label: "Guests" },
];
const docsRoles: SubjectOption[] = [
  { id: "role:owner", label: "Owner" },
  { id: "role:publisher", label: "Publisher" },
];

const docsConfig: RaciConfig = {
  actions: [
    { id: "view", label: "View" },
    { id: "edit", label: "Edit", implies: ["view"] },
    { id: "publish", label: "Publish", implies: ["edit", "view"] },
  ],
  subjectKinds: [
    memoryKind("user", "Person", docsPeople),
    memoryKind("group", "Team", docsTeams),
    memoryKind("role", "Role", docsRoles),
  ],
  resources: docsTree,
  strings: {
    "editor.title": "Permissions for {category}",
    "editor.subject": "Who",
    "editor.stopInheriting": "Do not inherit",
    "editor.empty": "Nobody has permissions here yet.",
  },
};

const docsSeed: RuleSet = {
  parents: parentsOf(docsTree),
  categories: {
    workspace: {
      entries: [
        { subject: "group:guests", action: "view", effect: "allow" },
        { subject: "role:owner", action: "publish", effect: "allow" },
      ],
    },
    docs: { entries: [{ subject: "group:editors", action: "edit", effect: "allow" }] },
    drafts: {
      stopInheriting: true,
      entries: [
        { subject: "group:editors", action: "edit", effect: "allow" },
        { subject: "user:maya", action: "publish", effect: "allow" },
      ],
    },
    media: { entries: [{ subject: "group:design", action: "edit", effect: "allow" }] },
    videos: { entries: [{ subject: "user:noah", action: "edit", effect: "deny" }] },
  },
};

const cellsConfig: RaciConfig = {
  ...docsConfig,
  cellStates: {
    allow: {
      glyph: "Y",
      text: "",
      label: "yes",
      tooltip: "Allowed",
      colors: { fg: "#065f46", bg: "#d1fae5", border: "#10b981" },
      shape: { radius: "999px" },
    },
    deny: {
      glyph: "N",
      text: "",
      label: "no",
      tooltip: "Denied",
      colors: { fg: "#991b1b", bg: "#fee2e2", border: "#ef4444" },
      shape: { radius: "999px" },
    },
    none: { glyph: "", text: "" },
    included: { glyph: "y", text: "", colors: { fg: "#065f46" } },
    inheritedAllow: { glyph: "Y", text: "" },
    inheritedDeny: { glyph: "N", text: "" },
  },
};

export const presets: Preset[] = [
  {
    id: "org",
    label: "Organisation",
    config: orgConfig,
    seed: orgSeed,
    initialCategory: "payroll",
  },
  {
    id: "other",
    label: "Other app",
    config: docsConfig,
    seed: docsSeed,
    initialCategory: "drafts",
  },
  {
    id: "cells",
    label: "Custom cells",
    config: cellsConfig,
    seed: docsSeed,
    initialCategory: "drafts",
    settings: { cells: { size: { width: 64, height: 36 } } },
  },
];

export const presetById = (id: string): Preset => presets.find((p) => p.id === id) ?? presets[0]!;

/** A fresh copy of a rule set, so a host can change it without touching the sample. */
const cloneRuleSet = (ruleSet: RuleSet): RuleSet => structuredClone(ruleSet);

/**
 * The demo presets: a name, a `RaciConfig`, a seed `RuleSet` and the category shown first. The
 * array and every seed are new on each call; the configs are shared and should not be changed.
 */
export const demoPresets = (): Preset[] =>
  presets.map((p) => ({ ...p, seed: cloneRuleSet(p.seed) }));

/** A fresh sample `RuleSet` for a preset id (the first preset when omitted or unknown). */
export const demoRuleSet = (presetId?: string): RuleSet =>
  cloneRuleSet(presetById(presetId ?? presets[0]!.id).seed);
