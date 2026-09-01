import { describe, expect, it } from "vitest";
import {
  assertOfflineRuntimeAssets,
  createCacheName,
  createPrecachePaths,
  renderServiceWorker,
} from "./service-worker-build.mjs";

const completeBuild = [
  "index.html",
  "manifest.webmanifest",
  "icons/app-mark.svg",
  "icons/app-icon-192.png",
  "icons/app-icon-512.png",
  "assets/app-123.js",
  "assets/worker-123.js",
  "assets/sqlite-123.wasm",
];

describe("production service worker build", () => {
  it("precache paths cover every emitted file except the service worker itself", () => {
    expect(createPrecachePaths([...completeBuild, "sw.js"])).toEqual([
      "/",
      "/assets/app-123.js",
      "/assets/sqlite-123.wasm",
      "/assets/worker-123.js",
      "/icons/app-icon-192.png",
      "/icons/app-icon-512.png",
      "/icons/app-mark.svg",
      "/index.html",
      "/manifest.webmanifest",
    ]);
  });

  it("requires the icons, JavaScript, worker and WASM needed for an offline reopen", () => {
    const completeShell = createPrecachePaths(completeBuild);

    expect(() => assertOfflineRuntimeAssets(completeShell)).not.toThrow();
    expect(() =>
      assertOfflineRuntimeAssets(completeShell.filter((path) => !path.endsWith(".wasm"))),
    ).toThrow(/SQLite WASM/);
  });

  it("changes the cache identity when emitted content changes", () => {
    const first = createCacheName([{ path: "assets/app.js", content: Buffer.from("first") }]);
    const second = createCacheName([{ path: "assets/app.js", content: Buffer.from("second") }]);

    expect(first).not.toBe(second);
  });

  it("injects both generated values into the service worker template", () => {
    const output = renderServiceWorker(
      'const CACHE = self.__RT_SITRAM_CACHE_NAME__ ?? "rt-sitram-pwa-shell-development";\n' +
        "const PATHS = self.__RT_SITRAM_PRECACHE__ ?? [];",
      ["/", "/index.html"],
      "rt-sitram-pwa-shell-test",
    );

    expect(output).toContain('const CACHE = "rt-sitram-pwa-shell-test";');
    expect(output).toContain('"/index.html"');
  });
});
