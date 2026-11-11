# Getting started

## Install

```bash
npm i node-raci-editor
```

`react` and `react-dom` (18 or newer) are peer dependencies. The package ships ESM and CJS with
type declarations, and a stylesheet.

```ts
import "node-raci-editor/styles.css";
```

Import the stylesheet once, near the root of your app. The components add the `raci-root` class to
their own root element, so there is nothing else to wrap. See [Theming](theming.md) to change the
look.

## The first screen

Three components share one `RaciConfig`: the editor, the simulator and the settings panel. The host
keeps the state.

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

What each piece does here:

- `config` is what the host knows: the actions (`read`, `edit`, where `edit` implies `read`), how to
  find subjects (one `user` kind with a `search` function), and the resource tree (`docs` with a
  child `specs`).
- `ruleSet` is the data you store. It starts empty. `parents` says `specs` sits under `docs`.
- `RulesEditor` edits the entries of one category, `specs`. Each edit calls `onChange` with a new
  `RuleSet`; your state setter stores it.
- `Simulator` reads the same `ruleSet` and answers questions with `decide()`. Add Alice in the
  editor, search for her in the simulator's Person box, and it lists what she can do and why.
- `settings` holds display choices (which action columns, density, confirm before deny). The editor
  and the simulator read them, and `SettingsPanel` edits them.

## What to wire to your own data

1. **Actions.** List the verbs your product has and say which include which. See
   [Configuration](configuration.md).
2. **Subject kinds.** Give each kind a `search` that calls your directory and, if you want names
   instead of ids in the grid, a `resolve`. Keep at least a `user` kind if you use the simulator.
3. **Resources.** Map your tree to `ResourceNode`s. The node ids are the category ids used in the
   `RuleSet`.
4. **Storage.** Load a `RuleSet` from wherever you keep it, pass it in, and save what `onChange`
   gives you. The shape is [documented](access-model.md#wire-format) and is the same one a server
   uses to decide.
5. **Server side.** Run the same decision where you enforce access. In TypeScript call `decide()`;
   in another language implement the algorithm and check it against the
   [test vectors](test-vectors.md).

## Next

- [The access model](access-model.md) explains how a decision is made.
- [Components](components.md) lists every prop.
- [Extending](extending.md) shows how to add your own action or subject kind.
