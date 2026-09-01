import { describe, expect, it } from "vitest";
import { shouldManagePowerSyncLifecycle } from "./lifecycle-activation";

describe("PowerSync lifecycle activation", () => {
  it("waits for Auth session restoration before managing SQLite", () => {
    expect(shouldManagePowerSyncLifecycle("INITIALIZING")).toBe(false);
    expect(shouldManagePowerSyncLifecycle("AUTHENTICATED")).toBe(true);
    expect(shouldManagePowerSyncLifecycle("UNAUTHENTICATED")).toBe(true);
  });
});
