# node-raci-editor

## Unreleased

### What Changed 👀

#### Bug Fixes

- fix(core): remove `RaciSettings.defaultStopInheriting`; the editor shows the same `stopInheriting` flag the engine reads (#4)
- fix(react): the settings panel Up and Down captions come from `settings.moveUp` and `settings.moveDown`, so `config.strings` overrides them (#4)
- fix(react): `Simulator` takes an optional `personKind` (default `user`) for the person picker, which is offered even when the settings leave that kind out (#5)

#### 📄 Documentation

- docs(guides): usage, configuration and theming docs, with the README quick start and the shared vector runner checked by a test (#8)
