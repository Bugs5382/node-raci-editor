# Shared decide() test vectors

The vector files are language-neutral sets of test cases for the access decision. The TypeScript package, a mock server and a Go implementation all run the same files, so they must agree. `decide()` is a pure evaluation helper the host may call; the host enforces.

## Files per model

There is one file per rule model. A file's `model` field names the model its cases belong to, and `version` is bumped when that model's behaviour changes.

| File           | Model       | Notes                                                                                           |
| -------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `nearest.json` | `"nearest"` | The built-in default model. Importable as `node-raci-editor/vectors/nearest.json`.              |
| `decide.json`  | `"nearest"` | The original name, kept as an alias. It has no `model` field (absent means `"nearest"`) and its cases are identical to `nearest.json`; a test keeps them equal. |

A runner picks the model from `model` (default `"nearest"`), runs every case of the file through that model, and skips a model it has not implemented with a visible skip, never a silent pass. Every model file uses the same format; the algorithm section describes `"nearest"`.

## Format

```json
{
  "version": 1,
  "actions": [{ "id": "manage", "implies": ["author", "approve", "read"] }],
  "cases": [
    {
      "name": "unique human readable name",
      "ruleSet": {
        "categories": {
          "team": {
            "stopInheriting": false,
            "entries": [{ "subject": "user:alice", "action": "read", "effect": "allow" }]
          },
          "*": { "entries": [] }
        },
        "parents": { "team": "dept" }
      },
      "person": { "id": "alice", "groups": ["finance"], "roles": ["approver"] },
      "category": "team",
      "action": "read",
      "expect": {
        "allowed": true,
        "reason": "entry",
        "decidedBy": {
          "category": "team",
          "subject": "user:alice",
          "action": "read",
          "effect": "allow"
        }
      }
    }
  ]
}
```

- `actions` is the list of action definitions (`id`, optional `label`, optional `implies`). It is shared by every case.
- `ruleSet.categories` maps a category id to its rules. `"*"` applies to every category as the last stop of a walk. `stopInheriting` is optional and defaults to false.
- `ruleSet.parents` maps a child category id to its parent id. A category missing from `parents` is a root.
- `person` is given as `id`, `groups` and `roles`. The loader derives the subjects `user:<id>`, then `group:<g>` for each group, then `role:<r>` for each role.
- `expect.reason` is `"entry"` or `"default-deny"`. `expect.decidedBy` is `null` for a default deny, otherwise the category and the entry (`subject`, `action`, `effect`) that decided.

## Algorithm

1. Default deny.
2. Walk from `category` up through `parents`, stopping if a category repeats (cycle). After the last category, `"*"` is the final stop, unless the walk already visited it.
3. At the nearest category with an entry matching the person and the asked action, decide: any matching deny beats any allow in that category, otherwise allow. When several entries share the winning effect, the first one in `entries` order is the one reported in `decidedBy`.
4. A category with `stopInheriting: true` ends the walk after its own entries are checked. The `"*"` stop is then skipped.
5. A category without a matching entry passes the question to its parent.

An entry matches when `entry.subject` is one of the person's subjects and the asked action is in the closure of `entry.action` under `implies` (transitive, cycle safe). An entry on `manage` therefore matches a question about `read`; an entry on `read` does not match `author`. Entries on actions not listed in `actions` only match themselves, and a question about an action not listed in `actions` is a default deny.

`path` and `stoppedAt` of the TypeScript `Decision` are not part of the vectors.
