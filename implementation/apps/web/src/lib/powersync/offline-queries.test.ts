import { describe, expect, it, vi } from "vitest";
import type { CommonPowerSyncDatabase } from "@powersync/web";
import { getOfflineIdentity, listOfflineDriverTrips } from "./offline-queries";

describe("offline product queries", () => {
  it("binds authenticated identity instead of interpolating it into SQL", async () => {
    const getAll = vi.fn(async (_sql: string, _parameters?: unknown[]) => []);
    const database = { getAll } as unknown as CommonPowerSyncDatabase;

    await getOfflineIdentity(database, "user-a");
    await listOfflineDriverTrips(database, "user-a");

    expect(getAll).toHaveBeenCalledTimes(2);
    expect(getAll.mock.calls[0]?.[1]).toEqual(["user-a"]);
    expect(getAll.mock.calls[1]?.[1]).toEqual(["user-a"]);
    expect(String(getAll.mock.calls[0]?.[0])).not.toContain("user-a");
    expect(String(getAll.mock.calls[1]?.[0])).not.toContain("user-a");
  });
});
