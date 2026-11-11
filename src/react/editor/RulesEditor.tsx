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
import type { CSSProperties, ReactNode } from "react";
import { cellStateId, normalizeCells, resolveCellStyle } from "@/core/cells";
import { defaultSettings } from "@/core/types";
import type {
  ActionDef,
  MatcherDef,
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
import { MarkIcon } from "@/react/editor/Icon";
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

/** How action headings read: the full label, the short label, or short when the grid is narrow or compact. */
export type HeaderMode = "full" | "short" | "auto";

/** Below this width of the grid's scroll area, `auto` switches to short labels. */
const NARROW_PX = 640;

/** The built-in subject every asker has. */
const EVERYONE_SUBJECT = "everyone:*";

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
   * Action headings: `"full"`, `"short"` (uses `ActionDef.shortLabel`) or `"auto"` (default: short at
   * compact density or when the grid is narrow). The full label is always the heading's tooltip
   * and accessible name.
   */
  headerMode?: HeaderMode;
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

/** A plain choice of the built-in Everyone and the host's matchers, with no kind chooser and no search. */
const MatcherPicker = (props: {
  matchers: MatcherDef[];
  existing: string[];
  everyoneLabel: string;
  label: string;
  pickLabel: string;
  placeholder: string;
  onPick: (subject: string) => void;
}) => {
  const free = props.matchers.filter((m) => !props.existing.includes(m.id));
  const groups = [...new Set(free.flatMap((m) => (m.group ? [m.group] : [])))];
  const option = (m: MatcherDef) => (
    <option key={m.id} value={m.id} title={m.description}>
      {m.label}
    </option>
  );
  return (
    <div className="raci-picker" role="group" aria-label={props.label}>
      <select
        className="raci-select"
        aria-label={props.pickLabel}
        value=""
        onChange={(e) => {
          if (e.target.value) props.onPick(e.target.value);
        }}
      >
        <option value="">{props.placeholder}</option>
        {!props.existing.includes(EVERYONE_SUBJECT) && (
          <option value={EVERYONE_SUBJECT}>{props.everyoneLabel}</option>
        )}
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {free.filter((m) => m.group === g).map(option)}
          </optgroup>
        ))}
        {free.filter((m) => !m.group).map(option)}
      </select>
    </div>
  );
};
/** The key for short headings: each short label with its full name. */
const keyOf = (actions: ActionDef[]): string =>
  actions
    .filter((a) => a.shortLabel)
    .map((a) => `${a.shortLabel} ${actionName(a)}`)
    .join(", ");

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
  const visibleColumns = config.actions.filter((a) => visible.has(a.id));
  // The host groups the columns: by `ActionDef.group`, else by `kind`, else all in one group. Groups
  // are drawn in `config.groups` order (access, then obligation, when there is none), each group's
  // columns in the host's order, and only when there is more than one group.
  const groupOf = (a: ActionDef): string => a.group ?? a.kind ?? "access";
  const present = [...new Set(visibleColumns.map(groupOf))];
  const order = config.groups?.map((g) => g.id) ?? ["access", "obligation"];
  const groupIds = [
    ...order.filter((id) => present.includes(id)),
    ...present.filter((id) => !order.includes(id)),
  ];
  const grouped = groupIds.length > 1;
  const columns = grouped
    ? groupIds.flatMap((id) => visibleColumns.filter((a) => groupOf(a) === id))
    : visibleColumns;
  const groupLabel = (id: string): string =>
    config.groups?.find((g) => g.id === id)?.label ??
    config.kindLabels?.[id] ??
    (id === "access" || id === "obligation" ? t(`editor.group.${id}`) : id);
  const groupHeadings: GroupHeading[] = groupIds.map((id) => ({
    id,
    count: columns.filter((a) => groupOf(a) === id).length,
    label: groupLabel(id),
  }));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (typeof ResizeObserver === "undefined" || !el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setNarrow(width < NARROW_PX);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const headerMode = props.headerMode ?? "auto";
  const short =
    headerMode === "short" || (headerMode === "auto" && (settings.density === "compact" || narrow));
  const headerText = (a: ActionDef): string =>
    short && a.shortLabel ? a.shortLabel : actionName(a);
  const headerName = (a: ActionDef): string | undefined =>
    short && a.shortLabel ? actionName(a) : undefined;
  const headerTitle = (a: ActionDef): string | undefined =>
    short && a.shortLabel
      ? a.description
        ? `${actionName(a)}: ${a.description}`
        : actionName(a)
      : a.description;
  const kinds = config.subjectKinds.filter((k) => settings.enabledSubjectKinds.includes(k.kind));

  const subjectLabel = (subject: string): string => {
    if (subject === EVERYONE_SUBJECT) return t("editor.everyone");
    const kind = config.subjectKinds.find((k) => subject.startsWith(`${k.kind}:`));
    return (
      kind?.resolve?.(subject) ??
      config.matchers?.find((m) => m.id === subject)?.label ??
      labels[subject] ??
      subject
    );
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
    <section className={rootClass} style={rootStyle} aria-labelledby={`${uid}-title`}>
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

      <div className="raci-editor__scroll" ref={scrollRef}>
        <table className="raci-table" aria-readonly={viewing ? "true" : undefined}>
          <TableHead
            columns={columns}
            groups={grouped ? groupHeadings : null}
            subject={t("editor.subject")}
            text={headerText}
            title={headerTitle}
            name={headerName}
            removeLabel={readOnly ? undefined : t("editor.remove")}
          />
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
                        {renderCell ? (
                          renderCell({
                            state: effect ?? "blank",
                            inherited: false,
                            includedBy: via,
                            action: a,
                            subject,
                            subjectLabel: label,
                            label: aria,
                            title:
                              st.tooltip ??
                              (via
                                ? t("editor.includedVia", { action: actionName(via) })
                                : stateText(effect)),
                            readOnly: locked,
                            onChange: (next) => request(subject, a, next),
                            onCycle: () => cycle(subject, a),
                            size: SIZE,
                          })
                        ) : (
                          <button
                            type="button"
                            className={`raci-cell raci-cell--${effect ?? "blank"}${via ? " raci-cell--included" : ""}${marks ? " raci-cell--marks" : ""}${st.className ? ` ${st.className}` : ""}`}
                            style={cellInline(st)}
                            aria-label={aria}
                            title={
                              st.tooltip ??
                              (via
                                ? t("editor.includedVia", { action: actionName(via) })
                                : stateText(effect))
                            }
                            disabled={locked}
                            onClick={() => cycle(subject, a)}
                          >
                            {marks ? (
                              st.glyph === undefined ? (
                                <MarkIcon effect={effect ?? (via ? "allow" : undefined)} />
                              ) : (
                                cellGlyph(st, sid, effect)
                              )
                            ) : (
                              <>
                                <span className="raci-cell__primary" aria-hidden="true">
                                  {cellGlyph(st, sid, effect)}
                                  <span className="raci-cell__text">
                                    {st.text ?? stateText(effect)}
                                  </span>
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

      {short && columns.some((a) => a.shortLabel) && (
        <p className="raci-editor__key raci-muted">
          {t("editor.key")}:{" "}
          {grouped
            ? groupHeadings
                .map((g) => `${g.label}: ${keyOf(columns.filter((a) => groupOf(a) === g.id))}`)
                .join("; ")
            : keyOf(columns)}
        </p>
      )}

      {!readOnly && (config.matchers !== undefined || config.subjectKinds.length === 0) && (
        <MatcherPicker
          matchers={config.matchers ?? []}
          existing={rows}
          everyoneLabel={t("editor.everyone")}
          label={t("editor.addSubject")}
          pickLabel={t("editor.pickMatcher")}
          placeholder={t("editor.addPlaceholder")}
          onPick={keep}
        />
      )}

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
          styleOf={styleOf}
          headerText={headerText}
          headerTitle={headerTitle}
          headerName={headerName}
          groups={grouped ? groupHeadings : null}
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

/** A column group heading: its kind, how many columns it spans and its label. */
interface GroupHeading {
  id: string;
  count: number;
  label: string;
}

/** The heading rows of an action grid, used by the editable grid and the inherited tables alike. */
const TableHead = (props: {
  columns: ActionDef[];
  groups: GroupHeading[] | null;
  subject: string;
  text: (a: ActionDef) => string;
  title: (a: ActionDef) => string | undefined;
  name: (a: ActionDef) => string | undefined;
  /** Set when the grid has a trailing removal column; its hidden heading text. */
  removeLabel?: string;
}) => {
  const { columns, groups, subject, text, title, name, removeLabel } = props;
  // Column positions where a group after the first starts.
  const starts = new Set<number>();
  let at = 0;
  for (const g of groups?.slice(0, -1) ?? []) {
    at += g.count;
    starts.add(at);
  }
  return (
    <thead>
      {groups && (
        <tr className="raci-table__groups">
          <td className="raci-table__corner" />
          {groups.map((g, i) => (
            <th
              scope="colgroup"
              colSpan={g.count}
              key={g.id}
              className={`raci-table__group${i > 0 ? " raci-col-group-start" : ""}`}
            >
              {g.label}
            </th>
          ))}
          {removeLabel !== undefined && <td className="raci-table__corner" />}
        </tr>
      )}
      <tr>
        <th scope="col" className="raci-table__subject">
          {subject}
        </th>
        {columns.map((a, i) => (
          <th
            scope="col"
            key={a.id}
            className={starts.has(i) ? "raci-col-group-start" : undefined}
            title={title(a)}
            aria-label={name(a)}
          >
            {text(a)}
          </th>
        ))}
        {removeLabel !== undefined && (
          <th scope="col">
            <span className="raci-visually-hidden">{removeLabel}</span>
          </th>
        )}
      </tr>
    </thead>
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
  headerText: (a: ActionDef) => string;
  headerTitle: (a: ActionDef) => string | undefined;
  headerName: (a: ActionDef) => string | undefined;
  groups: GroupHeading[] | null;
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
    styleOf,
    headerText,
    headerTitle,
    headerName,
    groups,
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
          <TableHead
            columns={columns}
            groups={groups}
            subject={t("editor.subject")}
            text={headerText}
            title={headerTitle}
            name={headerName}
          />
          <tbody>
            {deriveRows(entries).map((subject) => (
              <tr key={subject}>
                <th scope="row" className="raci-table__subject">
                  {subjectLabel(subject)}
                </th>
                {columns.map((a) => {
                  const effect = cellEffect(entries, subject, a.id);
                  const { id: sid, st } = styleOf(effect, true, false);
                  const label = t("editor.cellLabel", {
                    subject: subjectLabel(subject),
                    action: actionName(a),
                    state: st.label ?? stateWord(effect),
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
                          title: st.tooltip ?? stateText(effect),
                          readOnly: true,
                          onChange: NOOP,
                          onCycle: NOOP,
                          size: SIZE,
                        })
                      ) : (
                        <span
                          className={`raci-cell raci-cell--${effect ?? "blank"} raci-cell--inherited${marks ? " raci-cell--marks" : ""}${st.className ? ` ${st.className}` : ""}`}
                          style={cellInline(st)}
                          role="img"
                          aria-label={label}
                        >
                          {marks ? (
                            st.glyph === undefined ? (
                              <MarkIcon effect={effect} />
                            ) : (
                              cellGlyph(st, sid, effect)
                            )
                          ) : (
                            <>
                              <span className="raci-cell__primary" aria-hidden="true">
                                {cellGlyph(st, sid, effect)}
                                <span className="raci-cell__text">
                                  {st.text ?? stateText(effect)}
                                </span>
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
