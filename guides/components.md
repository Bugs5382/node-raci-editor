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

| Prop         | Type                      | Notes                                                                                         |
| ------------ | ------------------------- | --------------------------------------------------------------------------------------------- |
| `config`     | `RaciConfig`              | Actions, subject kinds, resources, strings.                                                   |
| `ruleSet`    | `RuleSet`                 | The whole rule set; the editor reads the entries of `categoryId`.                             |
| `categoryId` | `string`                  | The category being edited. Change it to move to another category.                             |
| `onChange`   | `(next: RuleSet) => void` | Called with the new rule set after each edit.                                                 |
| `settings`   | `Partial<RaciSettings>`   | Optional. Missing fields use `defaultSettings(config)`.                                       |
| `readOnly`   | `boolean`                 | Optional, default `false`. Disables the cells, the checkbox and the picker, and hides Remove. |
| `className`  | `string`                  | Optional.                                                                                     |

What it does:

- **Cells.** One button per subject and action. A click cycles not set, then allow, then deny, then
  not set. Setting a cell replaces any entry for that pair; clearing it removes the entry. If a
  stored rule set holds both an allow and a deny for one pair, the cell shows deny.
- **Included cells.** If a subject has an allow on an action that implies another, the other's
  cell shows "included" and its tooltip says which action includes it. The cell is still its own
  entry: you can set an explicit deny on it.
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

## Simulator

Pick a person, optionally add memberships, choose a category and see what they can do.

| Prop               | Type                    | Notes                                                                                                                            |
| ------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `config`           | `RaciConfig`            | Needs a subject kind for the person (`user` unless you set `personKind`).                                                        |
| `ruleSet`          | `RuleSet`               | The rules to evaluate.                                                                                                           |
| `categoryId`       | `string`                | Optional. When set, the simulator follows it. When omitted it keeps its own choice and starts at the first category of the tree. |
| `onCategoryChange` | `(id: string) => void`  | Optional. Called when the user picks another category in the menu.                                                               |
| `personKind`       | `string`                | Optional. The subject kind the person is picked from. Default `"user"`.                                                          |
| `settings`         | `Partial<RaciSettings>` | Optional. `visibleActions` picks and orders the rows; `enabledSubjectKinds` limits the memberships picker; `density` applies.    |
| `className`        | `string`                | Optional.                                                                                                                        |

What it does:

- The person is one pick from the `personKind` kind (default `user`). That kind is always offered
  in the person picker, even when `enabledSubjectKinds` leaves it out. The person's subjects are that pick plus every
  membership added (groups, roles or any other enabled kind), de-duplicated, in the order picked.
- For each visible action it runs `decide()` with your `ruleSet` and `config.actions` and shows
  Allowed or Denied, a plain-language reason, and the categories that were checked, nearest first,
  with the deciding one marked.
- With no person it asks you to choose one; with no categories or no visible actions it says so.

If you pass `categoryId` and keep your own state for it, wire `onCategoryChange` to that state, or
the menu will snap back after each choice.

Accessibility: the root is a labelled group; the results are a table inside a polite live region,
so a change is announced; each verdict has an icon and a word; the walk is an ordered list; the
pickers are comboboxes.

Keyboard: Tab through the controls; in a picker, Down and Up move through results, Enter picks and
Escape closes the list. The category menu is a native `select`.

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
