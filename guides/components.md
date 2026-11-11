# Components

`RulesEditor`, `Simulator` and `SettingsPanel` are controlled components. They keep a little UI
state of their own (what is typed in a search box, which pick is open) but never the data: you pass
the rules and the settings in and get a new copy back through a callback.

All three take a `className` that is added to the root element, and all three put `raci-root` on
that root so the [theme tokens](theming.md) apply.

## Immutability

- The `RuleSet` and `RaciSettings` objects you pass are never mutated.
- Every edit calls the callback with a new object. Untouched categories keep the same references,
  so a store that compares by reference only sees the category that changed.
- A callback is called once per user action. If you ignore it, the UI stays where it was (the
  component follows your props, not its own memory), which is how you reject a change.

## RulesEditor

A matrix of subjects (rows) by actions (columns) for the entries of one category.

| Prop          | Type                                   | Notes                                                                                         |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `config`      | `RaciConfig`                           | Actions, subject kinds, resources, strings.                                                   |
| `ruleSet`     | `RuleSet`                              | The whole rule set; the editor reads the entries of `categoryId`.                             |
| `categoryId`  | `string`                               | The category being edited. Change it to move to another category.                             |
| `onChange`    | `(next: RuleSet) => void`              | Called with the new rule set after each edit.                                                 |
| `settings`    | `Partial<RaciSettings>`                | Optional. Missing fields use `defaultSettings(config)`.                                       |
| `readOnly`    | `boolean`                              | Optional, default `false`. Disables the cells, the checkbox and the picker, and hides Remove. |
| `cellVariant` | `"box" \| "marks"`                     | Optional, default `"box"`. The look of a cell; see "Cell variants" below.                     |
| `renderCell`  | `(cell: RenderCellProps) => ReactNode` | Optional. Draws every cell itself; wins over `cellVariant`. See "Cell variants".              |
| `className`   | `string`                               | Optional.                                                                                     |

What it does:

- **Cells.** One button per subject and action. A click cycles not set, then allow, then deny, then
  not set. Setting a cell replaces any entry for that pair; clearing it removes the entry. If a
  stored rule set holds both an allow and a deny for one pair, the cell shows deny.
- **Included cells.** If a subject has an allow on an action that implies another, the other's
  cell shows "included" and its tooltip says which action includes it. The cell is still its own
  entry: you can set an explicit deny on it. Every cell state has the same fixed size, set by
  `--raci-cell-width` and `--raci-cell-height` for each density.
- **Confirm deny.** With `settings.confirmDeny`, the move to deny opens a dialog first. Escape or
  Cancel leaves the cell as it was.
- **Adding a subject.** The picker at the bottom has a kind menu (only the enabled kinds) and a
  search box. Picking a result adds an empty row; the row becomes part of the `RuleSet` only when
  you set a cell in it. An empty row lives in the editor's own state, kept per category: it
  survives switching to another category and back, and is forgotten only when you remove it or the
  editor unmounts.
- **Title.** A heading names the category being edited with its path in `config.resources`, such
  as "Rules for Company / Documents" (`editor.title`, `editor.pathSeparator`). The `"*"` category
  shows "All categories"; an id that is not in the tree shows as written.
- **Removing.** Remove deletes every entry of that subject in this category.
- **Stop inheriting.** A checkbox above the grid writes `stopInheriting` on the category (an
  explicit `true` or `false`, so it is never lost to a default).
- **Inherited entries.** With `settings.showInherited`, the entries of the ancestors, and of `"*"`,
  appear under the grid as read-only tables, nearest first, each titled "Inherited from ...". When
  the category stops inheriting, none show and a note says so.
- **Empty state.** With no rows it shows "No subjects have rules in this category yet."

Events: `onChange(next)` is the only one. Search failures are shown in the picker, not thrown.

Accessibility:

- The grid is a real `table` with column and row headers. Each cell button has an accessible name
  like "Alice, Edit: allow", or "Alice, Read: not set, included by Edit". The state is also written
  as text and an icon in the cell; colour is never the only signal.
- The root is a labelled `section`. The stop-inheriting checkbox is described by its help text.
- Read-only inherited cells are images with the same labels.
- The confirm dialog is an `alertdialog`, moves focus to its Deny button, and closes on Escape.
- The picker is an ARIA combobox with a listbox, an active-descendant and live status messages for
  loading, no results and errors.

Keyboard:

| Where      | Keys                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Anywhere   | Tab and Shift+Tab move between the checkbox, cells, Remove buttons and the picker.                                                       |
| Cell       | Enter or Space cycles the state.                                                                                                         |
| Search box | Type to search; Down and Up move through results (Down also opens the list); Enter picks the highlighted result; Escape closes the list. |
| Dialog     | Enter or Space on the focused button; Escape cancels.                                                                                    |

## Cell variants

Every cell has the same fixed box, set by `--raci-cell-width` and `--raci-cell-height` for each
density, in every variant, so editing never moves or resizes a row.

- **`box`** (default, unchanged): the state box with an icon, the state word and a reserved line for
  "included".
- **`marks`**: only a mark, centred in the same box. A check for Allow, an X for Deny and nothing for
  Not set. There is no box or fill. An included cell shows a dimmed check, and an inherited cell a
  dimmed mark. The button, its accessible name (for example "Alice, Edit: allow"), its tooltip, the
  keyboard behaviour (Tab, Enter, Space) and the click order (not set, allow, deny, not set) are
  the same as the box. `readOnly` disables it the same way.
- **`renderCell`**: the host draws the whole cell. It is called for every grid cell and every cell
  of the inherited tables, and gets a `RenderCellProps`:

| Field        | Type                                  | Notes                                                                             |
| ------------ | ------------------------------------- | --------------------------------------------------------------------------------- |
| `state`      | `"allow" \| "deny" \| "blank"`        | The cell's own state; `"blank"` is Not set.                                       |
| `inherited`  | `boolean`                             | True in an inherited table: read-only, never changes.                             |
| `includedBy` | `ActionDef \| undefined`              | For a blank cell, the action whose Allow includes it.                             |
| `action`     | `ActionDef`                           | The column.                                                                       |
| `subject`    | `string`                              | The row's subject id. `subjectLabel` is its display label.                        |
| `label`      | `string`                              | The accessible name the built-in cell uses. Put it on your control.               |
| `title`      | `string`                              | The tooltip text the built-in cell uses.                                          |
| `readOnly`   | `boolean`                             | True when the editor is read-only or the cell is inherited.                       |
| `onChange`   | `(next: Effect \| undefined) => void` | Sets the cell; a deny asks for confirmation when `settings.confirmDeny` is on.    |
| `onCycle`    | `() => void`                          | Moves to the next state: not set, allow, deny, not set.                           |
| `size`       | `{ width: string; height: string }`   | `var(--raci-cell-width)` and `var(--raci-cell-height)`: put them on your control. |

Keep the fixed size, put `label` on the control and call `onCycle` or `onChange`, and your cell
behaves like the built-in ones. The package does not add a wrapper, a border or a click handler
around a host cell.

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

The demo has a Cell variant switch (box, marks, custom) and exports `demoRenderCell`, a sample host
cell, from `node-raci-editor/demo`.

## Simulator

Pick a person, optionally add memberships and preview what the rules would allow in the category you pass. The
simulator has no category menu and no resource list: resources are your data, and you choose the
category.

| Prop            | Type                                        | Notes                                                                                                                                                                                 |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`        | `RaciConfig`                                | Needs a subject kind for the person (`user`, else your first kind, unless you set `personKind`).                                                                                      |
| `ruleSet`       | `RuleSet`                                   | The rules to evaluate.                                                                                                                                                                |
| `categoryId`    | `string`                                    | The category to check, chosen by your app. Without it the simulator shows the empty-category state (`simulator.emptyCategory`). `config.resources` only supplies labels and the walk. |
| `personKind`    | `string`                                    | Optional. The subject kind the person is picked from. Default `"user"`, else first kind.                                                                                              |
| `settings`      | `Partial<RaciSettings>`                     | Optional. `visibleActions` picks and orders the rows; `enabledSubjectKinds` limits the memberships picker; `density` applies.                                                         |
| `className`     | `string`                                    | Optional.                                                                                                                                                                             |
| `variant`       | `SimulatorVariant`                          | Optional. `"list"` (default), `"boxes"` or `"strips"`. See Variants.                                                                                                                  |
| `renderResults` | `(view: SimulatorViewProps) => ReactNode`   | Optional. Replaces the results region only.                                                                                                                                           |
| `evaluate`      | `(q) => Promise<{ decision, reasonText? }>` | Optional. Host-side evaluation; `decide()` is not run. See Evaluating on your server.                                                                                                 |
| `show`          | `{ memberships?: boolean }`                 | Optional. Set `memberships` to `false` to hide the memberships picker.                                                                                                                |

What it does:

- The person is one pick from the `personKind` kind (default `user`, else the first kind in the config). That kind is always offered
  in the person picker, even when `enabledSubjectKinds` leaves it out. The person's subjects are that pick plus every
  membership added (groups, roles or any other enabled kind), de-duplicated, in the order picked.
- For each visible action it runs `decide()` with your `ruleSet` and `config.actions` and shows
  "Would be allowed" or "Would be denied", a plain-language reason, and the categories that were checked, nearest first,
  with the deciding one marked.
- With no person it asks you to choose one; with no categories or no visible actions it says so.

To change the category, pass another `categoryId`; the results follow it.

### Variants

`variant` picks the built-in results view. The default, `"list"`, is the table described above and
does not change when the other views are added.

- `"boxes"`: a responsive grid of cards, one per visible action. A card has a verdict header (icon
  plus the words "Would be allowed" or "Would be denied"), then boxes: Reason (one sentence), Decided by (subject, effect,
  category, entry number, or "No rule matched"), Walk (one sub-box per visited category, nearest
  first, with the matching entries as chips tagged direct or implied, the deciding one outlined,
  "Inheriting stopped here" where the walk ended and "no match" where nothing matched) and a
  collapsed Overridden list of matches that lost (for example an allow beaten by a deny).
- `"strips"`: one full-width strip per visible action: a round icon (check when allowed, dashed
  minus when denied), a bold "Action - Would be allowed/denied" title and one muted reason line. Loading shows
  skeleton strips and an error shows a danger strip with a Retry button.

All three read the same decision, so switching `variant` never changes an answer. The number and
labels of the rows come from `config.actions` and `settings.visibleActions`.

### Replacing the results

`renderResults(view)` replaces only the results region. The pickers, the polite live region, the
empty states and the loading and error states stay in the package; the function is called once the
results are ready. `view` is a `SimulatorViewProps`: `person`, `category`, `results` (one
`ActionResult` of `action`, `decision` and `reasonText` per visible action), `status`, `retry`,
`labelOf`, `subjectLabel` and `t`.

### Evaluating on your server

A host that evaluates on its server and supplies its own wording passes `evaluate`. It is called
once per visible action with `{ person, category, action }` and returns `{ decision, reasonText? }`;
the package wording is used when `reasonText` is left out. While it runs the simulator shows a
loading state, a failure shows an error with Retry, and an answer that arrives after the person,
memberships, category or actions changed is dropped. Memoize `evaluate`: a new function re-runs the
evaluation. Use `show` to hide the memberships picker when the server decides those.

### Trace

`decide(input, { trace: true })` returns the same decision plus `trace`, one `TraceStep` per visited
category (`category`, `matches`, `stopInheriting`). Each `TraceMatch` has the `entry`, its `index`
in the category, `via` (`"direct"` or `"implied"`) and `decisive`. Without the option the decision
has no `trace` key and verdicts are identical. The boxes view uses the trace; the simulator asks
for it for every decision it computes, and a host decision without a trace still renders.

Types: `SimulatorVariant`, `ActionResult`, `SimulatorViewProps`, `TraceStep`, `TraceMatch` and
`DecideOptions` are exported.

Accessibility: the root is a labelled group; the results are a table inside a polite live region,
so a change is announced; each verdict has an icon and a word; the walk is an ordered list; the
pickers are comboboxes. In the boxes view each card is an article named by its action.

Keyboard: Tab through the controls; in a picker, Down and Up move through results, Enter picks and
Escape closes the list.

## SettingsPanel

Edits a `RaciSettings` value.

| Prop        | Type                           | Notes                                           |
| ----------- | ------------------------------ | ----------------------------------------------- |
| `config`    | `RaciConfig`                   | Supplies the actions, kinds and strings.        |
| `value`     | `RaciSettings`                 | The current settings (complete).                |
| `onChange`  | `(next: RaciSettings) => void` | Called with the new settings after each change. |
| `className` | `string`                       | Optional.                                       |

What it does:

- **Actions.** A checkbox per action to show or hide it, and Up and Down buttons to reorder the
  visible ones. Each line also says what the action implies. The last visible action cannot be
  hidden, and the box is disabled with a hint when only one is left.
- **Subject kinds.** A checkbox per kind. The last enabled kind cannot be turned off.
- **Behavior.** Show inherited entries, confirm before saving a Deny, and stop inheriting by
  default.
- **Density.** Comfortable or compact (radio buttons).
- **Reset to defaults.** Calls `onChange(defaultSettings(config))`.
- Ids in `value` that the config no longer has are ignored in the list. Use
  `normalizeSettings` to clean a stored value.

Accessibility: each group is a `fieldset` with a legend, descriptions and the last-item hint are
linked with `aria-describedby`, and the move buttons are named "Move Read up" and so on.

Keyboard: Tab between controls, Space toggles a checkbox or button, arrow keys move within the
density radio group.

## Helpers exported next to the components

- `impliedActions(actions, id)` returns what an action includes, transitively and without itself.
  Useful for your own column hints.
- `vectorSubjects(person)` builds the subject list for a vector person (see
  [Test vectors](test-vectors.md)).
- `defaultSettings`, `normalizeSettings`, `toggleAction`, `toggleKind` and `moveAction`; see
  [Configuration](configuration.md#settings).
