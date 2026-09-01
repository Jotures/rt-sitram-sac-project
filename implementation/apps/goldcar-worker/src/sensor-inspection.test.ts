import { describe, expect, it } from "vitest";
import type { Frame, Locator, Page } from "playwright-core";
import { GpsProviderError } from "@rt-sitram/integrations";
import type { GoldcarReadOnlyRoutingController } from "./read-policy";
import {
  assertGoldcarSensorDetailResponse,
  assertGoldcarSensorDetailStructuralTarget,
  classifyGoldcarSensorInspectionFailure,
  configureGoldcarSensorInspectionPageTimeouts,
  findUniqueVisibleGoldcarTarget,
  getGoldcarObjectsBootstrapDiscoveryTimeoutMs,
  getGoldcarSensorInspectionOperationTimeoutMs,
  getGoldcarSensorInspectionPhaseTimeoutMs,
  goldcarObjectsBootstrapDiscoveryTimeoutMaxMs,
  goldcarSensorInspectionPhaseTimeoutMaxMs,
  goldcarSensorInspectionTotalTimeoutMs,
  goldcarSensorInspectionWatchdogMarginMs,
  inspectGoldcarVisibleTargetAvailability,
  inspectGoldcarSensorDetailHtml,
  navigateToGoldcarSensorDetail,
  runGoldcarSensorInspectionOperation,
  toGoldcarSensorInspectionFailureOutput,
  toGoldcarSensorInspectionOutput,
  waitForGoldcarObjectsDom,
} from "./sensor-inspection";

const baseUrl = new URL("https://satelital.gpsgoldcar.com");
const detailUrl = new URL("https://satelital.gpsgoldcar.com/objects/48291");
const targetCanonicalId = "PORTAL-NAME:X3N-719";
const targetVisibleName = "X3N-719";

describe("Goldcar one-shot sensor inspection", () => {
  it("returns only a schema-level sensor summary and never the observed values", () => {
    const summary = inspectGoldcarSensorDetailHtml(
      `
        <section>
          <h1>X3N-719</h1>
          <span>Cobertura</span><strong>60 %</strong>
          <span>Satélites</span><strong>16</strong>
          <span>Ignición</span><strong>ON</strong>
          <span>Voltaje</span><strong>14.06 V</strong>
          <span>Movimiento</span><strong>true</strong>
          <span>Odómetro</span><strong>12874 km</strong>
          <span>Velocidad</span><strong>21 kph</strong>
          <span>Distancia</span><strong>132549.03 km</strong>
        </section>
      `,
      targetCanonicalId,
    );
    const output = toGoldcarSensorInspectionOutput(summary);
    const serialized = JSON.stringify(output);

    expect(output).toEqual({
      status: "completed",
      fields: [
        { field: "coverage", labelPresent: true, valueShape: "PERCENTAGE" },
        { field: "satellites", labelPresent: true, valueShape: "INTEGER_COUNT" },
        { field: "ignition", labelPresent: true, valueShape: "BOOLEAN_ON_OFF" },
        { field: "voltage", labelPresent: true, valueShape: "NUMERIC_VOLTS" },
        { field: "movement", labelPresent: true, valueShape: "BOOLEAN_TRUE_FALSE" },
        { field: "odometer", labelPresent: true, valueShape: "NUMERIC_KILOMETERS" },
        {
          field: "speed",
          labelPresent: true,
          valueShape: "NUMERIC_KILOMETERS_PER_HOUR",
        },
        { field: "distance", labelPresent: true, valueShape: "NUMERIC_KILOMETERS" },
      ],
    });
    expect(serialized).not.toContain(targetVisibleName);
    expect(serialized).not.toContain(targetCanonicalId);
    expect(serialized).not.toContain("12874");
    expect(serialized).not.toContain("132549.03");
    expect(serialized).not.toContain("14.06");
  });

  it("fails closed when the response cannot prove the approved target or sensor labels", () => {
    expect(() =>
      inspectGoldcarSensorDetailHtml(
        "<section><h1>OTHER-001</h1><span>Velocidad</span></section>",
        targetCanonicalId,
      ),
    ).toThrow("no acredita");
    expect(() =>
      inspectGoldcarSensorDetailHtml(
        "<section><h1>X3N-719</h1><span>Otro</span></section>",
        targetCanonicalId,
      ),
    ).toThrow("no contiene etiquetas");
  });

  it("reports an unverified shape instead of guessing a sensor reading", () => {
    const summary = inspectGoldcarSensorDetailHtml(
      "<section><h1>X3N-719</h1><span>Velocidad</span><strong>n/a</strong></section>",
      targetCanonicalId,
    );

    expect(summary.fields.find((field) => field.field === "speed")).toEqual({
      field: "speed",
      labelPresent: true,
      valueShape: "UNVERIFIABLE",
    });
    expect(JSON.stringify(toGoldcarSensorInspectionOutput(summary))).not.toContain("n/a");
  });

  it("selects exactly one visible target rather than assuming the first DOM match is visible", async () => {
    const visibleTarget = { isVisible: async () => true } as unknown as Locator;
    const hiddenTarget = { isVisible: async () => false } as unknown as Locator;
    const oneTargetPage = createTargetPage([hiddenTarget, visibleTarget], detailUrl.toString());
    const ambiguousTargetPage = createTargetPage(
      [visibleTarget, { isVisible: async () => true } as unknown as Locator],
      detailUrl.toString(),
    );
    const noVisibleTargetPage = createTargetPage([hiddenTarget], detailUrl.toString());

    await expect(findUniqueVisibleGoldcarTarget(oneTargetPage, targetCanonicalId)).resolves.toBe(
      visibleTarget,
    );
    await expect(
      findUniqueVisibleGoldcarTarget(ambiguousTargetPage, targetCanonicalId),
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    await expect(
      findUniqueVisibleGoldcarTarget(noVisibleTargetPage, targetCanonicalId),
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    await expect(
      assertGoldcarSensorDetailStructuralTarget(
        oneTargetPage,
        targetCanonicalId,
        detailUrl,
        baseUrl,
      ),
    ).resolves.toBeUndefined();
  });

  it("classifies target availability without returning target text or DOM data", async () => {
    const visibleTarget = { isVisible: async () => true } as unknown as Locator;
    const hiddenTarget = { isVisible: async () => false } as unknown as Locator;

    await expect(
      inspectGoldcarVisibleTargetAvailability(
        createTargetPage([], detailUrl.toString()),
        targetCanonicalId,
      ),
    ).resolves.toEqual({ availability: "ABSENT", locator: null });
    await expect(
      inspectGoldcarVisibleTargetAvailability(
        createTargetPage([hiddenTarget], detailUrl.toString()),
        targetCanonicalId,
      ),
    ).resolves.toEqual({ availability: "PRESENT_NOT_VISIBLE", locator: null });
    await expect(
      inspectGoldcarVisibleTargetAvailability(
        createTargetPage([hiddenTarget, visibleTarget], detailUrl.toString()),
        targetCanonicalId,
      ),
    ).resolves.toEqual({ availability: "UNIQUE_VISIBLE", locator: visibleTarget });
    await expect(
      inspectGoldcarVisibleTargetAvailability(
        createTargetPage(
          [visibleTarget, { isVisible: async () => true } as unknown as Locator],
          detailUrl.toString(),
        ),
        targetCanonicalId,
      ),
    ).resolves.toEqual({ availability: "MULTIPLE_VISIBLE", locator: null });
  });

  it("waits only for the existing objects document and its attached body", async () => {
    const calls: string[] = [];
    const readyPage = {
      url: () => "https://satelital.gpsgoldcar.com/objects",
      waitForLoadState: async (state: string) => {
        calls.push(`load:${state}`);
      },
      locator: (selector: string) => ({
        waitFor: async (options: { state: string }) => {
          calls.push(`locator:${selector}:${options.state}`);
        },
      }),
    } as unknown as Page;

    await expect(waitForGoldcarObjectsDom(readyPage, baseUrl)).resolves.toBeUndefined();
    expect(calls).toEqual(["load:domcontentloaded", "locator:body:attached"]);
  });

  it("bounds the entire bootstrap discovery window below the portal timeout", () => {
    expect(getGoldcarObjectsBootstrapDiscoveryTimeoutMs(30_000)).toBe(
      goldcarObjectsBootstrapDiscoveryTimeoutMaxMs,
    );
    expect(getGoldcarObjectsBootstrapDiscoveryTimeoutMs(5_000)).toBe(2_500);
    expect(getGoldcarObjectsBootstrapDiscoveryTimeoutMs(60_000)).toBe(
      goldcarObjectsBootstrapDiscoveryTimeoutMaxMs,
    );
  });

  it("keeps every inspector phase and the total session below the host watchdog budget", () => {
    expect(goldcarSensorInspectionTotalTimeoutMs).toBeLessThan(25_000);
    expect(getGoldcarSensorInspectionPhaseTimeoutMs(30_000)).toBe(
      goldcarSensorInspectionPhaseTimeoutMaxMs,
    );
    expect(getGoldcarSensorInspectionPhaseTimeoutMs(2_345)).toBe(2_345);
    expect(getGoldcarSensorInspectionPhaseTimeoutMs(0)).toBe(1);
    expect(getGoldcarSensorInspectionOperationTimeoutMs(8_000)).toBe(
      8_000 - goldcarSensorInspectionWatchdogMarginMs,
    );
    expect(
      getGoldcarSensorInspectionOperationTimeoutMs(goldcarSensorInspectionWatchdogMarginMs),
    ).toBe(1);
    expect(getGoldcarSensorInspectionOperationTimeoutMs(1)).toBe(1);
  });

  it("replaces the portal default timeout before the login phase", () => {
    const calls: string[] = [];
    const page = {
      setDefaultTimeout: (timeoutMs: number) => calls.push(`action:${timeoutMs}`),
      setDefaultNavigationTimeout: (timeoutMs: number) => calls.push(`navigation:${timeoutMs}`),
    } as unknown as Page;

    configureGoldcarSensorInspectionPageTimeouts(page, 8_000);
    expect(calls).toEqual(["action:8000", "navigation:8000"]);
  });

  it("turns an unfinished local phase into a canonical timeout without upstream detail", async () => {
    const failure = await runGoldcarSensorInspectionOperation(
      () => new Promise<never>(() => undefined),
      1,
    ).catch((error: unknown) => classifyGoldcarSensorInspectionFailure("LOGIN", error));

    expect(toGoldcarSensorInspectionFailureOutput(failure)).toEqual({
      status: "failed",
      code: "UNAVAILABLE",
      phase: "LOGIN",
    });
    expect(JSON.stringify(toGoldcarSensorInspectionFailureOutput(failure))).not.toContain(
      "presupuesto local",
    );
  });

  it("passes the remaining bounded timeout to objects readiness", async () => {
    const observed: Array<{ readonly state: string; readonly timeout: number | undefined }> = [];
    const readyPage = {
      url: () => "https://satelital.gpsgoldcar.com/objects",
      waitForLoadState: async (
        state: string,
        options: { readonly timeout?: number } | undefined,
      ) => {
        observed.push({ state, timeout: options?.timeout });
      },
      locator: () => ({
        waitFor: async (options: { readonly state: string; readonly timeout?: number }) => {
          observed.push({ state: options.state, timeout: options.timeout });
        },
      }),
    } as unknown as Page;

    await expect(waitForGoldcarObjectsDom(readyPage, baseUrl, 4_321)).resolves.toBeUndefined();
    expect(observed).toHaveLength(2);
    expect(observed[0]).toMatchObject({ state: "domcontentloaded" });
    expect(observed[1]).toMatchObject({ state: "attached" });
    for (const entry of observed) {
      expect(entry.timeout).toBeGreaterThan(0);
      expect(entry.timeout).toBeLessThanOrEqual(4_321);
    }
  });

  it("checks target visibility directly instead of waiting on an arbitrary first match", async () => {
    const target = { isVisible: async () => true } as unknown as Locator;
    const page = createTargetPage([target], detailUrl.toString());

    await expect(findUniqueVisibleGoldcarTarget(page, targetCanonicalId, 4_321)).resolves.toBe(
      target,
    );
  });

  it("fails closed if the page leaves /objects while waiting for the body", async () => {
    let currentUrl = "https://satelital.gpsgoldcar.com/objects";
    const changingPage = {
      url: () => currentUrl,
      waitForLoadState: async () => undefined,
      locator: () => ({
        waitFor: async () => {
          currentUrl = "https://satelital.gpsgoldcar.com/authentication/create";
        },
      }),
    } as unknown as Page;

    await expect(waitForGoldcarObjectsDom(changingPage, baseUrl)).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
  });

  it("uses the single permitted document navigation response and current page content", async () => {
    const mainFrame = {} as Frame;
    const calls: string[] = [];
    const target = {
      click: async () => {
        calls.push("click");
      },
    } as unknown as Locator;
    const page = {
      mainFrame: () => mainFrame,
      waitForNavigation: async () => ({
        status: () => 200,
        url: () => detailUrl.toString(),
        headers: () => ({ "content-type": "text/html" }),
      }),
      url: () => detailUrl.toString(),
      content: async () => "<main>X3N-719</main>",
    } as unknown as Page;
    const routing: GoldcarReadOnlyRoutingController = {
      armGoldcarSensorDetailNavigation: (frame) => {
        expect(frame).toBe(mainFrame);
        calls.push("arm");
      },
      getConsumedGoldcarSensorDetailUrl: () => detailUrl,
      armGoldcarObjectsBootstrapForSensorInspection: () => {
        throw new Error("not used by detail navigation");
      },
      sealGoldcarObjectsBootstrapForSensorInspection: () => {
        throw new Error("not used by detail navigation");
      },
      getGoldcarObjectsBootstrapDiagnosticForSensorInspection: () => ({
        preArmObjectsDynamicBlocked: false,
        eligibleDynamicBlockedAfterCap: false,
        routingConditionBlocked: false,
      }),
    };

    await expect(
      navigateToGoldcarSensorDetail(page, target, routing, baseUrl, 1_024),
    ).resolves.toEqual({ url: detailUrl, html: "<main>X3N-719</main>" });
    expect(calls).toEqual(["arm", "click"]);
  });

  it("blocks redirects, alternate response URLs, and non-HTML detail responses", () => {
    expect(() =>
      assertGoldcarSensorDetailResponse(
        {
          status: 302,
          responseUrl: detailUrl.toString(),
          contentType: "text/html",
        },
        detailUrl,
        baseUrl,
      ),
    ).toThrow("no admite redirecciones");
    expect(() =>
      assertGoldcarSensorDetailResponse(
        {
          status: 200,
          responseUrl: "https://satelital.gpsgoldcar.com/objects/48292",
          contentType: "text/html",
        },
        detailUrl,
        baseUrl,
      ),
    ).toThrow("exactamente");
    expect(() =>
      assertGoldcarSensorDetailResponse(
        {
          status: 200,
          responseUrl: detailUrl.toString(),
          contentType: "application/json",
        },
        detailUrl,
        baseUrl,
      ),
    ).toThrow("no devolvió HTML");
  });

  it("reports only a canonical failure code and sanitized phase", () => {
    const failure = classifyGoldcarSensorInspectionFailure(
      "FETCH_DETAIL",
      new GpsProviderError(
        "RATE_LIMITED",
        "https://satelital.gpsgoldcar.com/objects/48291?private=query Cookie: private-cookie 12874 km X3N-719",
      ),
    );

    expect(toGoldcarSensorInspectionFailureOutput(failure)).toEqual({
      status: "failed",
      code: "RATE_LIMITED",
      phase: "FETCH_DETAIL",
    });
    expect(JSON.stringify(toGoldcarSensorInspectionFailureOutput(failure))).not.toContain("48291");
    expect(JSON.stringify(toGoldcarSensorInspectionFailureOutput(failure))).not.toContain("12874");
    expect(JSON.stringify(toGoldcarSensorInspectionFailureOutput(failure))).not.toContain(
      "X3N-719",
    );
    expect(JSON.stringify(toGoldcarSensorInspectionFailureOutput(failure))).not.toContain(
      "private=query",
    );
    expect(JSON.stringify(toGoldcarSensorInspectionFailureOutput(failure))).not.toContain(
      "private-cookie",
    );

    expect(toGoldcarSensorInspectionFailureOutput(new Error("browser detail payload"))).toEqual({
      status: "failed",
      code: "UNAVAILABLE",
      phase: "BROWSER_LAUNCH",
    });

    const availabilityFailure = classifyGoldcarSensorInspectionFailure(
      "DISCOVER_DETAIL",
      new Error("private target route, cookie, and body"),
      "TARGET_AVAILABILITY",
    );
    expect(toGoldcarSensorInspectionFailureOutput(availabilityFailure)).toEqual({
      status: "failed",
      code: "UNAVAILABLE",
      phase: "DISCOVER_DETAIL",
      subphase: "TARGET_AVAILABILITY",
    });
    expect(
      JSON.stringify(toGoldcarSensorInspectionFailureOutput(availabilityFailure)),
    ).not.toContain("private target");
  });
});

function createTargetPage(targets: readonly Locator[], currentUrl: string): Page {
  return {
    url: () => currentUrl,
    getByText: (target: string, options: { exact?: boolean }) => {
      if (options.exact !== true) throw new Error("expected exact target lookup");
      if (target !== targetVisibleName) throw new Error("expected the derived visible target");
      return {
        count: async () => targets.length,
        nth: (index: number) => targets[index]!,
      } as unknown as Locator;
    },
  } as unknown as Page;
}
