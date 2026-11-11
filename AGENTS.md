# AGENTS.md - node-raci-editor

Guide for AI agents working in this repository. Pair with `CLAUDE.md` (the working agreement and
hook-enforced rules). Keep this file current when the build, layout, or public API changes.

## What this is

A generic, drop-in React library for editing and testing RACI-style access rules: a matrix editor
(`RulesEditor`), a simulator (`Simulator`) and a settings panel (`SettingsPanel`), on top of a pure
TypeScript `decide()` and a language-neutral set of test vectors. The host defines its own actions,
subject kinds and resource tree through a `RaciConfig`; the package knows no product.

It ships an npm library (ESM and CJS, with declarations) plus a stylesheet. Two things to keep in
mind before changing it:

- `src/core` is pure TypeScript with no React and no DOM, and is held to 100% test coverage.
  The React layer in `src/react` sits on top of it and never reimplements its logic.
- Colors, spacing and type come from CSS custom properties in `src/styles/tokens.css`; components
  style themselves with those tokens only.

## Using node-raci-editor

- Entry point: `node-raci-editor` (everything is exported from `src/index.ts`).
- Stylesheet: `import "node-raci-editor/styles.css"` (built to `dist/styles.css`).
- Demo: `import { RaciDemo } from "node-raci-editor/demo"` plus `node-raci-editor/demo.css`;
  `npx raci-editor-demo` serves the packaged static page. See `guides/demo.md`.
- Peer dependencies: `react` and `react-dom`, version 18 or newer.
- Test vectors for `decide()` ship as `vectors/decide.json` (also importable as
  `node-raci-editor/vectors/decide.json`). Go and mock implementations run the same file.
- Exports: the types (`RaciConfig`, `RuleSet`, `Entry`, ...), `decide`, `defaultSettings`,
  `normalizeSettings`, `toggleAction`, `toggleKind`, `moveAction`, `impliedActions`,
  `vectorSubjects`, and the three components with their props types. The simulator also exports
  `SimulatorVariant`, `ActionResult`, `SimulatorViewProps`, and core exports `TraceStep`,
  `TraceMatch` and `DecideOptions` (`decide(input, { trace: true })`).
- Components are controlled: the host owns the `RuleSet` and `RaciSettings` and receives a new
  object through `onChange`. Nothing is mutated.
- Usage docs are in `README.md` and `guides/` (getting started, access model, configuration,
  components, test vectors, extending, theming).

## Layout

- `src/index.ts` - the public entry point: exports only.
- `src/core/` - the pure TypeScript domain model and `decide()`; node tests, 100% coverage gate.
- `src/react/` - the React components; tests run in jsdom. The simulator has three built-in
  views (`list` is the default and must stay as it is; `Boxes.tsx`, `Strips.tsx`).
- `src/styles/` - `index.css` imports `tokens.css` and the component sheets (`components.css`,
  `editor.css`, `simulator.css`, `simulator-boxes.css`, `simulator-strips.css`, `settings.css`); built to
  `dist/styles.css`.
- `src/demo/` - `RaciDemo`, the sample data (`demoPresets`, `demoRuleSet`) and `demo.css` /
  `brand-override.css`; published as the `node-raci-editor/demo` subpath and `node-raci-editor/demo.css`.
  Tests are beside it (jsdom).
- `demo/` - a thin Vite shell that mounts `RaciDemo`; `npm run build` builds it to `dist/demo-site`,
  which ships with the `bin/raci-editor-demo.mjs` command (stdlib http server, default port 5179).
- `demo/` - a Vite app that imports the package source through the `@/` alias (not published).
- `tests/` - cross-module tests; `docs-snippets.test.tsx` runs the code shown in the README and guides.
- `vectors/` - shared `decide()` test vectors (published) and their format in `vectors/README.md`.
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
- Types: `npm run typecheck` (covers `src`, `demo` and `tests`)
- Demo: `npm run demo:dev` (port 5179) and `npm run demo:build` (to `dist/demo-site`, run by `build`)
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
- `vectors/decide.json` stays generic and language-neutral; change `vectors/README.md` with it.
- `decide()` treats a category without `stopInheriting` as false and ignores settings; the editor
  reads the same flag, so what it shows is what the engine does.
- No product or brand names anywhere in the code, docs or vectors.
