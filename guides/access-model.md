# The access model

Everything the package does rests on a small model. The editor writes it, the simulator reads it and
`decide()` evaluates it.

## Vocabulary

- **Subject.** Who a rule is about, written `kind:id`: `user:alice`, `group:finance`,
  `role:approver`. The kinds are yours (see [Configuration](configuration.md#subject-kinds)).
- **Resource (category).** A node of your resource tree. A rule lives in one category. A category can
  have a parent, so categories form a tree.
- **Action.** A verb the host defines, such as `read` or `approve`.
- **Implication.** An action can include others: `manage` implies `author`, `approve` and `read`.
  An entry on `manage` therefore also answers a question about `read`. Implication is transitive
  (if `manage` implies `author` and `author` implies `read`, `manage` covers `read`) and safe
  against cycles. Implication only widens an entry; it never narrows one.
- **Entry.** One rule: `{ subject, action, effect }`, where `effect` is `"allow"` or `"deny"`.
- **Person.** The one asking. A person is not a subject; it is the list of every subject string that
  matches them: their own `user:` id, their groups, their roles.

## Resolving a question

The question is: would these rules allow this person to do this action in this category? `decide()`
answers it in four steps. It is a pure evaluation helper the host may call; the host enforces.

1. **Default deny.** If nothing says allow, the answer is deny. An action that is not in the action
   list is denied outright.
2. **Walk.** Start at the asked category and go up through `parents`, one category at a time. After
   the last ancestor, visit the special category `"*"` (see below). A category is never visited
   twice, so a cycle in `parents` ends the walk.
3. **Nearest category with a matching entry decides.** An entry matches when its subject is one of
   the person's subjects and the asked action is the entry's action or something that action
   implies. In the first category that has any matching entry, a matching deny beats any matching
   allow. Categories further up are not consulted. When several entries share the winning effect,
   the first one in `entries` order is the one reported.
4. **Stop inheriting.** A category with `stopInheriting: true` ends the walk after its own entries
   are checked. Its parents and `"*"` are not visited.

`decide()` returns the verdict, the reason (`"entry"` or `"default-deny"`), the category and entry
that decided, the categories visited nearest first (`path`) and, when a stop ended the walk with no
match, where it stopped (`stoppedAt`).

### Worked examples

These use the actions `read`; `edit` (implies `read`); `manage` (implies `edit`, so also `read`),
and the tree `docs` > `specs`. Alice is `user:alice` and belongs to `group:eng`.

**Implication.** `specs` has `group:eng allow edit`. Asked `read` in `specs`: the entry's action
`edit` implies `read`, so it matches. Allowed, decided in `specs`, path `[specs]`. Asked `manage`:
`edit` does not imply `manage`, nothing else matches, default deny.

**Nearest wins.** `specs` has `user:alice deny read`, and `docs` has `group:eng allow manage`. Asked
`read` in `specs`: the deny in `specs` matches first, so the answer is deny and `docs` is never
looked at. Asked `read` in `docs`: only the `docs` entry exists on that walk, so allowed.

**Deny beats allow in the same category.** `specs` has `group:eng allow edit` and `user:alice deny
edit`. Asked `edit`: both match, the deny wins. A deny on `read` does not cancel an allow on `edit`
when `edit` is asked, because the deny on `read` only matches questions about `read`. But when
`read` is asked, both match and the deny wins.

**Inheritance.** `docs` has `group:eng allow read` and `specs` has no entries. Asked `read` in
`specs`: nothing in `specs`, so the walk moves to `docs`, which allows. Path `[specs, docs]`.

**Stop inheriting.** Same rules, but `specs` has `stopInheriting: true`. Asked `read` in `specs`:
nothing matches in `specs`, the walk ends there. Denied, reason `default-deny`, `stoppedAt:
"specs"`, path `[specs]`. Note that stopping does not remove `specs` own entries; they still count.

**The `"*"` category.** `"*"` has `role:auditor allow read`. Alice has `role:auditor`. Asked `read`
in `specs` with no other rules: the walk goes `specs`, `docs`, then `"*"`, and allows. Path
`[specs, docs, *]`.

## The `"*"` category

`categories["*"]` holds entries that apply to every category. It is the last stop of every walk, so
a rule in any real category beats a rule in `"*"`, and a category with `stopInheriting` skips it.
The editor shows it as "All categories" in the inherited section, read-only; the simulator lists it
in the walk. The editor has no screen of its own for `"*"` (it is not a node of your resource tree), so
write it from your own admin tooling or seed it in the stored `RuleSet`.

## Wire format

One JSON document is the contract between the editor, the simulator, a mock and a Go service.

```json
{
  "categories": {
    "docs": {
      "entries": [{ "subject": "group:eng", "action": "read", "effect": "allow" }]
    },
    "specs": {
      "stopInheriting": false,
      "entries": [
        { "subject": "user:alice", "action": "read", "effect": "deny" },
        { "subject": "group:eng", "action": "edit", "effect": "allow" }
      ]
    },
    "*": {
      "entries": [{ "subject": "role:auditor", "action": "read", "effect": "allow" }]
    }
  },
  "parents": { "specs": "docs" }
}
```

- `categories` maps a category id to `{ entries, stopInheriting? }`. `stopInheriting` is optional and
  false when absent. A category that is missing is the same as one with no entries.
- `parents` maps a child category id to its parent id. A category that is not a key is a root.
- `"*"` is reserved. Do not use it as a resource id.
- Actions are not stored in the rule set. They come from the host's configuration, which is why
  `decide()` takes them as a separate argument.

In TypeScript this is `RuleSet`. Treat it as immutable: the components never change the object you
pass and hand you a new one on every edit.

## Using `decide()`

```ts
import { decide } from "node-raci-editor";

const decision = decide({
  ruleSet,
  actions: config.actions,
  person: { subjects: ["user:alice", "group:eng"] },
  category: "specs",
  action: "read",
});
// decision.allowed, decision.reason, decision.decidedBy, decision.path, decision.stoppedAt
```

`decide()` is pure: same input, same output, no I/O.
