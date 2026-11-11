# Test vectors

`vectors/decide.json` is a language-neutral list of questions and expected answers for the access
decision. The TypeScript package, a mock server and a Go implementation all run the same file, so
they have to agree. The file ships in the npm package and is importable as
`node-raci-editor/vectors/decide.json`.

The format and the exact algorithm are written down in
[`vectors/README.md`](../vectors/README.md); that file is the contract. In short:

```json
{
  "version": 1,
  "actions": [{ "id": "read" }, { "id": "edit", "implies": ["read"] }],
  "cases": [
    {
      "name": "unique human readable name",
      "ruleSet": { "categories": {}, "parents": {} },
      "person": { "id": "alice", "groups": ["eng"], "roles": [] },
      "category": "specs",
      "action": "read",
      "expect": { "allowed": false, "reason": "default-deny", "decidedBy": null }
    }
  ]
}
```

- `actions` is shared by every case.
- `person` is `{ id, groups, roles }`. The runner derives the subjects `user:<id>`, then
  `group:<g>` per group, then `role:<r>` per role. `vectorSubjects` does this in TypeScript.
- `expect.decidedBy` is `null` for a default deny, otherwise `{ category, subject, action, effect }`
  of the entry that decided.
- `Decision.path` and `Decision.stoppedAt` are not part of the vectors.

## Running them from TypeScript

This runs every case and returns the names of the ones that disagree. In a test, assert that the
list is empty.

```ts
import { isDeepStrictEqual } from "node:util";
import { decide, vectorSubjects } from "node-raci-editor";
import type { ActionDef, DecideInput, VectorPerson } from "node-raci-editor";
import vectors from "node-raci-editor/vectors/decide.json";

interface Case {
  name: string;
  ruleSet: DecideInput["ruleSet"];
  person: VectorPerson;
  category: string;
  action: string;
  expect: { allowed: boolean; reason: string; decidedBy: object | null };
}

/** Returns the names of the cases whose decision differs from `expect`. */
export const runVectors = (): string[] => {
  const file = vectors as unknown as { actions: ActionDef[]; cases: Case[] };
  const failed: string[] = [];
  for (const c of file.cases) {
    const d = decide({
      ruleSet: c.ruleSet,
      actions: file.actions,
      person: { subjects: vectorSubjects(c.person) },
      category: c.category,
      action: c.action,
    });
    const by = d.decidedBy;
    const got = {
      allowed: d.allowed,
      reason: d.reason,
      decidedBy: by
        ? {
            category: by.category,
            subject: by.entry.subject,
            action: by.entry.action,
            effect: by.entry.effect,
          }
        : null,
    };
    if (!isDeepStrictEqual(got, c.expect)) failed.push(c.name);
  }
  return failed;
};
```

With Vitest or Jest: `expect(runVectors()).toEqual([])`. This repository runs the snippet above in
its own test suite, so it stays working.

## Running them from Go

Read the file, build the same subject list, run your implementation and compare. A sketch:

```go
type Case struct {
	Name     string `json:"name"`
	RuleSet  RuleSet `json:"ruleSet"`
	Person   struct {
		ID     string   `json:"id"`
		Groups []string `json:"groups"`
		Roles  []string `json:"roles"`
	} `json:"person"`
	Category string `json:"category"`
	Action   string `json:"action"`
	Expect   struct {
		Allowed   bool       `json:"allowed"`
		Reason    string     `json:"reason"`
		DecidedBy *DecidedBy `json:"decidedBy"`
	} `json:"expect"`
}

func TestVectors(t *testing.T) {
	raw, _ := os.ReadFile("decide.json")
	var file struct {
		Actions []ActionDef `json:"actions"`
		Cases   []Case      `json:"cases"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	for _, c := range file.Cases {
		subjects := []string{"user:" + c.Person.ID}
		for _, g := range c.Person.Groups {
			subjects = append(subjects, "group:"+g)
		}
		for _, r := range c.Person.Roles {
			subjects = append(subjects, "role:"+r)
		}
		got := Decide(c.RuleSet, file.Actions, subjects, c.Category, c.Action)
		if got.Allowed != c.Expect.Allowed || got.Reason != c.Expect.Reason ||
			!sameDecidedBy(got.DecidedBy, c.Expect.DecidedBy) {
			t.Errorf("%s: got %+v, want %+v", c.Name, got, c.Expect)
		}
	}
}
```

`Decide`, `RuleSet`, `ActionDef`, `DecidedBy` and `sameDecidedBy` are yours. Copy `decide.json` into
your repository at build time from the npm package (or a release asset) rather than editing it, so
every implementation tests the same cases.

## For a mock server

Mount the same loop behind a test: feed each case through the mock's decision endpoint and compare
`allowed`, `reason` and `decidedBy`. If the mock and `decide()` ever disagree on a case, one of
them has a bug.

## Adding a case

Add it to `vectors/decide.json` in this repository, keep the name unique, and keep the file
generic: no product names, only the vocabulary the file already uses. Run `npm test`; the package's
own test runs every case through `decide()`.
