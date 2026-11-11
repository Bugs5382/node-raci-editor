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
import { useEffect, useId, useMemo, useState } from "react";
import { decide } from "@/core/decide";
import { defaultSettings } from "@/core/types";
import type {
  Decision,
  Person,
  RaciConfig,
  RaciSettings,
  RuleSet,
  SubjectOption,
} from "@/core/types";
import { DEFAULT_PERSON_KIND } from "@/react/defaults";

/** The built-in subject every asker has. */
const EVERYONE_SUBJECT = "everyone:*";
import { makeT } from "@/react/strings";
import {
  categoryLabel,
  explainDecision,
  flattenResources,
  personFromPicks,
  subjectLabel,
} from "@/react/simulator/model";
import { Boxes } from "@/react/simulator/Boxes";
import { SubjectPicker } from "@/react/simulator/SubjectPicker";
import { Strips, StripsSkeleton } from "@/react/simulator/Strips";
import { simulatorStrings } from "@/react/simulator/strings";
import type { ActionResult, SimulatorVariant, SimulatorViewProps } from "@/react/simulator/view";

/** Props of `Simulator`. */
export interface SimulatorProps {
  /** The host configuration. */
  config: RaciConfig;
  /** The rules to evaluate. */
  ruleSet: RuleSet;
  /** The category to check, chosen by the host. Without it the simulator shows the empty-category state. */
  categoryId?: string;
  /** The subject kind the person is picked from. Defaults to `"user"` when the config has that kind, else the first kind in the config. */
  personKind?: string;
  /** Display settings; missing fields use the defaults. */
  settings?: Partial<RaciSettings>;
  /** Extra class on the root element. */
  className?: string;
  /** The built-in results view: `list` (default), `boxes` or `strips`. */
  variant?: SimulatorVariant;
  /** Replaces the results region only. Called once the results are ready. */
  renderResults?: (view: SimulatorViewProps) => React.ReactNode;
  /**
   * Host-side evaluation, one call per visible action. When set, `decide()` is not run and the
   * simulator shows loading and error (with retry) states. Memoize it: a new function re-runs.
   */
  evaluate?: (q: { person: Person; category: string; action: string }) => Promise<{
    decision: Decision;
    reasonText?: string;
  }>;
  /** Hide parts the host does not want. Defaults to shown. */
  show?: { memberships?: boolean };
}

type EvalState = { key: string; status: "ready" | "error"; results: ActionResult[] };

const Verdict = ({ allowed, text }: { allowed: boolean; text: string }) => {
  return (
    <span className={`raci-verdict raci-verdict-${allowed ? "allow" : "deny"}`}>
      <svg className="raci-verdict-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        {allowed ? (
          <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" />
        ) : (
          <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" />
        )}
      </svg>
      {text}
    </span>
  );
};

const Chip = ({
  label,
  remove,
  onRemove,
}: {
  label: string;
  remove: string;
  onRemove: () => void;
}) => {
  return (
    <li className="raci-chip">
      <span>{label}</span>
      <button type="button" className="raci-chip-remove" aria-label={remove} onClick={onRemove}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="12" height="12">
          <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </li>
  );
};

/** Pick a person and preview what the rules would allow in a category, using the package's own decide(). Preview only; the host enforces. */
export const Simulator = (props: SimulatorProps) => {
  const { config, ruleSet, categoryId, className } = props;
  // Without personKind: "user" when the host has that kind, else the host's first kind.
  const hasDefault = config.subjectKinds.some((k) => k.kind === DEFAULT_PERSON_KIND);
  const personKind =
    props.personKind ??
    (hasDefault ? DEFAULT_PERSON_KIND : (config.subjectKinds[0]?.kind ?? DEFAULT_PERSON_KIND));
  const { variant = "list", renderResults, evaluate, show } = props;
  const t = useMemo(() => makeT(config, simulatorStrings), [config]);
  const titleId = useId();

  const settings: RaciSettings = { ...defaultSettings(config), ...props.settings };
  const enabledKey = settings.enabledSubjectKinds.join("\n");
  const personKinds = useMemo(
    () => config.subjectKinds.filter((k) => k.kind === personKind),
    [config.subjectKinds, personKind],
  );
  const memberKinds = useMemo(
    () =>
      config.subjectKinds.filter(
        (k) => k.kind !== personKind && enabledKey.split("\n").includes(k.kind),
      ),
    [config.subjectKinds, enabledKey, personKind],
  );

  // A context picker replaces the person picker when the host has named contexts, or flat matchers and
  // no subject kinds: the context is the list of matchers that apply, resolved by the host.
  const matchers = config.matchers ?? [];
  const contexts = config.contexts ?? [];
  const contextMode =
    contexts.length > 0 || (matchers.length > 0 && config.subjectKinds.length === 0);
  const [contextId, setContextId] = useState("");
  const [contextSubjects, setContextSubjects] = useState<string[]>([]);
  const [person, setPerson] = useState<SubjectOption | null>(null);
  const [memberships, setMemberships] = useState<SubjectOption[]>([]);
  const flat = useMemo(() => flattenResources(config.resources), [config.resources]);
  const category = categoryId ?? "";

  const allLabel = t("simulator.allCategories");
  const labelOf = (id: string) => categoryLabel(flat, id, allLabel);
  const actions = settings.visibleActions.flatMap((id) => {
    const def = config.actions.find((a) => a.id === id);
    return def ? [def] : [];
  });
  const actionLabel = (id: string) => {
    const def = config.actions.find((a) => a.id === id);
    return def?.label ?? id;
  };

  const hasWho = contextMode
    ? contexts.length === 0 || contextId !== "" || contextSubjects.length > 0
    : person !== null;
  const picks = contextMode
    ? [EVERYONE_SUBJECT, ...contextSubjects]
    : [...(person ? [person.id] : []), ...memberships.map((m) => m.id)];
  const who = personFromPicks(picks);
  const labelSubject = (s: string): string =>
    s === EVERYONE_SUBJECT
      ? t("simulator.everyone")
      : (matchers.find((m) => m.id === s)?.label ?? subjectLabel(config.subjectKinds, s));

  const why = (decision: Decision) =>
    explainDecision(decision, {
      t,
      category,
      categoryLabel: labelOf,
      subjectLabel: labelSubject,
      actionLabel,
    });

  const ready = hasWho && category !== "" && flat.length > 0 && actions.length > 0;
  const evalKey =
    evaluate && ready ? JSON.stringify([picks, category, actions.map((a) => a.id)]) : null;
  const [attempt, setAttempt] = useState(0);
  const [evalState, setEvalState] = useState<EvalState | null>(null);
  const runKey = `${evalKey}#${attempt}`;
  useEffect(() => {
    if (evalKey === null || !evaluate) return;
    let live = true;
    Promise.all(
      actions.map(async (action): Promise<ActionResult> => {
        const r = await evaluate({ person: who, category, action: action.id });
        return { action, decision: r.decision, reasonText: r.reasonText ?? why(r.decision) };
      }),
    ).then(
      (list) => live && setEvalState({ key: runKey, status: "ready", results: list }),
      () => live && setEvalState({ key: runKey, status: "error", results: [] }),
    );
    return () => {
      live = false;
    };
    // The key stands for picks, category and actions; `evaluate` re-runs when the host changes it.
  }, [runKey, evaluate]);

  let status: SimulatorViewProps["status"] = "idle";
  let list: ActionResult[] = [];
  if (ready) {
    if (evalKey !== null) {
      const current = evalState?.key === runKey ? evalState : null;
      status = current?.status ?? "loading";
      list = current?.results ?? [];
    } else {
      status = "ready";
      list = actions.map((action) => {
        const decision = decide(
          { ruleSet, actions: config.actions, person: who, category, action: action.id },
          { trace: true },
        );
        return { action, decision, reasonText: why(decision) };
      });
    }
  }
  const view: SimulatorViewProps = {
    person: hasWho ? who : null,
    category,
    results: list,
    status,
    retry: status === "error" ? () => setAttempt((n) => n + 1) : undefined,
    labelOf,
    subjectLabel: labelSubject,
    t,
  };

  let results: React.ReactNode;
  if (!hasWho) {
    results = (
      <p className="raci-empty">
        {t(contextMode ? "simulator.emptyContext" : "simulator.emptyPerson")}
      </p>
    );
  } else if (category === "" || flat.length === 0) {
    results = <p className="raci-empty">{t("simulator.emptyCategory")}</p>;
  } else if (actions.length === 0) {
    results = <p className="raci-empty">{t("simulator.emptyActions")}</p>;
  } else if (status === "loading") {
    results =
      variant === "strips" ? (
        <StripsSkeleton count={actions.length} label={t("simulator.loading")} />
      ) : (
        <p className="raci-loading">{t("simulator.loading")}</p>
      );
  } else if (status === "error") {
    results = (
      <div className={variant === "strips" ? "raci-strip raci-strip--error" : "raci-error"}>
        <span role="alert">{t("simulator.error")}</span>
        <button type="button" className="raci-retry" onClick={view.retry}>
          {t("simulator.retry")}
        </button>
      </div>
    );
  } else if (renderResults) {
    results = renderResults(view);
  } else if (variant === "boxes") {
    results = <Boxes {...view} />;
  } else if (variant === "strips") {
    results = <Strips {...view} />;
  } else {
    results = (
      <table className="raci-table" aria-label={t("simulator.results")}>
        <thead>
          <tr>
            <th scope="col">{t("simulator.action")}</th>
            <th scope="col">{t("simulator.result")}</th>
            <th scope="col">{t("simulator.why")}</th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ action: a, decision, reasonText }) => {
            const decidedIn = decision.decidedBy?.category;
            return (
              <tr key={a.id}>
                <th scope="row">{a.label ?? a.id}</th>
                <td>
                  <Verdict
                    allowed={decision.allowed}
                    text={t(decision.allowed ? "simulator.allowed" : "simulator.denied")}
                  />
                </td>
                <td>
                  <p className="raci-reason">{reasonText}</p>
                  <ol className="raci-walk" aria-label={t("simulator.walk")}>
                    {decision.path.map((id) => (
                      <li key={id} data-decided={id === decidedIn || undefined}>
                        {labelOf(id)}
                      </li>
                    ))}
                  </ol>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <div
      className={["raci-root", "raci-simulator", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={titleId}
      data-density={settings.density}
    >
      <h2 className="raci-title" id={titleId}>
        {t("simulator.title")}
      </h2>
      <div className="raci-controls">
        {contextMode ? (
          <>
            {contexts.length > 0 && (
              <div className="raci-field">
                <label className="raci-label" htmlFor={`${titleId}-context`}>
                  {t("simulator.context")}
                </label>
                <select
                  id={`${titleId}-context`}
                  className="raci-select"
                  value={contextId}
                  onChange={(e) => {
                    setContextId(e.target.value);
                    setContextSubjects(
                      contexts.find((c) => c.id === e.target.value)?.subjects ?? [],
                    );
                  }}
                >
                  <option value="">{t("simulator.contextPlaceholder")}</option>
                  {contexts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {matchers.length > 0 && (
              <fieldset className="raci-field raci-toggles">
                <legend className="raci-label">{t("simulator.toggles")}</legend>
                {matchers.map((m) => (
                  <label key={m.id} className="raci-toggle" title={m.description}>
                    <input
                      type="checkbox"
                      checked={contextSubjects.includes(m.id)}
                      onChange={() =>
                        setContextSubjects((all) =>
                          all.includes(m.id) ? all.filter((x) => x !== m.id) : [...all, m.id],
                        )
                      }
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </>
        ) : (
          <div className="raci-field">
            {person ? (
              <>
                <span className="raci-label">{t("simulator.person")}</span>
                <ul className="raci-chips">
                  <Chip
                    label={person.label}
                    remove={t("simulator.remove", { label: person.label })}
                    onRemove={() => setPerson(null)}
                  />
                </ul>
              </>
            ) : (
              <SubjectPicker
                label={t("simulator.person")}
                placeholder={t("simulator.personPlaceholder")}
                noMatches={t("simulator.noMatches")}
                kinds={personKinds}
                exclude={[]}
                onPick={setPerson}
              />
            )}
          </div>
        )}
        {contextMode || show?.memberships === false || memberKinds.length === 0 ? null : (
          <div className="raci-field">
            <SubjectPicker
              label={t("simulator.memberships")}
              placeholder={t("simulator.membershipsPlaceholder")}
              noMatches={t("simulator.noMatches")}
              kinds={memberKinds}
              exclude={memberships.map((m) => m.id)}
              onPick={(o) => setMemberships((m) => [...m, o])}
            />
            {memberships.length > 0 ? (
              <ul className="raci-chips">
                {memberships.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.label}
                    remove={t("simulator.remove", { label: m.label })}
                    onRemove={() => setMemberships((all) => all.filter((x) => x.id !== m.id))}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
      <div className="raci-results" aria-live="polite">
        {results}
      </div>
    </div>
  );
};
