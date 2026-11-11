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
import type { ActionDef, Decision, Person } from "@/core/types";

/** Which built-in results view the simulator shows. `list` is the default table. */
export type SimulatorVariant = "list" | "boxes" | "strips";

/** What a view shows for one action. The simulator builds it, or the host's `evaluate` supplies it. */
export interface ActionResult {
  action: ActionDef;
  /** From `decide()` with a trace, or from the host. */
  decision: Decision;
  /** One sentence: the package wording, or the host's own text. */
  reasonText: string;
}

/** What a built-in view and the `renderResults` slot receive. */
export interface SimulatorViewProps {
  person: Person | null;
  category: string;
  /** One result per visible action, in display order. */
  results: ActionResult[];
  status: "idle" | "loading" | "error" | "ready";
  /** Set when the status is `error`. */
  retry?: () => void;
  labelOf: (categoryId: string) => string;
  subjectLabel: (subject: string) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}
