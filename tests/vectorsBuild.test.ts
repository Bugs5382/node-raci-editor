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
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error a plain script with no declarations
import { SHIPPED, buildVectors } from "../scripts/buildVectors.mjs";

const source = path.resolve("vectors");
const out = mkdtempSync(path.join(tmpdir(), "raci-vectors-"));
afterAll(() => rmSync(out, { recursive: true, force: true }));

describe("shipped vector files", () => {
  const files: string[] = buildVectors(source, out);

  it("ships the nearest and ordered files only", () => {
    expect(SHIPPED).toEqual(["nearest.json", "ordered.json"]);
    expect(files.map((f) => path.basename(f))).toEqual(SHIPPED);
  });

  it.each(SHIPPED as string[])("%s parses to the same data as its source", (name) => {
    const shipped = JSON.parse(readFileSync(path.join(out, name), "utf8"));
    const original = JSON.parse(readFileSync(path.join(source, name), "utf8"));
    expect(shipped).toEqual(original);
    expect(statSync(path.join(out, name)).size).toBeLessThan(
      statSync(path.join(source, name)).size,
    );
  });

  it("keeps the alias equal to nearest, so the export can point at it", () => {
    const alias = JSON.parse(readFileSync(path.join(source, "decide.json"), "utf8"));
    const nearest = JSON.parse(readFileSync(path.join(out, "nearest.json"), "utf8"));
    expect(alias.cases).toEqual(nearest.cases);
  });
});
