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
// Writes the shipped vector files to dist/vectors, minified, from the readable copies in
// vectors/. `decide.json` is only an alias of `nearest.json` in the repository and is not
// shipped; the `./vectors/decide.json` export points at the nearest file.
//
//   npm run build   (runs tsdown, then this script)
import console from "node:console";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** The vector files that are shipped. */
export const SHIPPED = ["nearest.json", "ordered.json"];

/** Minify each shipped vector file from `source` into `output`; returns the files written. */
export const buildVectors = (source, output) => {
  mkdirSync(output, { recursive: true });
  return SHIPPED.map((name) => {
    const text = JSON.stringify(JSON.parse(readFileSync(path.join(source, name), "utf8")));
    const file = path.join(output, name);
    writeFileSync(file, `${text}\n`);
    console.log(`buildVectors: wrote ${path.relative(process.cwd(), file)} (${text.length} bytes)`);
    return file;
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildVectors(path.resolve("vectors"), path.resolve("dist/vectors"));
}
