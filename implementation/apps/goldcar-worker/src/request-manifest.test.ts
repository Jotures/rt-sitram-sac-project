import { GpsProviderError } from "@rt-sitram/integrations";
import { describe, expect, it } from "vitest";
import type { Frame, Page, Request } from "playwright-core";
import type { GoldcarSameOriginDynamicRequest } from "./read-policy";
import {
  classifyGoldcarRequestManifestInspectionFailure,
  GoldcarPassiveRequestManifestCollector,
  toGoldcarRequestManifestFailureOutput,
  toGoldcarRequestManifestOutput,
  waitForGoldcarRequestManifestObjectsLoad,
} from "./request-manifest";

const baseUrl = new URL("https://satelital.gpsgoldcar.com");

describe("Goldcar passive request-manifest inspection", () => {
  it("retains only fixed aggregate metadata from same-origin dynamic candidates", () => {
    const collector = new GoldcarPassiveRequestManifestCollector(baseUrl);

    collector.record(
      createDynamicRequest({
        resourceType: "fetch",
        url: "https://satelital.gpsgoldcar.com/live/speed?asset=private-1&ignition=secret",
      }),
    );
    collector.record(
      createDynamicRequest({
        resourceType: "xhr",
        url: "https://satelital.gpsgoldcar.com/sensors/odometro/voltaje/satelites/cobertura/movimiento/distancia?reading=private-2",
      }),
    );
    const output = toGoldcarRequestManifestOutput(collector.toSummary());
    const serialized = JSON.stringify(output);

    expect(output).toEqual({
      status: "completed",
      candidateCount: 2,
      classes: { fetch: true, xhr: true },
      queryPresent: true,
      telemetryTerms: {
        speed: true,
        ignition: true,
        odometer: true,
        distance: true,
        movement: true,
        voltage: true,
        satellites: true,
        coverage: true,
      },
    });
    expect(serialized).not.toContain("private-1");
    expect(serialized).not.toContain("private-2");
    expect(serialized).not.toContain("satelital");
    expect(serialized).not.toContain("/live/");
    expect(serialized).not.toContain("reading");
  });

  it("does not count login-frame, cross-origin, navigation, post, or static requests", () => {
    const collector = new GoldcarPassiveRequestManifestCollector(baseUrl);

    collector.record(
      createDynamicRequest({
        resourceType: "fetch",
        url: "https://satelital.gpsgoldcar.com/live/speed?asset=private",
        frameUrl: "https://satelital.gpsgoldcar.com/authentication/create",
      }),
    );
    collector.record(
      createDynamicRequest({
        resourceType: "xhr",
        url: "https://other.example.test/live/speed?asset=private",
      }),
    );
    collector.record(
      createDynamicRequest({
        resourceType: "fetch",
        url: "https://satelital.gpsgoldcar.com/live/speed?asset=private",
        navigation: true,
      }),
    );
    collector.record(
      createDynamicRequest({
        method: "POST",
        resourceType: "fetch",
        url: "https://satelital.gpsgoldcar.com/live/speed?asset=private",
      }),
    );
    collector.record(
      createDynamicRequest({
        resourceType: "script",
        url: "https://satelital.gpsgoldcar.com/assets/application.js",
      }),
    );

    expect(collector.toSummary()).toEqual({
      candidateCount: 0,
      classes: { fetch: false, xhr: false },
      queryPresent: false,
      telemetryTerms: {
        speed: false,
        ignition: false,
        odometer: false,
        distance: false,
        movement: false,
        voltage: false,
        satellites: false,
        coverage: false,
      },
    });
  });

  it("waits only for the existing objects document and its normal static load", async () => {
    const calls: string[] = [];
    const page = {
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

    await expect(waitForGoldcarRequestManifestObjectsLoad(page, baseUrl)).resolves.toBeUndefined();
    expect(calls).toEqual([
      "load:domcontentloaded",
      "locator:body:attached",
      "load:load",
      "load:domcontentloaded",
      "locator:body:attached",
    ]);
  });

  it("serializes failures as only a canonical code and phase", () => {
    const failure = classifyGoldcarRequestManifestInspectionFailure(
      "LOAD_OBJECTS",
      new GpsProviderError(
        "RATE_LIMITED",
        "https://satelital.gpsgoldcar.com/live/speed?asset=private&reading=secret",
      ),
    );
    const output = toGoldcarRequestManifestFailureOutput(failure);
    const serialized = JSON.stringify(output);

    expect(output).toEqual({ status: "failed", code: "RATE_LIMITED", phase: "LOAD_OBJECTS" });
    expect(serialized).not.toContain("satelital");
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("secret");
  });
});

function createDynamicRequest(input: {
  readonly url: string;
  readonly resourceType: string;
  readonly method?: string;
  readonly navigation?: boolean;
  readonly frameUrl?: string;
}): GoldcarSameOriginDynamicRequest {
  const frame = {
    url: () => input.frameUrl ?? "https://satelital.gpsgoldcar.com/objects",
  } as unknown as Frame;
  return {
    method: () => input.method ?? "GET",
    url: () => input.url,
    isNavigationRequest: () => input.navigation ?? false,
    resourceType: () => input.resourceType,
    frame: () => frame,
  } as Pick<Request, "method" | "url" | "isNavigationRequest" | "resourceType" | "frame">;
}
