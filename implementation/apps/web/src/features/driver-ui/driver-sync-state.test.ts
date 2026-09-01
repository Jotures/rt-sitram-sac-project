import { describe, expect, it } from "vitest";
import { deriveDriverSyncPhase } from "./HistoryAndSyncPages";

const readyState = {
  connected: true,
  connecting: false,
  hasError: false,
  network: "ONLINE" as const,
  pending: 0,
  recoveryReady: true,
  sqliteReady: true,
};

describe("driver synchronization phase", () => {
  it("represents the complete local to server path", () => {
    expect(deriveDriverSyncPhase({ ...readyState, sqliteReady: false })).toBe("local");
    expect(
      deriveDriverSyncPhase({ ...readyState, connected: false, network: "OFFLINE", pending: 2 }),
    ).toBe("pending");
    expect(deriveDriverSyncPhase({ ...readyState, pending: 1 })).toBe("syncing");
    expect(deriveDriverSyncPhase(readyState)).toBe("synced");
  });

  it("keeps a conservative phase while recovery data is loading or unresolved", () => {
    expect(deriveDriverSyncPhase({ ...readyState, recoveryReady: false })).toBe("syncing");
    expect(deriveDriverSyncPhase({ ...readyState, hasError: true })).toBe("error");
  });
});
