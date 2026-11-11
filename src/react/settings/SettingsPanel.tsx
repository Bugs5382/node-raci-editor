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
import { useId, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { CELL_SIZE_LIMITS, CELL_STATE_IDS, normalizeCells, resolveCellStyle } from "@/core/cells";
import { defaultSettings } from "@/core/types";
import type {
  CellSettings,
  CellStateId,
  CellStateSettings,
  RaciConfig,
  RaciSettings,
} from "@/core/types";
import { PreviewCell } from "@/react/editor/cellFace";
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

  // Cell appearance: always emitted normalized, so what a host stores is valid and stable.
  const cells = normalizeCells(value.cells).value;
  const setCells = (next: CellSettings): void => {
    const { cells: _old, ...rest } = value;
    const clean = normalizeCells(next).value;
    onChange(Object.keys(clean).length > 0 ? { ...rest, cells: clean } : rest);
  };
  const patchState = (id: CellStateId, patch: Partial<CellStateSettings>): void => {
    const merged: CellStateSettings = { ...cells.states?.[id], ...patch };
    for (const key of ["glyph", "text", "tooltip"] as const) {
      if (merged[key] === "") delete merged[key];
    }
    setCells({ ...cells, states: { ...cells.states, [id]: merged } });
  };
  const [sizeDraft, setSizeDraft] = useState({
    w: String(cells.size?.width ?? ""),
    h: String(cells.size?.height ?? ""),
  });
  const sizeIssues: string[] = [];
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  for (const [key, v] of [
    ["width", sizeDraft.w],
    ["height", sizeDraft.h],
  ] as const) {
    if (v.trim() === "") continue;
    const lim = CELL_SIZE_LIMITS[key];
    const n = num(v)!;
    if (!Number.isFinite(n) || Math.round(n) < lim.min || Math.round(n) > lim.max) {
      sizeIssues.push(`The ${key} must be a number from ${lim.min} to ${lim.max}.`);
    }
  }
  const changeSize = (w: string, h: string): void => {
    setSizeDraft({ w, h });
    if (w.trim() === "" && h.trim() === "") {
      const { size: _s, ...rest } = cells;
      setCells(rest);
      return;
    }
    const { value: ok } = normalizeCells({ size: { width: num(w), height: num(h) } });
    if (ok.size) setCells({ ...cells, size: ok.size });
  };

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
                      {t("settings.moveUp")}
                    </button>
                    <button
                      type="button"
                      className="raci-settings__button"
                      aria-label={t("settings.actions.moveDown", { label })}
                      disabled={index === visible.length - 1}
                      onClick={() => emit(moveAction(value, id, 1))}
                    >
                      {t("settings.moveDown")}
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </fieldset>

      {/* With one kind there is nothing to choose, so the section is left out. */}
      {config.subjectKinds.length > 1 ? (
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
      ) : null}

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

      <fieldset className="raci-settings__group">
        <legend>{t("settings.cells.legend")}</legend>
        <p className="raci-settings__hint">{t("settings.cells.hint")}</p>
        <div
          data-testid="cells-preview"
          className={`raci-editor raci-editor--preview raci-editor--${value.density}`}
          style={
            cells.size
              ? ({
                  "--raci-cell-width": `${cells.size.width}px`,
                  "--raci-cell-height": `${cells.size.height}px`,
                } as CSSProperties)
              : undefined
          }
          aria-label={t("settings.cells.preview")}
        >
          {CELL_STATE_IDS.map((id) => (
            <div key={id} className="raci-settings__preview-item">
              <PreviewCell
                id={id}
                st={resolveCellStyle(id, config.cellStates, cells)}
                stateText={t(`settings.cells.state.${id}`)}
                includedText={t("settings.cells.included")}
              />
              <span className="raci-settings__preview-name">{t(`settings.cells.state.${id}`)}</span>
            </div>
          ))}
        </div>

        <div className="raci-settings__cells-size">
          <label>
            <span>{t("settings.cells.width")}</span>
            <input
              type="number"
              min={CELL_SIZE_LIMITS.width.min}
              max={CELL_SIZE_LIMITS.width.max}
              value={sizeDraft.w}
              onChange={(e) => changeSize(e.target.value, sizeDraft.h)}
            />
          </label>
          <label>
            <span>{t("settings.cells.height")}</span>
            <input
              type="number"
              min={CELL_SIZE_LIMITS.height.min}
              max={CELL_SIZE_LIMITS.height.max}
              value={sizeDraft.h}
              onChange={(e) => changeSize(sizeDraft.w, e.target.value)}
            />
          </label>
          <button
            type="button"
            className="raci-settings__button"
            onClick={() => changeSize("", "")}
          >
            {t("settings.cells.sizeDefault")}
          </button>
        </div>
        <p className="raci-settings__hint">
          {t("settings.cells.sizeHint", {
            min: CELL_SIZE_LIMITS.width.min,
            max: CELL_SIZE_LIMITS.width.max,
            minH: CELL_SIZE_LIMITS.height.min,
            maxH: CELL_SIZE_LIMITS.height.max,
          })}
        </p>
        {sizeIssues.map((m) => (
          <p key={m} role="alert" className="raci-settings__error">
            {m}
          </p>
        ))}

        {CELL_STATE_IDS.map((id) => {
          const mine = cells.states?.[id];
          const base = config.cellStates?.[id];
          const state = t(`settings.cells.state.${id}`);
          const hostText = (v: unknown): string => (typeof v === "string" ? v : "");
          return (
            <div key={id} className="raci-settings__cells-state">
              <strong>{state}</strong>
              <label>
                <span>{t("settings.cells.glyph", { state })}</span>
                <input
                  type="text"
                  maxLength={4}
                  value={mine?.glyph ?? ""}
                  placeholder={hostText(base?.glyph)}
                  onChange={(e) => patchState(id, { glyph: e.target.value })}
                />
              </label>
              <label>
                <span>{t("settings.cells.word", { state })}</span>
                <input
                  type="text"
                  maxLength={24}
                  value={mine?.text ?? ""}
                  placeholder={hostText(base?.text)}
                  onChange={(e) => patchState(id, { text: e.target.value })}
                />
              </label>
              <label>
                <span>{t("settings.cells.tooltip", { state })}</span>
                <input
                  type="text"
                  maxLength={80}
                  value={mine?.tooltip ?? ""}
                  placeholder={hostText(base?.tooltip)}
                  onChange={(e) => patchState(id, { tooltip: e.target.value })}
                />
              </label>
              {(["fg", "bg", "border"] as const).map((key) => (
                <label key={key}>
                  <span>{t(`settings.cells.${key}`, { state })}</span>
                  <input
                    type="color"
                    value={
                      /^#[0-9a-f]{6}$/i.test(mine?.colors?.[key] ?? "")
                        ? mine!.colors![key]!
                        : "#808080"
                    }
                    onChange={(e) =>
                      patchState(id, { colors: { ...mine?.colors, [key]: e.target.value } })
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                className="raci-settings__button"
                onClick={() => {
                  const { colors: _c, ...rest } = mine ?? {};
                  setCells({ ...cells, states: { ...cells.states, [id]: rest } });
                }}
              >
                {t("settings.cells.clear", { state })}
              </button>
            </div>
          );
        })}
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
