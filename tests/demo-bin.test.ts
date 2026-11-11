/**
 * Runs the raci-editor-demo bin against the built static demo. It needs `npm run build` first
 * (the demo site is part of the build), so it is skipped when dist/demo-site is not there.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bin = join(process.cwd(), "bin", "raci-editor-demo.mjs");
const built = existsSync(join(process.cwd(), "dist", "demo-site", "index.html"));

/** Start the bin on a free port and resolve with its URL and a stop function. */
const start = (...args: string[]) =>
  new Promise<{ url: string; stop: () => Promise<void> }>((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.once("error", reject);
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
      const url = /(http:\/\/\S+\/)/.exec(out)?.[1];
      if (url !== undefined) {
        resolve({
          url,
          stop: () =>
            new Promise<void>((done) => {
              child.once("exit", () => done());
              child.kill("SIGTERM");
            }),
        });
      }
    });
  });

describe.skipIf(!built)("raci-editor-demo bin", { timeout: 20_000 }, () => {
  it("serves the demo page and its assets and prints the URL", async () => {
    const { url, stop } = await start("--port", "0");
    try {
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
      const page = await fetch(url);
      expect(page.status).toBe(200);
      expect(page.headers.get("content-type")).toContain("text/html");
      const html = await page.text();
      const asset = /src="\.\/(assets\/[^"]+\.js)"/.exec(html)?.[1];
      expect(asset).toBeTruthy();
      const script = await fetch(`${url}${asset}`);
      expect(script.status).toBe(200);
      expect(script.headers.get("content-type")).toContain("text/javascript");
    } finally {
      await stop();
    }
  });

  it("answers 404 for a missing file and for a path outside the site", async () => {
    const { url, stop } = await start("--port=0");
    try {
      expect((await fetch(`${url}nope.js`)).status).toBe(404);
      const outside = await fetch(`${url}..%2f..%2fpackage.json`);
      expect(outside.status).toBe(404);
    } finally {
      await stop();
    }
  });

  it("rejects an invalid port", async () => {
    const code = await new Promise<number | null>((resolve) => {
      spawn(process.execPath, [bin, "--port", "abc"], { stdio: "ignore" }).once("exit", resolve);
    });
    expect(code).toBe(1);
  });
});
