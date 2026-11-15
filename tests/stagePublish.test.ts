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
/**
 * The publish job stages the package on npm instead of publishing it. The "Stage on npm" step body
 * is pulled out of the workflow and run against a stub npm, one case at a time.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const workflowPath = join(process.cwd(), ".github/workflows/action-deploy-npm.yaml");
const workflow = readFileSync(workflowPath, "utf8");
const STAGE_ID = "3f2b6c1e-8a4d-4e2f-9b7a-1c2d3e4f5a6b";

/** The `run:` body of the step with `id: stage`, read by indentation (no YAML parser needed). */
const stageStepBody = (): string => {
  const lines = workflow.split("\n");
  const at = lines.findIndex((l) => /^\s+id:\s*stage\s*$/.test(l));
  if (at < 0) return "";
  const runAt = lines.findIndex((l, i) => i > at && /^\s+run:\s*\|\s*$/.test(l));
  if (runAt < 0) return "";
  const indent = (lines[runAt] ?? "").search(/\S/);
  const body: string[] = [];
  for (const l of lines.slice(runAt + 1)) {
    if (l.trim() !== "" && l.search(/\S/) <= indent) break;
    body.push(l.slice(indent + 2));
  }
  return body.join("\n").trim();
};

const STUB = `#!/usr/bin/env bash
echo "npm $*" >> "$STUB_CALLS"
case "$1" in
  --version) echo "$STUB_NPM_VERSION"; exit 0 ;;
esac
if [ "$1 $2" = "stage publish" ]; then
  case "$STUB_CASE" in
    exists)
      echo "npm error You cannot publish over the previously published versions: 1.0.0." >&2
      exit 1 ;;
    noid)
      echo "+ node-raci-editor@1.0.0 (staged)"
      exit 0 ;;
    noauth)
      echo "npm error code ENEEDAUTH" >&2
      exit 1 ;;
    ok)
      echo "npm notice Staging to https://registry.npmjs.org/ with tag latest and public access" >&2
      echo "+ node-raci-editor@1.0.0 (staged with id ${STAGE_ID})"
      exit 0 ;;
  esac
fi
if [ "$1 $2" = "stage view" ]; then
  [ "$3" = "${STAGE_ID}" ] && { echo "staged node-raci-editor@1.0.0"; exit 0; }
  echo "npm error 404" >&2; exit 1
fi
echo "unexpected npm call: $*" >&2
exit 2
`.replaceAll("${STAGE_ID}", STAGE_ID);

describe("npm staged publishing", () => {
  let work = "";
  let step = "";

  beforeAll(() => {
    work = mkdtempSync(join(tmpdir(), "stage-step-"));
    mkdirSync(join(work, "bin"));
    writeFileSync(join(work, "bin", "npm"), STUB);
    chmodSync(join(work, "bin", "npm"), 0o755);
    step = join(work, "step.sh");
    writeFileSync(step, `${stageStepBody()}\n`);
  });

  afterAll(() => rmSync(work, { recursive: true, force: true }));

  const run = (stubCase: string, npmVersion: string) => {
    for (const f of ["calls", "out", "summary"]) writeFileSync(join(work, f), "");
    const result = spawnSync("bash", ["-e", step], {
      encoding: "utf8",
      env: {
        ...process.env,
        RUNNER_TEMP: work,
        GITHUB_OUTPUT: join(work, "out"),
        GITHUB_STEP_SUMMARY: join(work, "summary"),
        STUB_CASE: stubCase,
        STUB_NPM_VERSION: npmVersion,
        STUB_CALLS: join(work, "calls"),
        PATH: `${join(work, "bin")}:${process.env["PATH"] ?? ""}`,
      },
    });
    return {
      status: result.status,
      calls: readFileSync(join(work, "calls"), "utf8"),
      out: readFileSync(join(work, "out"), "utf8"),
      summary: readFileSync(join(work, "summary"), "utf8"),
    };
  };

  it("has a stage step with a body", () => {
    expect(stageStepBody()).not.toBe("");
  });

  it("fails when the version is already on the registry", () => {
    expect(run("exists", "11.19.0").status).not.toBe(0);
  });

  it("fails when npm reports success but no stage id", () => {
    expect(run("noid", "11.19.0").status).not.toBe(0);
  });

  it("fails when no trusted publisher is configured (ENEEDAUTH)", () => {
    expect(run("noauth", "11.19.0").status).not.toBe(0);
  });

  it("fails on an npm older than 11.15.0, before it calls npm stage", () => {
    const r = run("ok", "11.14.9");
    expect(r.status).not.toBe(0);
    expect(r.calls).not.toContain("stage publish");
  });

  it.each(["11.19.0", "12.1.0"])("stages on npm %s and prints the approval commands", (v) => {
    const r = run("ok", v);
    expect(r.status).toBe(0);
    expect(r.out).toContain(`stage-id=${STAGE_ID}`);
    expect(r.summary).toContain(`npm stage approve ${STAGE_ID}`);
    expect(r.calls).toContain(`npm stage view ${STAGE_ID}`);
    expect(r.calls).toContain("--provenance");
    expect(r.calls).toContain("--access public");
    expect(r.calls).toContain("--ignore-scripts");
  });

  it("uses no token, no registry-url and no plain publish", () => {
    expect(workflow).not.toContain("registry-url");
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toMatch(/npm publish/);
    expect(workflow).not.toContain("npm-publish");
  });
});
