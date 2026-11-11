import { useId } from "react";
import type { ReactElement } from "react";
import { defaultSettings } from "@/core/types";
import type { RaciConfig, RaciSettings } from "@/core/types";
import { makeT } from "@/react/strings";
import { moveAction, toggleAction, toggleKind } from "@/react/settings/model";
import { settingsStrings } from "@/react/settings/strings";

/** Props of `SettingsPanel`. */
export interface SettingsPanelProps {
  /** The host configuration; supplies the actions, subject kinds and strings. */
  config: RaciConfig;
  /** The current settings. The panel never changes it; it reports changes through `onChange`. */
  value: RaciSettings;
  /** Called with a new settings object after each change. */
  onChange: (next: RaciSettings) => void;
  /** Extra class on the root element. */
  className?: string;
}

/** Controlled panel that edits the display and behavior settings of the editor and simulator. */
export const SettingsPanel = ({
  config,
  value,
  onChange,
  className,
}: SettingsPanelProps): ReactElement => {
  const t = makeT(config, settingsStrings);
  const uid = useId();
  const labelOf = (id: string): string => config.actions.find((a) => a.id === id)?.label ?? id;

  const known = new Set(config.actions.map((a) => a.id));
  const visible = value.visibleActions.filter((id) => known.has(id));
  const hidden = config.actions.map((a) => a.id).filter((id) => !visible.includes(id));
  const ordered = [...visible, ...hidden];
  const lastAction = visible.length <= 1;
  const lastKind = value.enabledSubjectKinds.length <= 1;
  const actionsHintId = `${uid}-actions-last`;
  const kindsHintId = `${uid}-kinds-last`;

  const emit = (next: RaciSettings): void => {
    if (next !== value) onChange(next);
  };
  const set = (patch: Partial<RaciSettings>): void => onChange({ ...value, ...patch });

  return (
    <div className={["raci-root raci-settings", className].filter(Boolean).join(" ")}>
      <h2 className="raci-settings__title">{t("settings.title")}</h2>

      <fieldset className="raci-settings__group">
        <legend>{t("settings.actions.legend")}</legend>
        <p className="raci-settings__hint">{t("settings.actions.hint")}</p>
        {lastAction ? (
          <p id={actionsHintId} className="raci-settings__hint raci-settings__hint--warn">
            {t("settings.actions.lastHint")}
          </p>
        ) : null}
        <ol className="raci-settings__list">
          {ordered.map((id) => {
            const def = config.actions.find((a) => a.id === id)!;
            const label = def.label ?? id;
            const checked = visible.includes(id);
            const index = visible.indexOf(id);
            const guarded = checked && lastAction;
            const descId = `${uid}-a-${id}-desc`;
            const impliesId = `${uid}-a-${id}-implies`;
            const implied = (def.implies ?? []).map(labelOf);
            const describedBy = [
              def.description ? descId : "",
              impliesId,
              guarded ? actionsHintId : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={id} className="raci-settings__item">
                <div className="raci-settings__item-main">
                  <label className="raci-settings__check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={guarded}
                      aria-describedby={describedBy}
                      onChange={() => emit(toggleAction(value, id))}
                    />
                    <span>{label}</span>
                  </label>
                  {def.description ? (
                    <p id={descId} className="raci-settings__desc">
                      {def.description}
                    </p>
                  ) : null}
                  <p id={impliesId} className="raci-settings__desc">
                    {implied.length > 0
                      ? t("settings.actions.implies", { list: implied.join(", ") })
                      : t("settings.actions.impliesNone")}
                  </p>
                </div>
                {checked ? (
                  <span className="raci-settings__move">
                    <button
                      type="button"
                      className="raci-settings__button"
                      aria-label={t("settings.actions.moveUp", { label })}
                      disabled={index === 0}
                      onClick={() => emit(moveAction(value, id, -1))}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="raci-settings__button"
                      aria-label={t("settings.actions.moveDown", { label })}
                      disabled={index === visible.length - 1}
                      onClick={() => emit(moveAction(value, id, 1))}
                    >
                      Down
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </fieldset>

      <fieldset className="raci-settings__group">
        <legend>{t("settings.kinds.legend")}</legend>
        <p className="raci-settings__hint">{t("settings.kinds.hint")}</p>
        {lastKind ? (
          <p id={kindsHintId} className="raci-settings__hint raci-settings__hint--warn">
            {t("settings.kinds.lastHint")}
          </p>
        ) : null}
        {config.subjectKinds.map((k) => {
          const checked = value.enabledSubjectKinds.includes(k.kind);
          const guarded = checked && lastKind;
          return (
            <label key={k.kind} className="raci-settings__check">
              <input
                type="checkbox"
                checked={checked}
                disabled={guarded}
                aria-describedby={guarded ? kindsHintId : undefined}
                onChange={() => emit(toggleKind(value, k.kind))}
              />
              <span>{k.label}</span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="raci-settings__group">
        <legend>{t("settings.behavior.legend")}</legend>
        <label className="raci-settings__check">
          <input
            type="checkbox"
            checked={value.showInherited}
            onChange={(e) => set({ showInherited: e.target.checked })}
          />
          <span>{t("settings.showInherited")}</span>
        </label>
        <label className="raci-settings__check">
          <input
            type="checkbox"
            checked={value.confirmDeny}
            onChange={(e) => set({ confirmDeny: e.target.checked })}
          />
          <span>{t("settings.confirmDeny")}</span>
        </label>
        <label className="raci-settings__check">
          <input
            type="checkbox"
            checked={value.defaultStopInheriting}
            onChange={(e) => set({ defaultStopInheriting: e.target.checked })}
          />
          <span>{t("settings.defaultStopInheriting")}</span>
        </label>
      </fieldset>

      <fieldset className="raci-settings__group">
        <legend>{t("settings.density.legend")}</legend>
        {(["comfortable", "compact"] as const).map((d) => (
          <label key={d} className="raci-settings__check">
            <input
              type="radio"
              name={`${uid}-density`}
              value={d}
              checked={value.density === d}
              onChange={() => set({ density: d })}
            />
            <span>{t(`settings.density.${d}`)}</span>
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        className="raci-settings__button raci-settings__reset"
        onClick={() => onChange(defaultSettings(config))}
      >
        {t("settings.reset")}
      </button>
    </div>
  );
};
