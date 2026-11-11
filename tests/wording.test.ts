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
/**
 * The package shows and edits access rules; the host enforces them. User-visible text, docs and
 * TSDoc must use show and preview language, never claim the package enforces anything.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { simulatorStrings } from "@/react/simulator/strings";

const root = process.cwd();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const sourceFiles = walk(join(root, "src")).filter(
  (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f),
);
const docFiles = [
  "README.md",
  "AGENTS.md",
  "package.json",
  "vectors/README.md",
  "demo/index.html",
  "bin/raci-editor-demo.mjs",
  ...walk(join(root, "guides")).map((f) => relative(root, f)),
].map((f) => join(root, f));

/** Legitimate uses, removed before scanning. */
const allowed: RegExp[] = [
  /the host enforces/gi,
  /host enforces/gi,
  /your enforcement/gi,
  /the host's enforcement/gi,
  /hook-enforced/gi,
  /enforced by the git hooks/gi,
  /code block/gi,
  /owners block/gi,
  /(?:can|may) be blocked/gi,
  /does not enforce/gi,
  /doesn't enforce/gi,
  /\bSecurity\b/g,
  /"security"/g,
];

const denied: [string, RegExp][] = [
  ["enforce", /\benforc\w*/i],
  ["block", /\bblock(?:s|ed|ing)?\b/i],
  ["grant", /\bgrant(?:s|ed|ing)?\b/i],
  ["authoriz", /\bauthori[sz]\w*/i],
  ["go-authz", /go-authz/i],
  ["access control", /access[- ]control/i],
  ["protect", /\bprotect(?:s|ed|ing)?\b/i],
  ["secure", /\bsecur(?:e|es|ed|ing|ity)\b/i],
  ["prevent", /\bprevent(?:s|ed|ing)?\b/i],
  ["permits", /\bpermits\b/i],
  ["what they can do", /\bwhat (?:they|she|he|this person|the person) (?:can|may) do\b/i],
  ["the user can", /\bthe (?:user|person) (?:can|cannot|may) (?:not )?\w+/i],
];

const hits = (file: string): string[] => {
  const out: string[] = [];
  // The licence header the build stamps on source files is legal text, not package wording.
  const text = readFileSync(file, "utf8").replace(/^(#![^\n]*\n)?\/\*\n[\s\S]*?\*\/\n/, (m) =>
    m.replace(/[^\n]/g, ""),
  );
  text.split("\n").forEach((line, i) => {
    let rest = line;
    for (const a of allowed) rest = rest.replace(a, "");
    for (const [name, re] of denied) {
      if (re.test(rest)) out.push(`${relative(root, file)}:${i + 1} [${name}] ${line.trim()}`);
    }
  });
  return out;
};

describe("wording: the package shows, the host enforces", () => {
  it("source strings, TSDoc and demo text avoid enforcement language", () => {
    expect(sourceFiles.flatMap(hits)).toEqual([]);
  });

  it("docs, guides and metadata avoid enforcement language", () => {
    expect(docFiles.flatMap(hits)).toEqual([]);
  });

  it("the simulator reads as a preview of what the rules would allow", () => {
    expect(simulatorStrings["simulator.title"]).toMatch(/would allow/i);
    expect(simulatorStrings["simulator.allowed"]).toBe("Would be allowed");
    expect(simulatorStrings["simulator.denied"]).toBe("Would be denied");
  });

  it("the README and configuration guide say subjects are whatever kinds the app has", () => {
    for (const file of ["README.md", "guides/configuration.md"]) {
      const text = readFileSync(join(root, file), "utf8");
      expect(text).toContain(
        "Subjects are whatever kinds your app has (user, group, role, team, department, service account, ...); the package assumes none of them.",
      );
    }
  });

  it("the README says the host enforces and decide() is a helper the host may call", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    expect(readme).toMatch(/the host enforces/i);
    expect(readme).toMatch(/decide\(\)[^.]*host may call/i);
  });
});
