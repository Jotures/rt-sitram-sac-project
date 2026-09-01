import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertOfflineRuntimeAssets,
  createCacheName,
  createPrecachePaths,
  renderServiceWorker,
} from "./service-worker-build.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(appRoot, "dist");
const template = await readFile(path.join(appRoot, "public", "sw.js"), "utf8");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(absolute)));
    else files.push(absolute);
  }
  return files;
}

const emittedFiles = (await listFiles(distRoot)).filter(
  (file) => path.relative(distRoot, file).split(path.sep).join("/") !== "sw.js",
);
const shellPaths = createPrecachePaths(
  emittedFiles.map((file) => path.relative(distRoot, file).split(path.sep).join("/")),
);
const fingerprintEntries = await Promise.all(
  emittedFiles.map(async (file) => ({
    path: path.relative(distRoot, file).split(path.sep).join("/"),
    content: await readFile(file),
  })),
);
const cacheName = createCacheName(fingerprintEntries);

assertOfflineRuntimeAssets(shellPaths);

const output = renderServiceWorker(template, shellPaths, cacheName);

await writeFile(path.join(distRoot, "sw.js"), output);
console.log(
  `Service worker generated with ${shellPaths.length} offline shell assets in ${cacheName}.`,
);
