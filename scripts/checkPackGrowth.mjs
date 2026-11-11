// Package growth gate: compare this build's tarball with the last published
// release. Run it after `npm run build`:
//
//   npm run build && npm run check:pack:growth
//
// It reads `npm pack --dry-run --json --ignore-scripts` for this build and
// `npm view <name> version dist.unpackedSize dist.fileCount --json` for the
// version on the `latest` dist-tag, and fails when the unpacked size or the
// file count grows past the allowed percentage. A package that has never been
// published has nothing to compare against, so the check passes and says so.
//
// The threshold is per repo: set `config.packMaxGrowthPercent` in package.json.
// Tiny packages swing by large percentages on small edits, so growth under
// MIN_GROWTH_BYTES bytes or MIN_GROWTH_FILES files never fails on its own.
//
// Intended growth: add the `pack-size-override` label to the PR. The workflow
// passes it in as PACK_GROWTH_OVERRIDE=true, and the check still reports the
// growth but does not fail. Say why the package grew in the PR body.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import console from "node:console";
import process from "node:process";

const DEFAULT_MAX_GROWTH_PERCENT = 25;
const MIN_GROWTH_BYTES = 10_000;
const MIN_GROWTH_FILES = 5;
const OVERRIDE_LABEL = "pack-size-override";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const configured = Number(manifest.config?.packMaxGrowthPercent);
const fromConfig = Number.isFinite(configured) && configured >= 0;
const maxGrowthPercent = fromConfig ? configured : DEFAULT_MAX_GROWTH_PERCENT;
const overridden = process.env.PACK_GROWTH_OVERRIDE === "true";
console.log(
  `check:pack:growth: threshold ${maxGrowthPercent}% ` +
    `(${fromConfig ? "package.json config.packMaxGrowthPercent" : "default"}), ` +
    `floors ${MIN_GROWTH_BYTES} bytes / ${MIN_GROWTH_FILES} files, ` +
    `override label ${overridden ? "present" : "absent"}`,
);

const summary = (lines) => {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  }
};

// The last published release, or undefined when the package is not on the registry.
const lastPublished = (name) => {
  console.log(`check:pack:growth: npm view ${name} (latest dist-tag)`);
  const started = Date.now();
  try {
    const out = execFileSync(
      "npm",
      ["view", name, "version", "dist.unpackedSize", "dist.fileCount", "--json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    // npm 12 wraps the fields in a one-item array; earlier versions print the object.
    const viewed = JSON.parse(out);
    const view = Array.isArray(viewed) ? viewed[0] : viewed;
    console.log(`check:pack:growth: npm view answered in ${Date.now() - started} ms`);
    return {
      version: view.version,
      unpackedSize: Number(view["dist.unpackedSize"]),
      fileCount: Number(view["dist.fileCount"]),
    };
  } catch (error) {
    // npm view prints a JSON error on stdout with --json; E404 means the
    // package has never been published.
    const text = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    if (/E404|404 Not Found/.test(text)) {
      console.log(`check:pack:growth: ${name} is not published yet (${Date.now() - started} ms)`);
      return undefined;
    }
    console.error(`check:pack:growth: npm view ${name} failed: ${text.trim() || error.message}`);
    throw error;
  }
};

console.log("check:pack:growth: running npm pack --dry-run --json --ignore-scripts");
// npm 12 prints an object keyed by package name; earlier versions print an array.
const parsed = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);
const [pack] = Array.isArray(parsed) ? parsed : Object.values(parsed);
console.log(
  `check:pack:growth: this build ${pack.name}@${pack.version}: ` +
    `${pack.entryCount} files, ${pack.unpackedSize} bytes unpacked`,
);

// No release to compare with: report this build and pass.
const reportUnpublished = () => {
  summary([
    `### Package growth: ${pack.name}`,
    "",
    `Not published yet, so there is no release to compare with. This build: ` +
      `${pack.entryCount} files, ${pack.unpackedSize} bytes unpacked.`,
    "",
  ]);
  console.log("check:pack:growth: skipped (nothing published to compare with)");
  return 0;
};

// Percent change, from before to now.
const percent = (now, before) => (before > 0 ? ((now - before) / before) * 100 : Infinity);

// Compare this build with the published release; returns the exit code.
const compare = (base) => {
  if (!Number.isFinite(base.unpackedSize) || !Number.isFinite(base.fileCount)) {
    console.error(
      `check:pack:growth: registry metadata for ${pack.name}@${base.version} ` +
        "has no dist.unpackedSize or dist.fileCount",
    );
    return 1;
  }
  console.log(
    `check:pack:growth: last published ${pack.name}@${base.version}: ` +
      `${base.fileCount} files, ${base.unpackedSize} bytes unpacked`,
  );

  const measures = [
    {
      label: "unpacked size (bytes)",
      before: base.unpackedSize,
      now: pack.unpackedSize,
      floor: MIN_GROWTH_BYTES,
    },
    { label: "file count", before: base.fileCount, now: pack.entryCount, floor: MIN_GROWTH_FILES },
  ];

  const problems = [];
  const rows = [];
  for (const { label, before, now, floor } of measures) {
    const delta = now - before;
    const change = percent(now, before);
    const over = delta > floor && change > maxGrowthPercent;
    console.log(
      `check:pack:growth: ${label}: ${before} -> ${now} (${delta >= 0 ? "+" : ""}${delta}, ` +
        `${change.toFixed(1)}%)${over ? " over the threshold" : ""}`,
    );
    rows.push(
      `| ${label} | ${before} | ${now} | ${delta >= 0 ? "+" : ""}${delta} | ${change.toFixed(1)}% |`,
    );
    if (over) {
      problems.push(
        `${label} grew ${change.toFixed(1)}% (${before} -> ${now}), over the ` +
          `${maxGrowthPercent}% threshold`,
      );
    }
  }

  let verdict = "Within the threshold.";
  const list = problems.map((p) => `- ${p}`).join("\n");
  if (problems.length > 0 && overridden) {
    verdict = `**Growth allowed by the \`${OVERRIDE_LABEL}\` label:**\n\n${list}`;
  } else if (problems.length > 0) {
    verdict =
      `**Unexplained growth.** Shrink the package, or add the \`${OVERRIDE_LABEL}\` ` +
      `label and say why it grew in the PR body:\n\n${list}`;
  }
  summary([
    `### Package growth: ${pack.name}@${base.version} (published) vs this build`,
    "",
    `Threshold ${maxGrowthPercent}%, ignoring growth under ${MIN_GROWTH_BYTES} bytes ` +
      `or ${MIN_GROWTH_FILES} files.`,
    "",
    "| Measure | Published | This build | Change | % |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    verdict,
    "",
  ]);

  if (problems.length === 0) {
    console.log("check:pack:growth: package growth OK");
    return 0;
  } else if (overridden) {
    console.warn(`check:pack:growth: growth over the threshold, allowed by ${OVERRIDE_LABEL}:`);
    for (const problem of problems) {
      console.warn(`  ${problem}`);
    }
    return 0;
  } else {
    console.error(`check:pack:growth: failed (${problems.length} problems):`);
    for (const problem of problems) {
      console.error(`  ${problem}`);
    }
    console.error(`check:pack:growth: if the growth is intended, add the ${OVERRIDE_LABEL} label`);
    return 1;
  }
};

const base = lastPublished(pack.name);
process.exitCode = base === undefined ? reportUnpublished() : compare(base);
