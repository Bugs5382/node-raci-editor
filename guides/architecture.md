# Architecture (contract for contributors)

- `src/core/` pure TypeScript, no React: `types.ts` (the contract), `decide.ts`, vectors loader.
- `vectors/decide.json` shared test vectors, also run by Go and the mock. Do not make it package-specific.
- `src/react/` the drop-in components. They are controlled: the host owns the `RuleSet` and gets `onChange`.
  - `RulesEditor` props: `config: RaciConfig`, `ruleSet: RuleSet`, `categoryId: string`, `onChange(ruleSet)`, `settings?`, `readOnly?`, `className?`.
  - `Simulator` props: `config`, `ruleSet`, `categoryId?`, `personKind?` (default `"user"` when the config has that kind, else its first kind), `settings?`, `className?`. The person is picked inside the component from the `personKind` subject kind; memberships come from the other enabled kinds.
  - `SettingsPanel` props: `config`, `value: RaciSettings`, `onChange`, `className?`.
- `src/styles/tokens.css` CSS custom properties `--raci-*`, light and dark; components use only tokens.
- `src/demo/` the `RaciDemo` component and sample data (the `node-raci-editor/demo` export, with `demo.css`); `demo/` is a Vite shell that only mounts it; `guides/` documentation.
- No product names or brand anywhere. Exports go through `src/index.ts`.
- The code shown in `README.md` and `guides/` is run by `tests/docs-snippets.test.tsx`; change a snippet there and in the doc together.

See [Components](components.md) for the full props.
