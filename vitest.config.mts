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
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("src", import.meta.url)) };

const domTests = ["src/react/**/*.test.{ts,tsx}", "src/**/*.test.tsx", "tests/**/*.test.tsx"];

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
