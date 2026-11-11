# node-raci-editor

## Unreleased

### What Changed 👀

#### Features

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
