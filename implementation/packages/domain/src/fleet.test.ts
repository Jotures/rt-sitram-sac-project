import { describe, expect, it } from "vitest";
import {
  canScheduleVehicle,
  deriveMaintenanceDueStatus,
  evaluateTripScheduling,
  isVehicleSchedulableStatus,
} from "./fleet";

describe("trip scheduling", () => {
  it("allows an approved trip with available compatible resources", () => {
    expect(
      evaluateTripScheduling({
        trip: { companyId: "company-a", operationalStatus: "APPROVED" },
        vehicle: {
          companyId: "company-a",
          status: "AVAILABLE",
          hasActiveTrip: false,
          hasCriticalMaintenanceBlock: false,
          criticalDocumentsValid: true,
        },
        driver: {
          companyId: "company-a",
          status: "AVAILABLE",
          hasActiveTrip: false,
          criticalDocumentsValid: true,
        },
      }),
    ).toEqual({ allowed: true, reasons: [] });
  });

  it("reports company, vehicle, driver, maintenance and document violations", () => {
    const decision = evaluateTripScheduling({
      trip: { companyId: "company-a", operationalStatus: "DRAFT" },
      vehicle: {
        companyId: "company-b",
        status: "REPAIR",
        hasActiveTrip: true,
        hasCriticalMaintenanceBlock: true,
        criticalDocumentsValid: false,
      },
      driver: {
        companyId: "company-b",
        status: "ON_TRIP",
        hasActiveTrip: true,
        criticalDocumentsValid: false,
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toHaveLength(9);
    expect(decision.reasons).toContain(
      "El viaje, la unidad y el conductor deben pertenecer a la misma empresa.",
    );
  });

  it("keeps the legacy vehicle check as a conservative wrapper", () => {
    expect(
      canScheduleVehicle({
        status: "AVAILABLE",
        hasActiveTrip: false,
        hasCriticalMaintenanceBlock: false,
        criticalDocumentsValid: false,
        driverAvailable: true,
      }),
    ).toEqual({
      allowed: false,
      reasons: ["La unidad tiene documentación crítica vencida o faltante."],
    });
    expect(isVehicleSchedulableStatus("AVAILABLE")).toBe(true);
    expect(isVehicleSchedulableStatus("WAITING_LOAD")).toBe(false);
  });
});

describe("maintenance rules", () => {
  const today = new Date("2026-08-13T00:00:00.000Z");

  it("derives urgency from either mileage or date", () => {
    expect(
      deriveMaintenanceDueStatus({
        currentMileage: 99_700,
        nextMileage: 100_000,
        today,
        nextDate: null,
      }),
    ).toBe("UPCOMING");
    expect(
      deriveMaintenanceDueStatus({
        currentMileage: 100_000,
        nextMileage: 100_000,
        today,
        nextDate: null,
      }),
    ).toBe("OVERDUE");
    expect(
      deriveMaintenanceDueStatus({
        currentMileage: 10,
        nextMileage: 20_000,
        today,
        nextDate: new Date("2026-08-28T00:00:00.000Z"),
      }),
    ).toBe("UPCOMING");
    expect(
      deriveMaintenanceDueStatus({
        currentMileage: 10,
        nextMileage: null,
        today,
        nextDate: today,
      }),
    ).toBe("OVERDUE");
  });

  it("returns OK without a due rule and rejects invalid inputs", () => {
    expect(
      deriveMaintenanceDueStatus({
        currentMileage: 10,
        nextMileage: null,
        today,
        nextDate: null,
      }),
    ).toBe("OK");
    expect(() =>
      deriveMaintenanceDueStatus({
        currentMileage: -1,
        nextMileage: null,
        today,
        nextDate: null,
      }),
    ).toThrow("finito no negativo");
    expect(() =>
      deriveMaintenanceDueStatus({
        currentMileage: 1,
        nextMileage: null,
        today: new Date("invalid"),
        nextDate: null,
      }),
    ).toThrow("debe ser válida");
  });
});
