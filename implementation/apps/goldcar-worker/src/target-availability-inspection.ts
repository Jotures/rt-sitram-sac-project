import { GpsProviderError, type GpsProviderErrorCode } from "@rt-sitram/integrations";
import { chromium, type Browser, type LaunchOptions } from "playwright-core";
import type { GoldcarTargetAvailabilityInspectionConfig } from "./config";
import { loginGoldcarPortal } from "./playwright-source";
import {
  installGoldcarReadOnlyRouting,
  type GoldcarObjectsBootstrapDiagnostic,
} from "./read-policy";
import {
  configureGoldcarSensorInspectionPageTimeouts,
  getGoldcarObjectsBootstrapDiscoveryTimeoutMs,
  getGoldcarSensorInspectionOperationTimeoutMs,
  getGoldcarSensorInspectionPhaseTimeoutMs,
  goldcarSensorInspectionTotalTimeoutMs,
  waitForGoldcarObjectsDom,
  waitForGoldcarVisibleTargetAvailability,
  type GoldcarVisibleTargetAvailability,
} from "./sensor-inspection";

const goldcarTargetAvailabilityBrowserCloseTimeoutMs = 1_500;

/**
 * Only the visible-target state may leave this diagnostic. The non-successful
 * states are explicitly bounded to this inspection window; they do not claim
 * that a target can never appear in a future, separately authorized session.
 */
export type GoldcarTargetAvailabilityInspectionTargetState =
  | "UNIQUE_VISIBLE"
  | "ABSENT_AT_WINDOW_END"
  | "PRESENT_NOT_VISIBLE_AT_WINDOW_END"
  | "MULTIPLE_VISIBLE_AT_WINDOW_END";

export type GoldcarTargetAvailabilityInspectionFailurePhase =
  | "CONFIGURATION"
  | "BROWSER_LAUNCH"
  | "LOGIN"
  | "DISCOVER_OBJECTS";

/**
 * Value-free, non-persistent facts gathered exclusively from the authenticated
 * objects page. It contains no text, target identifier, URL, request count,
 * response, sensor reading, header, cookie, or payload.
 */
export interface GoldcarTargetAvailabilityInspectionSummary {
  readonly target: GoldcarTargetAvailabilityInspectionTargetState;
  readonly bootstrap: GoldcarObjectsBootstrapDiagnostic;
}

export interface GoldcarTargetAvailabilityInspectionOutput extends GoldcarTargetAvailabilityInspectionSummary {
  readonly status: "completed";
}

export interface GoldcarTargetAvailabilityInspectionFailureOutput {
  readonly status: "failed";
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarTargetAvailabilityInspectionFailurePhase;
}

/**
 * A one-shot availability-only diagnostic for DEC-033. It uses the same
 * browser-generated five-request bootstrap permit as the sensor inspector,
 * but it deliberately never arms a detail permit, clicks a target, navigates
 * to a detail document, reads page text, or stores any evidence.
 */
export class PlaywrightGoldcarTargetAvailabilityInspector {
  readonly #config: GoldcarTargetAvailabilityInspectionConfig;

  constructor(config: GoldcarTargetAvailabilityInspectionConfig) {
    this.#config = config;
  }

  async inspect(): Promise<GoldcarTargetAvailabilityInspectionSummary> {
    let browser: Browser | null = null;
    const inspectionDeadline = Date.now() + goldcarSensorInspectionTotalTimeoutMs;
    try {
      const launchedBrowser = await runGoldcarTargetAvailabilityInspectionPhaseBeforeDeadline(
        "BROWSER_LAUNCH",
        (timeoutMs) =>
          chromium.launch(
            createLaunchOptions(
              this.#config,
              getGoldcarSensorInspectionOperationTimeoutMs(timeoutMs),
            ),
          ),
        inspectionDeadline,
      );
      browser = launchedBrowser;
      const context = await runGoldcarTargetAvailabilityInspectionPhaseBeforeDeadline(
        "BROWSER_LAUNCH",
        () =>
          launchedBrowser.newContext({
            acceptDownloads: false,
            serviceWorkers: "block",
          }),
        inspectionDeadline,
      );
      const routing = await runGoldcarTargetAvailabilityInspectionPhaseBeforeDeadline(
        "BROWSER_LAUNCH",
        () =>
          installGoldcarReadOnlyRouting(context, this.#config.baseUrl, {
            enableGoldcarObjectsBootstrapForSensorInspection:
              this.#config.objectsBootstrapAllowDynamicRead,
          }),
        inspectionDeadline,
      );
      const page = await runGoldcarTargetAvailabilityInspectionPhaseBeforeDeadline(
        "BROWSER_LAUNCH",
        () => context.newPage(),
        inspectionDeadline,
      );
      configureGoldcarSensorInspectionPageTimeouts(
        page,
        getGoldcarSensorInspectionOperationTimeoutMs(
          getGoldcarSensorInspectionPhaseTimeoutMs(
            getGoldcarSensorInspectionRemainingTimeoutMs(inspectionDeadline),
          ),
        ),
      );
      await runGoldcarTargetAvailabilityInspectionPhaseBeforeDeadline(
        "LOGIN",
        (timeoutMs) =>
          loginGoldcarPortal(
            page,
            this.#config,
            getGoldcarSensorInspectionOperationTimeoutMs(timeoutMs),
          ),
        inspectionDeadline,
      );

      const discoveryDeadline = Math.min(
        inspectionDeadline,
        Date.now() + getGoldcarObjectsBootstrapDiscoveryTimeoutMs(this.#config.timeoutMs),
      );
      await runGoldcarTargetAvailabilityInspectionPhaseBeforeDeadline(
        "DISCOVER_OBJECTS",
        () => {
          routing.armGoldcarObjectsBootstrapForSensorInspection(page.mainFrame());
        },
        discoveryDeadline,
      );

      try {
        await runGoldcarTargetAvailabilityInspectionPhaseBeforeDeadline(
          "DISCOVER_OBJECTS",
          (timeoutMs) =>
            waitForGoldcarObjectsDom(
              page,
              this.#config.baseUrl,
              getGoldcarSensorInspectionOperationTimeoutMs(timeoutMs),
            ),
          discoveryDeadline,
        );
        const target = await runGoldcarTargetAvailabilityInspectionPhaseBeforeDeadline(
          "DISCOVER_OBJECTS",
          (timeoutMs) =>
            waitForGoldcarVisibleTargetAvailability(
              page,
              this.#config.sensorTargetCanonicalId,
              getGoldcarSensorInspectionOperationTimeoutMs(timeoutMs),
            ),
          discoveryDeadline,
        );
        return {
          target: toGoldcarTargetAvailabilityInspectionTargetState(target.availability),
          bootstrap: routing.getGoldcarObjectsBootstrapDiagnosticForSensorInspection(),
        };
      } finally {
        routing.sealGoldcarObjectsBootstrapForSensorInspection();
      }
    } finally {
      await closeGoldcarTargetAvailabilityInspectionBrowser(browser);
    }
  }
}

export function toGoldcarTargetAvailabilityInspectionOutput(
  summary: GoldcarTargetAvailabilityInspectionSummary,
): GoldcarTargetAvailabilityInspectionOutput {
  return { status: "completed", ...summary };
}

export function toGoldcarTargetAvailabilityInspectionFailureOutput(
  error: unknown,
): GoldcarTargetAvailabilityInspectionFailureOutput {
  const failure =
    error instanceof GoldcarTargetAvailabilityInspectionError
      ? error
      : classifyGoldcarTargetAvailabilityInspectionFailure(
          error instanceof GpsProviderError ? "CONFIGURATION" : "BROWSER_LAUNCH",
          error,
        );
  return { status: "failed", code: failure.code, phase: failure.phase };
}

export function toGoldcarTargetAvailabilityInspectionTargetState(
  availability: GoldcarVisibleTargetAvailability,
): GoldcarTargetAvailabilityInspectionTargetState {
  if (availability === "UNIQUE_VISIBLE") return "UNIQUE_VISIBLE";
  if (availability === "ABSENT") return "ABSENT_AT_WINDOW_END";
  if (availability === "PRESENT_NOT_VISIBLE") return "PRESENT_NOT_VISIBLE_AT_WINDOW_END";
  return "MULTIPLE_VISIBLE_AT_WINDOW_END";
}

function createLaunchOptions(
  config: GoldcarTargetAvailabilityInspectionConfig,
  timeoutMs: number,
): LaunchOptions {
  return {
    headless: config.headless,
    timeout: timeoutMs,
    ...(config.browserChannel ? { channel: config.browserChannel } : {}),
    ...(config.browserExecutablePath ? { executablePath: config.browserExecutablePath } : {}),
  };
}

async function closeGoldcarTargetAvailabilityInspectionBrowser(
  browser: Browser | null,
): Promise<void> {
  if (browser === null) return;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const close = Promise.resolve()
    .then(() => browser.close({ reason: "Goldcar target availability inspection completed." }))
    .catch(() => undefined);
  await Promise.race([
    close,
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, goldcarTargetAvailabilityBrowserCloseTimeoutMs);
    }),
  ]).finally(() => {
    if (timeout !== undefined) clearTimeout(timeout);
  });
}

function getGoldcarSensorInspectionRemainingTimeoutMs(deadline: number): number {
  return Math.max(1, deadline - Date.now());
}

export class GoldcarTargetAvailabilityInspectionError extends Error {
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarTargetAvailabilityInspectionFailurePhase;

  constructor(phase: GoldcarTargetAvailabilityInspectionFailurePhase, code: GpsProviderErrorCode) {
    super("La inspección de disponibilidad Goldcar no completó la fase solicitada.");
    this.name = "GoldcarTargetAvailabilityInspectionError";
    this.phase = phase;
    this.code = code;
  }
}

export function classifyGoldcarTargetAvailabilityInspectionFailure(
  phase: GoldcarTargetAvailabilityInspectionFailurePhase,
  error: unknown,
): GoldcarTargetAvailabilityInspectionError {
  if (error instanceof GoldcarTargetAvailabilityInspectionError) return error;
  if (error instanceof GpsProviderError) {
    return new GoldcarTargetAvailabilityInspectionError(phase, error.code);
  }
  return new GoldcarTargetAvailabilityInspectionError(phase, "UNAVAILABLE");
}

async function runGoldcarTargetAvailabilityInspectionPhase<T>(
  phase: GoldcarTargetAvailabilityInspectionFailurePhase,
  operation: () => Promise<T> | T,
  timeoutMs?: number,
): Promise<T> {
  try {
    return await runGoldcarTargetAvailabilityInspectionOperation(operation, timeoutMs);
  } catch (error) {
    throw classifyGoldcarTargetAvailabilityInspectionFailure(phase, error);
  }
}

async function runGoldcarTargetAvailabilityInspectionPhaseBeforeDeadline<T>(
  phase: GoldcarTargetAvailabilityInspectionFailurePhase,
  operation: (timeoutMs: number) => Promise<T> | T,
  deadline: number,
): Promise<T> {
  const timeoutMs = getGoldcarSensorInspectionPhaseTimeoutMs(
    getGoldcarSensorInspectionRemainingTimeoutMs(deadline),
  );
  return runGoldcarTargetAvailabilityInspectionPhase(phase, () => operation(timeoutMs), timeoutMs);
}

export async function runGoldcarTargetAvailabilityInspectionOperation<T>(
  operation: () => Promise<T> | T,
  timeoutMs: number | undefined,
): Promise<T> {
  if (timeoutMs === undefined) return operation();

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOperation = Promise.resolve().then(operation);
  const timeoutFailure = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(
        new GpsProviderError(
          "UNAVAILABLE",
          "La fase de disponibilidad Goldcar agotó su presupuesto local.",
        ),
      );
    }, timeoutMs);
  });
  try {
    return await Promise.race([timedOperation, timeoutFailure]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
