import { describe, expect, it } from "vitest";
import type { BrowserContext, Frame, Request, Route } from "playwright-core";
import {
  assertExactGoldcarSensorDetailResponseUrl,
  assertGoldcarCsvExportUrl,
  assertGoldcarSensorDetailUrl,
  decideGoldcarPortalRequest,
  goldcarObjectsBootstrapDynamicRequestLimit,
  GoldcarObjectsBootstrapPermit,
  GoldcarSensorDetailNavigationPermit,
  installGoldcarReadOnlyRouting,
  isGoldcarAllowedStaticResourceRequest,
  isGoldcarSameOriginBlockedStaticResourceRequest,
  isGoldcarSameOriginGetDynamicRequest,
} from "./read-policy";

const baseUrl = new URL("https://satelital.gpsgoldcar.com");

describe("Goldcar read-only request policy", () => {
  it("allows same-origin reads and only the login form write", () => {
    expect(
      decideGoldcarPortalRequest("GET", "https://satelital.gpsgoldcar.com/objects", baseUrl),
    ).toBe("ALLOW");
    expect(
      decideGoldcarPortalRequest(
        "POST",
        "https://satelital.gpsgoldcar.com/authentication/store",
        baseUrl,
      ),
    ).toBe("ALLOW");
    expect(
      decideGoldcarPortalRequest(
        "POST",
        "https://operator:secret@satelital.gpsgoldcar.com/authentication/store",
        baseUrl,
      ),
    ).toBe("BLOCK");
    expect(
      decideGoldcarPortalRequest(
        "POST",
        "https://satelital.gpsgoldcar.com/authentication/store?next=%2Fobjects",
        baseUrl,
      ),
    ).toBe("BLOCK");
    expect(
      decideGoldcarPortalRequest(
        "POST",
        "https://satelital.gpsgoldcar.com/authentication/store#detail",
        baseUrl,
      ),
    ).toBe("BLOCK");
    expect(
      decideGoldcarPortalRequest("POST", "https://satelital.gpsgoldcar.com/alerts", baseUrl),
    ).toBe("BLOCK");
    expect(
      decideGoldcarPortalRequest("GET", "https://satelital.gpsgoldcar.com/alerts", baseUrl),
    ).toBe("BLOCK");
    expect(
      decideGoldcarPortalRequest(
        "GET",
        "https://satelital.gpsgoldcar.com/objects/list/data?action=csv",
        baseUrl,
      ),
    ).toBe("BLOCK");
    expect(decideGoldcarPortalRequest("GET", "https://maps.example.test/tile", baseUrl)).toBe(
      "BLOCK",
    );
  });

  it("accepts only the exact visible CSV export route", () => {
    expect(() =>
      assertGoldcarCsvExportUrl(
        new URL("https://satelital.gpsgoldcar.com/objects/list/data?action=csv"),
        baseUrl,
      ),
    ).not.toThrow();
    expect(() =>
      assertGoldcarCsvExportUrl(
        new URL("https://satelital.gpsgoldcar.com/objects/list/data?action=pdf"),
        baseUrl,
      ),
    ).toThrow("read-only");
    expect(() =>
      assertGoldcarCsvExportUrl(
        new URL("https://satelital.gpsgoldcar.com/objects/list/data?action=csv&extra=1"),
        baseUrl,
      ),
    ).toThrow("read-only");
    expect(() =>
      assertGoldcarCsvExportUrl(
        new URL("https://operator:secret@satelital.gpsgoldcar.com/objects/list/data?action=csv"),
        baseUrl,
      ),
    ).toThrow("read-only");
    expect(() =>
      assertGoldcarCsvExportUrl(
        new URL("https://satelital.gpsgoldcar.com/objects/list/data?action=csv#fragment"),
        baseUrl,
      ),
    ).toThrow("read-only");
  });

  it("accepts a detail link only in the exact visible /objects/<id> shape", () => {
    const detailUrl = new URL("https://satelital.gpsgoldcar.com/objects/48291");

    expect(() => assertGoldcarSensorDetailUrl(detailUrl, baseUrl)).not.toThrow();
    expect(() =>
      assertGoldcarSensorDetailUrl(
        new URL("https://satelital.gpsgoldcar.com/objects/48291?tab=sensors"),
        baseUrl,
      ),
    ).toThrow("detalle Goldcar");
    expect(() =>
      assertGoldcarSensorDetailUrl(
        new URL("https://satelital.gpsgoldcar.com/objects/48291#sensors"),
        baseUrl,
      ),
    ).toThrow("detalle Goldcar");
    expect(() =>
      assertGoldcarSensorDetailUrl(
        new URL("https://satelital.gpsgoldcar.com/objects/48291/history"),
        baseUrl,
      ),
    ).toThrow("detalle Goldcar");
    expect(() =>
      assertGoldcarSensorDetailUrl(new URL("https://other.example.test/objects/48291"), baseUrl),
    ).toThrow("detalle Goldcar");
    expect(() =>
      assertGoldcarSensorDetailUrl(
        new URL("https://operator:secret@satelital.gpsgoldcar.com/objects/48291"),
        baseUrl,
      ),
    ).toThrow("detalle Goldcar");
  });

  it("recognizes only same-origin non-navigation GET XHR/fetch requests as passive candidates", () => {
    expect(
      isGoldcarSameOriginGetDynamicRequest(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/internal/telemetry?vehicle=private",
          navigation: false,
          frame: {} as Frame,
          resourceType: "fetch",
        }),
        baseUrl,
      ),
    ).toBe(true);
    expect(
      isGoldcarSameOriginGetDynamicRequest(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/internal/telemetry",
          navigation: false,
          frame: {} as Frame,
          resourceType: "xhr",
        }),
        baseUrl,
      ),
    ).toBe(true);

    for (const request of [
      createRequest({
        method: "POST",
        url: "https://satelital.gpsgoldcar.com/internal/telemetry",
        navigation: false,
        frame: {} as Frame,
        resourceType: "fetch",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/internal/telemetry",
        navigation: true,
        frame: {} as Frame,
        resourceType: "fetch",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/assets/app.js",
        navigation: false,
        frame: {} as Frame,
        resourceType: "script",
      }),
      createRequest({
        method: "GET",
        url: "https://operator:secret@satelital.gpsgoldcar.com/internal/telemetry",
        navigation: false,
        frame: {} as Frame,
        resourceType: "xhr",
      }),
      createRequest({
        method: "GET",
        url: "https://other.example.test/internal/telemetry",
        navigation: false,
        frame: {} as Frame,
        resourceType: "xhr",
      }),
    ]) {
      expect(isGoldcarSameOriginGetDynamicRequest(request, baseUrl)).toBe(false);
    }
  });

  it("recognizes only currently blocked same-origin static resources as passive candidates", () => {
    for (const resourceType of ["script", "stylesheet", "font", "image"]) {
      expect(
        isGoldcarSameOriginBlockedStaticResourceRequest(
          createRequest({
            method: "GET",
            url: "https://satelital.gpsgoldcar.com/vendor/private-resource?cache=private",
            navigation: false,
            frame: {} as Frame,
            resourceType,
          }),
          baseUrl,
        ),
      ).toBe(true);
    }

    for (const request of [
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/assets/application.js",
        navigation: false,
        frame: {} as Frame,
        resourceType: "script",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/vendor/private-resource",
        navigation: false,
        frame: {} as Frame,
        resourceType: "fetch",
      }),
      createRequest({
        method: "POST",
        url: "https://satelital.gpsgoldcar.com/vendor/private-resource",
        navigation: false,
        frame: {} as Frame,
        resourceType: "image",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/vendor/private-resource",
        navigation: true,
        frame: {} as Frame,
        resourceType: "font",
      }),
      createRequest({
        method: "GET",
        url: "https://operator:secret@satelital.gpsgoldcar.com/vendor/private-resource",
        navigation: false,
        frame: {} as Frame,
        resourceType: "stylesheet",
      }),
      createRequest({
        method: "GET",
        url: "https://other.example.test/vendor/private-resource",
        navigation: false,
        frame: {} as Frame,
        resourceType: "script",
      }),
    ]) {
      expect(isGoldcarSameOriginBlockedStaticResourceRequest(request, baseUrl)).toBe(false);
    }
  });

  it("allows only cache-busted scripts and styles beneath the fixed assets directory", () => {
    for (const resourceType of ["script", "stylesheet"]) {
      expect(
        isGoldcarAllowedStaticResourceRequest(
          createRequest({
            method: "GET",
            url: "https://satelital.gpsgoldcar.com/assets/application.js?cache=private",
            navigation: false,
            frame: {} as Frame,
            resourceType,
          }),
          baseUrl,
        ),
      ).toBe(true);
    }

    for (const request of [
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/assets/logo.png?cache=private",
        navigation: false,
        frame: {} as Frame,
        resourceType: "image",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/assets/font.woff?cache=private",
        navigation: false,
        frame: {} as Frame,
        resourceType: "font",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/assets/application.js?cache=private",
        navigation: false,
        frame: {} as Frame,
        resourceType: "fetch",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/assets-elsewhere/application.js?cache=private",
        navigation: false,
        frame: {} as Frame,
        resourceType: "script",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/assets/application.js?cache=private#fragment",
        navigation: false,
        frame: {} as Frame,
        resourceType: "script",
      }),
      createRequest({
        method: "GET",
        url: "https://operator:secret@satelital.gpsgoldcar.com/assets/application.js?cache=private",
        navigation: false,
        frame: {} as Frame,
        resourceType: "stylesheet",
      }),
    ]) {
      expect(isGoldcarAllowedStaticResourceRequest(request, baseUrl)).toBe(false);
    }

    expect(
      isGoldcarSameOriginBlockedStaticResourceRequest(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/assets/application.js?cache=private",
          navigation: false,
          frame: {} as Frame,
          resourceType: "script",
        }),
        baseUrl,
      ),
    ).toBe(false);
    expect(
      isGoldcarSameOriginBlockedStaticResourceRequest(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/assets/logo.png?cache=private",
          navigation: false,
          frame: {} as Frame,
          resourceType: "image",
        }),
        baseUrl,
      ),
    ).toBe(true);
  });

  it("notifies and aborts a passive dynamic candidate before it can continue", async () => {
    const routeHandlers: Array<(route: Route) => Promise<void>> = [];
    const context = {
      route: async (_pattern: string, handler: (route: Route) => Promise<void>) => {
        routeHandlers.push(handler);
      },
    } as unknown as BrowserContext;
    const observed: Request[] = [];
    const actions: string[] = [];
    await installGoldcarReadOnlyRouting(context, baseUrl, {
      onSameOriginGetDynamicRequest: (request) => {
        observed.push(request as Request);
        throw new Error("observer-private-detail");
      },
    });
    const candidate = createRequest({
      method: "GET",
      url: "https://satelital.gpsgoldcar.com/internal/telemetry?vehicle=private",
      navigation: false,
      frame: {} as Frame,
      resourceType: "fetch",
    });
    const route = {
      request: () => candidate,
      abort: async (reason: string) => {
        actions.push(`abort:${reason}`);
      },
      continue: async () => {
        actions.push("continue");
      },
    } as unknown as Route;

    const routeHandler = routeHandlers[0];
    if (routeHandler === undefined) throw new Error("expected a routing handler");
    await routeHandler(route);

    expect(observed).toEqual([candidate]);
    expect(actions).toEqual(["abort:blockedbyclient"]);
  });

  it("notifies and aborts a blocked static resource without relaxing the policy", async () => {
    const routeHandlers: Array<(route: Route) => Promise<void>> = [];
    const context = {
      route: async (_pattern: string, handler: (route: Route) => Promise<void>) => {
        routeHandlers.push(handler);
      },
    } as unknown as BrowserContext;
    const observed: Request[] = [];
    const actions: string[] = [];
    await installGoldcarReadOnlyRouting(context, baseUrl, {
      onBlockedSameOriginStaticResourceRequest: (request) => {
        observed.push(request as Request);
        throw new Error("observer-private-static-resource");
      },
    });
    const candidate = createRequest({
      method: "GET",
      url: "https://satelital.gpsgoldcar.com/vendor/private-resource?cache=private",
      navigation: false,
      frame: {} as Frame,
      resourceType: "script",
    });
    const route = {
      request: () => candidate,
      abort: async (reason: string) => {
        actions.push(`abort:${reason}`);
      },
      continue: async () => {
        actions.push("continue");
      },
    } as unknown as Route;

    const routeHandler = routeHandlers[0];
    if (routeHandler === undefined) throw new Error("expected a routing handler");
    await routeHandler(route);

    expect(observed).toEqual([candidate]);
    expect(actions).toEqual(["abort:blockedbyclient"]);
  });

  it("continues only allowed asset scripts/styles with cache queries", async () => {
    const routeHandlers: Array<(route: Route) => Promise<void>> = [];
    const context = {
      route: async (_pattern: string, handler: (route: Route) => Promise<void>) => {
        routeHandlers.push(handler);
      },
    } as unknown as BrowserContext;
    const observed: Request[] = [];
    const actions: string[] = [];
    await installGoldcarReadOnlyRouting(context, baseUrl, {
      onBlockedSameOriginStaticResourceRequest: (request) => observed.push(request as Request),
    });
    const routeHandler = routeHandlers[0];
    if (routeHandler === undefined) throw new Error("expected a routing handler");

    for (const resourceType of ["script", "stylesheet"]) {
      const candidate = createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/assets/application.js?cache=private",
        navigation: false,
        frame: {} as Frame,
        resourceType,
      });
      await routeHandler({
        request: () => candidate,
        abort: async () => {
          actions.push("abort");
        },
        continue: async () => {
          actions.push(`continue:${resourceType}`);
        },
      } as unknown as Route);
    }

    expect(observed).toEqual([]);
    expect(actions).toEqual(["continue:script", "continue:stylesheet"]);
  });

  it("keeps the DEC-033 dynamic bootstrap closed until armed and caps exactly five initial requests", () => {
    const mainFrame = createObjectsFrame();
    const permit = new GoldcarObjectsBootstrapPermit();
    const candidate = (index: number) =>
      createRequest({
        method: "GET",
        url: `https://satelital.gpsgoldcar.com/internal/bootstrap-${index}?private=query`,
        navigation: false,
        frame: mainFrame,
        resourceType: "fetch",
      });

    expect(permit.decide(candidate(0), baseUrl)).toBeNull();
    expect(permit.state).toBe("IDLE");
    expect(permit.allowedRequestCount).toBe(0);
    expect(permit.diagnostic).toEqual({
      preArmObjectsDynamicBlocked: false,
      eligibleDynamicBlockedAfterCap: false,
      routingConditionBlocked: false,
    });

    permit.arm(mainFrame, baseUrl);
    for (let index = 0; index < goldcarObjectsBootstrapDynamicRequestLimit; index += 1) {
      expect(permit.decide(candidate(index), baseUrl)).toBe("ALLOW");
    }
    expect(permit.allowedRequestCount).toBe(goldcarObjectsBootstrapDynamicRequestLimit);
    expect(permit.state).toBe("EXHAUSTED");
    // Reaching the cap is not evidence that a sixth request was required.
    expect(permit.diagnostic).toEqual({
      preArmObjectsDynamicBlocked: false,
      eligibleDynamicBlockedAfterCap: false,
      routingConditionBlocked: false,
    });
    expect(permit.decide(candidate(goldcarObjectsBootstrapDynamicRequestLimit), baseUrl)).toBe(
      "BLOCK",
    );
    expect(permit.allowedRequestCount).toBe(goldcarObjectsBootstrapDynamicRequestLimit);
    expect(permit.diagnostic).toEqual({
      preArmObjectsDynamicBlocked: false,
      eligibleDynamicBlockedAfterCap: true,
      routingConditionBlocked: false,
    });
  });

  it("blocks every non-initial, non-main-objects bootstrap request without spending its budget", () => {
    const mainFrame = createObjectsFrame();
    const otherFrame = createObjectsFrame();
    const permit = new GoldcarObjectsBootstrapPermit();
    permit.arm(mainFrame, baseUrl);

    for (const request of [
      createRequest({
        method: "POST",
        url: "https://satelital.gpsgoldcar.com/internal/bootstrap",
        navigation: false,
        frame: mainFrame,
        resourceType: "xhr",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/internal/bootstrap",
        navigation: true,
        frame: mainFrame,
        resourceType: "fetch",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/internal/bootstrap",
        navigation: false,
        frame: otherFrame,
        resourceType: "xhr",
      }),
      createRequest({
        method: "GET",
        url: "https://other.example.test/internal/bootstrap",
        navigation: false,
        frame: mainFrame,
        resourceType: "fetch",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/internal/bootstrap",
        navigation: false,
        frame: mainFrame,
        resourceType: "fetch",
        redirectedFrom: {} as Request,
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/internal/bootstrap#fragment",
        navigation: false,
        frame: mainFrame,
        resourceType: "xhr",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/objects",
        navigation: true,
        frame: mainFrame,
        resourceType: "document",
      }),
      createRequest({
        method: "GET",
        url: "https://satelital.gpsgoldcar.com/assets/application.js",
        navigation: false,
        frame: otherFrame,
        resourceType: "script",
      }),
    ]) {
      expect(permit.decide(request, baseUrl)).toBe("BLOCK");
      expect(permit.state).toBe("ARMED");
      expect(permit.allowedRequestCount).toBe(0);
    }
    expect(permit.diagnostic).toEqual({
      preArmObjectsDynamicBlocked: false,
      eligibleDynamicBlockedAfterCap: false,
      routingConditionBlocked: true,
    });

    permit.seal();
    expect(permit.state).toBe("SEALED");
    expect(
      permit.decide(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/internal/bootstrap",
          navigation: false,
          frame: mainFrame,
          resourceType: "fetch",
        }),
        baseUrl,
      ),
    ).toBe("BLOCK");
    expect(permit.allowedRequestCount).toBe(0);
    expect(() => permit.seal()).toThrow("no está preparado");
    expect(() => permit.arm(mainFrame, baseUrl)).toThrow("ya fue preparado");
  });

  it("retains only aggregate pre-arm and post-cap routing facts without request data", () => {
    const mainFrame = createObjectsFrame();
    const permit = new GoldcarObjectsBootstrapPermit();
    const candidate = (index: number) =>
      createRequest({
        method: "GET",
        url: `https://satelital.gpsgoldcar.com/internal/bootstrap-${index}?private=query`,
        navigation: false,
        frame: mainFrame,
        resourceType: "xhr",
      });

    permit.recordPreArmDynamicRequestBlocked(candidate(0), baseUrl);
    permit.arm(mainFrame, baseUrl);
    for (let index = 0; index < goldcarObjectsBootstrapDynamicRequestLimit; index += 1) {
      expect(permit.decide(candidate(index), baseUrl)).toBe("ALLOW");
    }
    expect(permit.decide(candidate(goldcarObjectsBootstrapDynamicRequestLimit), baseUrl)).toBe(
      "BLOCK",
    );
    permit.seal();

    const diagnostic = permit.diagnostic;
    expect(diagnostic).toEqual({
      preArmObjectsDynamicBlocked: true,
      eligibleDynamicBlockedAfterCap: true,
      routingConditionBlocked: false,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("bootstrap-");
    expect(JSON.stringify(diagnostic)).not.toContain("private=query");
    expect(JSON.stringify(diagnostic)).not.toContain("5");
  });

  it("retains only the pre-existing main-frame static asset exception while bootstrap is armed", () => {
    const mainFrame = createObjectsFrame();
    const permit = new GoldcarObjectsBootstrapPermit();
    permit.arm(mainFrame, baseUrl);

    expect(
      permit.decide(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/assets/application.js?cache=private",
          navigation: false,
          frame: mainFrame,
          resourceType: "script",
        }),
        baseUrl,
      ),
    ).toBe("ALLOW");
    expect(
      permit.decide(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/assets/logo.png",
          navigation: false,
          frame: mainFrame,
          resourceType: "image",
        }),
        baseUrl,
      ),
    ).toBe("BLOCK");
    expect(permit.allowedRequestCount).toBe(0);
  });

  it("requires an exact objects main document before bootstrap and never exposes it by default", async () => {
    const invalidPermit = new GoldcarObjectsBootstrapPermit();
    expect(() =>
      invalidPermit.arm(
        createObjectsFrame("https://satelital.gpsgoldcar.com/authentication/create"),
        baseUrl,
      ),
    ).toThrow("documento de objetos");

    const routeHandlers: Array<(route: Route) => Promise<void>> = [];
    const context = {
      route: async (_pattern: string, handler: (route: Route) => Promise<void>) => {
        routeHandlers.push(handler);
      },
    } as unknown as BrowserContext;
    const routing = await installGoldcarReadOnlyRouting(context, baseUrl);
    expect(() =>
      routing.armGoldcarObjectsBootstrapForSensorInspection(createObjectsFrame()),
    ).toThrow("deshabilitado");
    expect(routeHandlers).toHaveLength(1);
  });

  it("continues only sensor-enabled bootstrap requests and blocks them once sealed", async () => {
    const routeHandlers: Array<(route: Route) => Promise<void>> = [];
    const context = {
      route: async (_pattern: string, handler: (route: Route) => Promise<void>) => {
        routeHandlers.push(handler);
      },
    } as unknown as BrowserContext;
    const routing = await installGoldcarReadOnlyRouting(context, baseUrl, {
      enableGoldcarObjectsBootstrapForSensorInspection: true,
    });
    const routeHandler = routeHandlers[0];
    if (routeHandler === undefined) throw new Error("expected a routing handler");
    const mainFrame = createObjectsFrame();
    const actions: string[] = [];
    const candidate = createRequest({
      method: "GET",
      url: "https://satelital.gpsgoldcar.com/internal/bootstrap?private=query",
      navigation: false,
      frame: mainFrame,
      resourceType: "xhr",
    });
    const route = {
      request: () => candidate,
      abort: async (reason: string) => {
        actions.push(`abort:${reason}`);
      },
      continue: async () => {
        actions.push("continue");
      },
    } as unknown as Route;

    await routeHandler(route);
    routing.armGoldcarObjectsBootstrapForSensorInspection(mainFrame);
    await routeHandler(route);
    routing.sealGoldcarObjectsBootstrapForSensorInspection();
    await routeHandler(route);

    expect(actions).toEqual(["abort:blockedbyclient", "continue", "abort:blockedbyclient"]);
  });

  it("requires the sensor response to stay on the one exact derived link", () => {
    const detailUrl = new URL("https://satelital.gpsgoldcar.com/objects/48291");

    expect(() =>
      assertExactGoldcarSensorDetailResponseUrl(
        new URL("https://satelital.gpsgoldcar.com/objects/48291"),
        detailUrl,
        baseUrl,
      ),
    ).not.toThrow();
    expect(() =>
      assertExactGoldcarSensorDetailResponseUrl(
        new URL("https://satelital.gpsgoldcar.com/objects/48292"),
        detailUrl,
        baseUrl,
      ),
    ).toThrow("exactamente");
  });

  it("consumes one exact main-frame detail navigation atomically", () => {
    const mainFrame = {} as Frame;
    const permit = new GoldcarSensorDetailNavigationPermit();
    permit.arm(mainFrame);

    expect(
      permit.decide(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/objects/48291",
          navigation: true,
          frame: mainFrame,
        }),
        baseUrl,
      ),
    ).toBe("ALLOW");
    expect(permit.state).toBe("CONSUMED");
    expect(permit.getConsumedUrl()?.toString()).toBe(
      "https://satelital.gpsgoldcar.com/objects/48291",
    );
    expect(
      permit.decide(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/objects/48292",
          navigation: true,
          frame: mainFrame,
        }),
        baseUrl,
      ),
    ).toBe("BLOCK");
  });

  it("blocks XHR, popups, subframes, posts, malformed routes, and redirects while armed", () => {
    const mainFrame = {} as Frame;
    const otherFrame = {} as Frame;
    const detailUrl = "https://satelital.gpsgoldcar.com/objects/48291";

    for (const { kind, request } of [
      {
        kind: "XHR",
        request: createRequest({
          method: "GET",
          url: detailUrl,
          navigation: false,
          frame: mainFrame,
        }),
      },
      {
        kind: "popup",
        request: createRequest({
          method: "GET",
          url: detailUrl,
          navigation: true,
          frame: otherFrame,
        }),
      },
      {
        kind: "subframe",
        request: createRequest({
          method: "GET",
          url: detailUrl,
          navigation: true,
          frame: otherFrame,
        }),
      },
      {
        kind: "POST",
        request: createRequest({
          method: "POST",
          url: detailUrl,
          navigation: true,
          frame: mainFrame,
        }),
      },
      {
        kind: "query route",
        request: createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/objects/48291?tab=sensors",
          navigation: true,
          frame: mainFrame,
        }),
      },
    ]) {
      const permit = new GoldcarSensorDetailNavigationPermit();
      permit.arm(mainFrame);
      expect(permit.decide(request, baseUrl), kind).toBe("BLOCK");
      expect(permit.state).toBe("ARMED");
    }

    const redirectPermit = new GoldcarSensorDetailNavigationPermit();
    redirectPermit.arm(mainFrame);
    expect(
      redirectPermit.decide(
        createRequest({ method: "GET", url: detailUrl, navigation: true, frame: mainFrame }),
        baseUrl,
      ),
    ).toBe("ALLOW");
    expect(
      redirectPermit.decide(
        createRequest({
          method: "GET",
          url: "https://satelital.gpsgoldcar.com/authentication/create",
          navigation: true,
          frame: mainFrame,
        }),
        baseUrl,
      ),
    ).toBe("BLOCK");
  });
});

function createRequest(input: {
  readonly method: string;
  readonly url: string;
  readonly navigation: boolean;
  readonly frame: Frame;
  readonly resourceType?: string;
  readonly redirectedFrom?: Request | null;
}): Pick<
  Request,
  "method" | "url" | "isNavigationRequest" | "resourceType" | "frame" | "redirectedFrom"
> {
  return {
    method: () => input.method,
    url: () => input.url,
    isNavigationRequest: () => input.navigation,
    resourceType: () => input.resourceType ?? "document",
    frame: () => input.frame,
    redirectedFrom: () => input.redirectedFrom ?? null,
  };
}

function createObjectsFrame(currentUrl = "https://satelital.gpsgoldcar.com/objects"): Frame {
  return { url: () => currentUrl } as unknown as Frame;
}
