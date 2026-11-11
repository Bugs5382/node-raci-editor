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
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The words user, group, role and person are defaults in the string tables only. Code never builds,
// compares or shows them itself, so a host with no people, groups or roles needs nothing removed.
const WORDS = /(^|[^.\w:-])(users?|groups?|roles?|persons?|people)([^.\w:-]|$)/i;
// The string tables and the one module of overridable defaults may hold the words.
const KEEP = new Set(["defaults.ts", "strings.ts"]);

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

describe("no people words in the code", () => {
  const files = walk("src/react").filter(
    (f) => /\.tsx?$/.test(f) && !/\.test\./.test(f) && !KEEP.has(f.split("/").at(-1)!),
  );
  it("scans the React sources", () => {
    expect(files.length).toBeGreaterThan(10);
  });
  it("has the words only in comments and identifiers, never in a string a person can see or code compares", () => {
    const hits: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      source.split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
          const text = m[2] ?? "";
          if (/^[\w.-]+$/.test(text) && text.includes(".")) continue; // string keys such as "simulator.person"
          if (code.includes(`role=${m[1]}${text}${m[1]}`)) continue; // an ARIA role, not a kind of subject
          if (WORDS.test(text)) hits.push(`${file}:${i + 1} ${text}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});
