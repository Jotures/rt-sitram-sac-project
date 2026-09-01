import { describe, expect, it } from "vitest";
import type { ActorContext } from "../shared/application";
import { loadDashboard, type DashboardReadGateway, type DashboardSnapshot } from "./dashboard";

const actor: ActorContext = { profileId: "admin", companyId: "company-a", role: "administration" };

function snapshot(companyId = "company-a"): DashboardSnapshot {
  return {
    companyId,
    vehicles: [
      {
        vehicleId: "b",
        plate: "VDR-768",
        status: "AVAILABLE",
        tripId: null,
        driverName: null,
        location: "Cusco",
        nextAction: "Asignar viaje",
      },
      {
        vehicleId: "a",
        plate: "X2Y756",
        status: "ON_TRIP",
        tripId: "trip",
        driverName: "Juan",
        location: "Lima",
        nextAction: "Descargar",
      },
    ],
    activeTripCount: 1,
    pendingSettlementCount: 0,
    overdueInvoiceCount: 0,
    criticalAlertCount: 0,
    generatedAt: "2026-08-13T00:00:00.000Z",
  };
}

describe("dashboard read model", () => {
  it("keeps company scope and returns stable vehicle ordering", async () => {
    const gateway: DashboardReadGateway = { loadDashboard: () => Promise.resolve(snapshot()) };
    const result = await loadDashboard(gateway, actor);
    expect(result.vehicles.map((vehicle) => vehicle.plate)).toEqual(["VDR-768", "X2Y756"]);
  });

  it("rejects a projection from another company", async () => {
    const gateway: DashboardReadGateway = {
      loadDashboard: () => Promise.resolve(snapshot("company-b")),
    };
    await expect(loadDashboard(gateway, actor)).rejects.toThrow("otra empresa");
  });
});
