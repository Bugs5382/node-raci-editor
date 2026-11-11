import type { RaciConfig } from "@/core/types";

/** Look up a UI string: the host's override first, then the component's default, then the key. */
export const makeT = (
  config: Pick<RaciConfig, "strings">,
  defaults: Record<string, string>,
): ((key: string, vars?: Record<string, string | number>) => string) => {
  return (key, vars) => {
    const raw = config.strings?.[key] ?? defaults[key] ?? key;
    return raw.replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? `{${name}}`));
  };
};
