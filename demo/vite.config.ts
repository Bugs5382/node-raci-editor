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
import { defineConfig } from "vite";

const fromRoot = (file: string) => fileURLToPath(new URL(`../${file}`, import.meta.url));

// The demo imports the package source directly through the same `@/` alias the
// package uses, so a change in src/ shows up at once.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  // Relative asset URLs so the built site works from any subfolder.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@": fromRoot("src") },
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", port: 5179, strictPort: true, fs: { allow: [fromRoot("")] } },
  preview: { host: "127.0.0.1", port: 5179, strictPort: true },
  // Built into dist/ so the packed bin (raci-editor-demo) can serve it.
  build: { outDir: fromRoot("dist/demo-site"), emptyOutDir: true },
});
