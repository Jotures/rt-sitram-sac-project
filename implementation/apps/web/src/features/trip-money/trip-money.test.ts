import { describe, expect, it, vi } from "vitest";
import type { ActorContext, Clock, IdGenerator } from "../shared/application";
import {
  closeSettlement,
  issueAdvance,
  recordExpenseOffline,
  recordFuelOffline,
  reopenSettlement,
  type SettlementContext,
  type TripMoneyCommandGateway,
  type TripMoneyOfflineStore,
} from "./trip-money";

const clock: Clock = { now: () => new Date("2026-08-13T12:00:00.000Z") };
const ids: IdGenerator = { next: () => "local-id" };
const driver: ActorContext = {
  profileId: "driver-profile",
  companyId: "company-a",
  role: "driver",
};
const admin: ActorContext = { profileId: "admin", companyId: "company-a", role: "administration" };
const management: ActorContext = {
  profileId: "manager",
  companyId: "company-a",
  role: "management",
};

function context(overrides: Partial<SettlementContext> = {}): SettlementContext {
  return {
    id: "settlement-a",
    companyId: "company-a",
    tripId: "trip-a",
    tripOperationalStatus: "COMPLETED",
    advances: [500],
    approvedExpenses: [350],
    pendingExpenseCount: 0,
    observedExpenseCount: 0,
    allAdvancesIncluded: true,
    balanceResolved: true,
    state: "APPROVED",
    ...overrides,
  };
}

function store(settlement: SettlementContext | null = context()): TripMoneyOfflineStore {
  return {
    createExpense: vi.fn(() => Promise.resolve()),
    createFuelEntry: vi.fn(() => Promise.resolve()),
    getSettlementContext: () => Promise.resolve(settlement),
  };
}

function gateway(): TripMoneyCommandGateway {
  return {
    issueAdvance: vi.fn(() => Promise.resolve("advance-a")),
    closeSettlement: vi.fn(() => Promise.resolve()),
    reopenSettlement: vi.fn(() => Promise.resolve()),
  };
}

describe("offline trip money capture", () => {
  it("queues driver expenses for later review", async () => {
    const offline = store();
    const expense = await recordExpenseOffline({ store: offline, ids, clock }, driver, {
      tripId: "trip-a",
      categoryId: "toll",
      amount: 25,
      description: "Peaje",
    });
    expect(expense).toMatchObject({
      id: "local-id",
      companyId: "company-a",
      driverProfileId: "driver-profile",
      validationStatus: "PENDING_REVIEW",
    });
    expect(offline.createExpense).toHaveBeenCalledWith(expense);
  });

  it("validates fuel arithmetic before queuing", async () => {
    await expect(
      recordFuelOffline({ store: store(), ids, clock }, driver, {
        tripId: "trip-a",
        vehicleId: "vehicle-a",
        mileage: 100,
        quantity: 10,
        volumeUnit: "GALLON",
        unitPrice: 15,
        total: 140,
        supplierName: "Grifo",
      }),
    ).rejects.toThrow("no coincide");
  });
});

describe("sensitive trip money commands", () => {
  it("issues advances through the backend authority", async () => {
    const commands = gateway();
    await expect(
      issueAdvance(commands, driver, {
        tripId: "trip",
        driverId: "driver",
        amount: 1,
        concept: "Ruta",
      }),
    ).rejects.toThrow("No tienes permiso");
    await expect(
      issueAdvance(commands, admin, {
        tripId: "trip",
        driverId: "driver",
        amount: 200,
        concept: " Ruta ",
      }),
    ).resolves.toBe("advance-a");
    expect(commands.issueAdvance).toHaveBeenCalledWith({
      tripId: "trip",
      driverId: "driver",
      amount: 200,
      concept: "Ruta",
    });
  });

  it("calculates and closes an eligible settlement remotely", async () => {
    const commands = gateway();
    const calculation = await closeSettlement(store(), commands, admin, "settlement-a", {
      method: "Transferencia",
      reference: "OP-90210",
      note: "Saldo conciliado",
    });
    expect(calculation.balance).toBe(150);
    expect(commands.closeSettlement).toHaveBeenCalledWith({
      settlementId: "settlement-a",
      resolutionMethod: "Transferencia",
      resolutionReference: "OP-90210",
      resolutionNote: "Saldo conciliado",
    });
  });

  it("blocks closure with unresolved expenses", async () => {
    await expect(
      closeSettlement(
        store(context({ pendingExpenseCount: 1 })),
        gateway(),
        admin,
        "settlement-a",
        {
          method: "Transferencia",
          reference: "OP-90210",
        },
      ),
    ).rejects.toThrow("gastos pendientes");
  });

  it("reserves reopen for management and requires an audit reason", async () => {
    const commands = gateway();
    const closed = context({ state: "CLOSED" });
    await expect(reopenSettlement(commands, admin, closed, "Corrección")).rejects.toThrow(
      "No tienes permiso",
    );
    await expect(reopenSettlement(commands, management, closed, " ")).rejects.toThrow("motivo");
    await reopenSettlement(commands, management, closed, "Comprobante encontrado");
    expect(commands.reopenSettlement).toHaveBeenCalledWith({
      settlementId: "settlement-a",
      reason: "Comprobante encontrado",
    });
  });
});
