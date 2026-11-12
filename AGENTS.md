# AGENTS.md - node-raci-editor

Guide for AI agents working in this repository. Pair with `CLAUDE.md` (the working agreement and
hook-enforced rules). Keep this file current when the build, layout, or public API changes.

## What this is

A generic, drop-in React library for editing and testing RACI-style access rules: a matrix editor
(`RulesEditor`), a simulator (`Simulator`) and a settings panel (`SettingsPanel`), on top of a pure
TypeScript `decide()` and a language-neutral set of test vectors. The package shows and edits
access rules; the host enforces. `decide()` is a pure evaluation helper the host may call, and the
simulator previews what the rules would allow. The host defines its own actions, subject kinds and resource tree through a `RaciConfig`; the package knows no product.

It ships an npm library (ESM and CJS, with declarations) plus a stylesheet. Two things to keep in
mind before changing it:

- `src/core` is pure TypeScript with no React and no DOM, and is held to 100% test coverage.
  The React layer in `src/react` sits on top of it and never reimplements its logic.
- Colors, spacing and type come from CSS custom properties in `src/styles/tokens.css`; components
  style themselves with those tokens only.

## Using node-raci-editor

- Entry point: `node-raci-editor` (everything is exported from `src/index.ts`).
- Stylesheet: `import "node-raci-editor/styles.css"` (built to `dist/styles.css`).
- Peer dependencies: `react` and `react-dom`, version 18 or newer.
- Test vectors for `decide()` ship one file per model: `vectors/nearest.json` (importable as
  `node-raci-editor/vectors/nearest.json`) and `vectors/decide.json`, its alias with identical
  cases. Go and mock implementations run the same files, choosing by the `model` field.
- Exports: the types (`RaciConfig`, `RuleSet`, `Entry`, ...), `decide`, `defaultSettings`,
  `normalizeSettings`, `toggleAction`, `toggleKind`, `moveAction`, `impliedActions`,
  `vectorSubjects`, and the three components with their props types. The simulator also exports
  `SimulatorVariant`, `ActionResult`, `SimulatorViewProps`, and core exports `TraceStep`,
  `TraceMatch` and `DecideOptions` (`decide(input, { trace: true })`). Models: `registerModel`,
  `getModel`, `listModels` and the types `RaciModel`, `ModelCapabilities`, `ModelInput`,
  `ModelResult`, `ModelIssue`, `LegendItem`; `"nearest"` is the default.
- Components are controlled: the host owns the `RuleSet` and `RaciSettings` and receives a new
  object through `onChange`. Nothing is mutated.
- Usage docs are in `README.md` and `guides/` (getting started, access model, configuration,
  components, test vectors, extending, theming).

## Layout

- `src/index.ts` - the public entry point: exports only.
- `src/core/` - the pure TypeScript domain model, `decide()`, the model interface (`model.ts`), the
  registry (`registry.ts`) and the built-in models (`models/nearest.ts`); node tests, 100% coverage gate.
- `src/react/` - the React components; tests run in jsdom. The simulator has three built-in
  views (`list` is the default and must stay as it is; `Boxes.tsx`, `Strips.tsx`).
- `src/styles/` - `index.css` imports `tokens.css` and the component sheets (`components.css`,
  `editor.css`, `simulator.css`, `simulator-boxes.css`, `simulator-strips.css`, `settings.css`); built to
  `dist/styles.css`.
- `tests/` - cross-module tests; `docs-snippets.test.tsx` runs the code shown in the README and guides.
- `vectors/` - shared test vectors, one file per model (published), and their format in `vectors/README.md`.
- `guides/` - the documentation; `README.md` links to each guide.
- `scripts/` - repo tooling: CSS build, pack and install checks.
- Imports use the `@/` alias for `src/` (`@/core/types`), never `../../`.

## Build, test, lint

- Build: `npm run build` (tsdown for JS and declarations, then `scripts/buildCss.mjs` writes
  `dist/styles.css` by inlining the `@import`s)
- Test: `npm test` (`npm run test:coverage` for the 100% core gate); `*.test.ts` run in node,
  `src/react/**` and `*.test.tsx` run in jsdom with jest-dom
- Lint: `npm run lint` (Oxlint, shared config from `@bugs5382/node-oxlint-config`; `lint:fix`)
- Format: `npm run format` / `npm run format:check` (oxfmt); there is no ESLint or Prettier
- Types: `npm run typecheck` (covers `src` and `tests`)
- Package checks (npm packages), after a build: `npm run check:pack` (contents and ceiling),
  `npm run check:pack:growth` (growth against the last release), `npm run check:install`
  (install the tarball, import ESM and CJS); see CLAUDE.md "npm package contents"
- Docs: `npm run docs` (typedoc from `src/index.ts`, warnings are errors; output in `docs/`, git-ignored)

## Logging

Follow the logging rules in `CLAUDE.md`. In short:

- Log generously: entry and exit of significant operations, decisions and branches, retries, state
  changes, external calls (target, duration, outcome), and every error with its context.
- Levels: `trace` for step-by-step detail, `debug` for flow, `info` for lifecycle, `warn` and
  `error` for problems. The environment filters the volume, so err on the side of too much.
- Environments: local dev `trace` with `LOG_FORMAT=console` (never JSON), dev cluster `debug`,
  qa/staging `info`, production `error`. Every cluster environment logs JSON. Set levels through
  `LOG_LEVEL` and `LOG_FORMAT`, never in code; local settings live in the run target or
  `.env.example`.
- Never log secrets, tokens, or personal data, not even at `trace`. Log an opaque or keyed ID.

## Conventions and gotchas

- See `CLAUDE.md` for the branch/commit/PR rules; they are enforced by the git hooks in
  `.claude/hooks` (run `bash .claude/hooks/install.sh` once per clone).
- Open every PR as a draft. CI skips drafts, so run the full checks locally, push once they pass,
  and mark the PR ready when the work is finished; see CLAUDE.md "CI and Actions minutes".
- Every exported item needs a TSDoc comment: `npm run docs` fails on warnings.
- A code block in `README.md` or `guides/` that is also in `tests/docs-snippets.test.tsx` must match
  the test file exactly (with `@/index` written as `node-raci-editor`). Edit both together.
- `vectors/*.json` stay generic and language-neutral; change `vectors/README.md` with them.
  `decide.json` is byte-stable and must keep the same cases as `nearest.json` (a test checks it).
- CHANGELOG.md is generated by the changelog action from the release notes at release time. Never edit it by hand.
- `decide()` treats a category without `stopInheriting` as false and ignores settings; the editor
  reads the same flag, so what it shows is what `decide()` evaluates.
- No product or brand names anywhere in the code, docs or vectors.
