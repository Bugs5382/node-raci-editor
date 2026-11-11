# Extending

Nothing in the package knows your product. Everything you add is data in the `RaciConfig` and the
`RaciSettings`, so extending is a matter of building a new object, not patching the components.

## Add an action, a subject kind or a preset

The snippet below takes a base config and returns a new one with an extra `export` action that
implies `read`, and a `team` subject kind with its own lookup. A second function builds a
preset of settings. It uses the imports from the [quick start](getting-started.md#the-first-screen)
(`defaultSettings`, `RaciConfig`).

```ts
export const extend = (base: RaciConfig): RaciConfig => ({
  ...base,
  actions: [...base.actions, { id: "export", label: "Export", implies: ["read"] }],
  subjectKinds: [
    ...base.subjectKinds,
    {
      kind: "team",
      label: "Teams",
      search: (q) =>
        q.toLowerCase().startsWith("e") ? [{ id: "team:eng", label: "Engineering" }] : [],
      resolve: (subject) => (subject === "team:eng" ? "Engineering" : undefined),
    },
  ],
});

export const compact = (base: RaciConfig) => ({
  ...defaultSettings(base),
  density: "compact" as const,
  confirmDeny: true,
});
```

- **A new action.** Add an `ActionDef`. Existing stored entries are untouched; the new column
  appears blank. If it implies actions, a subject that already has an allow on it gets the implied
  cells marked as included. The simulator and `decide()` pick it up as soon as it is in
  `config.actions`. Keep action ids stable: they are stored in every entry, so renaming one orphans
  its entries.
- **A new subject kind.** Add a `SubjectKind`. Its `search` runs against your directory; the
  subject strings it returns (`team:eng`) must start with the `kind`. It shows up in the editor's
  picker and, because it is not `user`, in the simulator's memberships picker. A person's
  `subjects` list for `decide()` must include the matching `team:` strings, so build it from your
  directory on the server too.
- **A preset.** Settings are a plain object, so a preset is a function that returns one. Pass it as
  `settings`, store it, or offer a few as buttons next to `SettingsPanel`. Run values you load from
  storage through `normalizeSettings(config, stored)` so a config change cannot leave stale ids.
- **Strings.** Add or replace keys in `config.strings` to relabel or translate; see
  [Configuration](configuration.md#strings).

## Layer a token override

The look is a set of `--raci-*` custom properties with zero-specificity defaults. To change it, put
a rule in your own stylesheet, loaded after the package CSS, that targets `.raci-root` or an
ancestor:

```css
.my-admin-area .raci-root {
  --raci-accent: #0f766e;
  --raci-accent-hover: #115e59;
  --raci-focus-ring: #0f766e;
  --raci-radius-md: 0.25rem;
}
```

Because the override sits on an ancestor scope, it applies only inside that area, so one app can
show two themes. To override dark mode separately, add a second rule under
`.my-admin-area .raci-root[data-theme="dark"]` or inside a `prefers-color-scheme: dark` media
query. If you change a foreground or background, keep the pairs at WCAG AA. The full token list is
in [Theming](theming.md).

## What not to do

- Do not edit the objects you pass in; build new ones, as above. The components rely on a changed
  reference to know something changed, and `config` identity drives their string tables.
- Do not target the internal `raci-*` class names for layout; they can change. Tokens are the
  supported surface.
- Do not use `"*"` as a resource id; it is the all-categories rule bucket.
