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
