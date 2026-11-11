import { defineConfig } from "tsdown";

// The JavaScript and declarations are built here; dist/styles.css is written by
// scripts/buildCss.mjs right after (npm run build), which inlines the @imports.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  // react is a peer dependency; never bundle it.
  external: ["react", "react-dom", /^react\//, /^react-dom\//],
  // No source maps: they are never published (check:pack rejects them), and a
  // bundle that points at a missing map makes debuggers and bundlers warn.
  sourcemap: false,
});
