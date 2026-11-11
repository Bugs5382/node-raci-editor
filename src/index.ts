/**
 * node-raci-editor
 *
 * Generic drop-in React rules editor, simulator and settings for RACI-style access rules, with a pure TypeScript decide() and shared test vectors.
 */

export * from "./core/types.js";
export { decide } from "./core/decide.js";
export { vectorSubjects } from "./core/vectors.js";
export type { VectorPerson } from "./core/vectors.js";
export {
  SettingsPanel,
  normalizeSettings,
  moveAction,
  toggleAction,
  toggleKind,
} from "./react/settings/index.js";
export type { SettingsPanelProps } from "./react/settings/index.js";
