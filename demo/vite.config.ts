import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const fromRoot = (file: string) => fileURLToPath(new URL(`../${file}`, import.meta.url));

// The demo imports the package source directly through the same `@/` alias the
// package uses, so a change in src/ shows up at once.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: { "@": fromRoot("src") },
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", port: 5179, strictPort: true, fs: { allow: [fromRoot("")] } },
  preview: { host: "127.0.0.1", port: 5179, strictPort: true },
  build: { outDir: fromRoot("demo/dist"), emptyOutDir: true },
});
