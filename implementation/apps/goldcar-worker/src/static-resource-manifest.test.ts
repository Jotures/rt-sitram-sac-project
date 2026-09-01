import { GpsProviderError } from "@rt-sitram/integrations";
import { describe, expect, it } from "vitest";
import type { Frame, Request } from "playwright-core";
import type { GoldcarSameOriginStaticResourceRequest } from "./read-policy";
import {
  classifyGoldcarStaticResourceManifestInspectionFailure,
  GoldcarPassiveStaticResourceManifestCollector,
  toGoldcarStaticResourceManifestFailureOutput,
  toGoldcarStaticResourceManifestOutput,
} from "./static-resource-manifest";

const baseUrl = new URL("https://satelital.gpsgoldcar.com");

describe("Goldcar passive static-resource manifest inspection", () => {
  it("retains only fixed type and path-class counts for blocked resources", () => {
    const collector = new GoldcarPassiveStaticResourceManifestCollector(baseUrl);

    collector.record(
      createStaticRequest({
        resourceType: "script",
        url: "https://satelital.gpsgoldcar.com/js/application.js?build=private-1",
      }),
    );
    collector.record(
      createStaticRequest({
        resourceType: "stylesheet",
        url: "https://satelital.gpsgoldcar.com/css/application.css?build=private-2",
      }),
    );
    collector.record(
      createStaticRequest({
        resourceType: "font",
        url: "https://satelital.gpsgoldcar.com/vendor/fonts/private.woff?token=secret",
      }),
    );
    collector.record(
      createStaticRequest({
        resourceType: "image",
        url: "https://satelital.gpsgoldcar.com/assets/logo.svg?cache=private-3",
      }),
    );
    collector.record(
      createStaticRequest({
        resourceType: "image",
        url: "https://satelital.gpsgoldcar.com/images/logo.png?cache=private-4",
      }),
    );
    const output = toGoldcarStaticResourceManifestOutput(collector.toSummary());
    const serialized = JSON.stringify(output);

    expect(output).toEqual({
      status: "completed",
      candidateCount: 5,
      resourceTypeCounts: { script: 1, stylesheet: 1, font: 1, image: 2 },
      pathClassCounts: { assets: 1, js: 1, css: 1, vendor: 1, other: 1 },
    });
    expect(serialized).not.toContain("satelital");
    expect(serialized).not.toContain("application.js");
    expect(serialized).not.toContain("private-1");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("build");
  });

  it("does not count resources the current policy allows or requests outside the narrow scope", () => {
    const collector = new GoldcarPassiveStaticResourceManifestCollector(baseUrl);

    collector.record(
      createStaticRequest({
        resourceType: "script",
        url: "https://satelital.gpsgoldcar.com/assets/application.js",
      }),
    );
    collector.record(
      createStaticRequest({
        resourceType: "script",
        url: "https://satelital.gpsgoldcar.com/assets/application.js?cache=private",
      }),
    );
    collector.record(
      createStaticRequest({
        resourceType: "stylesheet",
        url: "https://satelital.gpsgoldcar.com/assets/application.css?cache=private",
      }),
    );
    collector.record(
      createStaticRequest({
        resourceType: "script",
        url: "https://satelital.gpsgoldcar.com/js/application.js?build=private",
        frameUrl: "https://satelital.gpsgoldcar.com/authentication/create",
      }),
    );
    collector.record(
      createStaticRequest({
        resourceType: "stylesheet",
        url: "https://other.example.test/css/application.css?build=private",
      }),
    );
    collector.record(
      createStaticRequest({
        resourceType: "fetch",
        url: "https://satelital.gpsgoldcar.com/js/application.js?build=private",
      }),
    );
    collector.record(
      createStaticRequest({
        method: "POST",
        resourceType: "image",
        url: "https://satelital.gpsgoldcar.com/images/logo.png?build=private",
      }),
    );
    collector.record(
      createStaticRequest({
        navigation: true,
        resourceType: "font",
        url: "https://satelital.gpsgoldcar.com/fonts/font.woff?build=private",
      }),
    );

    expect(collector.toSummary()).toEqual({
      candidateCount: 0,
      resourceTypeCounts: { script: 0, stylesheet: 0, font: 0, image: 0 },
      pathClassCounts: { assets: 0, js: 0, css: 0, vendor: 0, other: 0 },
    });
  });

  it("serializes failures as only a canonical code and phase", () => {
    const failure = classifyGoldcarStaticResourceManifestInspectionFailure(
      "LOAD_OBJECTS",
      new GpsProviderError(
        "RATE_LIMITED",
        "https://satelital.gpsgoldcar.com/js/application.js?build=private&token=secret",
      ),
    );
    const output = toGoldcarStaticResourceManifestFailureOutput(failure);
    const serialized = JSON.stringify(output);

    expect(output).toEqual({ status: "failed", code: "RATE_LIMITED", phase: "LOAD_OBJECTS" });
    expect(serialized).not.toContain("satelital");
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("secret");
  });
});

function createStaticRequest(input: {
  readonly url: string;
  readonly resourceType: string;
  readonly method?: string;
  readonly navigation?: boolean;
  readonly frameUrl?: string;
}): GoldcarSameOriginStaticResourceRequest {
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
