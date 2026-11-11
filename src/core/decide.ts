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
import { getModel } from "./registry.js";
import type { Decision, DecideInput, DecideOptions } from "./types.js";

/**
 * Evaluate whether the rules would allow a person to perform an action in a category. This is a
 * pure evaluation helper the host may call; the host enforces.
 *
 * The rule model is `options.model`, else `ruleSet.model`, else `"nearest"`; an unknown id throws.
 * Under "nearest": default deny; walk from the category up through `ruleSet.parents`, then the
 * implicit `"*"` category. The nearest category with a matching entry decides: any deny beats any
 * allow there (the first matching entry of the winning effect is reported). A category with
 * `stopInheriting` ends the walk after its own entries, skipping `"*"`. An unknown asked action is
 * denied with an empty path. With `options.trace` the decision also carries one `TraceStep` per
 * visited category; the verdict is the same either way.
 */
export const decide = (input: DecideInput, options?: DecideOptions): Decision => {
  const { decision, trace } = getModel(options?.model ?? input.ruleSet.model).evaluate(input);
  return options?.trace ? { ...decision, trace } : decision;
};
