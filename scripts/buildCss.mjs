// Builds dist/styles.css from src/styles/index.css by inlining its relative
// `@import "./file.css";` lines, in order. No dependencies: the stylesheet is
// plain CSS with custom properties, so nothing else needs to run over it.
//
//   npm run build   (runs tsdown, then this script)
import console from "node:console";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const entry = path.resolve("src/styles/index.css");
const output = path.resolve("dist/styles.css");
const IMPORT = /^\s*@import\s+(?:url\()?["']([^"']+)["']\)?\s*;\s*$/gm;

const inline = (file, seen) => {
  if (seen.includes(file)) {
    throw new Error(`circular @import: ${[...seen, file].join(" -> ")}`);
  }
  const source = readFileSync(file, "utf8");
  return source.replace(IMPORT, (_line, target) => {
    if (!target.startsWith(".")) {
      throw new Error(`${file}: only relative @import is supported, got "${target}"`);
    }
    return inline(path.resolve(path.dirname(file), target), [...seen, file]);
  });
};

{
  const css = inline(entry, []);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, css.endsWith("\n") ? css : `${css}\n`);
  console.log(`buildCss: wrote ${path.relative(process.cwd(), output)} (${css.length} bytes)`);
}
