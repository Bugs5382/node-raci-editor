# Demo

The package ships a working demo as a runtime export, so you can mount it in any React app to try
the editor, simulator and settings against sample data, or reuse the sample data in your own tests.

## Mount it

```tsx
import "node-raci-editor/styles.css";
import "node-raci-editor/demo.css";
import { RaciDemo } from "node-raci-editor/demo";

export const DemoPage = () => <RaciDemo initialPreset="other" initialTheme="dark" />;
```

Two stylesheets are needed: `node-raci-editor/styles.css` (the library tokens and components) and
`node-raci-editor/demo.css` (the demo's own chrome: header, tree, tabs and the brand override).
`demo.css` is separate on purpose, so `styles.css` stays library-only. Both stylesheets use the
`--raci-*` tokens, and the wrapper sets `data-theme` itself, so the host page is not restyled.

`RaciDemo` has the `react` and `react-dom` peers like the rest of the package and renders on the
server too (the saved theme is read in a try/catch, so no `window` is needed).

## Props

All optional.

| Prop            | Type                            | What it does                                                                        |
| --------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| `className`     | `string`                        | Extra class on the root, next to `raci-root` and `demo-app`.                        |
| `initialPreset` | `string`                        | `"org"` (default) or `"other"`. An unknown id falls back to `"org"`.                |
| `initialTheme`  | `"light" \| "dark" \| "system"` | First theme. When omitted, the choice saved in `localStorage` is used, else system. |

## What is on screen

- A resource tree in a dashed frame captioned "host app: resource tree, not part of the package".
  It stands in for your own navigation: the package takes the selected category id plus the
  resource data (nodes, parents, labels) and renders no resource list of its own. The only
  exception is the simulator's optional built-in category select, a convenience and not a tree
  (it can be hidden with `show.category=false` once that prop is available).
- The package area, captioned "package: rules editor, simulator, settings", with tabs: Editor (`RulesEditor`), Simulator (`Simulator`) and Settings (`SettingsPanel`), with arrow
  key navigation.
- A "Capabilities only" preset: no users, groups or roles. Subjects are matchers such as Can
  acknowledge and Can approve, added from a flat list; the simulator previews named contexts (New hire,
  Reviewer, Guest) or matcher toggles.
- A "Custom cells" preset: round Y and N cells in the host's colours, empty cells with no glyph, and a
  smaller cell size. The Settings tab has a Cells section to change glyphs, words, tooltips, colours
  and size, with a live preview.
- A "Short labels" preset that uses the headings R A APV M ACK in two host-named groups (Permissions:
  Read, Author, Approve; Obligations: Manage, Acknowledge) and the built-in Everyone subject, and a
  Heading labels switch (auto, full, short).
  The preset also runs on the ordered model (the rule set names the model `demo-ordered`): the
  simulator evaluates with it, the root seat (the Role "Root (site seat)", added as an extra
  membership) always has Read, Author, Manage and Approve whatever a row says, even a row that
  names root (the simulator then names that row as set aside), but not Acknowledge,
  and the IT category has an owner who approves through the owner list. The simulator explains each
  of those reasons.
- An Editor start switch in the Editor tab: editable (default) or read-only (starts read-only; Edit, Save and
  Cancel). The read-only start is opt-in.
- A Cell variant switch in the Editor tab: box (default), marks (a check, an X or nothing) and custom
  (a sample host cell, exported as `demoRenderCell`).
- Two presets that differ in actions, subject kinds, tree and strings, to show nothing is hard-coded.
- The rule set as JSON: copy, download, upload with validation, and reset to the sample.
- A light, dark and system theme switch, and a "Brand override" toggle that only changes tokens.

## Sample data

```ts
import { demoPresets, demoRuleSet } from "node-raci-editor/demo";

const presets = demoPresets(); // [{ id, label, config, seed, initialCategory }, ...]
const seed = demoRuleSet("org"); // a fresh RuleSet you can change freely
```

`demoPresets()` returns the two presets (`org` and `other`). Each has a `RaciConfig`, a seed
`RuleSet` and the category shown first. The array and the seeds are new on every call; the configs
are shared and should be treated as read-only. `demoRuleSet(id)` returns one seed, the first preset
when the id is omitted or unknown. The subject search is in memory with a short delay, to imitate a
directory call.

## The packaged static demo

The tarball also contains the built demo page, and a command that serves it with Node's standard
library only:

```bash
npx raci-editor-demo                       # http://127.0.0.1:5179/
npx raci-editor-demo --port 8080 --host 0.0.0.0
```

It prints the URL and never opens a browser. In this repository the same page is `npm run demo:dev`
(port 5179) and `npm run demo:build` (writes `dist/demo-site`, which `npm run build` runs for you).
The page is a thin shell that mounts `RaciDemo`; there is one demo code path, in `src/demo/`.

## Package size

The demo is part of the published package, so the package is bigger. Measured with
`npm run build` and `npm pack --dry-run --ignore-scripts`:

| Build                                                   | Files | Unpacked | Packed   |
| ------------------------------------------------------- | ----- | -------- | -------- |
| Before (library and styles only)                        | 10    | 206.9 kB | 40.0 kB  |
| After (`./demo`, `demo.css`, static demo site, the bin) | 23    | 546.0 kB | 136.4 kB |

Where the growth is: the static site is 281 kB unpacked, of which about 190 kB is React and React
DOM bundled into the page (79 kB gzipped; this is the page only, the `./demo` export itself uses your
React). The `./demo` export adds about 19 kB per format and `demo.css` 6 kB. Nothing outside the
`files` allowlist ships: no source, tests or maps.

`config.packMaxUnpackedBytes` was raised from 400000 to 600000 on purpose for this, and then to
650000 when the boxes and strips simulator views and the demo's view switch pushed the package to
604.3 kB unpacked (about 46 kB of headroom). Because the growth is intended, the PR carries the `pack-size-override`
label for `check:pack:growth`.
