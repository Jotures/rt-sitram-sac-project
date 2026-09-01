import { GpsProviderError, type GpsProviderErrorCode } from "@rt-sitram/integrations";
import { chromium, type Browser, type LaunchOptions, type Page } from "playwright-core";
import type { GoldcarRequestManifestInspectionConfig } from "./config";
import { loginGoldcarPortal } from "./playwright-source";
import {
  installGoldcarReadOnlyRouting,
  isGoldcarSameOriginGetDynamicRequest,
  type GoldcarSameOriginDynamicRequest,
} from "./read-policy";
import { waitForGoldcarObjectsDom } from "./sensor-inspection";

const telemetryDefinitions = [
  { field: "speed", tokens: ["speed", "velocidad", "kph", "kmh"] },
  { field: "ignition", tokens: ["ignition", "ignicion"] },
  { field: "odometer", tokens: ["odometer", "odometro"] },
  { field: "distance", tokens: ["distance", "distancia"] },
  { field: "movement", tokens: ["movement", "movimiento"] },
  { field: "voltage", tokens: ["voltage", "voltaje"] },
  { field: "satellites", tokens: ["satellite", "satellites", "satelite", "satelites"] },
  { field: "coverage", tokens: ["coverage", "cobertura"] },
] as const;

export type GoldcarRequestManifestTelemetryTerm = (typeof telemetryDefinitions)[number]["field"];

export type GoldcarRequestManifestInspectionFailurePhase =
  | "CONFIGURATION"
  | "BROWSER_LAUNCH"
  | "LOGIN"
  | "LOAD_OBJECTS";

export interface GoldcarRequestManifestClasses {
  readonly fetch: boolean;
  readonly xhr: boolean;
}

export type GoldcarRequestManifestTelemetryTerms = Readonly<
  Record<GoldcarRequestManifestTelemetryTerm, boolean>
>;

/**
 * This aggregate is the only dynamic-request information allowed to leave
 * the browser process. It contains no route, query key/value, identifier,
 * payload, cookie, header, response, or source code.
 */
export interface GoldcarRequestManifestSummary {
  readonly candidateCount: number;
  readonly classes: GoldcarRequestManifestClasses;
  readonly queryPresent: boolean;
  readonly telemetryTerms: GoldcarRequestManifestTelemetryTerms;
}

export interface GoldcarRequestManifestOutput extends GoldcarRequestManifestSummary {
  readonly status: "completed";
}

export interface GoldcarRequestManifestFailureOutput {
  readonly status: "failed";
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarRequestManifestInspectionFailurePhase;
}

/**
 * Holds only bounded aggregate facts. `record` parses a request synchronously
 * and then drops its URL; it never reads request headers, body, cookies, or a
 * response. The routing policy aborts the request before network dispatch.
 */
export class GoldcarPassiveRequestManifestCollector {
  readonly #baseUrl: URL;
  #candidateCount = 0;
  #fetchObserved = false;
  #xhrObserved = false;
  #queryPresent = false;
  readonly #telemetryTerms: Record<GoldcarRequestManifestTelemetryTerm, boolean> = {
    speed: false,
    ignition: false,
    odometer: false,
    distance: false,
    movement: false,
    voltage: false,
    satellites: false,
    coverage: false,
  };

  constructor(baseUrl: URL) {
    this.#baseUrl = new URL(baseUrl.toString());
  }

  record(request: GoldcarSameOriginDynamicRequest): void {
    if (!isGoldcarSameOriginGetDynamicRequest(request, this.#baseUrl)) return;

    let requestUrl: URL;
    let frameUrl: URL;
    let rawRequestUrl: string;
    try {
      rawRequestUrl = request.url();
      requestUrl = new URL(rawRequestUrl);
      frameUrl = new URL(request.frame().url());
    } catch {
      return;
    }
    if (!isGoldcarObjectsFrame(frameUrl, this.#baseUrl)) return;

    this.#candidateCount += 1;
    if (request.resourceType() === "fetch") this.#fetchObserved = true;
    if (request.resourceType() === "xhr") this.#xhrObserved = true;
    this.#queryPresent ||= hasQueryComponent(rawRequestUrl, requestUrl);

    const metadataTokens = getGoldcarRequestMetadataTokens(requestUrl);
    for (const definition of telemetryDefinitions) {
      if (definition.tokens.some((token) => metadataTokens.has(token))) {
        this.#telemetryTerms[definition.field] = true;
      }
    }
  }

  toSummary(): GoldcarRequestManifestSummary {
    return {
      candidateCount: this.#candidateCount,
      classes: { fetch: this.#fetchObserved, xhr: this.#xhrObserved },
      queryPresent: this.#queryPresent,
      telemetryTerms: { ...this.#telemetryTerms },
    };
  }
}

/**
 * Passive only: it loads the existing authenticated objects document and
 * observes requests initiated by that normal page lifecycle. It neither
 * clicks, reloads, evaluates page code, nor makes an API request itself.
 */
export class PlaywrightGoldcarRequestManifestInspector {
  readonly #config: GoldcarRequestManifestInspectionConfig;

  constructor(config: GoldcarRequestManifestInspectionConfig) {
    this.#config = config;
  }

  async inspect(): Promise<GoldcarRequestManifestSummary> {
    const collector = new GoldcarPassiveRequestManifestCollector(this.#config.baseUrl);
    let browser: Browser | null = null;
    try {
      const launchedBrowser = await runGoldcarRequestManifestInspectionPhase("BROWSER_LAUNCH", () =>
        chromium.launch(createLaunchOptions(this.#config)),
      );
      browser = launchedBrowser;
      const context = await runGoldcarRequestManifestInspectionPhase("BROWSER_LAUNCH", () =>
        launchedBrowser.newContext({
          acceptDownloads: false,
          serviceWorkers: "block",
        }),
      );
      await runGoldcarRequestManifestInspectionPhase("BROWSER_LAUNCH", () =>
        installGoldcarReadOnlyRouting(context, this.#config.baseUrl, {
          onSameOriginGetDynamicRequest: (request) => collector.record(request),
        }),
      );
      const page = await runGoldcarRequestManifestInspectionPhase("BROWSER_LAUNCH", () =>
        context.newPage(),
      );
      page.setDefaultTimeout(this.#config.timeoutMs);
      page.setDefaultNavigationTimeout(this.#config.timeoutMs);

      await runGoldcarRequestManifestInspectionPhase("LOGIN", () =>
        loginGoldcarPortal(page, this.#config),
      );
      await runGoldcarRequestManifestInspectionPhase("LOAD_OBJECTS", () =>
        waitForGoldcarRequestManifestObjectsLoad(page, this.#config.baseUrl),
      );
      return collector.toSummary();
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }
}

/**
 * Waits for the existing objects document and normal static-document load
 * only. It intentionally does not trigger a refresh, interaction, timer, or
 * additional navigation to solicit more dynamic requests.
 */
export async function waitForGoldcarRequestManifestObjectsLoad(
  page: Page,
  baseUrl: URL,
): Promise<void> {
  await waitForGoldcarObjectsDom(page, baseUrl);
  await page.waitForLoadState("load");
  await waitForGoldcarObjectsDom(page, baseUrl);
}

export function toGoldcarRequestManifestOutput(
  summary: GoldcarRequestManifestSummary,
): GoldcarRequestManifestOutput {
  return { status: "completed", ...summary };
}

export function toGoldcarRequestManifestFailureOutput(
  error: unknown,
): GoldcarRequestManifestFailureOutput {
  const failure =
    error instanceof GoldcarRequestManifestInspectionError
      ? error
      : classifyGoldcarRequestManifestInspectionFailure(
          error instanceof GpsProviderError ? "CONFIGURATION" : "BROWSER_LAUNCH",
          error,
        );
  return { status: "failed", code: failure.code, phase: failure.phase };
}

function createLaunchOptions(config: GoldcarRequestManifestInspectionConfig): LaunchOptions {
  return {
    headless: config.headless,
    ...(config.browserChannel ? { channel: config.browserChannel } : {}),
    ...(config.browserExecutablePath ? { executablePath: config.browserExecutablePath } : {}),
  };
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

function hasQueryComponent(rawRequestUrl: string, requestUrl: URL): boolean {
  if (requestUrl.search !== "") return true;
  const fragmentIndex = rawRequestUrl.indexOf("#");
  const urlWithoutFragment =
    fragmentIndex === -1 ? rawRequestUrl : rawRequestUrl.slice(0, fragmentIndex);
  return urlWithoutFragment.includes("?");
}

function getGoldcarRequestMetadataTokens(url: URL): ReadonlySet<string> {
  const tokens = new Set<string>();
  addNormalizedTokens(tokens, url.pathname);
  for (const queryKey of url.searchParams.keys()) addNormalizedTokens(tokens, queryKey);
  return tokens;
}

function addNormalizedTokens(tokens: Set<string>, value: string): void {
  for (const token of value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/gu)) {
    if (token !== "") tokens.add(token);
  }
}

export class GoldcarRequestManifestInspectionError extends Error {
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarRequestManifestInspectionFailurePhase;

  constructor(phase: GoldcarRequestManifestInspectionFailurePhase, code: GpsProviderErrorCode) {
    super("La inspección pasiva de solicitudes Goldcar no completó la fase solicitada.");
    this.name = "GoldcarRequestManifestInspectionError";
    this.phase = phase;
    this.code = code;
  }
}

export function classifyGoldcarRequestManifestInspectionFailure(
  phase: GoldcarRequestManifestInspectionFailurePhase,
  error: unknown,
): GoldcarRequestManifestInspectionError {
  if (error instanceof GoldcarRequestManifestInspectionError) return error;
  if (error instanceof GpsProviderError)
    return new GoldcarRequestManifestInspectionError(phase, error.code);
  return new GoldcarRequestManifestInspectionError(phase, "UNAVAILABLE");
}

async function runGoldcarRequestManifestInspectionPhase<T>(
  phase: GoldcarRequestManifestInspectionFailurePhase,
  operation: () => Promise<T> | T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw classifyGoldcarRequestManifestInspectionFailure(phase, error);
  }
}
