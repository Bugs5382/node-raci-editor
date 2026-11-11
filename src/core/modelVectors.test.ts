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
import { describe, expect, it } from "vitest";
import { actionPool } from "./pools.js";
import { createOrderedModel } from "./models/ordered.js";
import { getModel } from "./registry.js";
import { vectorSubjects } from "./vectors.js";
import type { VectorFile } from "./vectors.js";

const dir = new URL("../../vectors/", import.meta.url);
const read = (name: string): VectorFile =>
  JSON.parse(readFileSync(new URL(name, dir), "utf8")) as VectorFile;
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("vector files per model", () => {
  it("has a nearest file and the decide.json alias", () => {
    expect(files).toContain("nearest.json");
    expect(files).toContain("decide.json");
  });

  it("keeps decide.json and nearest.json on identical cases", () => {
    const alias = read("decide.json");
    const named = read("nearest.json");
    expect(named.cases).toEqual(alias.cases);
    expect(named.actions).toEqual(alias.actions);
    expect(named.version).toBe(alias.version);
    expect(named.model).toBe("nearest");
  });

  for (const name of files) {
    const file = read(name);
    const id = file.model ?? "nearest";
    describe(name, () => {
      it("declares a registered model and a version", () => {
        expect(file.version).toBe(1);
        expect(getModel(id).id).toBe(id);
      });

      for (const pool of file.pools ?? []) {
        it(pool.name, () => {
          expect(
            actionPool({
              ruleSet: pool.ruleSet,
              actions: file.actions,
              category: pool.category,
              people: pool.people,
              action: pool.action,
              model: id,
            }),
          ).toEqual(pool.expect);
        });
      }

      for (const tc of file.cases) {
        it(tc.name, () => {
          const model = file.options
            ? createOrderedModel({ ...file.options, id: `${id}-vectors` })
            : getModel(id);
          const { decision } = model.evaluate({
            ruleSet: tc.ruleSet,
            actions: file.actions,
            person: { subjects: vectorSubjects(tc.person) },
            category: tc.category,
            action: tc.action,
          });
          expect(decision.allowed).toBe(tc.expect.allowed);
          expect(decision.reason).toBe(tc.expect.reason);
          expect(decision.gatedBy).toBe(tc.expect.gatedBy);
          if (tc.expect.decidedBy === null) {
            expect(decision.decidedBy).toBeUndefined();
          } else {
            const { category, subject, action, effect } = tc.expect.decidedBy;
            expect(decision.decidedBy).toEqual({ category, entry: { subject, action, effect } });
          }
        });
      }
    });
  }
});
