# node-raci-editor 🧩

> 🧭 Generic drop-in React rules editor, simulator and settings for RACI-style access rules, with a pure TypeScript decide() and shared test vectors.

Subjects are whatever kinds your app has (user, group, role, team, department, service account, ...); the package assumes none of them.

You describe your actions, your kinds of subject (users, groups, roles, whatever you have) and your
resource tree. The package gives you a matrix editor for the rules of one category, a simulator that
previews "what would these rules allow this person here, and why", and a settings panel. The rules are one plain JSON
document, and `decide()` turns that document into a preview answer with no React and no DOM, so a Go
service or a mock can run the same logic against the same test vectors. The package shows and
edits the rules; it does not enforce anything. The host enforces them. 🔌 **The host owns the
data:** every component is controlled, you pass the rules in and get a new copy back through
`onChange`. Resources are your data too: the package draws no resource list, you pass the selected
category to the editor and the simulator.

## 📦 Install

```bash
npm i node-raci-editor
```

React 18 or newer is a peer dependency (`react` and `react-dom`). Import the stylesheet once:

```ts
import "node-raci-editor/styles.css";
```

## 🚀 Quick start

```tsx
import { useState } from "react";
import "node-raci-editor/styles.css";
import { RulesEditor, SettingsPanel, Simulator, defaultSettings } from "node-raci-editor";
import type { RaciConfig, RuleSet } from "node-raci-editor";

const people = [
  { id: "user:alice", label: "Alice" },
  { id: "user:bob", label: "Bob" },
];

export const config: RaciConfig = {
  actions: [
    { id: "read", label: "Read" },
    { id: "edit", label: "Edit", implies: ["read"] },
  ],
  subjectKinds: [
    {
      kind: "user",
      label: "Users",
      search: (q) => people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())),
    },
  ],
  resources: [{ id: "docs", label: "Docs", children: [{ id: "specs", label: "Specs" }] }],
};

export const App = () => {
  const [ruleSet, setRuleSet] = useState<RuleSet>({ categories: {}, parents: { specs: "docs" } });
  const [settings, setSettings] = useState(defaultSettings(config));
  return (
    <>
      <RulesEditor
        config={config}
        ruleSet={ruleSet}
        categoryId="specs"
        onChange={setRuleSet}
        settings={settings}
      />
      <Simulator config={config} ruleSet={ruleSet} categoryId="specs" settings={settings} />
      <SettingsPanel config={config} value={settings} onChange={setSettings} />
    </>
  );
};
```

Type a name in the editor's search box, pick Alice, and click a cell to cycle it: not set, allow,
deny. The simulator picks the person from the `user` kind, or from your first kind when you have none.

## 🌳 The resource tree

The package ships no tree component: the host renders its own resource tree and passes the nodes
(`ResourceNode[]` and `RuleSet.parents`) in. See [Getting started](guides/getting-started.md) for a
complete host example.

## 🧭 How a host app uses it

The host app owns its resources and checks requests itself: the resource tree and picker, the subject directory, the rule storage and whatever checks a request. The host enforces; the package only shows and edits the rules. The package is the rules editor, the simulator (a preview of what the rules would allow) and the settings panel, plus the pure `decide()`, an evaluation helper the host may call. Resources are data you pass in (ids, parents, labels, the selected `categoryId`); the package renders no resource list or picker of its own.

```text
  HOST APP (yours)                         PACKAGE (node-raci-editor)
  ------------------------------------     ---------------------------------------

  +-----------------------------+  resources   +-------------------------------+
  | Resource tree and picker    |------------->|                               |
  | ids, parents, labels, which |  categoryId  |  RulesEditor                  |
  | one is selected             |------------->|  edits the rules of ONE       |
  +-----------------------------+              |  category                     |
                                               |                               |
  +-----------------------------+  subjects    |   props in:  config, ruleSet, |
  | Subject directory           |------------->|              categoryId       |
  | people, groups, roles:      |  (search +   |   out:       onChange(ruleSet)|
  | lookup and labels           |   labels)    +-------------------------------+
  +-----------------------------+
   subjects: whatever kinds your app has
                                               +-------------------------------+
  +-----------------------------+  actions     |                               |
  | Actions and what they imply |------------->|  Simulator                    |
  | read, author, approve,      |              |                               |
  | manage (author -> read ...) |  rules       |  picks a person, evaluates    |
  +-----------------------------+------------->|  each action, shows the       |
                                               |  result and the reason        |
                                               |   props in:  config, ruleSet, |
  +-----------------------------+  rules       |              categoryId,      |
  | Rule storage                |<-------------|              evaluate? (host) |
  | keeps the rules JSON        |  onChange    +-------------------------------+
  +--------------+--------------+
                 |                              +-------------------------------+
                 | ruleSet                      |  SettingsPanel                |
                 v                              |  which actions and kinds to   |
  +-----------------------------+               |  show; onChange(settings)     |
  | Your enforcement            |  decide()     +-------------------------------+
  | may call decide() or an     |<-----------   decide(ruleSet, actions, person,
  | equivalent (same vectors)   |               category, action) -> Decision
  +-----------------------------+

  The package renders NO resource tree or picker. Your app owns it and passes the
  selected categoryId plus the resource data (nodes, parents, labels).

  EXAMPLE: a document library
  ---------------------------
  resources    library
                 `-- contracts            (parent of contracts = library)
  subject      alice = user:alice, member of group:finance-staff, role:approver
  rules        library:   Allow group:finance-staff  author
                          Allow role:approver        approve
               contracts: Deny  group:finance-staff  author

  alice asks:  author  on library    -> Would be allowed (library: Allow finance-staff)
               author  on contracts  -> Would be denied  (nearest category wins: the Deny)
               approve on contracts  -> Would be allowed (no entry in contracts, so the
                                                  parent library: Allow approver)
               read    on contracts  -> Would be denied  (a Deny on author includes read)
```

## ✨ Features

- 🧮 **A pure `decide()`** — default deny, nearest category wins, deny beats allow, no React, no DOM.
- 🧩 **Your model, not ours** — you define the actions, which actions imply which, the subject kinds and the resource tree.
- 🔎 **Async subject lookup** — each subject kind brings its own `search` and `resolve`; sync or promise.
- 🌳 **Inheritance you can see** — inherited entries show read-only in the editor, and the simulator prints the walk it took.
- 🪟 **Three simulator views** — the default list, a `boxes` grid with a per-category walk, and `strips`; plus a results slot and host-side `evaluate`.
- 🛑 **Stop inheriting** — per category, plus a `"*"` category for rules that apply everywhere.
- 🔌 **Pluggable rule models** — `nearest` is the default; other models register through `registerModel` and are picked with `decide(input, { model })` or `RuleSet.model`.
- 🧪 **Shared test vectors** — one JSON file that the TypeScript package, a mock and a Go implementation all run.
- 🗣️ **Your wording** — every string is a key you can override through `config.strings`.
- ♿ **Keyboard and screen reader friendly** — real buttons, tables and comboboxes; colour is never the only signal.
- 🎨 **Theme with tokens** — CSS custom properties with light and dark values, zero-specificity defaults.
- 🪶 **Small and unopinionated** — React and React DOM are peers, nothing else is bundled.

## 🧩 Cell variants

The editor cell is the state box by default. Pass `cellVariant="marks"` for a bare check, X or empty
cell, or `renderCell` to draw the cell yourself; every variant keeps the same fixed size. See
[Components](guides/components.md#cell-variants) for the fields.

```tsx
import type { RenderCellProps, RulesEditorProps } from "node-raci-editor";

// A host cell: a plain button that keeps the fixed size and the editor's accessible name.
export const HostCell = (cell: RenderCellProps) => (
  <button
    type="button"
    aria-label={cell.label}
    title={cell.title}
    disabled={cell.readOnly}
    style={{ width: cell.size.width, height: cell.size.height }}
    onClick={cell.onCycle}
  >
    {cell.state === "allow" ? "Y" : cell.state === "deny" ? "N" : ""}
  </button>
);

// `cellVariant="marks"` draws a check, an X or nothing; `renderCell` draws the whole cell.
export const MarksEditor = (props: RulesEditorProps) => (
  <RulesEditor {...props} cellVariant="marks" />
);
export const HostCellEditor = (props: RulesEditorProps) => (
  <RulesEditor {...props} renderCell={HostCell} />
);
```

## 📚 Guides

| Guide                                           | What is in it                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [Getting started](guides/getting-started.md)    | Install, the first screen, and what to wire up to your own data.                                      |
| [The access model](guides/access-model.md)      | Subjects, actions, entries, the four-step resolution with worked examples, and the JSON wire format.  |
| [Configuration](guides/configuration.md)        | `RaciConfig`, `RaciSettings`, subject kinds, the resource tree and every string key.                  |
| [Components](guides/components.md)              | `RulesEditor`, `Simulator` and `SettingsPanel`: props, events, immutability, accessibility, keyboard. |
| [Test vectors](guides/test-vectors.md)          | The shared `decide()` vectors, with a TypeScript runner and a Go sketch.                              |
| [Extending](guides/extending.md)                | Adding an action, a subject kind or a settings preset, and layering a token override.                 |
| [Theming](guides/theming.md)                    | Every `--raci-*` token, light and dark, and how to override them.                                     |
| [Rule models (design)](guides/models-design.md) | Design for pluggable rule models: `nearest`, `ordered`, vectors per model and the order of work.      |
| [Architecture](guides/architecture.md)          | The layout for contributors.                                                                          |

The API reference is generated from the source with `npm run docs`.

## 🛠 Develop

```bash
npm install
npm run build      # tsdown -> dist (esm + cjs + d.ts) and dist/styles.css
npm test           # vitest
npm run lint       # oxlint
npm run docs       # typedoc -> docs
```

## ⚖️ License

MIT (c) 2026 Shane
