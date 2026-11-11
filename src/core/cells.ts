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
import type {
  CellColors,
  CellSettings,
  CellShape,
  CellStateId,
  CellStateSettings,
  CellStateStyle,
  Effect,
} from "./types.js";

/** Every cell state, in the order a panel lists them. */
export const CELL_STATE_IDS: readonly CellStateId[] = [
  "allow",
  "deny",
  "none",
  "inheritedAllow",
  "inheritedDeny",
  "included",
];

/** The allowed range of the cell box, in px. The lower ends are smaller than the density defaults. */
export const CELL_SIZE_LIMITS = {
  width: { min: 24, max: 240 },
  height: { min: 16, max: 120 },
} as const;

/** The state a cell is drawn in. An inherited empty cell is `none`. */
export const cellStateId = (
  effect: Effect | undefined,
  inherited: boolean,
  included: boolean,
): CellStateId => {
  if (inherited)
    return effect === "allow" ? "inheritedAllow" : effect === "deny" ? "inheritedDeny" : "none";
  if (effect === "allow") return "allow";
  if (effect === "deny") return "deny";
  return included ? "included" : "none";
};

/** One thing `normalizeCells` dropped. */
export interface CellIssue {
  /** JSON-pointer-like path into the input, for example `states/allow/colors/fg`. */
  path: string;
  message: string;
}

const MAX = { glyph: 4, text: 24, label: 24, tooltip: 80 } as const;
const COLOR =
  /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[\d\s.,%/-]+\)|var\(--[\w-]+\)|[a-zA-Z]{3,20})$/;
const RADIUS = /^\d{1,3}(px|rem|%)?$/;
const WIDTH = /^[0-4](px)?$/;
const STYLES = ["solid", "dashed", "dotted", "none"] as const;
const CLASS = /^[A-Za-z0-9_\- ]{1,60}$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Check cell settings from anywhere (a user's input, a stored value) and return only what is valid,
 * plus a list of what was dropped. Pure; the result is safe to emit and to store, and normalizing it
 * again changes nothing.
 */
export const normalizeCells = (input: unknown): { value: CellSettings; issues: CellIssue[] } => {
  const issues: CellIssue[] = [];
  const value: CellSettings = {};
  const drop = (path: string, message: string) => issues.push({ path, message });
  if (!isObject(input)) return { value, issues };

  if (input.size !== undefined && isObject(input.size)) {
    const { width, height } = input.size;
    const ok = (n: unknown, key: "width" | "height"): n is number => {
      const lim = CELL_SIZE_LIMITS[key];
      const good =
        typeof n === "number" &&
        Number.isFinite(n) &&
        Math.round(n) >= lim.min &&
        Math.round(n) <= lim.max;
      if (!good) drop(`size/${key}`, `The ${key} must be a number from ${lim.min} to ${lim.max}.`);
      return good;
    };
    const w = ok(width, "width");
    const h = ok(height, "height");
    if (w && h)
      value.size = { width: Math.round(width as number), height: Math.round(height as number) };
  }

  if (isObject(input.states)) {
    const states: Partial<Record<CellStateId, CellStateSettings>> = {};
    for (const [id, raw] of Object.entries(input.states)) {
      if (!(CELL_STATE_IDS as readonly string[]).includes(id)) {
        drop(`states/${id}`, `"${id}" is not a cell state.`);
        continue;
      }
      if (!isObject(raw)) continue;
      const at = `states/${id}`;
      const out: CellStateSettings = {};
      for (const key of ["glyph", "text", "label", "tooltip"] as const) {
        const v = raw[key];
        if (v === undefined) continue;
        if (typeof v === "string" && Array.from(v).length <= MAX[key]) out[key] = v;
        else drop(`${at}/${key}`, `The ${key} must be text of at most ${MAX[key]} characters.`);
      }
      if (isObject(raw.colors)) {
        const colors: CellColors = {};
        for (const key of ["fg", "bg", "border"] as const) {
          const v = raw.colors[key];
          if (v === undefined) continue;
          if (typeof v === "string" && COLOR.test(v.trim())) colors[key] = v.trim();
          else drop(`${at}/colors/${key}`, "That is not a colour the cell can use.");
        }
        if (Object.keys(colors).length > 0) out.colors = colors;
      }
      if (isObject(raw.shape)) {
        const shape: CellShape = {};
        const { radius, borderStyle, borderWidth } = raw.shape;
        if (radius !== undefined) {
          if (typeof radius === "string" && RADIUS.test(radius)) shape.radius = radius;
          else drop(`${at}/shape/radius`, "The radius must be a number with px, rem or %.");
        }
        if (borderStyle !== undefined) {
          if (
            typeof borderStyle === "string" &&
            (STYLES as readonly string[]).includes(borderStyle)
          ) {
            shape.borderStyle = borderStyle as CellShape["borderStyle"];
          } else
            drop(
              `${at}/shape/borderStyle`,
              "The border style must be solid, dashed, dotted or none.",
            );
        }
        if (borderWidth !== undefined) {
          if (typeof borderWidth === "string" && WIDTH.test(borderWidth))
            shape.borderWidth = borderWidth;
          else drop(`${at}/shape/borderWidth`, "The border width must be 0 to 4 px.");
        }
        if (Object.keys(shape).length > 0) out.shape = shape;
      }
      if (raw.className !== undefined) {
        if (typeof raw.className === "string" && CLASS.test(raw.className))
          out.className = raw.className;
        else
          drop(
            `${at}/className`,
            "The class may hold letters, digits, dashes, underscores and spaces.",
          );
      }
      if (Object.keys(out).length > 0) states[id as CellStateId] = out;
    }
    if (Object.keys(states).length > 0) value.states = states;
  }
  return { value, issues };
};

/** The style of one state: the host's `cellStates` entry with the user's settings laid over it, field by field. */
export const resolveCellStyle = (
  state: CellStateId,
  config: Partial<Record<CellStateId, CellStateStyle>> | undefined,
  settings: CellSettings | undefined,
): CellStateStyle => {
  const base = config?.[state];
  const mine = settings?.states?.[state];
  const out: CellStateStyle = { ...base };
  if (mine) {
    for (const key of ["glyph", "text", "label", "tooltip", "className"] as const) {
      if (mine[key] !== undefined) out[key] = mine[key] as never;
    }
    if (mine.colors) out.colors = { ...base?.colors, ...mine.colors };
    if (mine.shape) out.shape = { ...base?.shape, ...mine.shape };
  }
  return out;
};
