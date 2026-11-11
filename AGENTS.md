# AGENTS.md - node-raci-editor

Guide for AI agents working in this repository. Pair with `CLAUDE.md` (the working agreement and
hook-enforced rules). Keep this file current when the build, layout, or public API changes.

## What this is

Generic drop-in React rules editor, simulator and settings for RACI-style access rules, with a pure TypeScript decide() and shared test vectors.

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
- Test vectors for `decide()` ship as `vectors/decide.json` when present.

## Layout

- `src/index.ts` - the public entry point: exports only.
- `src/core/` - the pure TypeScript domain model and `decide()`; node tests, 100% coverage gate.
- `src/react/` - the React components; tests run in jsdom.
- `src/styles/` - `index.css` imports `tokens.css` and `components.css`; built to `dist/styles.css`.
- `demo/` - a Vite app that imports the package source through the `@/` alias (not published).
- `tests/` - cross-module tests (optional); unit tests sit next to their module.
- `vectors/` - shared `decide()` test vectors (published once present).
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
- Demo: `npm run demo:dev` (port 5179) and `npm run demo:build`
- Package checks (npm packages), after a build: `npm run check:pack` (contents and ceiling),
  `npm run check:pack:growth` (growth against the last release), `npm run check:install`
  (install the tarball, import ESM and CJS); see CLAUDE.md "npm package contents"
- License headers / docs: `<command>`

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
- <project-specific conventions, non-obvious constraints, and traps an agent should know>
