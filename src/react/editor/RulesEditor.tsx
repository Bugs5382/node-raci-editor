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
import type { CSSProperties } from "react";
import { cellStateId, normalizeCells, resolveCellStyle } from "@/core/cells";
import { defaultSettings } from "@/core/types";
import type {
  ActionDef,
  CellStateId,
  CellStateStyle,
  Effect,
  Entry,
  RaciConfig,
  RaciSettings,
  ResourceNode,
  RuleSet,
} from "@/core/types";
import { makeT } from "@/react/strings";
import { cellGlyph, cellInline } from "@/react/editor/cellFace";
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
  const { config, ruleSet, categoryId, onChange, readOnly = false, className } = props;
  const settings: RaciSettings = { ...defaultSettings(config), ...props.settings };
  const t = useMemo(() => makeT(config, editorStrings), [config]);
  const cells = useMemo(() => normalizeCells(settings.cells).value, [settings.cells]);
  const styleOf = (effect: Effect | undefined, inherited: boolean, included: boolean) => {
    const id = cellStateId(effect, inherited, included);
    return { id, st: resolveCellStyle(id, config.cellStates, cells) };
  };
  const rootStyle: CSSProperties | undefined = cells.size
    ? ({
        "--raci-cell-width": `${cells.size.width}px`,
        "--raci-cell-height": `${cells.size.height}px`,
      } as CSSProperties)
    : undefined;
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

  const cycle = (subject: string, action: ActionDef) => {
    const next = nextEffect(cellEffect(entries, subject, action.id));
    if (next === "deny" && settings.confirmDeny) {
      setPending({ subject, action });
    } else {
      apply(subject, action, next);
    }
  };

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
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClass} style={rootStyle} aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="raci-editor__title">
        {t("editor.title", { category: resourceLabel(categoryId) })}
      </h2>
      <div className="raci-editor__toolbar">
        <label className="raci-check">
          <input
            type="checkbox"
            checked={stop}
            disabled={readOnly}
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
        <table className="raci-table">
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
                    const { id: sid, st } = styleOf(effect, false, via !== undefined);
                    const word = st.label ?? stateWord(effect);
                    const base = t("editor.cellLabel", {
                      subject: label,
                      action: actionName(a),
                      state: word,
                    });
                    const aria = via
                      ? t("editor.cellLabelIncluded", {
                          subject: label,
                          action: actionName(a),
                          state: word,
                          via: actionName(via),
                        })
                      : base;
                    return (
                      <td key={a.id}>
                        <button
                          type="button"
                          className={`raci-cell raci-cell--${effect ?? "blank"}${via ? " raci-cell--included" : ""}${st.className ? ` ${st.className}` : ""}`}
                          style={cellInline(st)}
                          aria-label={aria}
                          title={
                            st.tooltip ??
                            (via
                              ? t("editor.includedVia", { action: actionName(via) })
                              : stateText(effect))
                          }
                          disabled={readOnly}
                          onClick={() => cycle(subject, a)}
                        >
                          <span className="raci-cell__primary" aria-hidden="true">
                            {cellGlyph(st, sid, effect)}
                            <span className="raci-cell__text">{st.text ?? stateText(effect)}</span>
                          </span>
                          <span
                            className={`raci-cell__secondary${via ? "" : " raci-cell__secondary--off"}`}
                            aria-hidden="true"
                          >
                            {t("editor.included")}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td>
                      <button
                        type="button"
                        className="raci-button raci-button--quiet"
                        aria-label={t("editor.removeLabel", { subject: label })}
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
          styleOf={styleOf}
          t={t}
        />
      ))}

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
  styleOf: (
    effect: Effect | undefined,
    inherited: boolean,
    included: boolean,
  ) => { id: CellStateId; st: CellStateStyle };
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const InheritedTable = (props: InheritedTableProps) => {
  const { title, note, entries, columns, subjectLabel, stateWord, stateText, styleOf, t } = props;
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
                  const { id: sid, st } = styleOf(effect, true, false);
                  return (
                    <td key={a.id}>
                      <span
                        className={`raci-cell raci-cell--${effect ?? "blank"} raci-cell--inherited${st.className ? ` ${st.className}` : ""}`}
                        style={cellInline(st)}
                        role="img"
                        aria-label={t("editor.cellLabel", {
                          subject: subjectLabel(subject),
                          action: actionName(a),
                          state: st.label ?? stateWord(effect),
                        })}
                      >
                        <span className="raci-cell__primary" aria-hidden="true">
                          {cellGlyph(st, sid, effect)}
                          <span className="raci-cell__text">{st.text ?? stateText(effect)}</span>
                        </span>
                        <span
                          className="raci-cell__secondary raci-cell__secondary--off"
                          aria-hidden="true"
                        >
                          {t("editor.included")}
                        </span>
                      </span>
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
