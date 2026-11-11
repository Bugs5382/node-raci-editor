#!/usr/bin/env node
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
// Serves the packaged static demo (dist/demo-site) over plain HTTP, using only
// the Node standard library. It prints the URL and never opens a browser.
//
//   npx raci-editor-demo                 # http://127.0.0.1:5179/
//   npx raci-editor-demo --port 8080 --host 0.0.0.0
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import console from "node:console";
import process from "node:process";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const USAGE = "Usage: raci-editor-demo [--port <number>] [--host <address>]";

const readOption = (args, name, short) => {
  const index = args.findIndex((arg) => arg === name || arg === short);
  if (index !== -1) {
    return args[index + 1];
  }
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline === undefined ? undefined : inline.slice(name.length + 1);
};

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
const portText = readOption(args, "--port", "-p") ?? "5179";
const port = Number(portText);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  console.error(`raci-editor-demo: invalid port "${portText}"\n${USAGE}`);
  process.exit(1);
}
const host = readOption(args, "--host", "-H") ?? "127.0.0.1";

const root = resolve(fileURLToPath(new URL("../dist/demo-site", import.meta.url)));
try {
  statSync(join(root, "index.html"));
} catch {
  console.error(`raci-editor-demo: ${root} has no index.html; the package is incomplete.`);
  process.exit(1);
}

const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const file = normalize(join(root, pathname.endsWith("/") ? `${pathname}index.html` : pathname));
  let stat;
  try {
    stat = file.startsWith(root + sep) ? statSync(file) : undefined;
  } catch {
    stat = undefined;
  }
  if (stat === undefined || !stat.isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Content-Length": stat.size,
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.on("error", (error) => {
  console.error(`raci-editor-demo: ${error.message}`);
  process.exit(1);
});
server.listen(port, host, () => {
  const { address, port: bound } = server.address();
  const shown = address.includes(":") ? `[${address}]` : address;
  console.log(`raci-editor-demo: serving ${root}`);
  console.log(`raci-editor-demo: http://${shown}:${bound}/`);
  console.log("raci-editor-demo: press Ctrl+C to stop");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
