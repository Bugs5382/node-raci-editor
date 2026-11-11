# Theming

The package ships a neutral look built entirely from CSS custom properties
(design tokens). Every token is prefixed `--raci-`, has a light and a dark
value, and can be overridden by the host app. Components use only these
tokens; they never hard-code a colour, size or font.

The tokens live in `src/styles/tokens.css` and ship inside the single stylesheet the package
exports. Import it once in the host app:

```ts
import "node-raci-editor/styles.css";
```

Render the components inside an element with the `raci-root` class (the
components add it to their own root, so a host rarely needs to).

## How themes are chosen

- Light is the default.
- Dark applies automatically when the system prefers it
  (`prefers-color-scheme: dark`), unless `data-theme="light"` is set on the
  root or on any ancestor.
- `data-theme="dark"` forces dark regardless of the system. Set it on a
  `.raci-root` or on any ancestor (`<body>`, a host app wrapper), because
  every component renders its own `.raci-root`.
- The nearest explicit `data-theme` wins: a `.raci-root[data-theme="light"]`
  inside a `data-theme="dark"` ancestor is light. (A light ancestor nested
  inside a dark ancestor is not resolved by nearness; set the attribute on the
  `.raci-root` itself in that case.)
- `prefers-reduced-motion: reduce` sets `--raci-duration` to `0ms`.

All theme rules use `:where(...)`, which has zero specificity, so any host
rule that targets `.raci-root` wins without `!important`. The `:not()` with a
selector list used for the system-dark rule needs a current browser
(Chrome/Edge 88+, Firefox 84+, Safari 9+).

## Tokens

Dark column shows the value when it differs from light; a dash means the same.

### Surface

| Token                  | Meaning                      | Light     | Dark      |
| ---------------------- | ---------------------------- | --------- | --------- |
| `--raci-bg`            | Page / editor background     | `#ffffff` | `#0b1120` |
| `--raci-bg-subtle`     | Table headers, striped rows  | `#f8fafc` | `#111827` |
| `--raci-bg-raised`     | Cards, popovers, dialogs     | `#ffffff` | `#1e293b` |
| `--raci-border`        | Hairlines and dividers       | `#cbd5e1` | `#334155` |
| `--raci-border-strong` | Control outlines (3:1 on bg) | `#64748b` | `#94a3b8` |

### Text

| Token                   | Meaning                | Light     | Dark      |
| ----------------------- | ---------------------- | --------- | --------- |
| `--raci-text`           | Primary text           | `#0f172a` | `#f1f5f9` |
| `--raci-text-muted`     | Secondary text, hints  | `#475569` | `#a8b5c8` |
| `--raci-text-on-accent` | Text on an accent fill | `#ffffff` | `#0b1120` |

### Accent

| Token                 | Meaning                | Light     | Dark      |
| --------------------- | ---------------------- | --------- | --------- |
| `--raci-accent`       | Primary actions, links | `#1d4ed8` | `#60a5fa` |
| `--raci-accent-hover` | Accent hover / pressed | `#1e40af` | `#93c5fd` |
| `--raci-focus-ring`   | Keyboard focus outline | `#1d4ed8` | `#93c5fd` |

### Semantic states

Each state has `-bg`, `-fg` and `-border`. Foreground on background meets
WCAG AA (4.5:1) in both themes. Components pair colour with an icon or label;
colour is never the only signal.

| State   | Meaning             | Light bg / fg / border            | Dark bg / fg / border             |
| ------- | ------------------- | --------------------------------- | --------------------------------- |
| allow   | Access granted      | `#dcfce7` / `#14532d` / `#16a34a` | `#052e16` / `#bbf7d0` / `#22c55e` |
| deny    | Access denied       | `#fee2e2` / `#7f1d1d` / `#dc2626` | `#450a0a` / `#fecaca` / `#f87171` |
| blank   | No rule set         | `#f1f5f9` / `#475569` / `#94a3b8` | `#1e293b` / `#cbd5e1` / `#64748b` |
| warning | Needs attention     | `#fef3c7` / `#78350f` / `#d97706` | `#451a03` / `#fde68a` / `#f59e0b` |
| info    | Neutral information | `#dbeafe` / `#1e3a8a` / `#2563eb` | `#172554` / `#bfdbfe` / `#60a5fa` |

Token names follow the pattern `--raci-allow-bg`, `--raci-deny-fg`,
`--raci-warning-border`, and so on.

### Spacing

| Token            | Default    |
| ---------------- | ---------- |
| `--raci-space-1` | `0.125rem` |
| `--raci-space-2` | `0.25rem`  |
| `--raci-space-3` | `0.5rem`   |
| `--raci-space-4` | `0.75rem`  |
| `--raci-space-5` | `1rem`     |
| `--raci-space-6` | `1.5rem`   |
| `--raci-space-7` | `2rem`     |
| `--raci-space-8` | `3rem`     |

### Radius

| Token                | Default   |
| -------------------- | --------- |
| `--raci-radius-sm`   | `0.25rem` |
| `--raci-radius-md`   | `0.5rem`  |
| `--raci-radius-lg`   | `0.75rem` |
| `--raci-radius-pill` | `999px`   |

### Type

| Token                         | Default         |
| ----------------------------- | --------------- |
| `--raci-font-family`          | system UI stack |
| `--raci-font-size-xs`         | `0.75rem`       |
| `--raci-font-size-sm`         | `0.875rem`      |
| `--raci-font-size-md`         | `1rem`          |
| `--raci-font-size-lg`         | `1.125rem`      |
| `--raci-font-size-xl`         | `1.5rem`        |
| `--raci-font-weight-regular`  | `400`           |
| `--raci-font-weight-medium`   | `500`           |
| `--raci-font-weight-semibold` | `600`           |
| `--raci-font-weight-bold`     | `700`           |
| `--raci-line-height`          | `1.5`           |

### Shadow, motion, stacking, controls

| Token                   | Meaning                                     | Light default                    | Dark default                 |
| ----------------------- | ------------------------------------------- | -------------------------------- | ---------------------------- |
| `--raci-shadow-sm`      | Small elevation                             | `0 1px 2px rgb(15 23 42 / .08)`  | `0 1px 2px rgb(0 0 0 / .5)`  |
| `--raci-shadow-md`      | Popovers, dialogs                           | `0 4px 12px rgb(15 23 42 / .12)` | `0 4px 12px rgb(0 0 0 / .6)` |
| `--raci-duration`       | Transition duration (0 when reduced motion) | `150ms`                          | -                            |
| `--raci-easing`         | Transition easing                           | `cubic-bezier(0.2, 0, 0, 1)`     | -                            |
| `--raci-z-dropdown`     | Dropdown layer                              | `1000`                           | -                            |
| `--raci-z-sticky`       | Sticky header layer                         | `1100`                           | -                            |
| `--raci-z-modal`        | Modal layer                                 | `1200`                           | -                            |
| `--raci-z-toast`        | Toast layer                                 | `1300`                           | -                            |
| `--raci-control-height` | Height of buttons and inputs                | `2.25rem`                        | -                            |

## Overriding

Every `.raci-root` re-declares all tokens, so a token set on an ancestor
(`body`, `.my-app`, `:root`) is shadowed and has no effect on the components.
Override tokens on `.raci-root` itself, with any selector that has specificity
(the shipped rules have none, so even `.raci-root { ... }` wins regardless of
load order). Scope it with an ancestor class to limit it to part of the page.

Brand override. Because it also beats the shipped dark values, a dark accent
needs its own rule (below):

```css
.my-app .raci-root {
  --raci-accent: #0f766e;
  --raci-accent-hover: #115e59;
  --raci-focus-ring: #0f766e;
  --raci-font-family: "Inter", system-ui, sans-serif;
  --raci-radius-md: 0.25rem;
}
```

To brand dark separately, cover both ways dark can apply (the attribute on
the root or an ancestor, and the system preference):

```css
.my-app .raci-root[data-theme="dark"],
.my-app[data-theme="dark"] .raci-root {
  --raci-accent: #5eead4;
  --raci-text-on-accent: #042f2e;
}

@media (prefers-color-scheme: dark) {
  .my-app .raci-root:not([data-theme="light"], [data-theme="light"] .raci-root) {
    --raci-accent: #5eead4;
    --raci-text-on-accent: #042f2e;
  }
}
```

Force dark (or light) regardless of the system setting, from an ancestor:

```html
<div class="my-app" data-theme="dark">
  <!-- every component inside renders dark -->
</div>
```

or on a root directly: `<div class="raci-root" data-theme="dark">...</div>`.
Remove the attribute to follow the system preference again.

If you override a foreground or background, keep the pairs at WCAG AA: 4.5:1
for text, 3:1 for the focus ring and strong borders. The package test
`src/styles/tokens.test.ts` checks the shipped defaults in both themes.
