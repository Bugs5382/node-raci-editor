import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("src", import.meta.url)) };

const domTests = [
  "src/react/**/*.test.{ts,tsx}",
  "src/**/*.test.tsx",
  "tests/**/*.test.tsx",
  "demo/**/*.test.{ts,tsx}",
];

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      reporter: ["text", "lcov"],
      // 100% for the pure core only; the React layer is not gated.
      thresholds: {
        "src/core/**": { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
    projects: [
      {
        // The pure TypeScript core and everything else without a DOM.
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "node",
          globals: true,
          environment: "node",
          include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["node_modules/**", ...domTests],
        },
      },
      {
        // The React layer and component tests run in jsdom with jest-dom matchers.
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "dom",
          globals: true,
          environment: "jsdom",
          include: domTests,
          exclude: ["node_modules/**"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
