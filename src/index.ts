/**
 * node-raci-editor
 *
 * Generic drop-in React rules editor, simulator and settings for RACI-style access rules, with a pure TypeScript decide() and shared test vectors.
 */

export * from "./core/types.js";
export { decide } from "./core/decide.js";
export { vectorSubjects } from "./core/vectors.js";
export type { VectorPerson } from "./core/vectors.js";

export { Simulator } from "./react/simulator/Simulator.js";
export type { SimulatorProps } from "./react/simulator/Simulator.js";
