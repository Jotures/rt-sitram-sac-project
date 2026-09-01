import { describe, expect, it } from "vitest";
import {
  adminRouteComponents,
  dashboardAttentionDestination,
  detailIdFromPath,
  filterAndSortTrips,
  getTripSetupRequirements,
  labelStatusForUi,
  maintenanceWorkOrderErrorMessage,
  managedTripIdFromSearch,
  operationalCycleErrorMessage,
  staffCaptureErrorMessage,
  tripPrimaryAction,
  tripViewFromSearch,
  vehicleIdFromSearch,
  workOrderPartsTotal,
} from "./AdminRoutePage";
import type { AdminTripRow } from "./admin-data";

function trip(status: string, overrides: Partial<AdminTripRow> = {}): AdminTripRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? "Lima → Arequipa",
    description: overrides.description ?? "Cliente piloto",
    status,
    amount: null,
    date: overrides.date ?? "2026-08-30T10:00:00.000Z",
    version: 1,
    code: "RT-2026-0001",
    clientId: "client-a",
    vehicleId: null,
    driverId: null,
    clientName: "Cliente piloto",
    vehiclePlate: null,
    driverName: null,
    origin: "Lima",
    destination: "Arequipa",
    operationalStatus: status,
    captureMode: "driver_app",
    captureModeChangedAt: null,
    driverHasAppAccess: false,
    freightAmount: 0,
    freightPricingMode: "total",
    freightRatePerTon: null,
  };
}

describe("admin detail route resolver", () => {
  it("extracts a trip id before its detail tab", () => {
    expect(detailIdFromPath("tripMoney", "/viajes/trip-a/dinero")).toBe("trip-a");
    expect(detailIdFromPath("tripSummary", "/viajes/trip-b/resumen")).toBe("trip-b");
  });

  it("extracts a master or financial entity id from the last segment", () => {
    expect(detailIdFromPath("vehicleDetail", "/flota/vehicle-a")).toBe("vehicle-a");
    expect(detailIdFromPath("settlementDetail", "/finanzas/rendiciones/settlement-a")).toBe(
      "settlement-a",
    );
  });
});

describe("trip setup requirements", () => {
  it("makes the client prerequisite explicit instead of exposing an empty required selector", () => {
    const requirements = getTripSetupRequirements({
      clients: [],
      vehicles: [{ id: "vehicle-a", label: "ABC-123", status: "Disponible" }],
      drivers: [{ id: "driver-a", label: "Conductor A", status: "Disponible" }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({ id: "client", ready: false, href: "/clientes" }),
      expect.objectContaining({ id: "vehicle", ready: true, href: "/flota" }),
      expect.objectContaining({ id: "driver", ready: true, href: "/conductores" }),
    ]);
  });

  it("keeps unit and driver visible as prerequisites for programming, not draft creation", () => {
    const requirements = getTripSetupRequirements({
      clients: [{ id: "client-a", label: "Cliente piloto", status: "Activo" }],
      vehicles: [],
      drivers: [],
    });

    expect(requirements[0]).toMatchObject({ id: "client", ready: true });
    expect(requirements[1]).toMatchObject({ id: "vehicle", ready: false });
    expect(requirements[2]).toMatchObject({ id: "driver", ready: false });
  });

  it("keeps an available driver without app access eligible for office operation", () => {
    const requirements = getTripSetupRequirements({
      clients: [{ id: "client-a", label: "Cliente piloto", status: "Activo" }],
      vehicles: [{ id: "vehicle-a", label: "ABC-123", status: "Disponible" }],
      drivers: [
        { id: "driver-a", label: "Conductor sin app", status: "Disponible", hasAppAccess: false },
      ],
      registeredDrivers: 1,
      driversAwaitingAccess: 1,
    });

    expect(requirements[2]).toMatchObject({
      ready: true,
      href: "/conductores",
      action: "Gestionar conductores",
    });
  });
});

describe("managed trip route", () => {
  it("accepts a specific draft to open after creation", () => {
    expect(managedTripIdFromSearch("?gestionar=trip-a")).toBe("trip-a");
  });

  it("does not auto-open when the parameter is absent or blank", () => {
    expect(managedTripIdFromSearch("")).toBeNull();
    expect(managedTripIdFromSearch("?gestionar=%20")).toBeNull();
  });
});

describe("trip list controls", () => {
  it("keeps the URL contract for the views and unit filters", () => {
    expect(tripViewFromSearch("?vista=curso&q=lima")).toBe("curso");
    expect(tripViewFromSearch("?vista=otra")).toBe("todos");
    expect(vehicleIdFromSearch("?unidad=vehicle-a")).toBe("vehicle-a");
  });

  it("prioritizes actionable services before active and closed services", () => {
    const rows = filterAndSortTrips(
      [
        trip("completed", { id: "closed" }),
        trip("in_transit", { id: "active" }),
        trip("approved", { id: "approved" }),
        trip("draft", { id: "draft" }),
      ],
      "todos",
      "",
    );
    expect(rows.map((row) => row.id)).toEqual(["draft", "approved", "active", "closed"]);
    expect(filterAndSortTrips(rows, "curso", "").map((row) => row.id)).toEqual(["active"]);
    expect(filterAndSortTrips(rows, "todos", "arequipa")).toHaveLength(4);
  });

  it("keeps active travel under an explicit manage action", () => {
    expect(tripPrimaryAction(trip("draft"))).toEqual({ label: "Aprobar", kind: "manage" });
    expect(tripPrimaryAction(trip("approved"))).toEqual({ label: "Programar", kind: "manage" });
    expect(tripPrimaryAction(trip("in_transit"))).toEqual({
      label: "Gestionar",
      kind: "manage",
    });
  });
});

describe("dashboard attention navigation", () => {
  it("goes to the exact safe destination for one item and the list for several", () => {
    const row = {
      id: "settlement-a",
      title: "Rendición",
      description: "",
      status: "Abierta",
      amount: null,
      date: null,
    };
    expect(dashboardAttentionDestination({ alerts: [], settlements: [row], invoices: [] })).toEqual(
      { to: "/finanzas/rendiciones/settlement-a", label: "Revisar rendición" },
    );
    expect(
      dashboardAttentionDestination({ alerts: [row], settlements: [row], invoices: [] }),
    ).toEqual({ to: "/inicio?panel=pendientes", label: "Ver pendientes" });
  });
});

describe("administrative status language", () => {
  it("keeps operational status chips in Spanish", () => {
    expect(labelStatusForUi("scheduled")).toBe("Programado");
    expect(labelStatusForUi("in_transit")).toBe("En tránsito");
    expect(labelStatusForUi("available")).toBe("Disponible");
    expect(labelStatusForUi("Critical · New")).toBe("Crítica · Nueva");
  });
});

describe("administrative staff capture", () => {
  it("keeps a dedicated fuel surface in the administrative route package", () => {
    expect(adminRouteComponents.fuelEntries).toBeDefined();
  });

  it("translates a closed-settlement command rejection into the next safe action", () => {
    expect(staffCaptureErrorMessage(new Error("Settlement is closed"))).toBe(
      "La rendición está cerrada. Reábrela con su motivo auditado antes de registrar este movimiento.",
    );
  });
});

describe("operational cycles", () => {
  it("keeps the cycle surface in the administrative route package", () => {
    expect(adminRouteComponents.operationalCycles).toBeDefined();
  });

  it("translates an optimistic-concurrency rejection into the next safe action", () => {
    expect(
      operationalCycleErrorMessage(new Error("Operational cycle changed while updating")),
    ).toBe(
      "El ciclo cambió mientras lo estabas editando. Actualiza el detalle y vuelve a intentarlo.",
    );
  });

  it("translates the authoritative unfinished-trip rejection into the next safe action", () => {
    expect(
      operationalCycleErrorMessage(
        new Error("Every cycle trip must finish before completing the cycle"),
      ),
    ).toBe("Para finalizar el ciclo, todos sus viajes deben estar finalizados o cancelados.");
  });

  it("labels cycle states and sections in Spanish", () => {
    expect(labelStatusForUi("planned")).toBe("Planificado");
    expect(labelStatusForUi("outbound · empty_return")).toBe("Ida · Retorno vacío");
  });
});

describe("maintenance work orders", () => {
  it("keeps the maintenance detail surface in the administrative route package", () => {
    expect(adminRouteComponents.maintenanceDetail).toBeDefined();
  });

  it("uses the sum of rounded line amounts for the expected parts closing total", () => {
    expect(
      workOrderPartsTotal({
        parts: [
          {
            id: "line-a",
            title: "Línea A",
            description: "",
            status: "Registrado",
            amount: 0,
            date: null,
            partId: "part-a",
            supplierId: null,
            quantity: 1,
            unitCost: 1.005,
            installedAt: null,
            installationOdometerKm: null,
            notes: null,
          },
          {
            id: "line-b",
            title: "Línea B",
            description: "",
            status: "Registrado",
            amount: 0,
            date: null,
            partId: "part-b",
            supplierId: null,
            quantity: 1,
            unitCost: 1.005,
            installedAt: null,
            installationOdometerKm: null,
            notes: null,
          },
        ],
      }),
    ).toBe(2.02);
  });

  it("turns a parts-total rejection into the corrective next action", () => {
    expect(
      maintenanceWorkOrderErrorMessage(
        new Error("Work order parts cost must equal the sum of registered part lines"),
      ),
    ).toBe(
      "El total de repuestos debe coincidir exactamente con la suma de las líneas registradas. Actualiza el monto o las líneas antes de cerrar.",
    );
  });
});
