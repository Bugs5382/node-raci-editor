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
import { actionPool, type PoolPerson } from "@/core/pools";
import { EVERYONE } from "@/core/models/ordered";
import { defaultSettings } from "@/core/types";
import type {
  ActionDef,
  Decision,
  Person,
  RaciConfig,
  RaciSettings,
  RuleSet,
  SubjectOption,
} from "@/core/types";
import { makeT } from "@/react/strings";
import {
  categoryLabel,
  decidedByText,
  explainDecision,
  flattenResources,
  personFromPicks,
  subjectLabel,
  verdictWord,
} from "@/react/simulator/model";
import type { ReasonContext } from "@/react/simulator/model";
import { Boxes } from "@/react/simulator/Boxes";
import { SubjectPicker } from "@/react/simulator/SubjectPicker";
import { Strips, StripsSkeleton } from "@/react/simulator/Strips";
import { Lists } from "@/react/simulator/Lists";
import { simulatorDefaults } from "@/react/simulator/strings";
import type {
  ActionResult,
  PoolListView,
  SimulatorVariant,
  SimulatorViewProps,
} from "@/react/simulator/view";

/** One pool or obligation list to show for the selected category. */
export interface SimulatorList {
  /** Stable id of the list. */
  id: string;
  /** The action whose pool is listed: the approvers, or the people an obligation applies to. */
  action: string;
  /** The title. Default: the string `simulator.list.access` or `simulator.list.obligation` with the action's label. */
  label?: string;
  /** The people to consider, each with the matchers that apply to them. The package does not know who exists. */
  people: PoolPerson[];
}

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
  /**
   * Pool and obligation lists, such as the approvers or the people who must acknowledge. For each
   * one the simulator runs the same model as the results (the rule set's `model`) over `people` for
   * the selected category and shows who the action answers allowed for, owners first, with the
   * reason. Not used when `evaluate` is set: the host then supplies its own lists. A host that
   * replaces the results with `renderResults` receives them as `view.lists`.
   */
  lists?: SimulatorList[];
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
  const hasUser = config.subjectKinds.some((k) => k.kind === "user");
  const personKind =
    props.personKind ?? (hasUser ? "user" : (config.subjectKinds[0]?.kind ?? "user"));
  const { variant = "list", renderResults, evaluate, show } = props;
  const t = useMemo(() => makeT(config, simulatorDefaults(config.strings)), [config]);
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

  const picks = [...(person ? [person.id] : []), ...memberships.map((m) => m.id)];
  const who = personFromPicks(picks);

  const resultFor = (action: ActionDef, decision: Decision, reasonText?: string): ActionResult => {
    const ctx: ReasonContext = {
      t,
      category,
      categoryLabel: labelOf,
      subjectLabel: (s) => subjectLabel(config.subjectKinds, s),
      actionLabel,
      action,
    };
    const by = decidedByText(decision, ctx);
    return {
      action,
      decision,
      reasonText: reasonText ?? explainDecision(decision, ctx),
      ...(by !== undefined ? { decidedByText: by } : {}),
    };
  };

  const ready = person !== null && category !== "" && flat.length > 0 && actions.length > 0;
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
        return resultFor(action, r.decision, r.reasonText);
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
        return resultFor(action, decision);
      });
    }
  }
  // The lists use the rule set's model, as decide() does; with a host evaluation there are none.
  const poolLists: PoolListView[] =
    evaluate || category === "" || flat.length === 0
      ? []
      : (props.lists ?? []).map((spec) => {
          const def = config.actions.find((a) => a.id === spec.action);
          const entries = actionPool({
            ruleSet,
            actions: config.actions,
            category,
            people: spec.people,
            action: spec.action,
          });
          const where = (e: { row?: number; category: string }) =>
            e.row === undefined
              ? t("simulator.by.entry", { category: labelOf(e.category) })
              : t("simulator.by.row", { n: e.row + 1, category: labelOf(e.category) });
          const items = entries.flatMap((e) =>
            e.everyone
              ? []
              : [
                  {
                    person: e.person,
                    label: subjectLabel(config.subjectKinds, e.person),
                    reason:
                      e.reason === "owner"
                        ? t("simulator.by.owner", { category: labelOf(e.category) })
                        : where(e),
                    everyone: false,
                  },
                ],
          );
          const all = entries.find((e) => e.everyone);
          if (all) {
            items.push({
              person: EVERYONE,
              label: t("simulator.list.everyone"),
              reason: where(all),
              everyone: true,
            });
          }
          return {
            id: spec.id,
            action: spec.action,
            title:
              spec.label ??
              t(
                def?.kind === "obligation" ? "simulator.list.obligation" : "simulator.list.access",
                {
                  action: actionLabel(spec.action),
                },
              ),
            items,
          };
        });
  const view: SimulatorViewProps = {
    person: person ? who : null,
    category,
    results: list,
    lists: poolLists,
    status,
    retry: status === "error" ? () => setAttempt((n) => n + 1) : undefined,
    labelOf,
    subjectLabel: (s) => subjectLabel(config.subjectKinds, s),
    t,
  };

  let results: React.ReactNode;
  if (!person) {
    results = <p className="raci-empty">{t("simulator.emptyPerson")}</p>;
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
          {list.map(({ action: a, decision, reasonText, decidedByText: by }) => {
            const decidedIn = decision.decidedBy?.category;
            return (
              <tr key={a.id}>
                <th scope="row">{a.label ?? a.id}</th>
                <td>
                  <Verdict allowed={decision.allowed} text={verdictWord(a, decision.allowed, t)} />
                </td>
                <td>
                  <p className="raci-reason">{reasonText}</p>
                  {by ? (
                    <p className="raci-decided">{t("simulator.decidedBy", { text: by })}</p>
                  ) : null}
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
        {show?.memberships === false || memberKinds.length === 0 ? null : (
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
      {renderResults && status === "ready" ? null : <Lists lists={poolLists} t={t} />}
    </div>
  );
};
