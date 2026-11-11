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
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { defaultSettings } from "@/core/types";
import type {
  ActionDef,
  Effect,
  Entry,
  RaciConfig,
  RaciSettings,
  ResourceNode,
  RuleSet,
} from "@/core/types";
import { makeT } from "@/react/strings";
import { EffectIcon, MarkIcon } from "@/react/editor/Icon";
import {
  cellEffect,
  deriveRows,
  impliedActions,
  inheritedGroups,
  nextEffect,
  removeSubject,
  setCell,
  setStopInheriting,
  stableRows,
} from "@/react/editor/model";
import { SubjectPicker } from "@/react/editor/SubjectPicker";
import { editorStrings } from "@/react/editor/strings";

/** The editor is read-only (`"view"`) or editable (`"edit"`). */
export type EditorMode = "view" | "edit";

/** How a grid cell looks: the state box (default) or just a mark (a check, an X or nothing). */
export type CellVariant = "box" | "marks";

/** The fixed cell size, as CSS values the host can put on its own cell so rows never jump. */
export interface CellSizeTokens {
  /** `var(--raci-cell-width)`. */
  width: string;
  /** `var(--raci-cell-height)`. */
  height: string;
}

/** What a host's `renderCell` receives for one cell. */
export interface RenderCellProps {
  /** The cell's own state; `"blank"` is Not set. */
  state: "allow" | "deny" | "blank";
  /** True for a cell in an inherited (parent category) table: read-only, never changes. */
  inherited: boolean;
  /** For a blank cell, the action whose Allow includes it; otherwise undefined. */
  includedBy?: ActionDef;
  /** The action (column) of this cell. */
  action: ActionDef;
  /** The subject id of this cell's row. */
  subject: string;
  /** The subject's display label. */
  subjectLabel: string;
  /** The accessible name the built-in cell uses; put it on the host's control. */
  label: string;
  /** The tooltip text the built-in cell uses. */
  title: string;
  /** True when the editor is read-only or the cell is inherited. */
  readOnly: boolean;
  /** Sets this cell to a state (undefined clears it). A Deny asks for confirmation when that setting is on. */
  onChange: (next: Effect | undefined) => void;
  /** Moves to the next state in the editor's order: Not set, Allow, Deny, Not set. */
  onCycle: () => void;
  /** The fixed cell size; use it so rows keep the same height in every variant. */
  size: CellSizeTokens;
}

const SIZE: CellSizeTokens = { width: "var(--raci-cell-width)", height: "var(--raci-cell-height)" };
const NOOP = () => {};

/** Props of `RulesEditor`. */
export interface RulesEditorProps {
  /** The host configuration. */
  config: RaciConfig;
  /** The full rule set. Never mutated. */
  ruleSet: RuleSet;
  /** The category whose entries are edited. */
  categoryId: string;
  /** Called with a new rule set after each edit. */
  onChange: (next: RuleSet) => void;
  /** Display settings; missing fields use the defaults. */
  settings?: Partial<RaciSettings>;
  /** When true, nothing can be changed. */
  readOnly?: boolean;
  /**
   * Opt-in read-only start. `"edit"` (default) is today's behaviour: no Edit, Save or Cancel.
   * `"view"` starts read-only; Edit opens a working copy with Save and Cancel.
   */
  defaultMode?: EditorMode;
  /** Controlled mode; pair it with `onModeChange`. */
  mode?: EditorMode;
  /** Asked to switch mode: Edit asks for `"edit"`, Save and Cancel ask for `"view"`. */
  onModeChange?: (mode: EditorMode) => void;
  /** Whether editing is offered. Default true. When false the Edit button is hidden. */
  canEdit?: boolean;
  /** The host's words for why editing is not offered. With `canEdit` false it shows beside a disabled Edit. */
  readOnlyReason?: string;
  /** Called once when Save is pressed, with the working copy. The host stores it. */
  onSave?: (ruleSet: RuleSet) => void;
  /** Called after Cancel has discarded the working copy. */
  onCancel?: () => void;
  /** Asked before unsaved changes are discarded; the built-in dialog is the default. */
  confirmDiscard?: () => boolean | Promise<boolean>;
  /** Cell look: `"box"` (default) or `"marks"`. Ignored when `renderCell` is given. */
  cellVariant?: CellVariant;
  /** Draws every cell itself. Gets the state, the actions and the size tokens; see `RenderCellProps`. */
  renderCell?: (cell: RenderCellProps) => ReactNode;
  /** Extra class on the root element. */
  className?: string;
}

const STAR = "*";

/** Labels from the root down to the node with this id, or undefined when it is not in the tree. */
const findPath = (nodes: ResourceNode[], id: string): string[] | undefined => {
  for (const node of nodes) {
    if (node.id === id) return [node.label];
    const inner = findPath(node.children ?? [], id);
    if (inner !== undefined) return [node.label, ...inner];
  }
  return undefined;
};

const actionName = (a: ActionDef): string => a.label ?? a.id;

interface Pending {
  subject: string;
  action: ActionDef;
}

/** Matrix editor for the entries of one category. Controlled: it never mutates its input. */
export const RulesEditor = (props: RulesEditorProps) => {
  const { config, categoryId, readOnly = false, className, renderCell } = props;
  const marks = props.cellVariant === "marks";
  const savedRuleSet = props.ruleSet;

  // The mode bar (Edit, Save, Cancel) is opt-in: a host that sets none of these props sees today's
  // editor, editable, with no extra controls.
  const barActive =
    props.mode !== undefined || props.defaultMode !== undefined || props.onSave !== undefined;
  const [innerMode, setInnerMode] = useState<EditorMode>(props.defaultMode ?? "edit");
  const mode: EditorMode = barActive ? (props.mode ?? innerMode) : "edit";
  const viewing = barActive && !readOnly && mode === "view";
  const editingWithBar = barActive && !readOnly && mode === "edit";
  const locked = readOnly || viewing;
  const canEdit = props.canEdit ?? true;
  const [draft, setDraft] = useState<RuleSet | null>(null);
  const startRef = useRef<RuleSet | null>(null);
  const savedOnce = useRef(false);
  const [discarding, setDiscarding] = useState(false);
  // While editing, the editor works on a copy; the host's `ruleSet` is what Edit started from.
  const ruleSet = editingWithBar && draft ? draft : savedRuleSet;
  const dirty =
    editingWithBar &&
    startRef.current !== null &&
    JSON.stringify(draft ?? savedRuleSet) !== JSON.stringify(startRef.current);

  useEffect(() => {
    if (!editingWithBar) {
      setDraft(null);
      startRef.current = null;
      setDiscarding(false);
    } else {
      savedOnce.current = false;
    }
  }, [editingWithBar]);

  const changeMode = (next: EditorMode) => {
    props.onModeChange?.(next);
    if (props.mode === undefined) setInnerMode(next);
  };
  // Every edit goes through here: into the working copy while editing, and on to the host.
  const onChange = (next: RuleSet) => {
    if (editingWithBar) {
      if (startRef.current === null) startRef.current = savedRuleSet;
      setDraft(next);
    }
    props.onChange(next);
  };
  const leave = () => {
    if (dirty && startRef.current) props.onChange(startRef.current);
    setDraft(null);
    setDiscarding(false);
    props.onCancel?.();
    changeMode("view");
  };
  const cancel = () => {
    if (!dirty) {
      leave();
    } else if (props.confirmDiscard) {
      void Promise.resolve(props.confirmDiscard()).then((ok) => {
        if (ok) leave();
      });
    } else {
      setDiscarding(true);
    }
  };
  const save = () => {
    if (savedOnce.current) return;
    savedOnce.current = true;
    props.onSave?.(ruleSet);
    changeMode("view");
  };
  const settings: RaciSettings = { ...defaultSettings(config), ...props.settings };
  const t = useMemo(() => makeT(config, editorStrings), [config]);
  const uid = useId();

  // Subjects added in the UI that have no entry yet, kept per category for the life of the editor.
  const [added, setAdded] = useState<Record<string, string[]>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);

  const extras = added[categoryId] ?? [];
  const own = ruleSet.categories[categoryId];
  const entries = own?.entries ?? [];
  const stop = own?.stopInheriting ?? false;
  // Row order is remembered per category so a row never moves when its cells change.
  const orderRef = useRef<Record<string, string[]>>({});
  const rows = stableRows(orderRef.current[categoryId] ?? [], deriveRows(entries, extras));
  orderRef.current[categoryId] = rows;

  const visible = new Set(settings.visibleActions);
  const columns = config.actions.filter((a) => visible.has(a.id));
  const kinds = config.subjectKinds.filter((k) => settings.enabledSubjectKinds.includes(k.kind));

  const subjectLabel = (subject: string): string => {
    const kind = config.subjectKinds.find((k) => subject.startsWith(`${k.kind}:`));
    return kind?.resolve?.(subject) ?? labels[subject] ?? subject;
  };
  const resourceLabel = (id: string): string =>
    id === STAR
      ? t("editor.allCategories")
      : (findPath(config.resources, id)?.join(t("editor.pathSeparator")) ?? id);
  const stateWord = (effect: Effect | undefined): string =>
    t(effect === "allow" ? "editor.allow" : effect === "deny" ? "editor.deny" : "editor.blank");
  const stateText = (effect: Effect | undefined): string =>
    t(
      effect === "allow"
        ? "editor.allowText"
        : effect === "deny"
          ? "editor.denyText"
          : "editor.blankText",
    );

  const keep = (subject: string) =>
    setAdded((prev) => {
      const current = prev[categoryId] ?? [];
      return current.includes(subject) ? prev : { ...prev, [categoryId]: [...current, subject] };
    });

  const apply = (subject: string, action: ActionDef, effect: Effect | undefined) => {
    keep(subject);
    onChange(setCell(ruleSet, categoryId, subject, action.id, effect));
  };

  const request = (subject: string, action: ActionDef, next: Effect | undefined) => {
    if (next === "deny" && settings.confirmDeny) {
      setPending({ subject, action });
    } else {
      apply(subject, action, next);
    }
  };

  const cycle = (subject: string, action: ActionDef) =>
    request(subject, action, nextEffect(cellEffect(entries, subject, action.id)));

  // Actions a subject's allowed cells include, mapped to the action that includes them.
  const includedBy = (subject: string): Map<string, ActionDef> => {
    const out = new Map<string, ActionDef>();
    for (const col of config.actions) {
      if (cellEffect(entries, subject, col.id) !== "allow") continue;
      for (const implied of impliedActions(config.actions, col.id)) {
        if (!out.has(implied)) out.set(implied, col);
      }
    }
    return out;
  };

  const inherited = settings.showInherited ? inheritedGroups(ruleSet, categoryId, stop) : [];

  const rootClass = [
    "raci-root",
    "raci-editor",
    `raci-editor--${settings.density}`,
    readOnly ? "raci-editor--readonly" : "",
    viewing ? "raci-editor--viewing" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClass} aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="raci-editor__title">
        {t("editor.title", { category: resourceLabel(categoryId) })}
      </h2>
      {barActive && !readOnly && (
        <div className="raci-editor__modebar">
          <span role="status" className="raci-editor__unsaved">
            {dirty ? t("editor.unsaved") : ""}
          </span>
          {mode === "view" ? (
            <>
              {(canEdit || props.readOnlyReason !== undefined) && (
                <button
                  type="button"
                  className="raci-button"
                  disabled={!canEdit}
                  title={!canEdit ? props.readOnlyReason : undefined}
                  onClick={() => changeMode("edit")}
                >
                  {t("editor.edit")}
                </button>
              )}
              {!canEdit && props.readOnlyReason !== undefined && (
                <span className="raci-muted">{props.readOnlyReason}</span>
              )}
            </>
          ) : (
            <>
              <button type="button" className="raci-button" onClick={cancel}>
                {t("editor.cancel")}
              </button>
              <button
                type="button"
                className="raci-button raci-button--primary"
                disabled={!dirty}
                onClick={save}
              >
                {t("editor.save")}
              </button>
            </>
          )}
        </div>
      )}
      <div className="raci-editor__toolbar">
        <label className="raci-check">
          <input
            type="checkbox"
            checked={stop}
            disabled={locked}
            aria-describedby={`${uid}-stop-help`}
            onChange={() => onChange(setStopInheriting(ruleSet, categoryId, !stop))}
          />
          <span>{t("editor.stopInheriting")}</span>
        </label>
        <span id={`${uid}-stop-help`} className="raci-muted">
          {t("editor.stopInheritingHelp")}
        </span>
      </div>

      <div className="raci-editor__scroll">
        <table className="raci-table" aria-readonly={viewing ? "true" : undefined}>
          <thead>
            <tr>
              <th scope="col" className="raci-table__subject">
                {t("editor.subject")}
              </th>
              {columns.map((a) => (
                <th scope="col" key={a.id} title={a.description}>
                  {actionName(a)}
                </th>
              ))}
              {!readOnly && (
                <th scope="col">
                  <span className="raci-visually-hidden">{t("editor.remove")}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="raci-empty" colSpan={columns.length + 2}>
                  {t("editor.empty")}
                </td>
              </tr>
            )}
            {rows.map((subject) => {
              const label = subjectLabel(subject);
              const included = includedBy(subject);
              return (
                <tr key={subject} data-subject={subject}>
                  <th scope="row" className="raci-table__subject">
                    {label}
                  </th>
                  {columns.map((a) => {
                    const effect = cellEffect(entries, subject, a.id);
                    const via = effect === undefined ? included.get(a.id) : undefined;
                    const base = t("editor.cellLabel", {
                      subject: label,
                      action: actionName(a),
                      state: stateWord(effect),
                    });
                    const aria = via
                      ? t("editor.cellLabelIncluded", {
                          subject: label,
                          action: actionName(a),
                          state: stateWord(effect),
                          via: actionName(via),
                        })
                      : base;
                    return (
                      <td key={a.id}>
                        {renderCell ? (
                          renderCell({
                            state: effect ?? "blank",
                            inherited: false,
                            includedBy: via,
                            action: a,
                            subject,
                            subjectLabel: label,
                            label: aria,
                            title: via
                              ? t("editor.includedVia", { action: actionName(via) })
                              : stateText(effect),
                            readOnly: locked,
                            onChange: (next) => request(subject, a, next),
                            onCycle: () => cycle(subject, a),
                            size: SIZE,
                          })
                        ) : (
                          <button
                            type="button"
                            className={`raci-cell raci-cell--${effect ?? "blank"}${via ? " raci-cell--included" : ""}${marks ? " raci-cell--marks" : ""}`}
                            aria-label={aria}
                            title={
                              via
                                ? t("editor.includedVia", { action: actionName(via) })
                                : stateText(effect)
                            }
                            disabled={locked}
                            onClick={() => cycle(subject, a)}
                          >
                            {marks ? (
                              <MarkIcon effect={effect ?? (via ? "allow" : undefined)} />
                            ) : (
                              <>
                                <span className="raci-cell__primary" aria-hidden="true">
                                  <EffectIcon effect={effect} />
                                  <span className="raci-cell__text">{stateText(effect)}</span>
                                </span>
                                <span
                                  className={`raci-cell__secondary${via ? "" : " raci-cell__secondary--off"}`}
                                  aria-hidden="true"
                                >
                                  {t("editor.included")}
                                </span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td>
                      <button
                        type="button"
                        className="raci-button raci-button--quiet"
                        aria-label={t("editor.removeLabel", { subject: label })}
                        disabled={viewing}
                        onClick={() => {
                          setAdded((prev) => ({
                            ...prev,
                            [categoryId]: (prev[categoryId] ?? []).filter((s) => s !== subject),
                          }));
                          onChange(removeSubject(ruleSet, categoryId, subject));
                        }}
                      >
                        {t("editor.remove")}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && kinds.length > 0 && (
        <SubjectPicker
          kinds={kinds}
          existing={rows}
          disabled={viewing}
          t={t}
          onPick={(option) => {
            setLabels((prev) => ({ ...prev, [option.id]: option.label }));
            keep(option.id);
          }}
        />
      )}

      {stop && settings.showInherited && (
        <p className="raci-muted raci-editor__stopped">{t("editor.inheritanceStopped")}</p>
      )}

      {inherited.map((group) => (
        <InheritedTable
          key={group.categoryId}
          title={t("editor.inheritedFrom", { resource: resourceLabel(group.categoryId) })}
          note={t("editor.inheritedNote")}
          entries={group.entries}
          columns={columns}
          subjectLabel={subjectLabel}
          stateWord={stateWord}
          stateText={stateText}
          marks={marks}
          renderCell={renderCell}
          t={t}
        />
      ))}

      {discarding && (
        <ConfirmDeny
          title={t("editor.discardTitle")}
          body={t("editor.discardBody", { category: resourceLabel(categoryId) })}
          confirm={t("editor.discard")}
          cancel={t("editor.keepEditing")}
          onConfirm={leave}
          onCancel={() => setDiscarding(false)}
        />
      )}

      {pending && (
        <ConfirmDeny
          title={t("editor.confirmDenyTitle")}
          body={t("editor.confirmDenyBody", {
            action: actionName(pending.action),
            subject: subjectLabel(pending.subject),
          })}
          confirm={t("editor.confirm")}
          cancel={t("editor.cancel")}
          onConfirm={() => {
            apply(pending.subject, pending.action, "deny");
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  );
};

interface InheritedTableProps {
  title: string;
  note: string;
  entries: Entry[];
  columns: ActionDef[];
  subjectLabel: (subject: string) => string;
  stateWord: (effect: Effect | undefined) => string;
  stateText: (effect: Effect | undefined) => string;
  marks: boolean;
  renderCell?: (cell: RenderCellProps) => ReactNode;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const InheritedTable = (props: InheritedTableProps) => {
  const {
    title,
    note,
    entries,
    columns,
    subjectLabel,
    stateWord,
    stateText,
    marks,
    renderCell,
    t,
  } = props;
  return (
    <div className="raci-editor__inherited">
      <h3 className="raci-editor__inherited-title">{title}</h3>
      <p className="raci-muted">{note}</p>
      <div className="raci-editor__scroll">
        <table className="raci-table raci-table--inherited">
          <caption className="raci-visually-hidden">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="raci-table__subject">
                {t("editor.subject")}
              </th>
              {columns.map((a) => (
                <th scope="col" key={a.id}>
                  {actionName(a)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deriveRows(entries).map((subject) => (
              <tr key={subject}>
                <th scope="row" className="raci-table__subject">
                  {subjectLabel(subject)}
                </th>
                {columns.map((a) => {
                  const effect = cellEffect(entries, subject, a.id);
                  const label = t("editor.cellLabel", {
                    subject: subjectLabel(subject),
                    action: actionName(a),
                    state: stateWord(effect),
                  });
                  return (
                    <td key={a.id}>
                      {renderCell ? (
                        renderCell({
                          state: effect ?? "blank",
                          inherited: true,
                          action: a,
                          subject,
                          subjectLabel: subjectLabel(subject),
                          label,
                          title: stateText(effect),
                          readOnly: true,
                          onChange: NOOP,
                          onCycle: NOOP,
                          size: SIZE,
                        })
                      ) : (
                        <span
                          className={`raci-cell raci-cell--${effect ?? "blank"} raci-cell--inherited${marks ? " raci-cell--marks" : ""}`}
                          role="img"
                          aria-label={label}
                        >
                          {marks ? (
                            <MarkIcon effect={effect} />
                          ) : (
                            <>
                              <span className="raci-cell__primary" aria-hidden="true">
                                <EffectIcon effect={effect} />
                                <span className="raci-cell__text">{stateText(effect)}</span>
                              </span>
                              <span
                                className="raci-cell__secondary raci-cell__secondary--off"
                                aria-hidden="true"
                              >
                                {t("editor.included")}
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface ConfirmDenyProps {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDeny = ({ title, body, confirm, cancel, onConfirm, onCancel }: ConfirmDenyProps) => {
  const id = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);
  return (
    <div className="raci-modal" role="presentation">
      <div
        className="raci-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <h3 id={`${id}-title`} className="raci-dialog__title">
          {title}
        </h3>
        <p id={`${id}-body`}>{body}</p>
        <div className="raci-dialog__actions">
          <button type="button" className="raci-button" onClick={onCancel}>
            {cancel}
          </button>
          <button
            type="button"
            className="raci-button raci-button--danger"
            ref={confirmRef}
            onClick={onConfirm}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
};
