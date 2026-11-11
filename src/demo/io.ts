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
import type { RuleSet } from "@/core/types";

export type ThemeChoice = "light" | "dark" | "system";

const THEME_KEY = "raci-demo-theme";

/** Read the saved theme; storage may be blocked, so any failure means "system". */
export const readTheme = (): ThemeChoice => {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
};

export const writeTheme = (theme: ThemeChoice): void => {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
};

export const serializeRuleSet = (ruleSet: RuleSet): string => JSON.stringify(ruleSet, null, 2);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse and validate the wire format. Throws an Error with a readable message. */
export const parseRuleSet = (text: string, actionIds: string[]): RuleSet => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON.");
  }
  if (!isRecord(raw) || !isRecord(raw.categories) || !isRecord(raw.parents)) {
    throw new TypeError('Expected an object with "categories" and "parents".');
  }
  for (const [child, parent] of Object.entries(raw.parents)) {
    if (typeof parent !== "string") throw new TypeError(`Parent of "${child}" must be a string.`);
  }
  for (const [id, cat] of Object.entries(raw.categories)) {
    if (!isRecord(cat) || !Array.isArray(cat.entries)) {
      throw new Error(`Category "${id}" needs an "entries" array.`);
    }
    for (const e of cat.entries as unknown[]) {
      if (
        !isRecord(e) ||
        typeof e.subject !== "string" ||
        !e.subject.includes(":") ||
        (e.effect !== "allow" && e.effect !== "deny") ||
        typeof e.action !== "string"
      ) {
        throw new Error(`Category "${id}" has a malformed entry.`);
      }
      if (!actionIds.includes(e.action)) {
        throw new Error(`Category "${id}" uses unknown action "${e.action}".`);
      }
    }
  }
  return raw as unknown as RuleSet;
};
