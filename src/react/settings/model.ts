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
import { normalizeCells } from "@/core/cells";
import { defaultSettings } from "@/core/types";
import type { RaciConfig, RaciSettings } from "@/core/types";

/** @inline */
type ConfigShape = Pick<RaciConfig, "actions" | "subjectKinds">;

/** Move a visible action one place up (-1) or down (1). Returns the same object when nothing moves. */
export const moveAction = (settings: RaciSettings, id: string, delta: -1 | 1): RaciSettings => {
  const from = settings.visibleActions.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= settings.visibleActions.length) return settings;
  const next = [...settings.visibleActions];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return { ...settings, visibleActions: next };
};

/** Show or hide an action. Showing appends it; hiding the last visible action is refused. */
export const toggleAction = (settings: RaciSettings, id: string): RaciSettings => {
  if (settings.visibleActions.includes(id)) {
    if (settings.visibleActions.length <= 1) return settings;
    return { ...settings, visibleActions: settings.visibleActions.filter((a) => a !== id) };
  }
  return { ...settings, visibleActions: [...settings.visibleActions, id] };
};

/** Enable or disable a subject kind. Disabling the last enabled kind is refused. */
export const toggleKind = (settings: RaciSettings, kind: string): RaciSettings => {
  if (settings.enabledSubjectKinds.includes(kind)) {
    if (settings.enabledSubjectKinds.length <= 1) return settings;
    return {
      ...settings,
      enabledSubjectKinds: settings.enabledSubjectKinds.filter((k) => k !== kind),
    };
  }
  return { ...settings, enabledSubjectKinds: [...settings.enabledSubjectKinds, kind] };
};

const known = (ids: string[] | undefined, valid: string[]): string[] =>
  [...new Set(ids ?? [])].filter((id) => valid.includes(id));

/** Merge partial settings over the defaults: unknown ids are dropped, empty lists fall back. */
export const normalizeSettings = (
  config: ConfigShape,
  partial?: Partial<RaciSettings>,
): RaciSettings => {
  const base = defaultSettings(config);
  const actions = known(
    partial?.visibleActions,
    config.actions.map((a) => a.id),
  );
  const kinds = known(
    partial?.enabledSubjectKinds,
    config.subjectKinds.map((k) => k.kind),
  );
  const density =
    partial?.density === "compact" || partial?.density === "comfortable"
      ? partial.density
      : base.density;
  const cells = normalizeCells(partial?.cells).value;
  return {
    visibleActions: actions.length > 0 ? actions : base.visibleActions,
    enabledSubjectKinds: kinds.length > 0 ? kinds : base.enabledSubjectKinds,
    showInherited: partial?.showInherited ?? base.showInherited,
    confirmDeny: partial?.confirmDeny ?? base.confirmDeny,
    density,
    ...(Object.keys(cells).length > 0 ? { cells } : {}),
  };
};
