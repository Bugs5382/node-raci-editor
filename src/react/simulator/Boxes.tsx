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
import { useId } from "react";
import { verdictWord } from "@/react/simulator/model";
import type { Effect, TraceMatch } from "@/core/types";
import type { SimulatorViewProps } from "@/react/simulator/view";

type T = SimulatorViewProps["t"];

const EffectIcon = ({ effect }: { effect: Effect }) => (
  <svg className="raci-box-effect-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    {effect === "allow" ? (
      <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" />
    ) : (
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" />
    )}
  </svg>
);

const VerdictIcon = ({ allowed }: { allowed: boolean }) => (
  <span className="raci-box-icon" aria-hidden="true">
    <svg viewBox="0 0 16 16" focusable="false">
      {allowed ? (
        <path d="M3.5 8.5l3 3L12.5 5" fill="none" stroke="currentColor" strokeWidth="2" />
      ) : (
        <path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="2" />
      )}
    </svg>
  </span>
);

const EffectChip = ({ effect, t }: { effect: Effect; t: T }) => (
  <span className={`raci-box-effect raci-box-effect--${effect}`}>
    <EffectIcon effect={effect} />
    {t(effect === "allow" ? "simulator.box.effectAllow" : "simulator.box.effectDeny")}
  </span>
);

type Located = TraceMatch & { category: string };

/** The boxes view: one card per visible action with Reason, Decided by, Walk and Overridden. */
export const Boxes = (view: SimulatorViewProps) => {
  const { results, labelOf, subjectLabel, t } = view;
  const uid = useId();
  return (
    <ul className="raci-boxes" aria-label={t("simulator.results")}>
      {results.map(({ action, decision, reasonText, decidedByText }) => {
        const titleId = `${uid}-${action.id}`;
        const by = decision.decidedBy;
        const steps = decision.trace;
        const all: Located[] = (steps ?? []).flatMap((s) =>
          s.matches.map((m) => ({ ...m, category: s.category })),
        );
        const decisive = all.find((m) => m.decisive);
        const lost = all.filter((m) => !m.decisive);
        return (
          <li key={action.id}>
            <article
              className={`raci-box raci-box--${decision.allowed ? "allow" : "deny"}`}
              aria-labelledby={titleId}
            >
              <header className="raci-box-head">
                <VerdictIcon allowed={decision.allowed} />
                <div>
                  <h3 className="raci-box-title" id={titleId}>
                    {action.label ?? action.id}
                  </h3>
                  <p className="raci-box-verdict">{verdictWord(action, decision.allowed, t)}</p>
                </div>
              </header>
              <section className="raci-box-part raci-box-reason">
                <h4>{t("simulator.box.reason")}</h4>
                <p>{reasonText}</p>
              </section>
              <section className="raci-box-part raci-box-by">
                <h4>{t("simulator.box.decidedBy")}</h4>
                {decidedByText ? <p className="raci-box-by-text">{decidedByText}</p> : null}
                {by ? (
                  <p>
                    <strong>{subjectLabel(by.entry.subject)}</strong>{" "}
                    <EffectChip effect={by.entry.effect} t={t} />{" "}
                    <span>{labelOf(by.category)}</span>
                    {decisive ? (
                      <>
                        {" "}
                        <span className="raci-box-entry">
                          {t("simulator.box.entry", { n: decisive.index + 1 })}
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="raci-box-muted">{t("simulator.box.noRule")}</p>
                )}
              </section>
              <section className="raci-box-part raci-box-walk">
                <h4>{t("simulator.box.walk")}</h4>
                <ol>
                  {decision.path.map((id) => {
                    const step = steps?.find((s) => s.category === id);
                    return (
                      <li
                        key={id}
                        className="raci-box-step"
                        data-decided={id === by?.category || undefined}
                      >
                        <span className="raci-box-step-name">{labelOf(id)}</span>
                        {step && step.matches.length === 0 ? (
                          <span className="raci-box-muted">{t("simulator.box.noMatch")}</span>
                        ) : null}
                        {step && step.matches.length > 0 ? (
                          <ul className="raci-box-chips">
                            {step.matches.map((m) => (
                              <li
                                key={m.index}
                                className="raci-box-match"
                                data-decisive={m.decisive || undefined}
                              >
                                <EffectChip effect={m.entry.effect} t={t} />
                                <span>{subjectLabel(m.entry.subject)}</span>
                                <span className="raci-box-tag">
                                  {t(
                                    m.via === "direct"
                                      ? "simulator.box.direct"
                                      : "simulator.box.implied",
                                  )}
                                </span>
                                {m.decisive ? (
                                  <span className="raci-box-tag raci-box-tag--decisive">
                                    {t("simulator.box.deciding")}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {step?.stopInheriting ? (
                          <span className="raci-box-stop">{t("simulator.box.stopped")}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </section>
              {lost.length > 0 ? (
                <details className="raci-box-part raci-box-overridden">
                  <summary>{t("simulator.box.overridden", { count: lost.length })}</summary>
                  <ul>
                    {lost.map((m) => (
                      <li key={`${m.category}-${m.index}`}>
                        <EffectChip effect={m.entry.effect} t={t} />{" "}
                        <span>{subjectLabel(m.entry.subject)}</span>{" "}
                        <span>{labelOf(m.category)}</span>{" "}
                        <span className="raci-box-entry">
                          {t("simulator.box.entry", { n: m.index + 1 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
};
