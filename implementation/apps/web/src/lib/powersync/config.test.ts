import { describe, expect, it } from "vitest";
import { readPowerSyncConfiguration } from "./config";

describe("PowerSync configuration", () => {
  it("reports a missing endpoint", () => {
    expect(readPowerSyncConfiguration({})).toEqual({
      status: "NOT_CONFIGURED",
      problem: "MISSING_URL",
    });
  });

  it("accepts a PowerSync HTTP endpoint", () => {
    expect(
      readPowerSyncConfiguration({ VITE_POWERSYNC_URL: "https://example.powersync.com" }),
    ).toEqual({
      status: "CONFIGURED",
      endpoint: "https://example.powersync.com",
    });
  });
});
