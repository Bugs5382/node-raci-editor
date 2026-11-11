# Pluggable rule models: design

Status: PR A (steps 1 and 2) is implemented: the `RaciModel` interface, the registry
(`registerModel`, `getModel`, `listModels`) with `"nearest"` extracted from `decide()`, and the
per-model vector files (`vectors/nearest.json`, with `vectors/decide.json` kept as its alias). There
is no behaviour change. In this step `ModelInput` is the `decide()` input as it is, `describeEntry`
takes the entry only (no label functions yet) and the editor and simulator do not read models.
Everything from step 3 on, including `"ordered"`, is still design only. Tracked in issue #15.

## Proposal summary

- One package serves hosts whose rules read differently. A rule model is a small object, `RaciModel`,
  that says how a rule set is evaluated and which affordances the editor and simulator show.
- Two built-ins. `"nearest"` is today's behaviour and stays the default, with identical verdicts and
  identical vectors. `"ordered"` evaluates by rule order, per action, walking the chain nearest first.
- `"ordered"` adds an `own` effect (allowed, but only for things the person created), owners checked
  before any rule, a superuser override, requires-read gating (`ActionDef.requires`, distinct from
  `implies`) and an "everyone" subject convention.
- The wire format stays one JSON. `RuleSet.model?: string` names the model; every model-specific
  field is additive and optional (`precedence`, `owners`, entry `effect: "own"`).
- A host with a third rule model passes its own `RaciModel` object, registers it with
  `registerModel`, or evaluates on its server through the existing `evaluate` prop.
- The host enforces; the package only shows. A model only describes how rules read and how they preview.
- The editor adapts through `capabilities` flags (ordering, own, owners, locks, legend). The
  simulator adapts through extra `Decision` fields (`ownOnly`, `gatedBy`, trace steps).
- Vectors become one file per model, each with `model` and `version`, under a shared schema.
- Risks: semantics drift between models, the cell model needs one entry per subject and action in
  ordered mode, server and client can disagree, and the API surface grows. Mitigations in section 8.
- Effort is about 17 working days in six independent steps; step 1 changes no behaviour.

## 1. Goal and non-goals

Goal: let one package present and preview the rules of hosts that evaluate differently, without a
fork per host. The host decides which model its rules follow and ships that choice in the data.

Non-goals:

- The package only shows and previews; the host enforces. `decide()` and every model `evaluate` are pure evaluation
  helpers the host may call; the host enforces. Models change how rules read and preview only.
- No change to `decide()`'s verdicts, to `vectors/decide.json`, to existing exports or to existing
  props. The default model is `"nearest"`, and a rule set without a `model` field means `"nearest"`.
- No data migration. A rule set written today is a valid `"nearest"` rule set tomorrow.
- No attempt to model every possible host. Unusual rules go through a custom model or a host-side
  `evaluate`.

## 2. The `RaciModel` interface

```ts
/** Everything a model needs to answer one question. `chain` is the visited categories, nearest first. */
export interface ModelInput {
  rules: RuleSet;
  chain: string[]; // category ids, nearest first; "*" last when the model uses it
  subjects: string[]; // Person.subjects, plus the model's implicit subjects
  action: string;
  actions: ActionDef[];
  superuser?: boolean; // Person.superuser, additive and optional
}

export interface ModelResult {
  decision: Decision; // see section 5 for the extra optional fields
  trace: TraceStep[]; // always filled by a model; decide() keeps it opt-in
}

export interface ModelCapabilities {
  ordering: boolean; // entry order matters: show the # column and move up/down
  ownEffect: boolean; // third cell state "own"
  owners: boolean; // owners block, evaluated before rules
  superuser: boolean; // Person.superuser is honoured, simulator shows the step
  gating: boolean; // ActionDef.requires is honoured
  stopInheriting: boolean; // category toggle "stop inheriting"
  wildcardCategory: boolean; // the "*" category exists and is the last stop
}

export interface LegendItem {
  id: string; // "allow" | "deny" | "own" | "blank" | "inherited" | "locked" | custom
  label: string; // string key, resolved through config.strings
  description?: string;
}

export interface ModelIssue {
  level: "error" | "warning";
  path: string; // JSON pointer into the rule set
  message: string; // string key
}

export interface RaciModel {
  id: string; // "nearest", "ordered", or the host's own
  label: string;
  /** Effects an entry may carry; the editor offers exactly these, in cycle order. */
  effects: ReadonlyArray<Effect>; // ["allow","deny"] or ["allow","own","deny"]
  /** Per-category fields the model reads, so the editor knows which controls to draw. */
  categoryOptions: ReadonlyArray<"stopInheriting" | "precedence" | "owners">;
  capabilities: ModelCapabilities;
  /** Pure evaluation of one question. A preview only; the host enforces. */
  evaluate(input: ModelInput): ModelResult;
  /** Check a rule set before the editor shows or saves it (duplicates, unknown effects, cycles). */
  validate(ruleSet: RuleSet, actions: ActionDef[]): ModelIssue[];
  /** One sentence for an entry, used by tooltips and the simulator ("Deny for group finance, #2"). */
  describeEntry(entry: Entry, index: number, labels: LabelFns): string;
  /** The cell looks the legend shows for this model, in display order. */
  legend(): LegendItem[];
}
```

`Effect` widens to `"allow" | "deny" | "own"`. A model whose `effects` lacks `"own"` rejects it in
`validate`, so a `"nearest"` rule set never carries one.

### Wire format

```json
{
  "model": "ordered",
  "parents": { "team": "root" },
  "categories": {
    "root": { "owners": ["user:erin"], "entries": [] },
    "team": { "entries": [{ "subject": "group:staff", "action": "read", "effect": "own" }] }
  }
}
```

- `RuleSet.model?: string`. Absent means `"nearest"`. An unknown id is a `validate` error and the
  editor falls back to read-only with a note; it never guesses.
- Additive optional fields: `CategoryRules.precedence?: "deny-wins" | "first-match"` (the model's
  own default applies when absent), `CategoryRules.owners?: string[]` (subject strings),
  `CategoryRules.ownerActions?: string[]`, `Entry.effect: "own"`, `ActionDef.requires?: string[]`,
  `Person.superuser?: boolean`.
- A reader that does not know a field ignores it, so old consumers keep working on `"nearest"` data.

### Registering and supplying a model

```tsx
// A host with its own rules
registerModel(myModel); // global, by id; throws on a duplicate id
<RulesEditor models={{ mine: myModel }} ... />  // scoped to this editor, wins over the registry
<RulesEditor model={myModel} ... />             // an object, or a string id of a registered model
```

- `model` prop: a string id or a `RaciModel`. Default: `ruleSet.model ?? "nearest"`. The prop wins
  over the field in the data, which lets a host force a view without rewriting stored rules.
- `models` prop and `registerModel(model)`: how a custom model is found by id. Built-ins are always
  registered and cannot be replaced.
- Server-side evaluation: the existing `Simulator` `evaluate` prop. When set, the package does not
  run any model `evaluate`; it only uses the model's `capabilities`, `legend` and `describeEntry`
  for presentation. A host can therefore describe its model for the UI and keep the truth on its
  server.

## 3. The two built-in models

```
 rule set + person + question
        |
        v
  +-----------+   id from model prop, else RuleSet.model, else "nearest"
  |  registry | -------------------------------------------------------+
  +-----------+                                                        |
        |                                                              v
   RaciModel.evaluate  ---> Decision + trace ---> Simulator (preview)
   RaciModel.capabilities ---> RulesEditor (what to draw)
```

### 3.1 `"nearest"` (today)

Effects `allow` and `deny`. Walk the chain nearest first, then the implicit `"*"` last stop. The
nearest category with a matching entry decides; inside it any deny beats any allow. A category with
`stopInheriting` ends the walk after its own entries and skips `"*"`. An entry on an action also
answers every action it implies. Default deny. Capabilities: `stopInheriting` and `wildcardCategory`
true, everything else false. `evaluate` is the current `decide()` body moved behind the interface;
`decide()` itself stays and calls it.

### 3.2 `"ordered"`

Effects `allow`, `own`, `deny`. Order is meaning: the first matching entry decides, per action.

Algorithm for one question (`subjects`, `action`), numbered:

1. Subjects. Add the model's implicit subject `everyone:*` to `subjects` (the "everyone"
   convention; the option `implicitSubjects` can name others or be emptied). An unknown asked
   action is a default deny with an empty path.
2. Superuser. If `superuser` is true, answer allow with reason `superuser` and stop. Trace step
   kind `superuser`. This runs before owners, rules and gating.
3. Owners. For each category in `chain`, nearest first, if any subject in `owners` is in `subjects`
   and the action is in that category's `ownerActions` (default: the model option `ownerActions`,
   for example `read`, `approve`, `manage`), answer allow with reason `owner` and stop. Owners are
   read across the whole chain, so an ancestor's owner is an owner below it, and they run before
   any entry, so a nearer deny cannot beat them. `stopInheriting` is not used by this model.
4. Rules. For each category in `chain`, nearest first, scan `entries` in list order. The first entry
   whose subject is in `subjects` and whose action covers the asked action (itself, or an action
   that implies it) decides:
   - `allow`: allowed.
   - `deny`: denied.
   - `own`: allowed with `ownOnly: true`. The host finishes the ownership check.
     A blank cell is the absence of an entry and falls through to the next entry or category.
5. No entry matched anywhere in `chain`: denied, reason `default-deny`.
6. Gating. If the verdict from step 4 or 5 is allowed and `ActionDef.requires` lists actions, run
   steps 1, 3, 4 and 5 for each required action (no gating inside, so no recursion; the superuser
   step is already past). If any is denied, the answer becomes denied, reason `requires`,
   `gatedBy` is that action. An `own` answer on a required action counts as allowed.
   `requires` is independent of `implies`: `implies` widens what an entry covers in step 4,
   `requires` narrows a final verdict in step 6. An action with no `requires` (such as an
   "informed" action) is independent of read.
7. Trace. Every step above appends a `TraceStep` with its position (`order`) so a view can number
   them: superuser, owners, one step per visited category with its matching entries, one per gate.

Validation (`validate`): more than one entry for the same subject and action in a category is an
error in ordered mode (see risk 4); `own` only on actions the host lists in the model option
`ownActions`; `stopInheriting` present is a warning (ignored).

### Worked examples

Actions: `read`; `inform` (no requires); `approve` (requires `read`); chain for `team` is
`team`, `root`, then `*`. Person `dave` has subjects `user:dave`, `group:finance`.

Example 1, order decides. `team.entries = [ {user:dave, read, deny}, {group:finance, read, allow} ]`.
Asked: dave, read. Step 4 scans `team` in order: the first entry matches and denies. Result: denied,
decided by `team` entry #0. Swap the two entries and the result is allowed by entry #0. In
`"nearest"` both orders deny, because a deny beats an allow in the same category. This is the
whole difference between the models.

Example 2, own and owners. `root` has `owners: ["user:erin"]`. `team.entries = [ {user:erin, read,
deny}, {group:staff, read, own} ]`. Person `bob` has `group:staff`; person `erin` has `user:erin`.

- bob, read: not owner, not superuser. Step 4: entry #0 does not match bob; entry #1 matches with
  `own`. Result: allowed, `ownOnly: true`, decided by `team` entry #1.
- erin, read: step 3 finds `user:erin` in `root.owners` (an ancestor of `team`), `read` is an owner
  action. Result: allowed, reason `owner`, before her own deny at entry #0 is looked at.

Example 3, gating, independence and superuser. `team.entries = [ {user:carl, approve, allow} ]`,
`root.entries = [ {everyone:*, inform, allow} ]`.

- carl, approve: step 4 allows (entry #0). Step 6 asks `read`: no entry covers it, default deny.
  Result: denied, reason `requires`, `gatedBy: "read"`. Add `{user:carl, read, allow}` in front
  and the same question is allowed.
- carl, inform: step 1 adds `everyone:*`; step 4 finds `root` entry #0. Allowed, with no read needed.
- a person with `superuser: true`, approve: step 2 answers allowed, reason `superuser`; nothing
  else is read, so gating does not apply.

## 4. What the `RulesEditor` adapts per model

The editor reads `model.capabilities` and `model.legend()` and draws only what applies. Nothing is
drawn for a flag that is false, so the `"nearest"` screen is unchanged.

| Capability                | Affordance                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ordering`                | A `#` column numbering rows (own rows, then inherited rows continuing the count), move up and move down buttons per row, disabled at the ends and on inherited rows. New rows join the end of the list. |
| `ownEffect`               | A third cell state `own` with its own icon, the cycle blank, allow, own, deny, blank for actions in `ownActions`, a tooltip, and a legend entry.                                                        |
| `owners`                  | An owners block above the grid: chips for this category's owners with a remove control (hidden for the last one if the host asks), inherited owners as locked chips with "from X", an add picker.       |
| locks (`isLocked`)        | A row or cell the host marks locked shows a lock badge, is not clickable, and carries the reason as its tooltip and a note under the grid. Inherited rows are always locked.                            |
| `superuser`               | Only a note in the editor ("Administrators see everything regardless of these rules"); the effect shows in the simulator.                                                                               |
| `gating`                  | In the action header tooltip: "Needs read". No state change in the cell.                                                                                                                                |
| `stopInheriting`          | The existing toggle appears only when true.                                                                                                                                                             |
| legend (`model.legend()`) | A legend strip under the grid listing the model's cell looks, from `legend()` (allow, deny, own, blank, inherited, locked).                                                                             |
| trace and explanation     | The per-cell tooltip text comes from `describeEntry`, so an ordered cell says "Allow, rule #2" and a nearest cell keeps its current wording.                                                            |

Fixed-size state boxes rule: every cell state (blank, allow, own, deny, inherited, locked,
included) renders in the same box size. A new state never changes the cell dimensions, the row
height or the column width; badges are drawn inside the box. The existing cell size tests extend to
the new states.

Cell model: in ordered mode the editor keeps one entry per subject and action (a row is a subject,
a cell is one entry). Cycling a cell edits that entry in place; blank removes it. Existing
`stableRows` ordering carries over as the row order, and row order equals entry order of first
appearance, so moving a row moves that subject's entries together and keeps their relative order.

## 5. What the `Simulator` adapts

The three views (list, boxes, and a host `renderResults`) keep working and keep reading one
`Decision`, so switching view never changes data. The `Decision` gains optional fields, all
absent for `"nearest"`:

```ts
export type DecideReason = "entry" | "default-deny" | "owner" | "superuser" | "requires";
export interface Decision {
  /* existing fields unchanged */
  ownOnly?: true; // allowed, only for what the person created
  gatedBy?: string; // the required action that was not allowed
}
export interface TraceStep {
  /* existing fields unchanged */
  kind?: "category" | "owners" | "superuser" | "gate"; // absent means "category"
  order?: number; // 0-based position of the step in the evaluation
  action?: string; // for a gate step, the required action examined
  matched?: string; // for an owners step, the owner subject that matched
}
```

Per field:

- `ownOnly`: the verdict shows "Would be allowed" plus an "own only" badge (string
  `simulator.ownOnly`) in all views.
- `gatedBy`: the reason reads "Would be denied: needs <action>" (string `simulator.requires`); the
  boxes view shows the gate as its own box, the list view as a line in the walk.
- Trace steps with `order`: the walk shows "1.", "2." beside each step and the deciding entry as
  "#n" (its index in `entries`). Owner and superuser steps appear before categories with their own
  labels (`simulator.step.owners`, `simulator.step.superuser`).
- `reason` of `owner` and `superuser` extends `explainDecision` with one sentence each.
- The simulator offers a "super user" toggle next to the memberships only when `superuser` is true.
- Strings stay keyed and overridable through `config.strings`; the wording rule holds: "would be
  allowed", "preview", "the host enforces".

For a host that evaluates on its server, `evaluate` returns a `Decision`-like value and these same
fields drive the same views.

## 6. Vectors per model

Layout:

```
vectors/
  README.md
  schema.json      shared: version, model, actions, cases, expect
  nearest.json     the current cases, "model": "nearest", "version": 1
  decide.json      kept as a rename-compatible alias of nearest.json (same content)
  ordered.json     "model": "ordered", "version": 1
```

- Every file carries `model` and `version`. `decide.json` keeps its current content and gains
  `"model": "nearest"`; consumers that ignore unknown fields keep working, and a build step or a
  copy keeps it equal to `nearest.json` until the next major version retires it.
- `schema.json` is the shared shape. `expect` adds optional `ownOnly`, `gatedBy`, and `reason` takes
  the extra values; `decidedBy` may name the entry `index`. `person` adds optional `superuser`, and
  a rule set may add `owners`. A runner for a model ignores fields the model does not use.
- Runners choose by `model`: the TypeScript test loops over the files and calls the model with that
  id; the Go and mock runners switch on the field and skip models they have not implemented, with a
  visible skip, never a silent pass.

New cases for `ordered` (outline, by category, at least 12):

- Order: (1) deny before allow in one category denies; (2) the same entries swapped allow;
  (3) a different action's entry in between is skipped; (4) a blank (absent) entry falls through
  to the next category.
- Chain: (5) nearest category decides over a farther allow; (6) a farther deny reached because the
  near category has no match; (7) the `"*"` last stop decides when nothing nearer matches.
- Own: (8) `own` returns allowed with `ownOnly`; (9) an `own` before a deny wins by order;
  (10) `own` on a required action counts as allowed for gating.
- Owners: (11) an owner wins over a nearer deny; (12) an ancestor's owner applies in a child;
  (13) an owner on a non-owner action falls to the rules.
- Superuser: (14) allowed ahead of owners, a deny and gating.
- Gating: (15) approve with no read is denied with `gatedBy: "read"`; (16) the same with a read
  entry is allowed; (17) an independent action (`inform`) needs no read.
- Everyone: (18) an `everyone:*` entry matches a person with no other subject.
- Implies: (19) an entry on `manage` answers `read` by its position in the order.
- Edge: (20) an unknown asked action is a default deny; (21) a cycle in `parents` ends the walk.

## 7. What the host passes

| Need                          | The host passes                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Today's behaviour             | Nothing new. `model` defaults to `"nearest"`.                                                                      |
| The ordered model             | `model="ordered"` or `ruleSet.model = "ordered"`, plus `config.actions` with `requires`.                           |
| A model of its own            | `model={myModel}` (object) or `registerModel(myModel)` and its id; or `models={{...}}`.                            |
| Rules evaluated on its server | The `Simulator` `evaluate` prop returning a decision; the model supplies only presentation.                        |
| Per-person extras             | `Person.superuser`, and the people's subjects including any `everyone:*` constant if it disables the implicit one. |
| Locks and read-only           | `isLocked` and the read-only reason, as for any model.                                                             |

Migration notes:

- Existing hosts change nothing. Rule sets without `model` are `"nearest"`; vectors are unchanged.
- To adopt `"ordered"`, a host converts stored rules once: one entry per subject and action in the
  order it evaluates, `own` where it has a contribute-own effect, owners moved to
  `CategoryRules.owners`. The package does not convert silently; `validate` reports what to fix.
- A host that must keep its server as the truth keeps `evaluate`, reads the model's presentation
  only, and treats client previews as previews.

## 8. Risks and mitigations

| Risk                              | Mitigation                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two semantics drift apart         | The model is data (`model` field) with a default of today's; one vector file per model, each run by every runner; CI runs both. A change to a model bumps that file's `version`.                                    |
| Cell model mismatch               | Ordered mode needs one entry per subject and action. `validate` rejects duplicates, the editor edits in place, and the `"nearest"` collapse-to-deny cell is not used in ordered mode.                               |
| Server and client disagree        | Hosts with server truth use `evaluate`; the client model is a preview. Extra fields (owners, superuser, gating) are mirrored in the host's engine with the shared vectors before a host relies on a client preview. |
| API surface grows                 | Add only the interface, `registerModel`, the `model` and `models` props and optional fields. Everything else stays internal. Public-surface test updated in the same change; no removals.                           |
| `DecideReason` union widens       | Hosts that switch exhaustively on `reason` need a default branch. Documented in the guides; the new values only appear in non-default models.                                                                       |
| `implies` vs `requires` confusion | Separate fields, separate steps (4 and 6), separate worked example; never overload `implies`.                                                                                                                       |
| Open question: confer over deny   | Some hosts let a higher action confer a lower one even over an explicit deny. Not part of `"ordered"`; a host that needs it supplies a custom model or evaluates on its server.                                     |

## 9. Effort and order of work

Estimates in working days, one developer, including tests and docs for the item.

| Step | Work item                                                                                    | Days |
| ---- | -------------------------------------------------------------------------------------------- | ---- |
| 1    | `RaciModel` interface, registry, `"nearest"` extracted from `decide()`; no behaviour change  | 2    |
| 2    | Vectors per model: `nearest.json`, alias `decide.json`, shared schema, `model` and `version` | 1.5  |
| 3    | `"ordered"` evaluate (order, chain, implies, everyone, trace) and its vectors, headless      | 3    |
| 4    | Editor: model-aware capabilities, `#` column, move up and down, one entry per cell, legend   | 3    |
| 5    | `own` effect: cell state, cycle, legend, `ownOnly` in the simulator                          | 2    |
| 6    | Owners, superuser, gating: evaluate steps, owners block, simulator steps, `gatedBy`          | 4    |
| 7    | Docs, an `"ordered"` demo preset, and guides                                                 | 1.5  |

Total: about 17 days. A Go port of the runner is outside this estimate, about 1 day per model.

Recommended order and PR split, after the initial build merges:

1. PR A, steps 1 and 2 together: pure refactor and vectors. Ships alone; no user-visible change.
2. PR B, step 3: the `"ordered"` model headless. Ships alone and is already useful to a host that
   evaluates with it on a server or in tests; it needs only A.
3. PR C, step 4: editor ordering. Needs B; ships alone, own and owners still absent.
4. PR D, step 5: `own`. Needs B and C. Can land before or after E.
5. PR E, step 6: owners, superuser, gating. Needs B; the owners block UI needs C's layout.
6. PR F, step 7: docs and demo preset. Last, so it describes what shipped.

Each PR keeps `npm test`, lint, format and the wording test green, keeps `vectors/nearest.json`
verdicts unchanged and adds only optional fields.
