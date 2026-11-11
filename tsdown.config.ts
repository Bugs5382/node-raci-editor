import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  // No source maps: they are never published (check:pack rejects them), and a
  // bundle that points at a missing map makes debuggers and bundlers warn.
  sourcemap: false,
});
