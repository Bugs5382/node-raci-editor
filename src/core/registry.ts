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
import type { RaciModel } from "./model.js";
import { nearest } from "./models/nearest.js";

/** The model used when neither the call nor the rule set names one. */
export const DEFAULT_MODEL_ID = "nearest";

const models = new Map<string, RaciModel>([[nearest.id, nearest]]);

/** Register a model by id. Throws on a duplicate id; built-in models cannot be replaced. */
export const registerModel = (model: RaciModel): void => {
  if (models.has(model.id)) {
    throw new Error(`Rule model "${model.id}" is already registered.`);
  }
  models.set(model.id, model);
};

/** Find a model by id; no id means the default, `"nearest"`. Throws on an unknown id. */
export const getModel = (id: string = DEFAULT_MODEL_ID): RaciModel => {
  const model = models.get(id);
  if (!model) {
    const known = [...models.keys()].join(", ");
    throw new Error(`Unknown rule model "${id}". Registered models: ${known}.`);
  }
  return model;
};

/** Every registered model, built-ins first, then in registration order. */
export const listModels = (): RaciModel[] => [...models.values()];
