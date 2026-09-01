import { describe, expect, it, vi } from "vitest";
import type { ActorContext, Clock, IdGenerator } from "../shared/application";
import {
  completeWorkOrder,
  createMaintenancePlan,
  createVehicle,
  getMaintenanceDueStatus,
  openWorkOrder,
  updateVehicle,
  type FleetOfflineStore,
  type MaintenanceCommandGateway,
  type VehicleModel,
} from "./fleet";

const admin: ActorContext = { profileId: "admin", companyId: "company-a", role: "administration" };
const clock: Clock = { now: () => new Date("2026-08-13T00:00:00.000Z") };
const ids: IdGenerator = { next: () => "generated-id" };

function store(): FleetOfflineStore {
  return {
    saveVehicle: vi.fn(() => Promise.resolve()),
    listVehicles: () => Promise.resolve([]),
    saveMaintenancePlan: vi.fn(() => Promise.resolve()),
    listMaintenancePlans: () => Promise.resolve([]),
    saveWorkOrder: vi.fn(() => Promise.resolve()),
  };
}

function vehicle(overrides: Partial<VehicleModel> = {}): VehicleModel {
  return {
    id: "vehicle-a",
    companyId: "company-a",
    plate: "X2Y756",
    year: 2014,
    capacityTons: 32,
    status: "AVAILABLE",
    active: true,
    createdAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("fleet and maintenance application", () => {
  it("creates normalized vehicle masters and supports scoped updates", async () => {
    const offline = store();
    const created = await createVehicle({ store: offline, ids, clock }, admin, {
      plate: " x2y756 ",
      year: 2014,
      capacityTons: 32,
    });
    expect(created).toMatchObject({ plate: "X2Y756", status: "AVAILABLE", companyId: "company-a" });
    await expect(
      updateVehicle(offline, admin, vehicle({ companyId: "company-b" }), { active: false }),
    ).rejects.toThrow("otra empresa");
  });

  it("requires a due rule and derives its state", async () => {
    await expect(
      createMaintenancePlan({ store: store(), ids }, admin, {
        vehicle: vehicle(),
        name: "Aceite",
        criticalWhenOverdue: true,
      }),
    ).rejects.toThrow("fecha o kilometraje");

    const plan = await createMaintenancePlan({ store: store(), ids }, admin, {
      vehicle: vehicle(),
      name: "Aceite",
      nextMileage: 100_000,
      criticalWhenOverdue: true,
    });
    expect(getMaintenanceDueStatus(plan, 99_700, clock.now())).toBe("UPCOMING");
  });

  it("opens offline work orders but completes them through the backend", async () => {
    const offline = store();
    const order = await openWorkOrder({ store: offline, ids, clock }, admin, {
      vehicle: vehicle(),
      supplierId: "workshop-a",
      type: "CORRECTIVE",
      problem: "Freno",
    });
    expect(offline.saveWorkOrder).toHaveBeenCalledWith(order);
    const completeWorkOrderCommand = vi.fn(() => Promise.resolve());
    const commands: MaintenanceCommandGateway = { completeWorkOrder: completeWorkOrderCommand };
    await completeWorkOrder(commands, admin, order, {
      finalMileage: 1000,
      labourCost: 100,
      partsCost: 200,
    });
    expect(completeWorkOrderCommand).toHaveBeenCalledWith({
      workOrderId: "generated-id",
      finalMileage: 1000,
      labourCost: 100,
      partsCost: 200,
    });
  });
});
