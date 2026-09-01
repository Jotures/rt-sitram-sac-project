import { describe, expect, it, vi } from "vitest";
import type { ActorContext, Clock, IdGenerator } from "../shared/application";
import { createClient, updateClient, type ClientOfflineStore } from "./clients";

const actor: ActorContext = { profileId: "admin", companyId: "company-a", role: "administration" };
const clock: Clock = { now: () => new Date("2026-08-13T00:00:00.000Z") };
const ids: IdGenerator = { next: () => "client-a" };
const store: ClientOfflineStore = {
  saveClient: vi.fn(() => Promise.resolve()),
  getClient: () => Promise.resolve(null),
  listClients: () => Promise.resolve([]),
};

describe("client masters", () => {
  it("creates and updates an own-company client", async () => {
    const client = await createClient({ store, ids, clock }, actor, {
      legalName: " Cliente ABC ",
      taxId: " 20123456789 ",
      relationship: "DIRECT",
      paymentTermsDays: 15,
    });
    expect(client).toMatchObject({
      legalName: "Cliente ABC",
      taxId: "20123456789",
      companyId: "company-a",
    });
    await expect(
      updateClient(store, actor, client, { paymentTermsDays: 30 }),
    ).resolves.toMatchObject({ paymentTermsDays: 30 });
  });

  it("rejects fractional payment terms", async () => {
    await expect(
      createClient({ store, ids, clock }, actor, {
        legalName: "Cliente",
        relationship: "DIRECT",
        paymentTermsDays: 1.5,
      }),
    ).rejects.toThrow("deben ser enteros");
  });
});
