import { defaultSettings } from "@/core/types";
import type { RaciConfig, RaciSettings } from "@/core/types";

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
  return {
    visibleActions: actions.length > 0 ? actions : base.visibleActions,
    enabledSubjectKinds: kinds.length > 0 ? kinds : base.enabledSubjectKinds,
    showInherited: partial?.showInherited ?? base.showInherited,
    confirmDeny: partial?.confirmDeny ?? base.confirmDeny,
    density,
    defaultStopInheriting: partial?.defaultStopInheriting ?? base.defaultStopInheriting,
  };
};
