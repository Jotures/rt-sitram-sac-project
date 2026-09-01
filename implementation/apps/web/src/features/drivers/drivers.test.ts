import { describe, expect, it, vi } from "vitest";
import type { ActorContext, Clock, IdGenerator } from "../shared/application";
import { createDriver, updateDriver, type DriverOfflineStore } from "./drivers";

const actor: ActorContext = { profileId: "admin", companyId: "company-a", role: "administration" };
const clock: Clock = { now: () => new Date("2026-08-13T00:00:00.000Z") };
const ids: IdGenerator = { next: () => "driver-a" };

describe("driver masters", () => {
  it("creates driver records and keeps profile linkage optional", async () => {
    const saveDriver = vi.fn(() => Promise.resolve());
    const store: DriverOfflineStore = {
      saveDriver,
      listDrivers: () => Promise.resolve([]),
      getDriver: () => Promise.resolve(null),
    };
    const driver = await createDriver({ store, ids, clock }, actor, {
      displayName: "Juan Quispe",
      documentNumber: "12345678",
      phone: "999999999",
      licenceNumber: "Q12345678",
      licenceExpiresAt: new Date("2027-08-13T00:00:00.000Z"),
    });
    expect(driver).toMatchObject({ profileId: null, status: "AVAILABLE", companyId: "company-a" });
    await updateDriver(store, actor, driver, { status: "LEAVE" });
    expect(saveDriver).toHaveBeenLastCalledWith(expect.objectContaining({ status: "LEAVE" }));
  });
});
