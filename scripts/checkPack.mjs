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
// Package contents and size gate. Run it after `npm run build`:
//
//   npm run build && npm run check:pack
//
// It runs `npm pack --dry-run --json --ignore-scripts`, so it checks exactly
// what `files` and the build produce, and it fails when the tarball would ship
// a source map, TypeScript source, tests or another non-runtime folder, misses
// a package entry point, or goes over the unpacked-size ceiling. In CI it also
// writes the file list and sizes to the job summary.
//
// The ceiling is per repo: set `config.packMaxUnpackedBytes` in package.json.
// Raise it on purpose, in the same PR as the growth, and say why.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import console from "node:console";
import process from "node:process";

// Used when package.json sets no ceiling. A small library build plus README,
// LICENSE and CHANGELOG is well under this, and a bundled dependency or stray
// build output is well over it.
const DEFAULT_MAX_UNPACKED_BYTES = 250_000;

const FORBIDDEN = [
  { pattern: /\.map$/, reason: "source map" },
  {
    pattern: /^(src|__tests__|test|tests|docs|scripts|coverage|temp|\.github)\//,
    reason: "non-runtime folder",
  },
  { pattern: /\.(test|spec)\.[cm]?[jt]sx?$/, reason: "test file" },
  { pattern: /(^|\/)\.cache\/|\.tsbuildinfo$/, reason: "build cache" },
];

// TypeScript sources are forbidden; declaration files are the one TypeScript
// output that belongs in the package.
const isTypeScriptSource = (filePath) =>
  /\.[cm]?tsx?$/.test(filePath) && !/\.d\.[cm]?ts$/.test(filePath);

// Every path package.json points consumers at must be in the tarball.
const entryPoints = (manifest) => {
  const found = new Set();
  const walk = (value) => {
    if (typeof value === "string") {
      if (value.startsWith("./") && !value.includes("*")) {
        found.add(value.slice(2));
      }
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  for (const key of ["main", "module", "types", "typings"]) {
    if (typeof manifest[key] === "string") {
      found.add(manifest[key].replace(/^\.\//, ""));
    }
  }
  walk(manifest.exports);
  return [...found];
};

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const configured = Number(manifest.config?.packMaxUnpackedBytes);
const maxUnpacked =
  Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_UNPACKED_BYTES;
console.log(
  `check:pack: ceiling ${maxUnpacked} bytes unpacked ` +
    `(${Number.isFinite(configured) && configured > 0 ? "package.json config.packMaxUnpackedBytes" : "default"})`,
);

console.log("check:pack: running npm pack --dry-run --json --ignore-scripts");
const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
// npm 12 prints an object keyed by package name; earlier versions print an array.
const parsed = JSON.parse(out);
const [pack] = Array.isArray(parsed) ? parsed : Object.values(parsed);

console.log(
  `${pack.name}@${pack.version}: ${pack.entryCount} files, ` +
    `${pack.unpackedSize} bytes unpacked, ${pack.size} bytes packed`,
);
for (const file of pack.files) {
  console.log(`  ${file.size}\t${file.path}`);
}

const problems = [];
if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
  problems.push("package.json has no `files` allowlist, so npm packs the whole repo");
}
const packed = new Set(pack.files.map((file) => file.path));
for (const entry of entryPoints(manifest)) {
  if (!packed.has(entry)) {
    problems.push(`${entry} (entry point missing: run \`npm run build\` first)`);
  }
}
for (const file of pack.files) {
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(file.path)) {
      problems.push(`${file.path} (${reason})`);
    }
  }
  if (isTypeScriptSource(file.path)) {
    problems.push(`${file.path} (TypeScript source)`);
  }
}
if (pack.unpackedSize > maxUnpacked) {
  problems.push(`unpacked size ${pack.unpackedSize} bytes is over the ${maxUnpacked} byte ceiling`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = pack.files.map((file) => `| \`${file.path}\` | ${file.size} |`);
  const summary = [
    `### Package contents: ${pack.name}@${pack.version}`,
    "",
    `${pack.entryCount} files, ${pack.unpackedSize} bytes unpacked ` +
      `(ceiling ${maxUnpacked}), ${pack.size} bytes packed.`,
    "",
    problems.length > 0
      ? `**${problems.length} problems:**\n\n${problems.map((p) => `- ${p}`).join("\n")}`
      : "No problems found.",
    "",
    "| File | Bytes |",
    "| --- | --- |",
    ...rows,
    "",
  ].join("\n");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

if (problems.length > 0) {
  console.error(`check:pack: failed (${problems.length} problems):`);
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  process.exitCode = 1;
} else {
  console.log("check:pack: package contents OK");
}
