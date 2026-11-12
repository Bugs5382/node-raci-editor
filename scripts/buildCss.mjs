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
// Builds dist/styles.css from src/styles/index.css by inlining its relative
// `@import "./file.css";` lines, in order. No dependencies: the stylesheet is
// plain CSS with custom properties, so nothing else needs to run over it.
//
//   npm run build   (runs tsdown, then this script)
import console from "node:console";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// Each stylesheet the package exports: the library.
const builds = [{ entry: "src/styles/index.css", output: "dist/styles.css" }];
const IMPORT = /^\s*@import\s+(?:url\()?["']([^"']+)["']\)?\s*;\s*$/gm;

const inline = (file, seen) => {
  if (seen.includes(file)) {
    throw new Error(`circular @import: ${[...seen, file].join(" -> ")}`);
  }
  const source = readFileSync(file, "utf8");
  return source.replace(IMPORT, (_line, target) => {
    if (!target.startsWith(".")) {
      throw new Error(`${file}: only relative @import is supported, got "${target}"`);
    }
    return inline(path.resolve(path.dirname(file), target), [...seen, file]);
  });
};

for (const build of builds) {
  const output = path.resolve(build.output);
  const css = inline(path.resolve(build.entry), []);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, css.endsWith("\n") ? css : `${css}\n`);
  console.log(`buildCss: wrote ${path.relative(process.cwd(), output)} (${css.length} bytes)`);
}
