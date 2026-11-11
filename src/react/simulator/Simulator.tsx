import { useId, useMemo, useState } from "react";
import { decide } from "@/core/decide";
import { defaultSettings } from "@/core/types";
import type { RaciConfig, RaciSettings, RuleSet, SubjectOption } from "@/core/types";
import { makeT } from "@/react/strings";
import {
  categoryLabel,
  explainDecision,
  flattenResources,
  personFromPicks,
  subjectLabel,
} from "@/react/simulator/model";
import { SubjectPicker } from "@/react/simulator/SubjectPicker";
import { simulatorStrings } from "@/react/simulator/strings";

/** Props of `Simulator`. */
export interface SimulatorProps {
  /** The host configuration. */
  config: RaciConfig;
  /** The rules to evaluate. */
  ruleSet: RuleSet;
  /** The category to check. When given, the simulator follows it; otherwise it keeps its own. */
  categoryId?: string;
  /** Called when the user picks another category in the simulator. */
  onCategoryChange?: (id: string) => void;
  /** The subject kind the person is picked from. Defaults to `"user"`. */
  personKind?: string;
  /** Display settings; missing fields use the defaults. */
  settings?: Partial<RaciSettings>;
  /** Extra class on the root element. */
  className?: string;
}

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

/** Pick a person and see what they may do in a category, using the package's own decide(). */
export const Simulator = (props: SimulatorProps) => {
  const { config, ruleSet, categoryId, onCategoryChange, className, personKind = "user" } = props;
  const t = useMemo(() => makeT(config, simulatorStrings), [config]);
  const titleId = useId();
  const categoryFieldId = useId();

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
  const [ownCategory, setOwnCategory] = useState("");
  const category =
    categoryId ?? (flat.some((c) => c.id === ownCategory) ? ownCategory : (flat[0]?.id ?? ""));

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

  const changeCategory = (id: string) => {
    setOwnCategory(id);
    onCategoryChange?.(id);
  };

  let results: React.ReactNode;
  if (!person) {
    results = <p className="raci-empty">{t("simulator.emptyPerson")}</p>;
  } else if (category === "" || flat.length === 0) {
    results = <p className="raci-empty">{t("simulator.emptyCategory")}</p>;
  } else if (actions.length === 0) {
    results = <p className="raci-empty">{t("simulator.emptyActions")}</p>;
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
          {actions.map((a) => {
            const decision = decide({
              ruleSet,
              actions: config.actions,
              person: who,
              category,
              action: a.id,
            });
            const why = explainDecision(decision, {
              t,
              category,
              categoryLabel: labelOf,
              subjectLabel: (s) => subjectLabel(config.subjectKinds, s),
              actionLabel,
            });
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
                  <p className="raci-reason">{why}</p>
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
        {flat.length > 0 ? (
          <div className="raci-field">
            <label className="raci-label" htmlFor={categoryFieldId}>
              {t("simulator.category")}
            </label>
            <select
              id={categoryFieldId}
              className="raci-select"
              value={category}
              onChange={(e) => changeCategory(e.target.value)}
            >
              {flat.map((c) => (
                <option key={c.id} value={c.id}>
                  {"  ".repeat(c.depth) + c.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="raci-results" aria-live="polite">
        {results}
      </div>
    </div>
  );
};
