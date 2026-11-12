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
import { verdictWord } from "@/react/simulator/model";
import type { SimulatorViewProps } from "@/react/simulator/view";

/** The strips view: one full-width strip per visible action with the answer and one reason line. */
export const Strips = ({ results, t }: SimulatorViewProps) => (
  <ul className="raci-strips" aria-label={t("simulator.results")}>
    {results.map(({ action, decision, reasonText, decidedByText }) => (
      <li
        key={action.id}
        className={`raci-strip raci-strip--${decision.allowed ? "allow" : "deny"}`}
      >
        <span className="raci-strip-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false">
            {decision.allowed ? (
              <path d="M3.5 8.5l3 3L12.5 5" fill="none" stroke="currentColor" strokeWidth="2" />
            ) : (
              <path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="2" />
            )}
          </svg>
        </span>
        <div className="raci-strip-body">
          <strong className="raci-strip-title">
            {t("simulator.strip.title", {
              action: action.label ?? action.id,
              answer: verdictWord(action, decision.allowed, t, true),
            })}
          </strong>
          <p className="raci-strip-reason">{reasonText}</p>
          {decidedByText ? (
            <p className="raci-strip-reason raci-strip-by">
              {t("simulator.decidedBy", { text: decidedByText })}
            </p>
          ) : null}
        </div>
      </li>
    ))}
  </ul>
);

/** Placeholder strips while a host evaluation is running. */
export const StripsSkeleton = ({ count, label }: { count: number; label: string }) => (
  <div aria-busy="true">
    <ul className="raci-strips" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="raci-strip raci-strip--skeleton" />
      ))}
    </ul>
    <p className="raci-strips-note">{label}</p>
  </div>
);
