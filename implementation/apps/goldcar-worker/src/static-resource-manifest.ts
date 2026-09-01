import { GpsProviderError, type GpsProviderErrorCode } from "@rt-sitram/integrations";
import { chromium, type Browser, type LaunchOptions } from "playwright-core";
import type { GoldcarStaticResourceManifestInspectionConfig } from "./config";
import { loginGoldcarPortal } from "./playwright-source";
import {
  installGoldcarReadOnlyRouting,
  isGoldcarSameOriginBlockedStaticResourceRequest,
  type GoldcarSameOriginStaticResourceRequest,
} from "./read-policy";
import { waitForGoldcarRequestManifestObjectsLoad } from "./request-manifest";

const staticResourceTypes = ["script", "stylesheet", "font", "image"] as const;
const staticResourcePathClasses = ["assets", "js", "css", "vendor", "other"] as const;

export type GoldcarStaticResourceType = (typeof staticResourceTypes)[number];
export type GoldcarStaticResourcePathClass = (typeof staticResourcePathClasses)[number];

export type GoldcarStaticResourceManifestInspectionFailurePhase =
  | "CONFIGURATION"
  | "BROWSER_LAUNCH"
  | "LOGIN"
  | "LOAD_OBJECTS";

export type GoldcarStaticResourceTypeCounts = Readonly<Record<GoldcarStaticResourceType, number>>;
export type GoldcarStaticResourcePathClassCounts = Readonly<
  Record<GoldcarStaticResourcePathClass, number>
>;

/**
 * The only static-resource result permitted outside the browser. It contains
 * fixed category counts only: never a URL, query, identifier, source code,
 * payload, cookie, header, or response.
 */
export interface GoldcarStaticResourceManifestSummary {
  readonly candidateCount: number;
  readonly resourceTypeCounts: GoldcarStaticResourceTypeCounts;
  readonly pathClassCounts: GoldcarStaticResourcePathClassCounts;
}

export interface GoldcarStaticResourceManifestOutput extends GoldcarStaticResourceManifestSummary {
  readonly status: "completed";
}

export interface GoldcarStaticResourceManifestFailureOutput {
  readonly status: "failed";
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarStaticResourceManifestInspectionFailurePhase;
}

/**
 * Retains only category counters for resources the existing policy blocks.
 * Each request is parsed synchronously and discarded; no body/headers/cookies
 * are inspected, and the routing policy aborts it before network dispatch.
 */
export class GoldcarPassiveStaticResourceManifestCollector {
  readonly #baseUrl: URL;
  #candidateCount = 0;
  readonly #resourceTypeCounts: Record<GoldcarStaticResourceType, number> = {
    script: 0,
    stylesheet: 0,
    font: 0,
    image: 0,
  };
  readonly #pathClassCounts: Record<GoldcarStaticResourcePathClass, number> = {
    assets: 0,
    js: 0,
    css: 0,
    vendor: 0,
    other: 0,
  };

  constructor(baseUrl: URL) {
    this.#baseUrl = new URL(baseUrl.toString());
  }

  record(request: GoldcarSameOriginStaticResourceRequest): void {
    if (!isGoldcarSameOriginBlockedStaticResourceRequest(request, this.#baseUrl)) return;

    const resourceType = toGoldcarStaticResourceType(request.resourceType());
    if (resourceType === null) return;

    let requestUrl: URL;
    let frameUrl: URL;
    try {
      requestUrl = new URL(request.url());
      frameUrl = new URL(request.frame().url());
    } catch {
      return;
    }
    if (!isGoldcarObjectsFrame(frameUrl, this.#baseUrl)) return;

    this.#candidateCount += 1;
    this.#resourceTypeCounts[resourceType] += 1;
    this.#pathClassCounts[classifyGoldcarStaticResourcePath(requestUrl.pathname)] += 1;
  }

  toSummary(): GoldcarStaticResourceManifestSummary {
    return {
      candidateCount: this.#candidateCount,
      resourceTypeCounts: { ...this.#resourceTypeCounts },
      pathClassCounts: { ...this.#pathClassCounts },
    };
  }
}

/**
 * Passive only: loads the normal authenticated objects document without a
 * reload, click, evaluation, or direct API request. The pre-existing routing
 * policy continues to abort every blocked resource before dispatch.
 */
export class PlaywrightGoldcarStaticResourceManifestInspector {
  readonly #config: GoldcarStaticResourceManifestInspectionConfig;

  constructor(config: GoldcarStaticResourceManifestInspectionConfig) {
    this.#config = config;
  }

  async inspect(): Promise<GoldcarStaticResourceManifestSummary> {
    const collector = new GoldcarPassiveStaticResourceManifestCollector(this.#config.baseUrl);
    let browser: Browser | null = null;
    try {
      const launchedBrowser = await runGoldcarStaticResourceManifestInspectionPhase(
        "BROWSER_LAUNCH",
        () => chromium.launch(createLaunchOptions(this.#config)),
      );
      browser = launchedBrowser;
      const context = await runGoldcarStaticResourceManifestInspectionPhase("BROWSER_LAUNCH", () =>
        launchedBrowser.newContext({
          acceptDownloads: false,
          serviceWorkers: "block",
        }),
      );
      await runGoldcarStaticResourceManifestInspectionPhase("BROWSER_LAUNCH", () =>
        installGoldcarReadOnlyRouting(context, this.#config.baseUrl, {
          onBlockedSameOriginStaticResourceRequest: (request) => collector.record(request),
        }),
      );
      const page = await runGoldcarStaticResourceManifestInspectionPhase("BROWSER_LAUNCH", () =>
        context.newPage(),
      );
      page.setDefaultTimeout(this.#config.timeoutMs);
      page.setDefaultNavigationTimeout(this.#config.timeoutMs);

      await runGoldcarStaticResourceManifestInspectionPhase("LOGIN", () =>
        loginGoldcarPortal(page, this.#config),
      );
      await runGoldcarStaticResourceManifestInspectionPhase("LOAD_OBJECTS", () =>
        waitForGoldcarRequestManifestObjectsLoad(page, this.#config.baseUrl),
      );
      return collector.toSummary();
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }
}

export function toGoldcarStaticResourceManifestOutput(
  summary: GoldcarStaticResourceManifestSummary,
): GoldcarStaticResourceManifestOutput {
  return { status: "completed", ...summary };
}

export function toGoldcarStaticResourceManifestFailureOutput(
  error: unknown,
): GoldcarStaticResourceManifestFailureOutput {
  const failure =
    error instanceof GoldcarStaticResourceManifestInspectionError
      ? error
      : classifyGoldcarStaticResourceManifestInspectionFailure(
          error instanceof GpsProviderError ? "CONFIGURATION" : "BROWSER_LAUNCH",
          error,
        );
  return { status: "failed", code: failure.code, phase: failure.phase };
}

function createLaunchOptions(config: GoldcarStaticResourceManifestInspectionConfig): LaunchOptions {
  return {
    headless: config.headless,
    ...(config.browserChannel ? { channel: config.browserChannel } : {}),
    ...(config.browserExecutablePath ? { executablePath: config.browserExecutablePath } : {}),
  };
}

function toGoldcarStaticResourceType(value: string): GoldcarStaticResourceType | null {
  return staticResourceTypes.find((resourceType) => resourceType === value) ?? null;
}

function isGoldcarObjectsFrame(url: URL, baseUrl: URL): boolean {
  return (
    baseUrl.username === "" &&
    baseUrl.password === "" &&
    url.protocol === baseUrl.protocol &&
    url.hostname === baseUrl.hostname &&
    url.port === baseUrl.port &&
    url.username === "" &&
    url.password === "" &&
    (url.pathname === "/objects" || url.pathname === "/objects/") &&
    url.search === "" &&
    url.hash === ""
  );
}

function classifyGoldcarStaticResourcePath(pathname: string): GoldcarStaticResourcePathClass {
  const pathTokens = pathname
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9.]+/gu)
    .filter((token) => token !== "");
  if (pathTokens.includes("assets")) return "assets";
  if (pathTokens.includes("vendor")) return "vendor";
  if (
    pathTokens.includes("js") ||
    pathname.toLowerCase().endsWith(".js") ||
    pathname.toLowerCase().endsWith(".mjs")
  ) {
    return "js";
  }
  if (pathTokens.includes("css") || pathname.toLowerCase().endsWith(".css")) return "css";
  return "other";
}

export class GoldcarStaticResourceManifestInspectionError extends Error {
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarStaticResourceManifestInspectionFailurePhase;

  constructor(
    phase: GoldcarStaticResourceManifestInspectionFailurePhase,
    code: GpsProviderErrorCode,
  ) {
    super("La inspección pasiva de recursos estáticos Goldcar no completó la fase solicitada.");
    this.name = "GoldcarStaticResourceManifestInspectionError";
    this.phase = phase;
    this.code = code;
  }
}

export function classifyGoldcarStaticResourceManifestInspectionFailure(
  phase: GoldcarStaticResourceManifestInspectionFailurePhase,
  error: unknown,
): GoldcarStaticResourceManifestInspectionError {
  if (error instanceof GoldcarStaticResourceManifestInspectionError) return error;
  if (error instanceof GpsProviderError)
    return new GoldcarStaticResourceManifestInspectionError(phase, error.code);
  return new GoldcarStaticResourceManifestInspectionError(phase, "UNAVAILABLE");
}

async function runGoldcarStaticResourceManifestInspectionPhase<T>(
  phase: GoldcarStaticResourceManifestInspectionFailurePhase,
  operation: () => Promise<T> | T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw classifyGoldcarStaticResourceManifestInspectionFailure(phase, error);
  }
}
