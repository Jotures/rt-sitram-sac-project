import { GpsProviderError, type GpsProviderErrorCode } from "@rt-sitram/integrations";
import {
  chromium,
  type Browser,
  type LaunchOptions,
  type Locator,
  type Page,
} from "playwright-core";
import type { GoldcarSensorInspectionConfig } from "./config";
import { deriveGoldcarPortalVisibleTarget } from "./goldcar-target";
import { loginGoldcarPortal } from "./playwright-source";
import {
  assertExactGoldcarSensorDetailResponseUrl,
  installGoldcarReadOnlyRouting,
  type GoldcarReadOnlyRoutingController,
} from "./read-policy";

const sensorDefinitions = [
  { field: "coverage", labels: ["cobertura"] },
  { field: "satellites", labels: ["satelites"] },
  { field: "ignition", labels: ["ignicion"] },
  { field: "voltage", labels: ["voltaje"] },
  { field: "movement", labels: ["movimiento"] },
  { field: "odometer", labels: ["odometro"] },
  { field: "speed", labels: ["velocidad"] },
  { field: "distance", labels: ["distancia"] },
] as const;

export type GoldcarSensorField = (typeof sensorDefinitions)[number]["field"];

/**
 * A whitelist-derived semantic signature. These values describe only a
 * parseable shape and expected unit, never a reading received from Goldcar.
 */
export type GoldcarSensorValueShape =
  | "NOT_OBSERVED"
  | "UNVERIFIABLE"
  | "PERCENTAGE"
  | "INTEGER_COUNT"
  | "BOOLEAN_ON_OFF"
  | "BOOLEAN_TRUE_FALSE"
  | "NUMERIC_VOLTS"
  | "NUMERIC_KILOMETERS"
  | "NUMERIC_KILOMETERS_PER_HOUR";

export type GoldcarSensorInspectionFailurePhase =
  | "CONFIGURATION"
  | "BROWSER_LAUNCH"
  | "LOGIN"
  | "DISCOVER_DETAIL"
  | "FETCH_DETAIL"
  | "PARSE_DETAIL";

/**
 * A discovery-only checkpoint that distinguishes whether the authenticated
 * objects document became ready or whether its approved visible target did.
 * It never carries a URL, identifier, DOM, or telemetry reading.
 */
export type GoldcarSensorInspectionFailureSubphase = "OBJECTS_BOOTSTRAP" | "TARGET_AVAILABILITY";

/**
 * A local, value-free classification of the one approved visible target.
 * These categories intentionally describe only what was observable in the
 * rendered DOM at a bounded instant; they never assert permanent absence.
 */
export type GoldcarVisibleTargetAvailability =
  | "UNIQUE_VISIBLE"
  | "ABSENT"
  | "PRESENT_NOT_VISIBLE"
  | "MULTIPLE_VISIBLE";

/**
 * The locator is process-local implementation state. It is never serialized
 * by either sensor inspection or the availability-only diagnostic.
 */
export interface GoldcarVisibleTargetAvailabilityResult {
  readonly availability: GoldcarVisibleTargetAvailability;
  readonly locator: Locator | null;
}

/**
 * The entire objects-discovery window is fixed rather than configurable from
 * the environment, so a local command wrapper can emit a sanitized failure
 * before teardown.
 */
export const goldcarObjectsBootstrapDiscoveryTimeoutMaxMs = 8_000;

/**
 * Reserve a small, fixed part of each local phase budget for canonical error
 * classification and browser teardown. The caller cannot configure it, and
 * it never expands the DEC-033 discovery window or the overall session.
 */
export const goldcarSensorInspectionWatchdogMarginMs = 250;

/**
 * A sensor inspection is an interactive diagnostic, not a background job.
 * These fixed budgets keep every browser operation and the overall session
 * below the host wrapper deadline without accepting a caller-provided timeout.
 */
export const goldcarSensorInspectionPhaseTimeoutMaxMs = 8_000;
export const goldcarSensorInspectionTotalTimeoutMs = 22_000;

// Keep browser teardown bounded too: the CLI must be able to print its
// sanitized diagnostic after a discovery timeout instead of waiting on an
// unresponsive local browser process.
const goldcarSensorInspectionBrowserCloseTimeoutMs = 1_500;

export interface GoldcarSensorFieldInspection {
  readonly field: GoldcarSensorField;
  /** Only label presence is returned. Never return the remote sensor value. */
  readonly labelPresent: boolean;
  readonly valueShape: GoldcarSensorValueShape;
}

export interface GoldcarSensorInspectionSummary {
  readonly targetVerified: true;
  readonly fields: readonly GoldcarSensorFieldInspection[];
}

/**
 * This is the only result allowed to leave the inspection process. It omits
 * the target, route, DOM, labels' raw text, and every telemetry value.
 */
export interface GoldcarSensorInspectionOutput {
  readonly status: "completed";
  readonly fields: readonly GoldcarSensorFieldInspection[];
}

export interface GoldcarSensorInspectionFailureOutput {
  readonly status: "failed";
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarSensorInspectionFailurePhase;
  readonly subphase?: GoldcarSensorInspectionFailureSubphase;
}

interface GoldcarSensorDetailResponseMetadata {
  readonly status: number;
  readonly responseUrl: string;
  readonly contentType: string | undefined;
}

export interface GoldcarSensorDetailDocument {
  readonly url: URL;
  readonly html: string;
}

/**
 * One-shot, non-persistent inspection of the browser-visible detail panel.
 * It permits exactly one main-frame document navigation triggered by the one
 * visible target text. During DEC-033 bootstrap only, up to five initial
 * browser-generated dynamic reads may render that target; the permit closes
 * before detail navigation. No endpoint is supplied through configuration and
 * every other XHR, popup, subframe, redirect, or second request stays blocked.
 */
export class PlaywrightGoldcarSensorInspector {
  readonly #config: GoldcarSensorInspectionConfig;

  constructor(config: GoldcarSensorInspectionConfig) {
    this.#config = config;
  }

  async inspect(): Promise<GoldcarSensorInspectionSummary> {
    let browser: Browser | null = null;
    const inspectionDeadline = Date.now() + goldcarSensorInspectionTotalTimeoutMs;
    try {
      const launchedBrowser = await runGoldcarSensorInspectionPhaseBeforeDeadline(
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
      const context = await runGoldcarSensorInspectionPhaseBeforeDeadline(
        "BROWSER_LAUNCH",
        () =>
          launchedBrowser.newContext({
            acceptDownloads: false,
            serviceWorkers: "block",
          }),
        inspectionDeadline,
      );
      const routing = await runGoldcarSensorInspectionPhaseBeforeDeadline(
        "BROWSER_LAUNCH",
        () =>
          installGoldcarReadOnlyRouting(context, this.#config.baseUrl, {
            enableGoldcarObjectsBootstrapForSensorInspection:
              this.#config.objectsBootstrapAllowDynamicRead,
          }),
        inspectionDeadline,
      );
      const page = await runGoldcarSensorInspectionPhaseBeforeDeadline(
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

      await runGoldcarSensorInspectionPhaseBeforeDeadline(
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
      // The configuration gate is a literal true only after its separate
      // kill switch has passed. Arm only after successful login on /objects,
      // and always seal before any detail-navigation permission is armed.
      await runGoldcarSensorInspectionPhaseBeforeDeadline(
        "DISCOVER_DETAIL",
        () => {
          routing.armGoldcarObjectsBootstrapForSensorInspection(page.mainFrame());
        },
        discoveryDeadline,
        "OBJECTS_BOOTSTRAP",
      );
      const detailTarget = await (async () => {
        try {
          await runGoldcarSensorInspectionPhaseBeforeDeadline(
            "DISCOVER_DETAIL",
            (timeoutMs) =>
              waitForGoldcarObjectsDom(
                page,
                this.#config.baseUrl,
                getGoldcarSensorInspectionOperationTimeoutMs(timeoutMs),
              ),
            discoveryDeadline,
            "OBJECTS_BOOTSTRAP",
          );
          return await runGoldcarSensorInspectionPhaseBeforeDeadline(
            "DISCOVER_DETAIL",
            (timeoutMs) =>
              findUniqueVisibleGoldcarTarget(
                page,
                this.#config.sensorTargetCanonicalId,
                getGoldcarSensorInspectionOperationTimeoutMs(timeoutMs),
              ),
            discoveryDeadline,
            "TARGET_AVAILABILITY",
          );
        } finally {
          routing.sealGoldcarObjectsBootstrapForSensorInspection();
        }
      })();

      configureGoldcarSensorInspectionPageTimeouts(
        page,
        getGoldcarSensorInspectionOperationTimeoutMs(
          getGoldcarSensorInspectionPhaseTimeoutMs(
            getGoldcarSensorInspectionRemainingTimeoutMs(inspectionDeadline),
          ),
        ),
      );
      const detailDocument = await runGoldcarSensorInspectionPhaseBeforeDeadline(
        "FETCH_DETAIL",
        () =>
          navigateToGoldcarSensorDetail(
            page,
            detailTarget,
            routing,
            this.#config.baseUrl,
            this.#config.maxResponseBytes,
          ),
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
      return runGoldcarSensorInspectionPhaseBeforeDeadline(
        "PARSE_DETAIL",
        async (timeoutMs) => {
          await assertGoldcarSensorDetailStructuralTarget(
            page,
            this.#config.sensorTargetCanonicalId,
            detailDocument.url,
            this.#config.baseUrl,
            getGoldcarSensorInspectionOperationTimeoutMs(timeoutMs),
          );
          return inspectGoldcarSensorDetailHtml(
            detailDocument.html,
            this.#config.sensorTargetCanonicalId,
          );
        },
        inspectionDeadline,
      );
    } finally {
      await closeGoldcarSensorInspectionBrowser(browser);
    }
  }
}

export async function findUniqueVisibleGoldcarTarget(
  page: Page,
  targetCanonicalId: string,
  timeoutMs?: number,
): Promise<Locator> {
  const result = await waitForGoldcarVisibleTargetAvailability(page, targetCanonicalId, timeoutMs);
  if (result.availability === "UNIQUE_VISIBLE") {
    if (result.locator !== null) return result.locator;
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no conservó un objetivo visible de detalle autorizado.",
    );
  }
  throwGoldcarVisibleTargetAvailabilityError(result.availability);
}

/**
 * Reads only count and visibility for an exact, canonical-derived target.
 * It neither reads text content nor returns any remote identifier/value. In
 * particular, it does not make the old unsafe assumption that the first DOM
 * match is the visible match.
 */
export async function inspectGoldcarVisibleTargetAvailability(
  page: Page,
  targetCanonicalId: string,
): Promise<GoldcarVisibleTargetAvailabilityResult> {
  const visibleTarget = deriveGoldcarPortalVisibleTarget(targetCanonicalId);
  const candidates = page.getByText(visibleTarget, { exact: true });
  const candidateCount = await candidates.count();
  const visibleCandidates: Locator[] = [];
  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible()) visibleCandidates.push(candidate);
  }
  if (visibleCandidates.length === 1) {
    return { availability: "UNIQUE_VISIBLE", locator: visibleCandidates[0]! };
  }
  if (visibleCandidates.length > 1) return { availability: "MULTIPLE_VISIBLE", locator: null };
  if (candidateCount === 0) return { availability: "ABSENT", locator: null };
  return { availability: "PRESENT_NOT_VISIBLE", locator: null };
}

/**
 * Waits only for the *state* of the exact approved target to become safely
 * unique. A result other than `UNIQUE_VISIBLE` is returned at the end of the
 * local window so a separate diagnostic can distinguish absence, hidden text,
 * and ambiguity without exposing DOM data. With no timeout it performs one
 * immediate classification, which keeps post-navigation structural checks
 * fail-closed and deterministic.
 */
export async function waitForGoldcarVisibleTargetAvailability(
  page: Page,
  targetCanonicalId: string,
  timeoutMs?: number,
): Promise<GoldcarVisibleTargetAvailabilityResult> {
  const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
  let result = await inspectGoldcarVisibleTargetAvailability(page, targetCanonicalId);
  while (result.availability !== "UNIQUE_VISIBLE" && deadline !== undefined) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await waitForGoldcarTargetAvailabilityPoll(Math.min(50, remainingMs));
    result = await inspectGoldcarVisibleTargetAvailability(page, targetCanonicalId);
  }
  return result;
}

function throwGoldcarVisibleTargetAvailabilityError(
  availability: Exclude<GoldcarVisibleTargetAvailability, "UNIQUE_VISIBLE">,
): never {
  if (availability === "MULTIPLE_VISIBLE") {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no expuso un único texto visible para la unidad aprobada.",
    );
  }
  if (availability === "PRESENT_NOT_VISIBLE") {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar expuso la unidad aprobada, pero no como texto visible.",
    );
  }
  throw new GpsProviderError(
    "MALFORMED_RESPONSE",
    "La lista Goldcar no expuso el texto visible de la unidad aprobada.",
  );
}

function waitForGoldcarTargetAvailabilityPoll(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function navigateToGoldcarSensorDetail(
  page: Page,
  target: Locator,
  routing: GoldcarReadOnlyRoutingController,
  baseUrl: URL,
  maxResponseBytes: number,
): Promise<GoldcarSensorDetailDocument> {
  routing.armGoldcarSensorDetailNavigation(page.mainFrame());
  const [response] = await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    target.click(),
  ]);
  const detailUrl = routing.getConsumedGoldcarSensorDetailUrl();
  if (response === null || detailUrl === null) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no completó una navegación de detalle autorizada.",
    );
  }
  assertGoldcarSensorDetailResponse(
    {
      status: response.status(),
      responseUrl: response.url(),
      contentType: response.headers()["content-type"],
    },
    detailUrl,
    baseUrl,
  );

  let pageUrl: URL;
  try {
    pageUrl = new URL(page.url());
  } catch {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no conservó la navegación de detalle autorizada.",
    );
  }
  assertExactGoldcarSensorDetailResponseUrl(pageUrl, detailUrl, baseUrl);

  const html = await page.content();
  if (new TextEncoder().encode(html).byteLength > maxResponseBytes) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "El detalle de sensores Goldcar supera el tamaño máximo autorizado.",
    );
  }
  return { url: detailUrl, html };
}

export async function assertGoldcarSensorDetailStructuralTarget(
  page: Page,
  targetCanonicalId: string,
  detailUrl: URL,
  baseUrl: URL,
  timeoutMs?: number,
): Promise<void> {
  let pageUrl: URL;
  try {
    pageUrl = new URL(page.url());
  } catch {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no conserva una página de detalle estructuralmente válida.",
    );
  }
  assertExactGoldcarSensorDetailResponseUrl(pageUrl, detailUrl, baseUrl);
  await findUniqueVisibleGoldcarTarget(page, targetCanonicalId, timeoutMs);
}

/**
 * Waits only for the already-authenticated `/objects` document to expose a
 * body. It does not click, navigate, or relax the request allowlist.
 */
export async function waitForGoldcarObjectsDom(
  page: Page,
  baseUrl: URL,
  timeoutMs?: number,
): Promise<void> {
  assertGoldcarObjectsPageUrl(page.url(), baseUrl);
  const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
  await page.waitForLoadState(
    "domcontentloaded",
    deadline === undefined
      ? undefined
      : { timeout: getGoldcarSensorInspectionRemainingTimeoutMs(deadline) },
  );
  await page
    .locator("body")
    .waitFor(
      deadline === undefined
        ? { state: "attached" }
        : { state: "attached", timeout: getGoldcarSensorInspectionRemainingTimeoutMs(deadline) },
    );
  assertGoldcarObjectsPageUrl(page.url(), baseUrl);
}

export function getGoldcarObjectsBootstrapDiscoveryTimeoutMs(portalTimeoutMs: number): number {
  return Math.max(
    1,
    Math.min(goldcarObjectsBootstrapDiscoveryTimeoutMaxMs, Math.floor(portalTimeoutMs / 2)),
  );
}

export function getGoldcarSensorInspectionPhaseTimeoutMs(remainingMs: number): number {
  return Math.max(1, Math.min(goldcarSensorInspectionPhaseTimeoutMaxMs, Math.floor(remainingMs)));
}

/**
 * Keeps the operation below its enclosing watchdog whenever the phase budget
 * permits it. At very small budgets a one-millisecond lower bound still
 * prevents an invalid timeout while the outer watchdog remains fail-closed.
 */
export function getGoldcarSensorInspectionOperationTimeoutMs(phaseTimeoutMs: number): number {
  return Math.max(1, phaseTimeoutMs - goldcarSensorInspectionWatchdogMarginMs);
}

function getGoldcarSensorInspectionRemainingTimeoutMs(deadline: number): number {
  return Math.max(1, deadline - Date.now());
}

function assertGoldcarObjectsPageUrl(rawUrl: string, baseUrl: URL): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no conservó la página de objetos autorizada.",
    );
  }
  if (
    baseUrl.username !== "" ||
    baseUrl.password !== "" ||
    url.protocol !== baseUrl.protocol ||
    url.hostname !== baseUrl.hostname ||
    url.port !== baseUrl.port ||
    url.username !== "" ||
    url.password !== "" ||
    (url.pathname !== "/objects" && url.pathname !== "/objects/") ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no conservó la página de objetos autorizada.",
    );
  }
}

export function assertGoldcarSensorDetailResponse(
  metadata: GoldcarSensorDetailResponseMetadata,
  requestedUrl: URL,
  baseUrl: URL,
): void {
  if (metadata.status >= 300 && metadata.status < 400) {
    throw new GpsProviderError(
      "REMOTE_ERROR",
      "La inspección de sensores no admite redirecciones Goldcar.",
    );
  }
  if (metadata.status === 401 || metadata.status === 403) {
    throw new GpsProviderError("UNAUTHORIZED", "Goldcar rechazó la lectura de detalle autorizada.");
  }
  if (metadata.status === 429) {
    throw new GpsProviderError(
      "RATE_LIMITED",
      "Goldcar limitó temporalmente la lectura de detalle.",
    );
  }
  if (metadata.status < 200 || metadata.status >= 300) {
    throw new GpsProviderError(
      "REMOTE_ERROR",
      "Goldcar no completó la lectura de detalle autorizada.",
    );
  }

  let responseUrl: URL;
  try {
    responseUrl = new URL(metadata.responseUrl);
  } catch {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar devolvió una URL de detalle no válida.",
    );
  }
  assertExactGoldcarSensorDetailResponseUrl(responseUrl, requestedUrl, baseUrl);

  const contentType = metadata.contentType?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no devolvió HTML para el detalle de sensores autorizado.",
    );
  }
}

export function inspectGoldcarSensorDetailHtml(
  html: string,
  targetCanonicalId: string,
): GoldcarSensorInspectionSummary {
  const text = normalizeGoldcarDetailText(html);
  if (!containsCanonicalIdentifier(text, deriveGoldcarPortalVisibleTarget(targetCanonicalId))) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "El detalle Goldcar no acredita la unidad aprobada.",
    );
  }

  const fields = sensorDefinitions.map(({ field, labels }) => {
    const labelPresent = labels.some((label) => containsNormalizedLabel(text, label));
    return {
      field,
      labelPresent,
      valueShape: getGoldcarSensorValueShape(field, text, labelPresent),
    };
  });
  if (!fields.some((field) => field.labelPresent)) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "El detalle Goldcar no contiene etiquetas de sensores reconocidas.",
    );
  }

  return { targetVerified: true, fields };
}

export function toGoldcarSensorInspectionOutput(
  summary: GoldcarSensorInspectionSummary,
): GoldcarSensorInspectionOutput {
  return { status: "completed", fields: summary.fields };
}

export function toGoldcarSensorInspectionFailureOutput(
  error: unknown,
): GoldcarSensorInspectionFailureOutput {
  const failure =
    error instanceof GoldcarSensorInspectionError
      ? error
      : classifyGoldcarSensorInspectionFailure(
          error instanceof GpsProviderError ? "CONFIGURATION" : "BROWSER_LAUNCH",
          error,
        );
  return {
    status: "failed",
    code: failure.code,
    phase: failure.phase,
    ...(failure.subphase === undefined ? {} : { subphase: failure.subphase }),
  };
}

function createLaunchOptions(
  config: GoldcarSensorInspectionConfig,
  timeoutMs: number,
): LaunchOptions {
  return {
    headless: config.headless,
    timeout: timeoutMs,
    ...(config.browserChannel ? { channel: config.browserChannel } : {}),
    ...(config.browserExecutablePath ? { executablePath: config.browserExecutablePath } : {}),
  };
}

export function configureGoldcarSensorInspectionPageTimeouts(page: Page, timeoutMs: number): void {
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);
}

async function closeGoldcarSensorInspectionBrowser(browser: Browser | null): Promise<void> {
  if (browser === null) return;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const close = Promise.resolve()
    .then(() => browser.close({ reason: "Goldcar sensor inspection completed." }))
    .catch(() => undefined);
  await Promise.race([
    close,
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, goldcarSensorInspectionBrowserCloseTimeoutMs);
    }),
  ]).finally(() => {
    if (timeout !== undefined) clearTimeout(timeout);
  });
}

function normalizeGoldcarDetailText(html: string): string {
  return decodeKnownHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/gu, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
      .replace(/<[^>]*>/gu, " "),
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toUpperCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function decodeKnownHtmlEntities(value: string): string {
  const entities: Readonly<Record<string, string>> = {
    "&aacute;": "á",
    "&eacute;": "é",
    "&iacute;": "í",
    "&oacute;": "ó",
    "&uacute;": "ú",
    "&ntilde;": "ñ",
    "&amp;": "&",
    "&nbsp;": " ",
  };
  return value.replace(/&[a-z]+;/giu, (entity) => entities[entity.toLowerCase()] ?? entity);
}

function containsCanonicalIdentifier(text: string, identifier: string): boolean {
  const normalizedIdentifier = identifier
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toUpperCase()
    .trim();
  const escapedIdentifier = normalizedIdentifier.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|[^A-Z0-9:_-])${escapedIdentifier}(?=$|[^A-Z0-9:_-])`, "u").test(text);
}

function containsNormalizedLabel(text: string, label: string): boolean {
  const normalizedLabel = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toUpperCase();
  return new RegExp(`(?:^|[^A-Z])${normalizedLabel}(?=$|[^A-Z])`, "u").test(text);
}

function getGoldcarSensorValueShape(
  field: GoldcarSensorField,
  text: string,
  labelPresent: boolean,
): GoldcarSensorValueShape {
  if (!labelPresent) return "NOT_OBSERVED";
  if (field === "coverage" && matchesLabelValue(text, "COBERTURA", `${numericPattern}%`)) {
    return "PERCENTAGE";
  }
  if (field === "satellites" && matchesLabelValue(text, "SATELITES", "\\d+")) {
    return "INTEGER_COUNT";
  }
  if (field === "ignition" && matchesLabelValue(text, "IGNICION", "(?:ON|OFF)")) {
    return "BOOLEAN_ON_OFF";
  }
  if (field === "voltage" && matchesLabelValue(text, "VOLTAJE", `${numericPattern}V`)) {
    return "NUMERIC_VOLTS";
  }
  if (
    field === "movement" &&
    matchesLabelValue(text, "MOVIMIENTO", "(?:TRUE|FALSE|VERDADERO|FALSO)")
  ) {
    return "BOOLEAN_TRUE_FALSE";
  }
  if (
    (field === "odometer" || field === "distance") &&
    matchesLabelValue(text, field === "odometer" ? "ODOMETRO" : "DISTANCIA", `${numericPattern}KM`)
  ) {
    return "NUMERIC_KILOMETERS";
  }
  if (field === "speed" && matchesLabelValue(text, "VELOCIDAD", `${numericPattern}(?:KPH|KM/H)`)) {
    return "NUMERIC_KILOMETERS_PER_HOUR";
  }
  return "UNVERIFIABLE";
}

const numericPattern = "\\d+(?:[.,]\\d+)?\\s*";

function matchesLabelValue(text: string, label: string, valuePattern: string): boolean {
  return new RegExp(`(?:^|[^A-Z])${label}\\s*(?::|-)?\\s*${valuePattern}(?=$|[^A-Z0-9])`, "u").test(
    text,
  );
}

export class GoldcarSensorInspectionError extends Error {
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarSensorInspectionFailurePhase;
  readonly subphase: GoldcarSensorInspectionFailureSubphase | undefined;

  constructor(
    phase: GoldcarSensorInspectionFailurePhase,
    code: GpsProviderErrorCode,
    subphase?: GoldcarSensorInspectionFailureSubphase,
  ) {
    super("La inspección de sensores Goldcar no completó la fase solicitada.");
    this.name = "GoldcarSensorInspectionError";
    this.phase = phase;
    this.code = code;
    this.subphase = subphase;
  }
}

export function classifyGoldcarSensorInspectionFailure(
  phase: GoldcarSensorInspectionFailurePhase,
  error: unknown,
  subphase?: GoldcarSensorInspectionFailureSubphase,
): GoldcarSensorInspectionError {
  if (error instanceof GoldcarSensorInspectionError) return error;
  if (error instanceof GpsProviderError) {
    return new GoldcarSensorInspectionError(phase, error.code, subphase);
  }
  return new GoldcarSensorInspectionError(phase, "UNAVAILABLE", subphase);
}

async function runGoldcarSensorInspectionPhase<T>(
  phase: GoldcarSensorInspectionFailurePhase,
  operation: () => Promise<T> | T,
  subphase?: GoldcarSensorInspectionFailureSubphase,
  timeoutMs?: number,
): Promise<T> {
  try {
    return await runGoldcarSensorInspectionOperation(operation, timeoutMs);
  } catch (error) {
    throw classifyGoldcarSensorInspectionFailure(phase, error, subphase);
  }
}

async function runGoldcarSensorInspectionPhaseBeforeDeadline<T>(
  phase: GoldcarSensorInspectionFailurePhase,
  operation: (timeoutMs: number) => Promise<T> | T,
  deadline: number,
  subphase?: GoldcarSensorInspectionFailureSubphase,
): Promise<T> {
  const timeoutMs = getGoldcarSensorInspectionPhaseTimeoutMs(
    getGoldcarSensorInspectionRemainingTimeoutMs(deadline),
  );
  return runGoldcarSensorInspectionPhase(phase, () => operation(timeoutMs), subphase, timeoutMs);
}

export async function runGoldcarSensorInspectionOperation<T>(
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
          "La fase de inspección de sensores Goldcar agotó su presupuesto local.",
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
