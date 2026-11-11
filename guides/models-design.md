# Pluggable rule models: design

Status: PR A (steps 1 and 2) is implemented: the `RaciModel` interface, the registry
(`registerModel`, `getModel`, `listModels`) with `"nearest"` extracted from `decide()`, and the
per-model vector files (`vectors/nearest.json`, with `vectors/decide.json` kept as its alias). There
is no behaviour change. In this step `ModelInput` is the `decide()` input as it is, `describeEntry`
takes the entry only (no label functions yet) and the editor and simulator do not read models.
Everything from step 3 on, including `"ordered"`, is still design only. Tracked in issue #15.

The `"ordered"` sections were rewritten to match the owner's description of the original firewall
editor and the behaviour of the one running
product that works this way, which is compared in section 3.3. Where the two differ, the design
does not decide: section 3.4 lists each difference for the owner.

## Proposal summary

- One package serves hosts whose rules read differently. A rule model is a small object, `RaciModel`,
  that says how a rule set is evaluated and which affordances the editor and simulator show.
- Two built-ins. `"nearest"` is today's behaviour and stays the default, with identical verdicts and
  identical vectors. `"ordered"` is a firewall-style list: per action, the first row from the top
  whose cell is green or red decides, walking the category's own rows and then the inherited rows.
- `"ordered"` adds owners (the host names which subject kinds may own, for example people only; inherited down, checked before any row, immune to a deny),
  a built-in "Everyone" subject, `requires` (an obligation such as acknowledging needs read; distinct
  from `implies`), an action `kind` (access or obligation, shown in one grid) and an approver pool.
- The wire format stays one JSON. `RuleSet.model?: string` names the model; every model-specific
  field is additive and optional (`precedence`, `owners`, `ActionDef.kind`, `ActionDef.requires`).
- A host with a third rule model passes its own `RaciModel` object, registers it with
  `registerModel`, or evaluates on its server through the existing `evaluate` prop.
- The host enforces; the package only shows. A model only describes how rules read and how they preview.
- The editor adapts through `capabilities` flags (ordering, owners, locks, legend, kinds). The
  simulator adapts through extra `Decision` fields (`gatedBy`, trace steps) and by wording each
  result by the action's kind.
- Vectors become one file per model, each with `model` and `version`, under a shared schema.
- Risks: semantics drift between models, the cell model needs one entry per subject and action in
  ordered mode, server and client can disagree, and the API surface grows. Mitigations in section 8.
- Effort is about 18 working days in six independent steps; step 1 changes no behaviour.

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
}

export interface ModelResult {
  decision: Decision; // see section 5 for the extra optional fields
  trace: TraceStep[]; // always filled by a model; decide() keeps it opt-in
}

export interface ModelCapabilities {
  ordering: boolean; // entry order matters: show the # column and move up/down
  ownEffect: boolean; // third cell state "own" (custom models; false for both built-ins)
  owners: boolean; // owners block, evaluated before rules
  superuser: boolean; // Person.superuser is honoured (custom models; false for both built-ins)
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

`Effect` stays `"allow" | "deny"` for both built-in models. The `own` effect and the superuser
override that appear in `ModelCapabilities` are for a host's custom model; neither built-in uses
them (see section 3.3 for the one product that does).

### Wire format

```json
{
  "model": "ordered",
  "parents": { "team": "root" },
  "categories": {
    "root": { "owners": ["user:erin"], "entries": [] },
    "team": { "entries": [{ "subject": "group:staff", "action": "read", "effect": "allow" }] }
  }
}
```

- `RuleSet.model?: string`. Absent means `"nearest"`. An unknown id is a `validate` error and the
  editor falls back to read-only with a note; it never guesses.
- Additive optional fields: `CategoryRules.precedence?: "deny-wins" | "first-match"` (the model's
  own default applies when absent), `CategoryRules.owners?: string[]` (subjects of the kinds the model option `ownerKinds` allows),
  `ActionDef.requires?: string[]`, `ActionDef.kind?: "access" | "obligation"` (default
  `"access"`), `ActionDef.outcome?: { allowed: string; denied: string }` (result words for that
  action) and `RaciConfig.kindLabels?: { access?: string; obligation?: string }` (the grid's group
  headings). The package names no product: Read, Author, Ack and the rest are the host's config.
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

Effects `allow` and `deny`; an absent entry is an empty cell. Order is meaning.

Terms:

- A **row** is one subject (a host-defined matcher such as `user:alice`, `group:it` or `can:ack`, or the built-in `everyone:*`, shown as "Everyone")
  with one cell per action. A cell is green (allow), red (deny) or empty. In the data a row is the
  subject's entries, one per action, kept next to each other; the row order is the entry order.
- A subject matches a person when it is in the person's `subjects` or is `everyone:*`, which every
  person has. `everyone:*` is a convention; the model option `implicitSubjects` can name others.
- A row **speaks to** an action only when its cell for that action (or for an action that implies it,
  see step 4) is green or red. An empty cell means "not matching": the row is skipped for that
  action, so the walk goes on down.
- The **effective list** of a category is its own rows in order, then its parent's rows, then the
  grandparent's, and so on. Inherited rows are always shown, read-only, and are never switched off;
  there is no stop-inheriting in this model. To override one, add the same subject on the child
  with the changed cells: because the child's rows come first, the child's row wins.
- An action has a `kind`. `"access"` actions state what a person may do; `"obligation"` actions
  state what a person must do (acknowledge, approve). Both use the same rows and the same walk.
- **Owners** are a per-category list of subjects of the kinds the model option `ownerKinds` allows (a host that wants people only sets it to the person kind; empty or absent switches owners off), more than one allowed, inherited from the top level down: an owner of a category is an owner of everything below it. They are not rows.

Algorithm for one question (`person`, `action`, `category`), numbered:

1. Unknown asked action: denied, reason `default-deny`, empty path. Build `subjects` from the
   person plus the implicit subjects.
2. Owners. If the action is in the model option `ownerActions` and any category in the chain lists
   an owner that is in `subjects`, answer allowed, reason `owner`, and stop. `ownerActions`
   defaults to the host's access-and-approve actions and never contains an obligation to
   acknowledge: owners are not required to acknowledge by default. Owners run before every row,
   so no row, however far up, can deny them.
3. Rows. Walk the effective list top down. The first row whose subject matches and that speaks to
   the action decides: green allows, red denies. Empty cells are skipped.
4. Implies. A cell on action `X` also speaks to every action `X` implies (Author and Approve
   imply Read, Manage implies Author, Approve and Read), with the same colour. Inside one row a
   cell on the asked action itself beats a cell that only implies it; across rows, position
   decides. `implies` only widens what a cell covers.
5. No row decided: denied, reason `default-deny`. For an obligation action that reads "not
   required".
6. Requires. If the verdict is allowed and `ActionDef.requires` lists actions, answer each required
   action with steps 2 to 5 (no gating inside, so no recursion). If any is denied the answer
   becomes denied, reason `requires`, `gatedBy` that action. Acknowledge requires Read, so a deny
   on Read also turns Acknowledge off. `requires` only narrows a final verdict; it is not
   `implies`.
7. Trace. Every step appends a `TraceStep` with its position: the owner step, one step per visited
   category listing its rows that spoke to the action and the deciding row as `#n` (its position
   in that category's rows), and one per requires check.

The approver pool for a category is the owners (inherited) plus every person whose Approve answers
allowed from the rows. It is a list with a reason for each entry (`owner`, or the deciding row as
category and `#n`). The host passes the people to consider; the package does not know who exists.
The same listing works for any obligation action: the people for whom it answers allowed are the
people it applies to (the acknowledge list for Acknowledge).

Validation: more than one entry for the same subject and action in a category is an error; a
subject in `owners` whose kind is not in `ownerKinds` is an error; `stopInheriting` present is a warning (ignored);
`own` is an error.

### Worked examples

Actions: `read`, `author` (implies read), `approve` (implies read), `manage` (implies read, author
and approve), and `ack` (kind obligation, requires read). Category `it-policies` is top level.

Example 1, an outside consultant. Rows of `it-policies`, top down:

| #   | Subject    | Read  | Author | Approve | Ack   |
| --- | ---------- | ----- | ------ | ------- | ----- |
| 1   | user:vciso | green | green  |         | red   |
| 2   | group:it   | green | green  |         | green |
| 3   | Everyone   | green |        |         | green |

The consultant has `user:vciso` and `everyone:*` only (he is not in the IT group).

- Read: row 1 speaks (green): allowed.
- Ack: row 1 speaks (red): denied, "not required". Row 3 is never reached, so the Everyone row does
  not make him acknowledge. If his row were moved below row 3, Ack would be required: order is how
  the conflict is resolved.
- Approve: rows 1, 2 and 3 are empty for Approve: denied, `default-deny`. He cannot approve.

Example 2, a person who reaches a duty through a group. Rows of `it-policies`:

| #   | Subject    | Read | Author | Ack   |
| --- | ---------- | ---- | ------ | ----- |
| 1   | user:shane |      | green  |       |
| 2   | group:it   |      |        | green |

Shane is in `group:it`. Ack: row 1's Ack cell is empty, so it is skipped (Author does not imply
Ack); row 2 speaks: green, so the answer is allowed. Requires: Read for Shane is covered by row 1's
Author cell (Author implies Read): allowed. Result: required, decided by row 2. A person who is
not in the group and has no other row gets `default-deny`: not required.

Example 3, inheritance and override. Parent `it` rows: `#1 group:staff read green`. Child
`it-policies` rows: `#1 user:dave read red`. The child's effective list is the child's `#1`, then
the inherited `it #1` (shown read-only). Dave is in `group:staff`: Read on `it-policies` is denied by
the child's own row; Read on `it` is allowed. Delete the child's row and the inherited row decides.

Example 4, owners. `it` lists owner `user:erin`; `it-policies` rows: `#1 user:erin read red`. Read
for Erin on `it-policies`: owner step (inherited from `it`) allows, reason `owner`, before the red
row is looked at. Ack for Erin: not an owner action, so the rows decide; no row speaks, so not
required.

Example 5, requires. Rows: `#1 user:carl read red`, `#2 Everyone read green, ack green`. Carl, Ack:
row 1 does not speak to Ack, row 2 allows; requires Read: row 1 denies. Result: denied, reason
`requires`, `gatedBy: "read"`.

Example 6, the approver pool. Owner `user:erin` on `it`. `it-policies` rows: `#1 user:ann approve
red`, `#2 group:finance approve green`. People: erin, dave (finance), ann (finance), bob. Pool:
erin (`owner`), dave (row `#2` of `it-policies`). Ann is excluded by row 1, bob matches nothing.

### 3.3 The running product that works this way

One product the owner runs today evaluates exactly this kind of list, and the original editor did
the same. Its behaviour is the reference for `"ordered"`. The table maps each behaviour to the
owner's notes and to the `"ordered"` setting that covers it. It is written from the product's
documented behaviour; nothing of its code, names or strings is in this package, and the vectors
are written fresh from this document.

| Product behaviour                                                                                                          | Owner notes                                                      | Covered by in `"ordered"`                                        | Gap                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| One ordered list of rows; a row has a subject and a cell per action                                                        | Firewall list, one row per subject, one cell per action          | Rows and cells (3.2)                                             | None                                                                       |
| Per action, the first non-blank allow or deny wins; a blank cell falls through                                             | Empty = not matching, skip; per action, top down                 | Step 3                                                           | None                                                                       |
| Chain: the target's rows, then each ancestor's                                                                             | Child's own rows first, then inherited rows, always shown        | Effective list, step 3                                           | None; no stop-inheriting in either                                         |
| Subjects: a person, a directory group, everyone; groups match case-insensitively or by directory id                        | User, group, Everyone                                            | `user:`, `group:`, `everyone:*`                                  | Case folding and ids are the host's: subjects are matched as exact strings |
| Owners: user ids only, several, inherited down, evaluated before rules, never acknowledge                                  | Owners people only, several, inherited, immune to a deny, no Ack | Step 2, `owners`, `ownerActions`                                 | See difference 5 (Manage)                                                  |
| Owners get read, approve and author automatically                                                                          | Owners get Read, Author, Approve and the new Manage              | `ownerActions`                                                   | See difference 5                                                           |
| A site admin reads everything but is never an automatic approver or author                                                 | Not mentioned                                                    | Not in the model                                                 | See difference 3                                                           |
| An "own only" setting: allowed, but only for what the subject created                                                      | Not mentioned                                                    | Not in the model (the `own` capability stays for a custom model) | See difference 4                                                           |
| Read gates author and approve; an allowed author or approve confers read                                                   | Author and Approve imply Read; Ack requires Read                 | `implies` (step 4) and `requires` (step 6)                       | See differences 1 and 2                                                    |
| Acknowledge ("informed") does not need read and never confers it                                                           | "To have Ack, means you have to be able to read"                 | `requires`                                                       | See difference 1                                                           |
| Default deny when nothing matches                                                                                          | Not answered                                                     | Step 5                                                           | Owner to confirm                                                           |
| A reason line for each answer: the deciding rule with its number and category, or owner, or default deny, or requires read | Not mentioned                                                    | `decidedBy`, `reason`, trace (step 7) and `describeEntry`        | The package's wording is its own, keyed strings                            |
| The simulator is the same function run on unsaved rules                                                                    | Not mentioned                                                    | Models are pure; `evaluate` takes any rule set                   | None                                                                       |
| A list of everyone informed, leaving Everyone out as noise                                                                 | Everyone as an acknowledge row means all must acknowledge        | Obligation listing (section 5)                                   | See difference 6                                                           |
| Approvers: owners plus anyone with an approve rule; approval levels per secret are the host's                              | Owners plus anyone who matches Approve are the pool              | `approverPool` (section 5)                                       | Approval levels stay in the host's workflow                                |
| Four actions (read, informed, approve, author-and-manage in one)                                                           | Read, Author, Approve, Ack, and Manage as a new action           | Host's `config.actions`                                          | See difference 5                                                           |

### 3.4 Differences for the owner to decide

The design does not pick a side on these. Until each is answered, the vectors for it are marked
`"pending"` and the model follows the owner's notes.

1. **Acknowledge and Read.** The running product treats the acknowledge tier as independent of
   read: someone with only an acknowledge cell is informed although they cannot read. The notes
   say you must be able to read to acknowledge. The model follows the notes (`requires`). Which is
   right?
2. **Author or Approve over a Read deny.** The running product decides Read first; if that is not
   allowed, an allowed Author or Approve then confers Read, so an explicit Read deny does not stop
   a person who is allowed to author. In this design Author's cell covers Read by position in the
   list, so a red Read row above a green Author row denies Read and Author alike (Author also needs
   Read). Which should win?
3. **Site admin read-all.** The running product lets a site admin read everything but never approve
   or author. The notes do not mention it and `"ordered"` has no such step. Should the model have
   one, or is it the host's job (an Everyone row or a host-side override)?
4. **The `own` setting** (allowed only for what the person created). The running product has it; the
   notes do not. Should `"ordered"` offer it as an optional effect, or leave it to a custom model?
5. **Manage.** The notes call Manage a new action. The running product has no separate Manage (its
   author action covers editing and managing). What does Manage imply? This design says Read,
   Author and Approve, and not Acknowledge, because acknowledging is a duty and owners are not
   required to acknowledge by default. Confirm that, and confirm that owners get Manage.
6. **Everyone and the acknowledge list.** The running product leaves Everyone out of its list of
   informed subjects (noise). The notes use an Everyone Acknowledge row on purpose, so everyone
   added must acknowledge. The obligation listing here includes Everyone and says "everyone"
   instead of listing people. Confirm.
7. **No match.** Both deny. Confirm that no row means "not required" for an obligation too.
8. **Owners and approval.** The running product exempts owners from approval on an approval-required
   secret and always asks owners on an always-approve one. That is the host's workflow, outside
   the package; the pool only lists who may be asked.

## 4. What the `RulesEditor` adapts per model

The editor reads `model.capabilities` and `model.legend()` and draws only what applies. Nothing is
drawn for a flag that is false, so the `"nearest"` screen is unchanged.

| Capability                | Affordance                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ordering`                | A `#` column numbering rows (own rows, then inherited rows continuing the count), move up and move down buttons per row, drag to reorder with a handle, disabled at the ends and on inherited rows. New rows join the end. |
| cell look (ordered)       | Green for allow, red for deny, nothing for empty (not matching). A cell cycles empty, green, red, empty. Colour is never alone: the same icons and words as the other variants.                                            |
| `owners`                  | An owners block above the grid: chips for this category's owners (the picker offers only the allowed kinds; hidden when owners are off) with a remove control, inherited owners as locked chips "from X", an add picker.   |
| inherited rows            | Shown under the category's own rows in the same grid, numbered on, read-only, with their source; never switched off. A host overrides one by adding the same subject on the child.                                         |
| action kinds              | One grid. Columns are grouped under two headings, Access and Obligations (host-configurable labels, `RaciConfig.kindLabels`), by each action's `kind`. Access first, then obligations; an empty group draws no heading.    |
| locks (`isLocked`)        | A row or cell the host marks locked shows a lock badge, is not clickable, and carries the reason as its tooltip and a note under the grid. Inherited rows are always locked.                                               |
| `gating`                  | In the action header tooltip: "Needs read". No state change in the cell.                                                                                                                                                   |
| `stopInheriting`          | The existing toggle appears only when true; false for `"ordered"`.                                                                                                                                                         |
| legend (`model.legend()`) | A legend strip under the grid listing the model's cell looks (allow, deny, empty, inherited, locked).                                                                                                                      |
| trace and explanation     | The per-cell tooltip text comes from `describeEntry`, so an ordered cell says "Allow, rule #2" and a nearest cell keeps its current wording.                                                                               |

Fixed-size state boxes rule: every cell state (empty, green, red, inherited, locked, included)
renders in the same box size in every cell variant (box, marks, or a host's `renderCell`). A new
state never changes the cell dimensions, the row height or the column width. The existing cell
size tests extend to the new states.

Cell model: in ordered mode the editor keeps one entry per subject and action (a row is a subject,
a cell is one entry). Cycling a cell edits that entry in place; empty removes it. Row order is the
order of first appearance of the subject in `entries`, so moving a row moves that subject's entries
together and keeps their relative order.

### 4.1 Everything is the host's to name

The package names no action, role or product. Every word the editor and simulator show is a
default that the host can replace, and every action is host config.

Per action (`ActionDef`), all optional except `id`:

| Field         | Meaning                                                                                |
| ------------- | -------------------------------------------------------------------------------------- |
| `id`          | The stable key stored in the rules.                                                    |
| `label`       | The full name. Falls back to the id.                                                   |
| `shortLabel`  | A short header (for example one to three letters). Falls back to the label.            |
| `description` | The tooltip and the screen-reader description.                                         |
| `kind`        | `"access"` (default) or `"obligation"`: picks the column group and the result wording. |
| order         | The order of `config.actions` (and `settings.visibleActions`), within its group.       |
| `implies`     | Actions a cell on this one also covers.                                                |
| `requires`    | Actions that must also be allowed.                                                     |
| `outcome`     | The words for an allowed and a denied result of this action.                           |

Editor and simulator options:

- **Header mode**: a prop `headerMode` with `"full"`, `"short"` or `"auto"` (default `"auto"`).
  Auto uses the short labels at compact density and when the grid is narrow; full uses the full
  labels. Whichever is shown, the full label is always the header's tooltip and its accessible
  name, so a short header is never the only name.
- **Group headings**: `config.kindLabels` (`access`, `obligation`) for the two headings above the
  columns.
- **Built-in subject**: the label of the "Everyone" subject is the string `editor.everyone`.
- **Owner list**: the label of the owners block is the string `editor.owners` (the host may call
  it something else), with `editor.ownersHelp` for its note.
- **Cell look**: the green, red and empty colours come from the tokens `--raci-allow-*`,
  `--raci-deny-*` and `--raci-blank-*`; the glyphs (check, cross, dash) can be replaced through the
  prop `glyphs` (`{ allow?: ReactNode; deny?: ReactNode; blank?: ReactNode }`). Colour is never the
  only carrier: the glyph or the word is always present.
- **Result words**: `ActionDef.outcome` per action, else the kind's default strings
  (`simulator.access.allowed`, `simulator.access.denied`, `simulator.obligation.allowed`,
  `simulator.obligation.denied`), all overridable through `config.strings`.
- **No English in the logic**: the code never compares a label or id to a word. Defaults live only in
  the string tables, and every key is documented in the configuration guide.

Audit of the current code, for this section and PR C:

| Place                            | Finding                                                                              | Action                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `core` (decide, models, vectors) | No action or role word compared or built in.                                         | None                                                        |
| `react` components               | Every visible word goes through the string tables; no literal English in the markup. | None                                                        |
| String defaults                  | "Person", "allow", "deny", "not set", "included" are defaults, all overridable.      | Document each key; add the new keys above                   |
| Column header                    | Shows the label or id only; no short label, no header mode.                          | Add `shortLabel` and `headerMode` in PR C                   |
| Cell glyphs                      | Check, cross and dash are fixed in one icon component.                               | Add the `glyphs` override in PR C                           |
| Subject labels                   | The built-in subject would show as its raw id.                                       | Label from `editor.everyone` in PR C                        |
| Owners block                     | Does not exist yet.                                                                  | Label and help from strings in PR C                         |
| Result words                     | One pair of words for every action.                                                  | Per action and per kind in PR D                             |
| Demo data                        | Role and action words appear in the sample presets only.                             | Demo only; add a preset with the short labels R A M APV ACK |

A test renders the grid with custom ids, labels and short labels (including a preset that uses
short labels such as R, A, M, APV and ACK) and checks the header text in each mode, the tooltip
and the accessible name, and that no default action word appears.

### 4.2 Subjects are matchers, not people

A host may have no users, groups or roles at all. A subject is a matcher the host defines, and the
package gives no meaning to any kind or id except the one built-in, `everyone:*`.

- **A subject** is a string `kind:id`. A kind can be `user` or `group`, or `can` and `has` for a
  capability such as `can:ack` or `has:approve` ("everyone who can acknowledge"). Rows, cells and
  the walk treat all of them the same.
- **The context.** `decide()` and the simulator take a list of the matchers that apply to the
  asker (`Person.subjects`, also exported as the alias `Context`). The host resolves it; the
  package never learns how a match is computed, so a predicate is just one more entry in the list.
- **No kinds, no picker.** With `config.subjectKinds` empty the editor shows no kind chooser and no
  search. It offers the built-in Everyone and a flat list of host matchers,
  `config.matchers: { id, label, description?, group? }[]`, as a plain list of choices for the next
  row (a matcher already in the grid is not offered again; `group` only groups the choices).
  Kinds with a lookup keep working and may be mixed with the flat list.
- **The context picker.** The simulator's "person" picker is a context picker. Its label is a
  string the host sets (Person, Account, Request, ...). With a directory lookup it is the searchable
  picker it is today. Without one it shows the matchers as toggles ("which of these apply?"), or
  a fixed list of named contexts, `config.contexts: { id, label, subjects }[]`. No directory
  lookup is needed.
- **Owners.** The model option `ownerKinds` lists the subject kinds that may own a category. A
  host that wants people only passes the person kind; an empty list switches owners off, and the
  owners block is not drawn. A host with only capability matchers has no owners.
- **Words.** The words user, group, role and person are defaults in the string tables only
  (`editor.kind.*`, `simulator.context`, `simulator.contextPlaceholder`), each overridable, and the
  code never compares a kind or a label to a word. The default of the context label becomes
  neutral ("Context").
- **Demo.** A preset with only capability matchers (no users, groups or roles): rows such as
  `can:ack` and `has:approve`, named contexts instead of people, no owners.
- **Tests.** The capability preset runs end to end: through `decide()` (the vectors gain a
  matcher-only case), through the editor (rows, no kind chooser, no search, flat choices) and
  through the simulator (toggles, named contexts, no lookup), plus a check that the user, group,
  role and person words appear only in the string defaults.

### 4.3 Read-only start (opt-in)

The editor can start read-only, so nothing changes until someone presses Edit. This is opt-in: the
default is `defaultMode="edit"`, which is today's behaviour and changes nothing for a host that does
not ask. This applies to every model, so it is independent of `"ordered"`.

| Prop / slot             | Meaning                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`, `onModeChange`  | `"view"` or `"edit"`. Controlled with both props, or uncontrolled with `defaultMode` (`"edit"` by default; `"view"` starts read-only).     |
| `canEdit`               | Default true. When false the Edit button is hidden, or disabled when `readOnlyReason` is given, with the reason as its tooltip and a note. |
| `readOnlyReason`        | The host's words for why editing is not offered.                                                                                           |
| `onSave(rules, owners)` | Called once when Save is pressed, with the working copy. The host stores it. The editor then returns to view mode.                         |
| `onCancel`              | Called after Cancel, which discards the working copy and restores what the editor had when Edit was pressed.                               |
| `confirmDiscard` slot   | `() => boolean                                                                                                                             | Promise<boolean>`. Called when leaving edit mode with unsaved changes; the built-in confirm dialog is the default. |
| `onChange`              | Still called after each edit, with the working copy, so a host can mirror it. It is not a save.                                            |

Behaviour:

- **View mode** (when started or switched to). Cells, row reorder controls, add and remove row, the owners editor and the
  inherited-rows controls are not interactive: native buttons are disabled or replaced by
  non-focusable marks, the grid carries `aria-readonly="true"`, and there are no tab traps. Every
  size is the same as in edit mode (fixed cell tokens), so toggling never moves anything. A cell
  variant (`box`, `marks`) or a host `renderCell` receives `readOnly: true`.
- **Edit mode.** The editor works on a copy. A marker shows unsaved changes (a dot and a string,
  `editor.unsaved`), Save and Cancel appear, Save is disabled when nothing changed.
- **Leaving with changes.** Cancel, or `mode` turned to `"view"` by the host, with unsaved changes
  asks `confirmDiscard`; declining stays in edit mode.
- **The simulator is untouched.** It stays fully usable in view mode and previews the saved rules
  in view mode and the working copy in edit mode.
- **Words.** Every label (`editor.edit`, `editor.save`, `editor.cancel`, `editor.unsaved`,
  `editor.discardTitle`, `editor.discardBody`, `editor.readOnlyNote`) comes from `config.strings`.
- **Tests.** View mode cannot change anything (no click, key or drop changes the rules, and no
  `onChange` fires); Cancel restores the copy; Save emits `onSave` once; leaving with changes
  confirms; sizes are the same in both modes. The demo has a switch for both starts (default edit).

## 5. What the `Simulator` adapts

The three views (list, boxes, and a host `renderResults`) keep working and keep reading one
`Decision`, so switching view never changes data. The `Decision` gains optional fields, all
absent for `"nearest"`:

```ts
export type DecideReason = "entry" | "default-deny" | "owner" | "requires";
export interface Decision {
  /* existing fields unchanged */
  gatedBy?: string; // the required action that was not allowed
}
export interface TraceStep {
  /* existing fields unchanged */
  kind?: "category" | "owners" | "gate"; // absent means "category"
  order?: number; // 0-based position of the step in the evaluation
  action?: string; // for a gate step, the required action examined
  matched?: string; // for an owners step, the owner subject that matched
}
export interface PoolEntry {
  subject: string; // the person's own subject
  reason: "owner" | "entry";
  category: string; // where they own, or where the deciding row sits
  index?: number; // 0-based row position, when reason is "entry"
}
```

Per field:

- `gatedBy`: the reason reads "Needs <action>" (string `simulator.requires`); the boxes view shows
  the gate as its own box, the list view as a line in the walk.
- Trace steps with `order`: the walk shows "1.", "2." beside each step and the deciding row as
  "#n". Owner steps appear before categories with their own label (`simulator.step.owners`).
- `reason` of `owner` and `requires` extends `explainDecision` with one sentence each.
- Strings stay keyed and overridable through `config.strings`; the wording rule holds: "preview",
  "the host enforces".

Two questions, one set of rules:

1. **What can this person do?** For an `access` action the result reads allowed or denied
   ("Would be allowed" and "Would be denied").
2. **What is this person obliged to do?** For an `obligation` action the result reads required or
   not required ("Required" and "Not required"). A host can override both words per action with
   `ActionDef.outcome` (for example Acknowledge: "Must acknowledge" and "Not required"). The
   simulator can show the person's obligations as a list of the obligation actions that apply.

Lists for a category, from the same rules (headless functions next to `decide`):

- `approverPool(ruleSet, category, people, config)` returns the owners (inherited) and everyone
  whose Approve is allowed, each as a `PoolEntry`, owners first. The simulator shows it as a list
  with the reason for each ("owner of X", "row #2 of X").
- `obligated(ruleSet, category, people, action, config)` does the same for any obligation action,
  for example the acknowledge list. An Everyone row that makes it required is shown as "everyone",
  not as a list of every person (difference 6).

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
- `schema.json` is the shared shape. `expect` adds optional `gatedBy`, and `reason` takes the extra
  values `owner` and `requires`; `decidedBy` may name the entry `index`. A rule set may add
  `owners`; an action may carry `kind` and `requires`. A file may add a `pools` array for the
  approver pool and obligation lists (rule set, people, category, action, expected entries). A
  runner for a model ignores fields the model does not use.
- Runners choose by `model`: the TypeScript test loops over the files and calls the model with that
  id; the Go and mock runners switch on the field and skip models they have not implemented, with a
  visible skip, never a silent pass.
- The cases are written fresh from section 3.2, not taken from any product. A case for a
  difference in section 3.4 is marked `"pending": "<number>"` and follows the owner's notes.

Cases for `ordered` (at least 24, by group):

- Order: (1) a red row above a green row denies; (2) the same rows swapped allow; (3) a row whose
  cell for the asked action is empty is skipped for it; (4) a cell on the asked action beats an
  implied cell in the same row.
- Per action: (5) Shane reaches Ack through the IT group row (example 2); (6) the consultant's red
  Ack at the top denies Ack (example 1); (7) the same row moved below the Everyone row requires Ack;
  (8) the consultant's empty Approve is denied by default.
- Everyone: (9) an Everyone row matches a person with no other subject.
- Inheritance: (10) the child's own row wins over an inherited row; (11) an inherited row decides
  when no child row speaks; (12) a grandparent's rows come after the parent's; (13) a stored
  `stopInheriting` is ignored.
- Owners: (14) an owner is allowed over a deny; (15) an ancestor's owner is an owner in the child;
  (16) an owner is not required to acknowledge (rows decide); (17) a subject in `owners` whose kind is not allowed
  is not an owner; (18) an owner can approve.
- Implies and requires: (19) a Manage cell answers Read, Author and Approve and not Ack;
  (20) Ack with a Read deny is denied with `gatedBy: "read"`; (21) Ack with Read allowed is
  allowed; (22) an action with no `requires` needs no read.
- Pools: (23) the approver pool of example 6; (24) an obligation list with an Everyone row.
- Edge: (25) an unknown asked action is a default deny; (26) a cycle in `parents` ends the walk.

## 7. What the host passes

| Need                           | The host passes                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Today's behaviour              | Nothing new. `model` defaults to `"nearest"`.                                                                                             |
| The ordered model              | `model="ordered"` or `ruleSet.model = "ordered"`, plus `config.actions` with `kind`, `implies` and `requires`, and `owners` per category. |
| Grid headings and result words | `config.kindLabels` for the Access and Obligations headings; `ActionDef.outcome` for per-action result words.                             |
| A model of its own             | `model={myModel}` (object) or `registerModel(myModel)` and its id; or `models={{...}}`.                                                   |
| Rules evaluated on its server  | The `Simulator` `evaluate` prop returning a decision; the model supplies only presentation.                                               |
| The people to list             | An array of people (their subjects) to `approverPool` and `obligated`; the package does not know who exists.                              |
| Subjects without a directory   | `config.matchers`, `config.contexts` (or toggles), `ownerKinds`; `subjectKinds` may be empty.                                             |
| Locks and read-only            | `isLocked` and the read-only reason, as for any model.                                                                                    |

Migration notes:

- Existing hosts change nothing. Rule sets without `model` are `"nearest"`; vectors are unchanged.
- To adopt `"ordered"`, a host converts stored rules once: one entry per subject and action in the
  order it evaluates, owners moved to `CategoryRules.owners` (only kinds the host allows). The package does not
  convert silently; `validate` reports what to fix.
- A host that must keep its server as the truth keeps `evaluate`, reads the model's presentation
  only, and treats client previews as previews.

## 8. Risks and mitigations

| Risk                              | Mitigation                                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two semantics drift apart         | The model is data (`model` field) with a default of today's; one vector file per model, each run by every runner; CI runs both. A change to a model bumps that file's `version`.                                |
| Cell model mismatch               | Ordered mode needs one entry per subject and action. `validate` rejects duplicates, the editor edits in place, and the `"nearest"` collapse-to-deny cell is not used in ordered mode.                           |
| Server and client disagree        | Hosts with server truth use `evaluate`; the client model is a preview. Extra fields (owners, gating, kinds) are mirrored in the host's engine with the shared vectors before a host relies on a client preview. |
| API surface grows                 | Add only the interface, `registerModel`, the `model` and `models` props, the pool functions and optional fields. Everything else stays internal. Public-surface test updated in the same change; no removals.   |
| `DecideReason` union widens       | Hosts that switch exhaustively on `reason` need a default branch. Documented in the guides; the new values only appear in non-default models.                                                                   |
| `implies` vs `requires` confusion | Separate fields, separate steps (4 and 6), separate worked example; never overload `implies`.                                                                                                                   |
| Open differences (3.4)            | Each is listed for the owner and marked pending in the vectors; the model follows the owner's notes until answered, and a change after that is a model `version` bump.                                          |

## 9. Effort and order of work

Estimates in working days, one developer, including tests and docs for the item.

| Step | Work item                                                                                             | Days |
| ---- | ----------------------------------------------------------------------------------------------------- | ---- |
| 1    | `RaciModel` interface, registry, `"nearest"` extracted from `decide()`; no behaviour change           | 2    |
| 2    | Vectors per model: `nearest.json`, alias `decide.json`, shared schema, `model` and `version`          | 1.5  |
| 3    | `"ordered"` evaluate (rows, chain, owners, implies, requires, trace), pools, validate and its vectors | 4    |
| 4    | Editor: view and edit mode (1.5); names, matchers and context picker (2.5); ordered editor (3)        | 7    |
| 5    | Simulator: wording by kind, pool and obligation lists, trace steps, `gatedBy`                         | 2    |
| 6    | Docs, an `"ordered"` demo preset, and guides                                                          | 1.5  |

Total: about 18 days. A Go port of the runner is outside this estimate, about 1 day per model.

Recommended order and PR split, after the initial build merges:

1. PR A, steps 1 and 2 together: pure refactor and vectors. Ships alone; no user-visible change.
   Merged.
2. PR B, step 3: the `"ordered"` model headless, with its vectors, the pool functions and the
   action `kind`, `requires` and `outcome` fields. Ships alone and is already useful to a host that
   evaluates with it on a server or in tests; it needs only A.
3. PR C, step 4, split into three because the pieces are independent concerns:
   - C1: view and edit mode (4.3). Applies to every model; needs nothing else.
   - C2: names and matchers (4.1 and 4.2): short labels and header mode, kind grouping, glyph
     overrides, generic matchers, the context picker, the demo presets (short labels; capabilities
     only). Applies to every model; needs nothing else.
   - C3: the `"ordered"` editor: row ordering (up, down, drag), green/red/empty cells, inherited
     rows, the owners editor. Needs B and C1.
4. PR D, step 5: the simulator's wording by kind, pool and obligation lists. Needs B; its list view
   shares C's labels, so it follows C.
5. PR E, step 6: docs and demo preset. Last, so it describes what shipped.

Each PR keeps `npm test`, lint, format and the wording test green, keeps `vectors/nearest.json`
verdicts unchanged and adds only optional fields.
