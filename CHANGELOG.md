# node-raci-editor

## Unreleased

### What Changed 👀

#### Features

- feat(demo): `node-raci-editor/demo` exports `RaciDemo` (a ready-to-render demo with both presets, tabs, JSON view, theme switch and brand override), `demoPresets` and `demoRuleSet`; `node-raci-editor/demo.css` is its stylesheet (#9)
- feat(demo): the built demo page ships in the package as `dist/demo-site`, served by the new `raci-editor-demo` command (Node standard library only, port 5179 by default); the Vite app in `demo/` now only mounts `RaciDemo` (#9)
- chore(repo): `config.packMaxUnpackedBytes` raised from 400000 to 650000 for the demo and the extra simulator views (206.9 kB to about 604 kB unpacked; see guides/demo.md) (#9)
- feat(simulator): `variant` ("list" default, "boxes", "strips"), `renderResults`, `evaluate` and `show` (`memberships`) props, new strings under `simulator.box.*`, `simulator.strip.*` and `simulator.loading`, `simulator.error`, `simulator.retry`; the default list view is unchanged (#11)
- feat(simulator)!: remove the built-in category menu and `onCategoryChange`; the host passes `categoryId`, and without it the simulator shows the empty-category state (#11)
- feat(core): `decide(input, { trace: true })` adds a per-category `trace`; verdicts are identical with and without it (#11)

#### Bug Fixes

- fix(core): remove `RaciSettings.defaultStopInheriting`; the editor shows the same `stopInheriting` flag the engine reads (#4)
- fix(react): the settings panel Up and Down captions come from `settings.moveUp` and `settings.moveDown`, so `config.strings` overrides them (#4)
- fix(react): `Simulator` takes an optional `personKind` (default `user`) for the person picker, which is offered even when the settings leave that kind out (#5)
- fix(react): `RulesEditor` keeps subjects added without a cell per category, drops the unused `toggleStopInheriting` helper and shows a heading with the category path, `editor.title` "Rules for {category}" (#6)

#### 📄 Documentation

- docs(guides): usage, configuration and theming docs, with the README quick start and the shared vector runner checked by a test (#8)
