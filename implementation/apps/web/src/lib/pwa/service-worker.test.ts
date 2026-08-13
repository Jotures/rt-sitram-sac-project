import { describe, expect, it } from "vitest";
import { shouldRegisterServiceWorker } from "./service-worker";

describe("service worker registration", () => {
  it("registers only in a production browser that supports service workers", () => {
    expect(
      shouldRegisterServiceWorker({ isProduction: true, isServiceWorkerSupported: true }),
    ).toBe(true);
    expect(
      shouldRegisterServiceWorker({ isProduction: false, isServiceWorkerSupported: true }),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({ isProduction: true, isServiceWorkerSupported: false }),
    ).toBe(false);
  });
});
