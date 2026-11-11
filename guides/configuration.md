# Configuration

The host describes its world with one `RaciConfig` and its display choices with one
`RaciSettings`. Pass the config to all three components.

```ts
interface RaciConfig {
  actions: ActionDef[];
  subjectKinds: SubjectKind[];
  resources: ResourceNode[];
  strings?: Partial<Record<string, string>>;
}
```

Create the config once (or memoize it): the components rebuild their string tables when the `config`
object changes identity.

## Actions

```ts
interface ActionDef {
  id: string;
  label?: string;
  description?: string;
  implies?: string[];
}
```

- `id` is stored in entries, so keep it stable. `label` is the column heading and falls back to the
  id. `description` shows as the column's tooltip in the editor and as a note in the settings panel.
- `implies` lists the actions this one includes. Give one level; the closure is computed. In the
  editor, a subject with an allow on `edit` sees the `read` cell marked "included by Edit" if `edit`
  implies `read` and `read` itself is not set.
- The order of the `actions` array is the default column order. The settings panel can reorder and
  hide them per user.
- Action ids that appear in `implies` but not in the list match only by id.

## Cell appearance

Whoever uses the package can set how the cells look, in two places. Both are optional; nothing
changes without them.

**Host config, `config.cellStates`.** One entry per state: `allow`, `deny`, `none` (empty),
`inheritedAllow`, `inheritedDeny` and `included` (an empty cell another cell covers). Every field of
an entry is optional:

| Field       | Meaning                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `glyph`     | Text, or a function `(state) => ReactNode` for an icon. An empty string draws no glyph.                |
| `text`      | The word beside the glyph. An empty string hides the word.                                             |
| `label`     | The state's name in the cell's accessible name ("Alice, Read: yes").                                   |
| `tooltip`   | The cell's tooltip.                                                                                    |
| `colors`    | `{ fg, bg, border }`: a CSS colour or `var(--token)`. The green and red defaults are the token values. |
| `shape`     | `{ radius, borderStyle, borderWidth }`.                                                                |
| `className` | An extra class on the cell.                                                                            |

**User settings, `settings.cells`.** The serializable part of the same entries (everything except a
glyph function), plus the cell size: `{ size: { width, height }, states: { allow: { glyph: "Y" } } }`.
Settings override the host's entry field by field. The size is in px, from 24 to 240 wide and from 16
to 120 high, so cells can be much smaller than the density defaults (96 by 56 and 144 by 28); empty
uses the density's size. `normalizeCells(value)` checks any such value and returns what is valid
with a list of what it dropped; `normalizeSettings` and the settings panel use it, so what you
store is valid.

**The Settings panel** has a Cells section: a live preview of the six states drawn by the real cell,
the size, and for each state a glyph, a word, a tooltip and three colour inputs. It emits through
`onChange` as `settings.cells` and stores nothing; the host persists what it receives and passes it
back. An empty text field keeps the default (to draw nothing, type a single space).

**Guarantees.** The box size comes from the size tokens (`--raci-cell-width` and
`--raci-cell-height`) only. A glyph or word that is too big is clipped, never resizes the box, the
row or the column, and stays centred. The state is still carried by the glyph or word as well as
colour, so choosing colours with little contrast is only a matter of taste, not of meaning.

## Subject kinds

Subjects are whatever kinds your app has (user, group, role, team, department, service account, ...); the package assumes none of them. With one kind there is no kind chooser, and a stored subject of a kind you did not configure is shown as stored, kept when rows change and still evaluated.

```ts
interface SubjectKind {
  kind: string;
  label: string;
  search: (query: string) => Promise<SubjectOption[]> | SubjectOption[];
  resolve?: (subject: string) => string | undefined;
}

interface SubjectOption {
  id: string; // full subject string, "kind:id"
  label: string;
  detail?: string;
}
```

- `kind` is the part before the colon in a subject string. `label` is shown in the kind selector.
- `search(query)` returns matches for what the user typed. It may be synchronous or return a
  promise. The picker debounces input by 200 ms, trims the query, never calls `search` for an empty
  query, ignores out-of-date responses and shows a "Search failed" message if the promise rejects.
  Each option's `id` must be the full subject string (`user:alice`, not `alice`).
- `resolve(subject)` turns a stored subject into a name for display, for subjects the user did not
  just pick (rows loaded from storage). Return `undefined` to fall back to the label remembered
  from the last pick, then to the raw subject string. Keep it synchronous and cheap: it runs on
  every render of a row.
- The simulator finds the person with the kind named by its `personKind` prop (default `user` when the config has that kind, else its first kind),
  whether or not the settings enable it. Its "extra memberships" picker offers every other kind that
  is enabled in the settings.

## Resource tree

```ts
interface ResourceNode {
  id: string;
  label: string;
  children?: ResourceNode[];
}
```

The node ids are the category ids in your `RuleSet`. The tree is used for labels (the editor's
"Inherited from ..." headings and the simulator's walk). It is not used to decide:
`decide()` follows `ruleSet.parents`, so keep `parents` in step with the tree you pass here.

The package ships no tree component: your app renders its own tree (navigation, a file browser,
whatever fits) and passes the nodes in. The demo's tree is internal to the demo and not exported.

## Settings

```ts
interface RaciSettings {
  visibleActions: string[];
  enabledSubjectKinds: string[];
  showInherited: boolean;
  confirmDeny: boolean;
  density: "comfortable" | "compact";
}
```

| Field                 | Default         | Effect                                                             |
| --------------------- | --------------- | ------------------------------------------------------------------ |
| `visibleActions`      | every action id | Which action columns show, in this order.                          |
| `enabledSubjectKinds` | every kind      | Kinds offered in the editor's picker and as simulator memberships. |
| `showInherited`       | `true`          | Show inherited entries, read-only, under the editor's grid.        |
| `confirmDeny`         | `false`         | Ask before saving a Deny from the editor.                          |
| `density`             | `"comfortable"` | Row spacing of the editor and the simulator.                       |

Helpers exported for hosts that store settings:

- `defaultSettings(config)` builds the defaults.
- `normalizeSettings(config, partial?)` merges a stored, possibly stale value over the defaults:
  unknown action and kind ids are dropped, empty lists fall back to the defaults, and a bad
  `density` is replaced. Run stored settings through it when the config can change between
  releases.
- `toggleAction`, `toggleKind` and `moveAction` are the pure functions behind the panel; each
  refuses to hide the last action or kind.

`RulesEditor` and `Simulator` take `settings` as a `Partial<RaciSettings>` and fill in the rest from
`defaultSettings`. `SettingsPanel` takes a complete `RaciSettings`.

## Strings

Every piece of text comes from a key. Put overrides in `config.strings`; any key you leave out uses
the English default. A value may contain `{name}` placeholders, filled from the variables listed
below; an unknown placeholder is left as written. Keys are not namespaced per host, so reuse one
`strings` object for all three components.

```ts
const config: RaciConfig = {
  // ...
  strings: { "editor.title": "Permissions for {category}", "editor.deny": "no" },
};
```

Keys with a variable list their variables in braces. The default text is in the second column.

### Rules editor (`editor.*`)

| Key                         | Default                                                                   |
| --------------------------- | ------------------------------------------------------------------------- |
| `editor.title`              | Rules for {category} (the heading; {category} is the resource path)       |
| `editor.pathSeparator`      | " / " (between the labels of the path)                                    |
| `editor.subject`            | Subject                                                                   |
| `editor.empty`              | No subjects have rules in this category yet.                              |
| `editor.allow`              | allow (spoken state in a cell's label)                                    |
| `editor.deny`               | deny                                                                      |
| `editor.blank`              | not set                                                                   |
| `editor.allowText`          | Allow (visible text in a cell)                                            |
| `editor.denyText`           | Deny                                                                      |
| `editor.blankText`          | Not set                                                                   |
| `editor.included`           | included                                                                  |
| `editor.includedVia`        | Included by {action}                                                      |
| `editor.cellLabel`          | {subject}, {action}: {state}                                              |
| `editor.cellLabelIncluded`  | {subject}, {action}: {state}, included by {via}                           |
| `editor.remove`             | Remove                                                                    |
| `editor.removeLabel`        | Remove {subject}                                                          |
| `editor.stopInheriting`     | Stop inheriting                                                           |
| `editor.stopInheritingHelp` | Ignore rules from parent categories and the all-categories rules.         |
| `editor.inheritanceStopped` | Inheritance stops at this category.                                       |
| `editor.inheritedFrom`      | Inherited from {resource}                                                 |
| `editor.allCategories`      | All categories                                                            |
| `editor.inheritedNote`      | Read-only. Change these in their own category.                            |
| `editor.addSubject`         | Add subject                                                               |
| `editor.kind`               | Subject type                                                              |
| `editor.search`             | Search                                                                    |
| `editor.searchPlaceholder`  | Search by name                                                            |
| `editor.searching`          | Searching...                                                              |
| `editor.noResults`          | No matches.                                                               |
| `editor.searchError`        | Search failed. Try again.                                                 |
| `editor.confirmDenyTitle`   | Confirm deny                                                              |
| `editor.confirmDenyBody`    | Deny {action} for {subject}? A deny overrides any allow in this category. |
| `editor.confirm`            | Deny (the confirm button)                                                 |
| `editor.cancel`             | Cancel                                                                    |

### Simulator (`simulator.*`)

| Key                                | Default                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `simulator.title`                  | Previews what these rules would allow                                  |
| `simulator.person`                 | Person                                                                 |
| `simulator.personPlaceholder`      | Search for a person                                                    |
| `simulator.memberships`            | Extra memberships                                                      |
| `simulator.membershipsPlaceholder` | Add a membership                                                       |
| `simulator.noMatches`              | No matches                                                             |
| `simulator.remove`                 | Remove {label}                                                         |
| `simulator.results`                | Results                                                                |
| `simulator.action`                 | Action                                                                 |
| `simulator.result`                 | Result                                                                 |
| `simulator.why`                    | Why                                                                    |
| `simulator.walk`                   | Checked, nearest first                                                 |
| `simulator.allowed`                | Would be allowed                                                       |
| `simulator.denied`                 | Would be denied                                                        |
| `simulator.allCategories`          | All categories                                                         |
| `simulator.emptyPerson`            | Choose a person to preview what these rules would allow.               |
| `simulator.emptyCategory`          | There are no categories to preview.                                    |
| `simulator.emptyActions`           | There are no actions to show.                                          |
| `simulator.reason.entry`           | {verdict} by {subject} in {category} ({action})                        |
| `simulator.reason.inherited`       | {verdict} by {subject} ({action}), inherited from {category}           |
| `simulator.reason.global`          | {verdict} by {subject} ({action}), from the rules for all categories   |
| `simulator.reason.stopped`         | Would be denied: no rule matched, and inheriting stopped at {category} |
| `simulator.reason.default`         | Would be denied: no rule matched (default deny)                        |
| `simulator.loading`                | Previewing...                                                          |
| `simulator.error`                  | Could not preview the result.                                          |
| `simulator.retry`                  | Retry                                                                  |
| `simulator.strip.title`            | {action} - {answer}                                                    |
| `simulator.strip.yes`              | Would be allowed                                                       |
| `simulator.strip.no`               | Would be denied                                                        |
| `simulator.box.reason`             | Reason                                                                 |
| `simulator.box.decidedBy`          | Decided by                                                             |
| `simulator.box.walk`               | Walk                                                                   |
| `simulator.box.overridden`         | Overridden ({count})                                                   |
| `simulator.box.noRule`             | No rule matched                                                        |
| `simulator.box.noMatch`            | no match                                                               |
| `simulator.box.stopped`            | Inheriting stopped here                                                |
| `simulator.box.direct`             | direct                                                                 |
| `simulator.box.implied`            | implied                                                                |
| `simulator.box.deciding`           | deciding                                                               |
| `simulator.box.effectAllow`        | Allow                                                                  |
| `simulator.box.effectDeny`         | Deny                                                                   |
| `simulator.box.entry`              | Entry #{n}                                                             |

### Settings panel (`settings.*`)

| Key                            | Default                                           |
| ------------------------------ | ------------------------------------------------- |
| `settings.title`               | Settings                                          |
| `settings.actions.legend`      | Actions                                           |
| `settings.actions.hint`        | Choose which actions are shown and in what order. |
| `settings.actions.implies`     | Implies: {list}                                   |
| `settings.actions.impliesNone` | Implies no other action                           |
| `settings.moveUp`              | Up                                                |
| `settings.moveDown`            | Down                                              |
| `settings.actions.moveUp`      | Move {label} up                                   |
| `settings.actions.moveDown`    | Move {label} down                                 |
| `settings.actions.lastHint`    | At least one action must stay visible.            |
| `settings.kinds.legend`        | Subject kinds                                     |
| `settings.kinds.hint`          | Choose which kinds of subject can be picked.      |
| `settings.kinds.lastHint`      | At least one subject kind must stay enabled.      |
| `settings.behavior.legend`     | Behavior                                          |
| `settings.showInherited`       | Show inherited entries                            |
| `settings.confirmDeny`         | Confirm before saving a Deny                      |
| `settings.density.legend`      | Density                                           |
| `settings.density.comfortable` | Comfortable                                       |
| `settings.density.compact`     | Compact                                           |
| `settings.reset`               | Reset to defaults                                 |

The "Up" and "Down" captions use `settings.moveUp` and `settings.moveDown`; the accessible names of
those buttons, which carry the action label, use `settings.actions.moveUp` and `moveDown`. The one
piece of text you do not set through `strings` is the action and kind labels themselves, which come
from your `ActionDef.label` and `SubjectKind.label`.
