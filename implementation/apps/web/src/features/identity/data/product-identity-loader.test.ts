import type { CommonPowerSyncDatabase } from "@powersync/web";
import { describe, expect, it, vi } from "vitest";
import { loadIdentityFromPowerSync } from "./product-identity-loader";

function database(role: string): CommonPowerSyncDatabase {
  return {
    init: vi.fn(async () => undefined),
    getAll: vi.fn(async () => [
      {
        profile_id: "user-a",
        company_id: "company-a",
        display_name: "Carlos",
        role,
        profile_active: 1,
        legal_name: "R&T SITRAM SAC",
        trade_name: "R&T SITRAM",
        company_active: 1,
      },
    ]),
  } as unknown as CommonPowerSyncDatabase;
}

describe("offline identity loader", () => {
  it("loads and validates a cached profile/company pair", async () => {
    await expect(loadIdentityFromPowerSync("user-a", database("driver"))).resolves.toMatchObject({
      ok: true,
      identity: { profile: { role: "driver" } },
    });
  });

  it("rejects an unknown cached role", async () => {
    await expect(loadIdentityFromPowerSync("user-a", database("owner"))).resolves.toMatchObject({
      ok: false,
      reason: "INVALID_DATA",
    });
  });
});
