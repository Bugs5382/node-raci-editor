# Architecture (contract for contributors)

- `src/core/` pure TypeScript, no React: `types.ts` (the contract), `decide.ts`, vectors loader.
- `vectors/decide.json` shared test vectors, also run by Go and the mock. Do not make it package-specific.
- `src/react/` the drop-in components. They are controlled: the host owns the `RuleSet` and gets `onChange`.
  - `RulesEditor` props: `config: RaciConfig`, `ruleSet: RuleSet`, `categoryId: string`, `onChange(ruleSet)`, `readOnly?`.
  - `Simulator` props: `config`, `ruleSet`, `categoryId?`, `resolvePerson?(query)`.
  - `SettingsPanel` props: `config`, `value: RaciSettings`, `onChange`.
- `src/styles/tokens.css` CSS custom properties `--raci-*`, light and dark; components use only tokens.
- `demo/` Vite app; `guides/` documentation.
- No product names or brand anywhere. Exports go through `src/index.ts`.
