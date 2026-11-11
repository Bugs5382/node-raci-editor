import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text", "lcov"],
      thresholds: {
        "src/core/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
