import { GpsProviderError } from "@rt-sitram/integrations";
import type { BrowserContext, Frame, Request } from "playwright-core";

export type GoldcarRequestDecision = "ALLOW" | "BLOCK";

export type GoldcarSensorDetailNavigationState = "IDLE" | "ARMED" | "CONSUMED";

/**
 * DEC-033 fixes this budget to the observed bootstrap envelope. It is not a
 * configuration value: increasing it requires an explicit review rather than
 * an environment change.
 */
export const goldcarObjectsBootstrapDynamicRequestLimit = 5;

export type GoldcarObjectsBootstrapState = "IDLE" | "ARMED" | "EXHAUSTED" | "SEALED";

/**
 * A fixed, value-free account of routing conditions observed during the
 * narrow DEC-033 bootstrap. It never includes counts, routes, identifiers,
 * queries, payloads, or response information.
 *
 * `eligibleDynamicBlockedAfterCap` is intentionally different from merely
 * reaching the five-request cap: it becomes true only if another request
 * that would otherwise satisfy the exact bootstrap contract is blocked after
 * that cap. This lets a diagnostic distinguish an exhausted envelope from a
 * demonstrated unmet follow-up without disclosing the request itself.
 */
export interface GoldcarObjectsBootstrapDiagnostic {
  readonly preArmObjectsDynamicBlocked: boolean;
  readonly eligibleDynamicBlockedAfterCap: boolean;
  readonly routingConditionBlocked: boolean;
}

export interface GoldcarReadOnlyRoutingController {
  armGoldcarSensorDetailNavigation(mainFrame: Frame): void;
  getConsumedGoldcarSensorDetailUrl(): URL | null;
  armGoldcarObjectsBootstrapForSensorInspection(mainFrame: Frame): void;
  sealGoldcarObjectsBootstrapForSensorInspection(): void;
  getGoldcarObjectsBootstrapDiagnosticForSensorInspection(): GoldcarObjectsBootstrapDiagnostic;
}

/**
 * The passive manifest inspector receives an intercepted request only long
 * enough to derive fixed aggregate booleans. It must not retain or emit its
 * URL, headers, body, cookies, or response.
 */
export type GoldcarSameOriginDynamicRequest = Pick<
  Request,
  "method" | "url" | "isNavigationRequest" | "resourceType" | "frame"
>;

export type GoldcarSameOriginStaticResourceRequest = GoldcarSameOriginDynamicRequest;

/**
 * This stricter request shape is used only by the temporary DEC-033 permit.
 * `redirectedFrom` is deliberately included so a redirected follow-up cannot
 * consume a second bootstrap slot.
 */
export type GoldcarObjectsBootstrapDynamicRequest = Pick<
  Request,
  "method" | "url" | "isNavigationRequest" | "resourceType" | "frame" | "redirectedFrom"
>;

export interface GoldcarReadOnlyRoutingOptions {
  readonly onSameOriginGetDynamicRequest?: (request: GoldcarSameOriginDynamicRequest) => void;
  readonly onBlockedSameOriginStaticResourceRequest?: (
    request: GoldcarSameOriginStaticResourceRequest,
  ) => void;
  /**
   * This literal opt-in is intentionally available only to the sensor-detail
   * or target-availability inspector after its separate kill switch has been
   * validated. It does not accept a route, request method, or
   * caller-controlled limit.
   */
  readonly enableGoldcarObjectsBootstrapForSensorInspection?: true;
}

/**
 * A one-shot permit for the detail document. It is deliberately separate
 * from the ordinary login/read policy: once armed, every request other than
 * the first exact main-frame document GET is blocked.
 */
export class GoldcarSensorDetailNavigationPermit {
  #state: GoldcarSensorDetailNavigationState = "IDLE";
  #mainFrame: Frame | null = null;
  #consumedUrl: URL | null = null;

  get state(): GoldcarSensorDetailNavigationState {
    return this.#state;
  }

  arm(mainFrame: Frame): void {
    if (this.#state !== "IDLE") {
      throw new GpsProviderError(
        "CONFIGURATION",
        "La navegación de detalle Goldcar ya fue preparada o consumida.",
      );
    }
    this.#state = "ARMED";
    this.#mainFrame = mainFrame;
  }

  getConsumedUrl(): URL | null {
    return this.#consumedUrl === null ? null : new URL(this.#consumedUrl.toString());
  }

  decide(
    request: Pick<Request, "method" | "url" | "isNavigationRequest" | "frame">,
    baseUrl: URL,
  ): GoldcarRequestDecision | null {
    if (this.#state === "IDLE") return null;
    if (this.#state === "CONSUMED") return "BLOCK";

    if (
      request.method().toUpperCase() !== "GET" ||
      !request.isNavigationRequest() ||
      request.frame() !== this.#mainFrame
    ) {
      return "BLOCK";
    }

    let url: URL;
    try {
      url = new URL(request.url());
      assertGoldcarSensorDetailUrl(url, baseUrl);
    } catch {
      return "BLOCK";
    }

    // Consume before allowing the request so concurrent routing callbacks
    // cannot obtain a second permit.
    this.#state = "CONSUMED";
    this.#consumedUrl = url;
    return "ALLOW";
  }
}

/**
 * A bounded, session-local exception for DEC-033. It may continue no more
 * than five initial browser-generated GET XHR/fetch requests from the exact
 * authenticated `/objects` main document. It never reads a response or
 * exposes a dynamic route, and every deviation remains blocked.
 */
export class GoldcarObjectsBootstrapPermit {
  #state: GoldcarObjectsBootstrapState = "IDLE";
  #mainFrame: Frame | null = null;
  #allowedRequestCount = 0;
  #preArmDynamicRequestBlocked = false;
  #eligibleDynamicBlockedAfterCap = false;
  #routingConditionBlocked = false;

  get state(): GoldcarObjectsBootstrapState {
    return this.#state;
  }

  get allowedRequestCount(): number {
    return this.#allowedRequestCount;
  }

  /**
   * This diagnostic is retained across sealing so the availability inspector
   * can emit only fixed, sanitized routing facts after discovery. Reaching
   * the five-request cap alone is intentionally not reported: it does not
   * prove that a further request was required.
   */
  get diagnostic(): GoldcarObjectsBootstrapDiagnostic {
    return {
      preArmObjectsDynamicBlocked: this.#preArmDynamicRequestBlocked,
      eligibleDynamicBlockedAfterCap: this.#eligibleDynamicBlockedAfterCap,
      routingConditionBlocked: this.#routingConditionBlocked,
    };
  }

  /**
   * Observes only a candidate that the existing deny-by-default policy is
   * about to block before the permit is armed. This detects a timing race;
   * it cannot continue, retain, or expose the request.
   */
  recordPreArmDynamicRequestBlocked(request: GoldcarSameOriginDynamicRequest, baseUrl: URL): void {
    if (
      this.#state === "IDLE" &&
      isGoldcarSameOriginGetDynamicRequest(request, baseUrl) &&
      isGoldcarObjectsDocumentFrame(request.frame(), baseUrl)
    ) {
      this.#preArmDynamicRequestBlocked = true;
    }
  }

  arm(mainFrame: Frame, baseUrl: URL): void {
    if (this.#state !== "IDLE") {
      throw new GpsProviderError(
        "CONFIGURATION",
        "El bootstrap dinámico Goldcar ya fue preparado o cerrado.",
      );
    }
    if (!isGoldcarObjectsDocumentFrame(mainFrame, baseUrl)) {
      throw new GpsProviderError(
        "MALFORMED_RESPONSE",
        "Goldcar no conserva el documento de objetos autorizado para el bootstrap.",
      );
    }
    this.#mainFrame = mainFrame;
    this.#state = "ARMED";
  }

  seal(): void {
    if (this.#state === "IDLE" || this.#state === "SEALED") {
      throw new GpsProviderError(
        "CONFIGURATION",
        "El bootstrap dinámico Goldcar no está preparado para cerrarse.",
      );
    }
    this.#state = "SEALED";
  }

  decide(
    request: GoldcarObjectsBootstrapDynamicRequest,
    baseUrl: URL,
  ): GoldcarRequestDecision | null {
    if (this.#state === "IDLE") return null;
    const isDynamicTransport = isGoldcarDynamicTransportRequest(request);
    if (this.#state === "SEALED") return isDynamicTransport ? "BLOCK" : null;

    // While the temporary permit is active, static assets retain only their
    // pre-existing narrow exception. No document, popup, subframe, form, or
    // extra resource can piggyback on the bootstrap window.
    if (!isDynamicTransport) {
      return this.#isAllowedObjectsBootstrapStaticRequest(request, baseUrl) ? "ALLOW" : "BLOCK";
    }
    if (this.#mainFrame === null) {
      this.#routingConditionBlocked = true;
      return "BLOCK";
    }

    // These checks precede any permit consumption. In particular, a 3xx
    // follow-up request cannot exhaust the fixed five-request envelope.
    if (!isEligibleGoldcarObjectsBootstrapDynamicRequest(request, this.#mainFrame, baseUrl)) {
      this.#routingConditionBlocked = true;
      return "BLOCK";
    }

    if (this.#state === "EXHAUSTED") {
      // The exact candidate is held only for this boolean decision and then
      // discarded. No URL, response, body, or count leaves the permit.
      this.#eligibleDynamicBlockedAfterCap = true;
      return "BLOCK";
    }

    if (this.#state !== "ARMED") {
      this.#routingConditionBlocked = true;
      return "BLOCK";
    }

    if (this.#allowedRequestCount >= goldcarObjectsBootstrapDynamicRequestLimit) {
      this.#eligibleDynamicBlockedAfterCap = true;
      this.#state = "EXHAUSTED";
      return "BLOCK";
    }

    // Consume before continuing so concurrent routing callbacks cannot exceed
    // the fixed envelope. No request body, response, URL, or payload is
    // retained by this permit.
    this.#allowedRequestCount += 1;
    if (this.#allowedRequestCount === goldcarObjectsBootstrapDynamicRequestLimit) {
      this.#state = "EXHAUSTED";
    }
    return "ALLOW";
  }

  #isAllowedObjectsBootstrapStaticRequest(
    request: GoldcarObjectsBootstrapDynamicRequest,
    baseUrl: URL,
  ): boolean {
    try {
      return (
        this.#mainFrame !== null &&
        request.frame() === this.#mainFrame &&
        isGoldcarAllowedStaticResourceRequest(request, baseUrl)
      );
    } catch {
      return false;
    }
  }
}

export function decideGoldcarPortalRequest(
  method: string,
  rawUrl: string,
  baseUrl: URL,
): GoldcarRequestDecision {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "BLOCK";
  }
  if (!isExactBaseHostUrl(url, baseUrl)) return "BLOCK";

  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
    const isApprovedPage =
      url.search === "" &&
      url.hash === "" &&
      (url.pathname === "/" ||
        url.pathname === "/authentication/create" ||
        url.pathname === "/objects" ||
        url.pathname === "/objects/");
    return isApprovedPage ? "ALLOW" : "BLOCK";
  }
  if (
    normalizedMethod === "POST" &&
    url.pathname === "/authentication/store" &&
    url.search === "" &&
    url.hash === ""
  ) {
    return "ALLOW";
  }
  return "BLOCK";
}

/**
 * This is deliberately narrower than the normal portal policy. It identifies
 * only same-origin, non-navigation GET XHR/fetch attempts, which the caller
 * can inspect in memory before the routing layer aborts them.
 */
export function isGoldcarSameOriginGetDynamicRequest(
  request: GoldcarSameOriginDynamicRequest,
  baseUrl: URL,
): boolean {
  if (
    request.method().toUpperCase() !== "GET" ||
    request.isNavigationRequest() ||
    (request.resourceType() !== "xhr" && request.resourceType() !== "fetch")
  ) {
    return false;
  }
  try {
    return isExactBaseHostUrl(new URL(request.url()), baseUrl);
  } catch {
    return false;
  }
}

/**
 * The only approved static-resource exception. It accepts cache-busted
 * scripts/styles below the fixed `/assets/` directory, while retaining the
 * deny-by-default posture for images, fonts, data requests, and every other
 * path. No route or query is configurable.
 */
export function isGoldcarAllowedStaticResourceRequest(
  request: GoldcarSameOriginStaticResourceRequest,
  baseUrl: URL,
): boolean {
  if (
    request.method().toUpperCase() !== "GET" ||
    request.isNavigationRequest() ||
    (request.resourceType() !== "script" && request.resourceType() !== "stylesheet")
  ) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(request.url());
  } catch {
    return false;
  }
  return isExactBaseHostUrl(url, baseUrl) && url.hash === "" && url.pathname.startsWith("/assets/");
}

/**
 * Detects only blocked static subresources. It deliberately delegates the
 * allow/deny decision to the existing portal policy so this diagnostic cannot
 * widen the current static-resource allowlist.
 */
export function isGoldcarSameOriginBlockedStaticResourceRequest(
  request: GoldcarSameOriginStaticResourceRequest,
  baseUrl: URL,
): boolean {
  if (
    request.method().toUpperCase() !== "GET" ||
    request.isNavigationRequest() ||
    !isGoldcarStaticResourceType(request.resourceType())
  ) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(request.url());
  } catch {
    return false;
  }
  return (
    isExactBaseHostUrl(url, baseUrl) && !isGoldcarAllowedStaticResourceRequest(request, baseUrl)
  );
}

export function assertGoldcarCsvExportUrl(url: URL, baseUrl: URL): void {
  if (
    !isExactBaseHostUrl(url, baseUrl) ||
    url.pathname !== "/objects/list/data" ||
    url.search !== "?action=csv" ||
    url.hash !== ""
  ) {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La ruta de exportación Goldcar no pertenece a la lista read-only aprobada.",
    );
  }
}

/**
 * The sensor diagnostic accepts only the visible object-detail document,
 * never a query endpoint, route with credentials, or a fragment variation.
 */
export function assertGoldcarSensorDetailUrl(url: URL, baseUrl: URL): void {
  if (
    !isExactBaseHostUrl(url, baseUrl) ||
    !/^\/objects\/[A-Za-z0-9_-]+$/u.test(url.pathname) ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "La ruta de detalle Goldcar no tiene la forma read-only aprobada.",
    );
  }
}

export function assertExactGoldcarSensorDetailResponseUrl(
  responseUrl: URL,
  requestedUrl: URL,
  baseUrl: URL,
): void {
  assertGoldcarSensorDetailUrl(requestedUrl, baseUrl);
  assertGoldcarSensorDetailUrl(responseUrl, baseUrl);
  if (
    responseUrl.protocol !== requestedUrl.protocol ||
    responseUrl.host !== requestedUrl.host ||
    responseUrl.pathname !== requestedUrl.pathname ||
    responseUrl.search !== requestedUrl.search ||
    responseUrl.hash !== requestedUrl.hash ||
    responseUrl.username !== requestedUrl.username ||
    responseUrl.password !== requestedUrl.password
  ) {
    throw new GpsProviderError(
      "REMOTE_ERROR",
      "Goldcar no respondió exactamente en la ruta de detalle autorizada.",
    );
  }
}

export async function installGoldcarReadOnlyRouting(
  context: BrowserContext,
  baseUrl: URL,
  options: GoldcarReadOnlyRoutingOptions = {},
): Promise<GoldcarReadOnlyRoutingController> {
  const detailPermit = new GoldcarSensorDetailNavigationPermit();
  const objectsBootstrapPermit = new GoldcarObjectsBootstrapPermit();
  await context.route("**/*", async (route) => {
    const request = route.request();
    const detailDecision = detailPermit.decide(request, baseUrl);
    if (detailDecision !== null) {
      if (detailDecision === "ALLOW") {
        await route.continue();
      } else {
        await route.abort("blockedbyclient");
      }
      return;
    }

    const objectsBootstrapDecision = objectsBootstrapPermit.decide(request, baseUrl);
    if (objectsBootstrapDecision !== null) {
      if (objectsBootstrapDecision === "ALLOW") {
        await route.continue();
      } else {
        await route.abort("blockedbyclient");
      }
      return;
    }

    // The permit remains closed until the inspector deliberately arms it
    // after login. Record only the coarse fact that a candidate was blocked
    // during that narrow timing window; the request still cannot leave.
    objectsBootstrapPermit.recordPreArmDynamicRequestBlocked(request, baseUrl);

    if (isGoldcarSameOriginGetDynamicRequest(request, baseUrl)) {
      // This observer has no authority to loosen routing. Even a faulty
      // observer must leave the dynamic request blocked before dispatch.
      try {
        options.onSameOriginGetDynamicRequest?.(request);
      } catch {
        // Intentionally suppress observer details: the command output must
        // remain aggregate-only and the routing decision remains BLOCK.
      }
      await route.abort("blockedbyclient");
      return;
    }

    if (isGoldcarAllowedStaticResourceRequest(request, baseUrl)) {
      await route.continue();
      return;
    }

    if (isGoldcarSameOriginBlockedStaticResourceRequest(request, baseUrl)) {
      // A passive static manifest may classify only the fixed aggregate
      // categories. It cannot affect the existing deny decision.
      try {
        options.onBlockedSameOriginStaticResourceRequest?.(request);
      } catch {
        // Keep the request blocked and avoid surfacing observer details.
      }
      await route.abort("blockedbyclient");
      return;
    }

    if (decideGoldcarPortalRequest(request.method(), request.url(), baseUrl) === "ALLOW") {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });

  return {
    armGoldcarSensorDetailNavigation(mainFrame: Frame): void {
      detailPermit.arm(mainFrame);
    },
    getConsumedGoldcarSensorDetailUrl(): URL | null {
      return detailPermit.getConsumedUrl();
    },
    armGoldcarObjectsBootstrapForSensorInspection(mainFrame: Frame): void {
      if (options.enableGoldcarObjectsBootstrapForSensorInspection !== true) {
        throw new GpsProviderError(
          "CONFIGURATION",
          "El bootstrap dinámico Goldcar está deshabilitado para este flujo.",
        );
      }
      objectsBootstrapPermit.arm(mainFrame, baseUrl);
    },
    sealGoldcarObjectsBootstrapForSensorInspection(): void {
      if (options.enableGoldcarObjectsBootstrapForSensorInspection !== true) {
        throw new GpsProviderError(
          "CONFIGURATION",
          "El bootstrap dinámico Goldcar está deshabilitado para este flujo.",
        );
      }
      objectsBootstrapPermit.seal();
    },
    getGoldcarObjectsBootstrapDiagnosticForSensorInspection(): GoldcarObjectsBootstrapDiagnostic {
      if (options.enableGoldcarObjectsBootstrapForSensorInspection !== true) {
        throw new GpsProviderError(
          "CONFIGURATION",
          "El bootstrap dinámico Goldcar está deshabilitado para este flujo.",
        );
      }
      return objectsBootstrapPermit.diagnostic;
    },
  };
}

/**
 * Validates the complete, fixed DEC-033 envelope without retaining any
 * request-derived data. It is used both before consuming a slot and after
 * the cap, so the diagnostic can state whether an otherwise eligible
 * follow-up was blocked without exposing that follow-up.
 */
function isEligibleGoldcarObjectsBootstrapDynamicRequest(
  request: GoldcarObjectsBootstrapDynamicRequest,
  mainFrame: Frame,
  baseUrl: URL,
): boolean {
  if (
    request.method().toUpperCase() !== "GET" ||
    request.isNavigationRequest() ||
    request.frame() !== mainFrame
  ) {
    return false;
  }
  try {
    const url = new URL(request.url());
    return (
      isExactBaseHostUrl(url, baseUrl) &&
      url.hash === "" &&
      request.redirectedFrom() === null &&
      isGoldcarObjectsDocumentFrame(mainFrame, baseUrl)
    );
  } catch {
    return false;
  }
}

function isGoldcarStaticResourceType(resourceType: string): boolean {
  return (
    resourceType === "script" ||
    resourceType === "stylesheet" ||
    resourceType === "font" ||
    resourceType === "image"
  );
}

function isGoldcarDynamicTransportRequest(request: Pick<Request, "resourceType">): boolean {
  return request.resourceType() === "xhr" || request.resourceType() === "fetch";
}

function isGoldcarObjectsDocumentFrame(frame: Frame, baseUrl: URL): boolean {
  let url: URL;
  try {
    url = new URL(frame.url());
  } catch {
    return false;
  }
  return (
    isExactBaseHostUrl(url, baseUrl) &&
    (url.pathname === "/objects" || url.pathname === "/objects/") &&
    url.search === "" &&
    url.hash === ""
  );
}

function isExactBaseHostUrl(url: URL, baseUrl: URL): boolean {
  return (
    baseUrl.username === "" &&
    baseUrl.password === "" &&
    url.protocol === baseUrl.protocol &&
    url.hostname === baseUrl.hostname &&
    url.port === baseUrl.port &&
    url.username === "" &&
    url.password === ""
  );
}
