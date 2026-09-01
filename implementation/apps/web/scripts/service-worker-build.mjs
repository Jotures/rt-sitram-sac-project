import { createHash } from "node:crypto";

const CACHE_NAME_EXPRESSION = 'self.__RT_SITRAM_CACHE_NAME__ ?? "rt-sitram-pwa-shell-development"';
const PRECACHE_EXPRESSION = "self.__RT_SITRAM_PRECACHE__ ?? []";

export function createPrecachePaths(relativeFiles) {
  return [
    "/",
    ...relativeFiles
      .filter((file) => file !== "sw.js")
      .map((file) => `/${file.replaceAll("\\", "/")}`)
      .sort(),
  ];
}

export function createCacheName(entries) {
  const fingerprint = createHash("sha256");

  for (const entry of [...entries].sort((left, right) => left.path.localeCompare(right.path))) {
    fingerprint.update(entry.path);
    fingerprint.update("\0");
    fingerprint.update(entry.content);
    fingerprint.update("\0");
  }

  return `rt-sitram-pwa-shell-${fingerprint.digest("hex").slice(0, 16)}`;
}

export function assertOfflineRuntimeAssets(shellPaths) {
  const requiredPaths = [
    "/index.html",
    "/manifest.webmanifest",
    "/icons/app-mark.svg",
    "/icons/app-icon-192.png",
    "/icons/app-icon-512.png",
  ];

  for (const requiredPath of requiredPaths) {
    if (!shellPaths.includes(requiredPath)) {
      throw new Error(`Missing required offline shell asset: ${requiredPath}`);
    }
  }

  const runtimeRequirements = [
    ["JavaScript", (assetPath) => assetPath.startsWith("/assets/") && assetPath.endsWith(".js")],
    ["SQLite WASM", (assetPath) => assetPath.startsWith("/assets/") && assetPath.endsWith(".wasm")],
    [
      "PowerSync worker",
      (assetPath) =>
        assetPath.startsWith("/assets/") &&
        assetPath.toLowerCase().includes("worker") &&
        assetPath.endsWith(".js"),
    ],
  ];

  for (const [label, predicate] of runtimeRequirements) {
    if (!shellPaths.some(predicate)) {
      throw new Error(`The production build did not emit the required ${label} runtime asset.`);
    }
  }
}

export function renderServiceWorker(template, shellPaths, cacheName) {
  if (!template.includes(CACHE_NAME_EXPRESSION) || !template.includes(PRECACHE_EXPRESSION)) {
    throw new Error("Service worker template placeholders are missing or changed.");
  }

  return template
    .replace(CACHE_NAME_EXPRESSION, JSON.stringify(cacheName))
    .replace(PRECACHE_EXPRESSION, JSON.stringify(shellPaths, null, 2));
}
