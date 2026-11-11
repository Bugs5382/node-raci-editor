# Contributing to node-raci-editor

This repository follows the workflow below.

## Workflow

1. Open an issue from a template (free-form issues are disabled). For multi-step work,
   use a parent issue with ordered sub-issues, and put it on the active milestone.
2. Branch from `main` as `<type>/<issue#>-<slug>` (for example `feat/12-add-listener`).
3. Commit using Conventional Commits (`type(scope): description`). No attribution
   trailers, no emoji in source or commit messages (emoji are fine in Markdown).
4. Open a PR with a Conventional Commit title. The autolabeler sets the category label
   from the title; fill the PR template, reference the issue (`Closes #N`), and add a
   closing summary before merge.
5. PRs merge by squash. On merge, release-drafter drafts the next notes and the changelog
   updates on `main`; the maintainer publishes releases manually.

Keep one concern per PR, even small ones: one issue per PR is the default. Similar work in the same wave may share one PR that closes several issues, each issue still filed and each with its own `Closes`, above all when a rebase would make every open PR rerun CI. Unrelated work stays in separate PRs. When editing GitHub Actions workflows, a job id must be a
plain identifier (a letter or `_`, then alphanumerics/`-`/`_`); put emoji and display text in the
job's `name:`. The Actionlint check enforces this.

## Local setup

CI enforces Conventional Commits and the no-tell/no-emoji rules on every pull request, so run
the repo's lint and test tasks before you push. In a Linux-only repo (one with a
`.claude/linux-only` marker) the build, lint and test checks may not run on macOS, and CI is the
gate. See `CLAUDE.md` for the full working agreement.
