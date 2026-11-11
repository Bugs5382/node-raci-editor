# Roadmap notes

Nothing on this page is implemented. These are candidates found while comparing the package with a
host that keeps its rules on a server and evaluates there. Each needs an owner decision before work
starts. None would change verdicts when its new fields are absent, so `vectors/decide.json` stays
valid; new behaviour would get new vectors.

The design for these as pluggable rule models, with the built-in `nearest` and `ordered` models, the
split into work items and the order of work, is in [Pluggable rule models](models-design.md).

## Editor features worth generalizing (future, ranked)

1. Row ordering (move up and down, a `#` column), active when a category sets
   `precedence: "first-match"`. Needs the `decide()` option below. About 2 to 3 days.
2. A subject presentation slot (`SubjectKind.icon`, `describe`) for avatars and captions. About 1 day.
3. Per-subject lock (`isLocked(subject, categoryId)` with a reason) and a read-only reason note.
   About 1 day.
4. A simple "share sheet" editor view (checkbox columns) next to the grid. About 2 days.
5. Picker hardening: minimum query length, debounce, stale-answer guard, `searchText` matching,
   result cap. About 1 day, mostly tests.
6. An `own` effect with its own cell look and legend. About 2 days with `decide()` and vectors.
7. An owners block (`CategoryRules.owners`) checked before rules. About 3 days with vectors.
8. A legend component for the cell looks. Under half a day.

A dirty, save and discard bar belongs to the host page and is not a candidate.

## Model gaps (future, owner decision)

| Gap                    | Proposal                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-match precedence | `CategoryRules.precedence?: "deny-wins" (default) \| "first-match"`. In first-match the first matching entry decides instead of any deny. Vectors must carry the mode.                          |
| An `own` effect        | Either `Effect` gains `"own"` or `Entry.scope?: "own"`; `Decision.ownOnly` stays allowed and the host finishes the ownership check.                                                             |
| Owners                 | `CategoryRules.owners` with `ownerActions`, evaluated across the whole chain before any category's entries. Cannot be emulated with entries, because a nearer deny would win.                   |
| Gating                 | `ActionDef.requires?: string[]`: if a required action is not allowed the answer is denied with a "requires" reason. Separate from `implies`, which would change current verdicts if overloaded. |
| Everyone               | No change to `decide()`: document a convention such as `everyone:*` in every `Person.subjects`, and optionally a `SubjectKind` flag marking a kind as implicit.                                 |
| Administrator override | A hook consulted before the walk, for example `DecideInput.overrides`.                                                                                                                          |

## Risks to settle first

- Two precedence modes mean two sets of vectors and a trap for ports. The mode should be data that
  defaults to today's behaviour.
- A server and a client `decide()` can disagree once the extra fields exist. A host that owns the
  truth on its server should keep using `evaluate` and treat `decide()` as an optional preview.
- In first-match mode the editor needs a rule for one entry per subject and action, or the cell
  must say which entry it shows.
