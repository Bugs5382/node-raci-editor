/*
MIT License

Copyright (c) 2026 Shane

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

type Tokens = Record<string, string>;
interface Block {
  media: string;
  selector: string;
  decls: Tokens;
}

/** Minimal parser: top-level rules and one level of at-rule nesting. */
const parse = (src: string): Block[] => {
  const out: Block[] = [];
  const walk = (text: string, media: string): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open < 0) break;
      const selector = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (depth > 0 && j < text.length) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (selector.startsWith("@")) {
        walk(body, selector);
      } else {
        const decls: Tokens = {};
        for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
          decls[m[1] as string] = (m[2] as string).trim();
        }
        out.push({ media, selector, decls });
      }
      i = j;
    }
  };
  walk(src, "");
  return out;
};

const blocks = parse(css);

const MEDIA_SEL = ':where(.raci-root:not([data-theme="light"], [data-theme="light"] .raci-root))';
const DARK_SEL = ':where(.raci-root[data-theme="dark"], [data-theme="dark"] .raci-root)';
const LIGHT_SEL = ':where(.raci-root[data-theme="light"])';
const find = (media: string, selector: string): Block => {
  const b = blocks.find((x) => x.media === media && x.selector === selector);
  if (!b) throw new Error(`missing block: ${media} ${selector}`);
  return b;
};

const light = find("", ":where(.raci-root)").decls;
const darkMedia = find("@media (prefers-color-scheme: dark)", MEDIA_SEL).decls;
const darkAttr = find("", DARK_SEL).decls;
const lightAttr = find("", LIGHT_SEL).decls;
const reduced = find("@media (prefers-reduced-motion: reduce)", ":where(.raci-root)").decls;

const resolve = (tokens: Tokens, name: string, seen = new Set<string>()): string => {
  if (seen.has(name)) throw new Error(`cycle at ${name}`);
  seen.add(name);
  const v = tokens[name];
  if (v === undefined) throw new Error(`undefined token ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? resolve(tokens, ref[1] as string, seen) : v;
};

const themes: Record<string, Tokens> = {
  light,
  "dark (media)": { ...light, ...darkMedia },
  "dark (attribute)": { ...light, ...darkAttr },
  "light (attribute over dark)": { ...light, ...darkAttr, ...lightAttr },
};

const luminance = (hex: string): number => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((k) => {
    const c = parseInt((m[1] as string).slice(k, k + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi as number) + 0.05) / ((lo as number) + 0.05);
};

/** [foreground, background, minimum ratio] */
const pairs: Array<[string, string, number]> = [
  ["text", "bg", 4.5],
  ["text", "bg-subtle", 4.5],
  ["text", "bg-raised", 4.5],
  ["text-muted", "bg", 4.5],
  ["text-muted", "bg-subtle", 4.5],
  ["text-muted", "bg-raised", 4.5],
  ["allow-fg", "allow-bg", 4.5],
  ["deny-fg", "deny-bg", 4.5],
  ["blank-fg", "blank-bg", 4.5],
  ["warning-fg", "warning-bg", 4.5],
  ["info-fg", "info-bg", 4.5],
  ["text-on-accent", "accent", 4.5],
  ["text-on-accent", "accent-hover", 4.5],
  ["accent", "bg", 4.5],
  ["focus-ring", "bg", 3],
  ["focus-ring", "bg-subtle", 3],
  ["focus-ring", "bg-raised", 3],
  ["border-strong", "bg", 3],
];

describe("token contrast (WCAG AA)", () => {
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const [fg, bg, min] of pairs) {
      it(`${theme}: ${fg} on ${bg} >= ${min}:1`, () => {
        const ratio = contrast(resolve(tokens, `--raci-${fg}`), resolve(tokens, `--raci-${bg}`));
        expect(ratio).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

describe("token coverage", () => {
  it("prefixes every custom property with --raci-", () => {
    for (const b of blocks) {
      for (const name of Object.keys(b.decls)) {
        expect(name.startsWith("--raci-")).toBe(true);
      }
    }
  });

  it("dark overrides only tokens that exist in light", () => {
    for (const name of [...Object.keys(darkMedia), ...Object.keys(darkAttr)]) {
      expect(light).toHaveProperty([name]);
    }
  });

  it("media and attribute dark blocks are identical", () => {
    expect(darkAttr).toEqual(darkMedia);
  });

  it("every light token resolves in dark (defined or inherited)", () => {
    for (const [theme, tokens] of Object.entries(themes)) {
      for (const name of Object.keys(light)) {
        expect(() => resolve(tokens, name), `${theme} ${name}`).not.toThrow();
      }
    }
  });

  it("redefines every colour and shadow token in dark", () => {
    const themed = Object.keys(light).filter((n) =>
      /^--raci-(bg|border|text|accent|focus|allow|deny|blank|warning|info|shadow)/.test(n),
    );
    expect(themed.length).toBeGreaterThan(20);
    for (const name of themed) {
      expect(darkMedia, name).toHaveProperty([name]);
    }
  });

  it("defines the required groups", () => {
    const need = [
      "space-1",
      "space-8",
      "radius-sm",
      "radius-md",
      "radius-lg",
      "radius-pill",
      "font-family",
      "font-size-xs",
      "font-size-xl",
      "font-weight-regular",
      "font-weight-semibold",
      "line-height",
      "shadow-sm",
      "shadow-md",
      "duration",
      "easing",
      "z-dropdown",
      "z-modal",
      "control-height",
    ];
    for (const n of need) expect(light).toHaveProperty([`--raci-${n}`]);
  });

  it("honours data-theme on an ancestor as well as on the root", () => {
    expect(DARK_SEL).toContain('[data-theme="dark"] .raci-root');
    expect(MEDIA_SEL).toContain('[data-theme="light"] .raci-root');
    expect(blocks.find((b) => b.selector === DARK_SEL)).toBeDefined();
  });

  it("keeps every theme selector at zero specificity", () => {
    for (const b of blocks) expect(b.selector.startsWith(":where("), b.selector).toBe(true);
  });

  it("light attribute rule repeats the light values", () => {
    const darkNames = Object.keys(darkAttr);
    expect(Object.keys(lightAttr).sort()).toEqual(darkNames.sort());
    for (const name of darkNames) expect(lightAttr[name], name).toBe(light[name]);
  });

  it("orders light attribute last so the nearest explicit theme wins", () => {
    const at = (sel: string): number => blocks.findIndex((b) => b.selector === sel);
    expect(at(LIGHT_SEL)).toBeGreaterThan(at(DARK_SEL));
    expect(at(LIGHT_SEL)).toBeGreaterThan(at(MEDIA_SEL));
    expect(at(LIGHT_SEL)).toBe(blocks.length - 2); // only the reduced-motion block follows
  });

  it("reduced motion zeroes the duration", () => {
    expect(reduced["--raci-duration"]).toBe("0ms");
  });

  it("mentions no product brand", () => {
    expect(css.toLowerCase()).not.toMatch(/steward|brigade|vitals/);
  });
});
