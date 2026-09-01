import { describe, expect, it } from "vitest";
import type { AdminDashboardSnapshot, AdminListRow, AdminTripRow } from "./admin-data";
import { summarizeAdminDashboard } from "./admin-dashboard-model";

function row(overrides: Partial<AdminListRow> = {}): AdminListRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? "Registro",
    description: overrides.description ?? "Detalle",
    status: overrides.status ?? "Activo",
    amount: overrides.amount ?? null,
    date: overrides.date ?? null,
  };
}

function trip(status: string): AdminTripRow {
  return {
    ...row({ id: `trip-${status}`, title: `V-${status}`, status }),
    version: 1,
    code: `RT-${status}`,
    clientId: "client-a",
    vehicleId: "vehicle-a",
    driverId: "driver-a",
    clientName: "Cliente A",
    vehiclePlate: "ABC-123",
    driverName: "Conductor A",
    origin: "Cusco",
    destination: "Arequipa",
    operationalStatus: status,
    captureMode: "driver_app",
    captureModeChangedAt: null,
    driverHasAppAccess: true,
    freightAmount: 0,
    freightPricingMode: "total",
    freightRatePerTon: null,
  };
}

function snapshot(): AdminDashboardSnapshot {
  return {
    source: "remote",
    unavailableMetrics: [],
    vehicles: [
      row({ status: "Available" }),
      row({ status: "In trip" }),
      row({ status: "Preventive maintenance" }),
    ],
    trips: [trip("draft"), trip("scheduled"), trip("in_transit"), trip("completed")],
    settlements: [row({ status: "Open" }), row({ status: "Closed" })],
    invoices: [row({ status: "Issued", amount: 480 }), row({ status: "Paid", amount: 200 })],
    alerts: [row({ status: "Critical · New" }), row({ status: "Low · Resolved" })],
  };
}

describe("admin dashboard summary", () => {
  it("separates fleet availability and keeps only operationally active trips", () => {
    const summary = summarizeAdminDashboard(snapshot());

    expect(summary.availableVehicles).toBe(1);
    expect(summary.operatingVehicles).toBe(1);
    expect(summary.attentionVehicles).toBe(1);
    expect(summary.activeTrips.map((item) => item.operationalStatus)).toEqual([
      "scheduled",
      "in_transit",
    ]);
  });

  it("counts only unresolved work and derives explicit next actions", () => {
    const summary = summarizeAdminDashboard(snapshot());

    expect(summary.activeAlerts).toHaveLength(1);
    expect(summary.pendingSettlements).toHaveLength(1);
    expect(summary.pendingInvoices).toHaveLength(1);
    expect(summary.pendingInvoiceAmount).toBe(480);
    expect(summary.attentionCount).toBe(3);
    expect(summary.nextSteps.map((item) => item.action)).toEqual([
      "Revisar y aprobar el servicio",
      "Confirmar preparación para salida",
      "Monitorear el recorrido",
    ]);
  });

  it("does not present unavailable remote metrics as pending work", () => {
    const local = { ...snapshot(), source: "local" as const, invoices: [], alerts: [] };
    const summary = summarizeAdminDashboard(local);

    expect(summary.activeAlerts).toEqual([]);
    expect(summary.pendingInvoiceAmount).toBe(0);
    expect(summary.attentionCount).toBe(1);
  });
});
