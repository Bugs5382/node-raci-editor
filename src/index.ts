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
/**
 * node-raci-editor
 *
 * Generic drop-in React rules editor, simulator and settings for RACI-style access rules, with a pure TypeScript decide() and shared test vectors.
 */

export * from "./core/types.js";
export { decide } from "./core/decide.js";
export { getModel, listModels, registerModel } from "./core/registry.js";
export type {
  LegendItem,
  ModelCapabilities,
  ModelInput,
  ModelIssue,
  ModelResult,
  RaciModel,
} from "./core/model.js";
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

export { Simulator } from "./react/simulator/Simulator.js";
export type { SimulatorProps } from "./react/simulator/Simulator.js";
export type { ActionResult, SimulatorVariant, SimulatorViewProps } from "./react/simulator/view.js";
export { RulesEditor, impliedActions } from "./react/editor/index.js";
export type { HeaderMode, RulesEditorProps } from "./react/editor/index.js";
