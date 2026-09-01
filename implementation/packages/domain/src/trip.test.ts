import { describe, expect, it } from "vitest";
import {
  calculateTravelledDistance,
  canCloseTripOperationally,
  canTransitionTrip,
  canTransitionTripAdministration,
  canTransitionTripFinance,
  evaluateOperationalCompletion,
  evaluateOperationalCycle,
  validateOdometerProgression,
  validateTripTransition,
  type CycleTripLeg,
} from "./trip";

describe("trip lifecycle", () => {
  it("models one commercial leg without return states", () => {
    expect(canTransitionTrip("SCHEDULED", "LOADING")).toBe(true);
    expect(canTransitionTrip("UNLOADING", "COMPLETED")).toBe(true);
    expect(canTransitionTrip("SCHEDULED", "COMPLETED")).toBe(false);
    expect(canTransitionTrip("COMPLETED", "IN_TRANSIT")).toBe(false);
    expect(() => validateTripTransition("COMPLETED", "IN_TRANSIT")).toThrow(
      "Transición operativa de viaje no permitida",
    );
  });

  it("keeps administrative and financial lifecycles independent", () => {
    expect(canTransitionTripAdministration("SETTLEMENT_REVIEW", "SETTLEMENT_CLOSED")).toBe(true);
    expect(canTransitionTripAdministration("SETTLEMENT_PENDING", "SETTLEMENT_CLOSED")).toBe(false);
    expect(canTransitionTripFinance("BILLED", "PARTIALLY_PAID")).toBe(true);
    expect(canTransitionTripFinance("PAID", "FINANCIALLY_CLOSED")).toBe(true);
    expect(canTransitionTripFinance("UNBILLED", "PAID")).toBe(false);
  });

  it("completes transport without depending on settlement", () => {
    expect(
      canCloseTripOperationally({
        initialMileage: 124_000,
        finalMileage: 125_000,
        cargoDelivered: true,
        requiredDocumentsSatisfied: true,
        settlementClosed: false,
      }),
    ).toBe(true);
  });

  it("reports every failed operational completion invariant", () => {
    expect(
      evaluateOperationalCompletion({
        initialMileage: 125_000,
        finalMileage: 124_000,
        cargoDelivered: false,
        requiredDocumentsSatisfied: false,
      }),
    ).toEqual({
      allowed: false,
      reasons: [
        "El kilometraje final no puede ser menor que el inicial.",
        "La entrega de la carga debe estar confirmada.",
        "Faltan documentos operativos obligatorios o su justificación.",
      ],
    });

    expect(
      canCloseTripOperationally({
        finalMileage: Number.NaN,
        requiredDocumentsSatisfied: true,
      }),
    ).toBe(false);
    expect(
      evaluateOperationalCompletion({
        initialMileage: -1,
        finalMileage: 10,
        requiredDocumentsSatisfied: true,
      }).reasons,
    ).toContain("El kilometraje inicial debe ser válido.");
  });
});

describe("odometer invariants", () => {
  it("calculates travelled distance for monotonic odometer readings", () => {
    expect(calculateTravelledDistance(100_000.5, 101_250.75)).toBe(1_250.25);
  });

  it("requires explicit authorization and reason for a correction", () => {
    expect(() => validateOdometerProgression({ previousMileage: 100, currentMileage: 99 })).toThrow(
      "corrección autorizada",
    );
    expect(() =>
      validateOdometerProgression({
        previousMileage: 100,
        currentMileage: 99,
        correctionAuthorized: true,
        correctionReason: "   ",
      }),
    ).toThrow("incluir un motivo");
    expect(() =>
      validateOdometerProgression({
        previousMileage: 100,
        currentMileage: 99,
        correctionAuthorized: true,
        correctionReason: "Lectura anterior digitada incorrectamente",
      }),
    ).not.toThrow();
  });

  it("rejects invalid odometer values", () => {
    expect(() => calculateTravelledDistance(-1, 10)).toThrow("finito no negativo");
    expect(() => calculateTravelledDistance(1, Number.POSITIVE_INFINITY)).toThrow(
      "finito no negativo",
    );
  });
});

describe("operational cycles", () => {
  const firstLeg: CycleTripLeg = {
    id: "trip-outbound",
    companyId: "company-a",
    vehicleId: "vehicle-a",
    origin: "Cusco",
    destination: "Lima",
    startedAt: new Date("2026-08-01T08:00:00.000Z"),
    completedAt: new Date("2026-08-02T12:00:00.000Z"),
  };

  it("groups chronological commercial legs for the same company and vehicle", () => {
    expect(
      evaluateOperationalCycle({
        companyId: "company-a",
        vehicleId: "vehicle-a",
        legs: [
          firstLeg,
          {
            ...firstLeg,
            id: "trip-return",
            origin: "Lima",
            destination: "Cusco",
            startedAt: new Date("2026-08-04T08:00:00.000Z"),
            completedAt: new Date("2026-08-05T12:00:00.000Z"),
          },
        ],
      }),
    ).toEqual({ allowed: true, reasons: [] });
  });

  it("rejects cross-company, cross-vehicle, duplicate and overlapping legs", () => {
    const result = evaluateOperationalCycle({
      companyId: "company-a",
      vehicleId: "vehicle-a",
      legs: [
        firstLeg,
        {
          ...firstLeg,
          companyId: "company-b",
          vehicleId: "vehicle-b",
          startedAt: new Date("2026-08-02T10:00:00.000Z"),
        },
      ],
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "El viaje trip-outbound está duplicado dentro del ciclo.",
        "El viaje trip-outbound pertenece a otra empresa.",
        "El viaje trip-outbound pertenece a otra unidad.",
        "El viaje trip-outbound se superpone con el viaje anterior del ciclo.",
      ]),
    );
  });

  it("requires at least one leg", () => {
    expect(
      evaluateOperationalCycle({ companyId: "company-a", vehicleId: "vehicle-a", legs: [] }),
    ).toEqual({
      allowed: false,
      reasons: ["El ciclo operativo debe contener al menos un viaje."],
    });
  });

  it("does not allow another leg after an open leg", () => {
    const result = evaluateOperationalCycle({
      companyId: "company-a",
      vehicleId: "vehicle-a",
      legs: [
        { ...firstLeg, completedAt: null },
        {
          ...firstLeg,
          id: "trip-return",
          origin: "Lima",
          destination: "Cusco",
          startedAt: new Date("2026-08-04T08:00:00.000Z"),
        },
      ],
    });

    expect(result.reasons).toContain(
      "El viaje trip-return no puede seguir a un viaje todavía abierto.",
    );
  });
});
