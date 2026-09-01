import { describe, expect, it } from "vitest";
import {
  createGpsContextPresentation,
  shouldRenderGpsContext,
  type GpsContextSource,
  type GpsFreshnessPolicy,
  type GpsSignalEvidence,
} from "./gps-context";

const now = "2026-08-22T10:00:00.000Z";
const freshnessPolicy: GpsFreshnessPolicy = {
  staleAfterMs: 15 * 60 * 1000,
  futureToleranceMs: 60 * 1000,
};

function signal(overrides: Partial<GpsSignalEvidence> = {}): GpsSignalEvidence {
  return {
    recordedAt: "2026-08-22T09:55:00.000Z",
    speedKmh: 21,
    ignition: true,
    odometerKm: 12_874,
    ...overrides,
  };
}

function present(source: GpsContextSource) {
  return createGpsContextPresentation(source, now, freshnessPolicy);
}

describe("GPS contextual presentation", () => {
  it("presents a recent signal without exposing coordinates", () => {
    const result = present({ kind: "SIGNAL", signal: signal() });

    expect(result).toMatchObject({
      status: "FRESH",
      label: "Señal reciente",
      recordedAt: "2026-08-22T09:55:00.000Z",
      speedKmh: 21,
      ignition: true,
      odometerKm: 12_874,
      movement: { state: "MOVING", label: "En movimiento" },
    });
    expect(result.copy).toContain("No sustituye el estado operativo");
    expect(result).not.toHaveProperty("latitude");
    expect(result).not.toHaveProperty("longitude");
    expect(result).not.toHaveProperty("coordinates");
  });

  it("distinguishes a fresh observed zero speed from a confirmed stopped unit", () => {
    const result = present({ kind: "SIGNAL", signal: signal({ speedKmh: 0 }) });

    expect(result.movement).toEqual({ state: "ZERO_SPEED", label: "Velocidad 0 km/h" });
  });

  it("does not derive movement from a stale signal even when it has speed", () => {
    const result = present({
      kind: "SIGNAL",
      signal: signal({ recordedAt: "2026-08-22T09:00:00.000Z" }),
    });

    expect(result.status).toBe("STALE");
    expect(result.label).toBe("Señal atrasada");
    expect(result.copy).toContain("no confirma la ubicación ni el estado actual");
    expect(result.movement).toEqual({ state: "UNKNOWN", label: "Movimiento no disponible" });
  });

  it("makes a provider clock anomaly visible and leaves movement unknown", () => {
    const result = present({
      kind: "SIGNAL",
      signal: signal({ recordedAt: "2026-08-22T10:02:00.000Z" }),
    });

    expect(result.status).toBe("CLOCK_SKEW");
    expect(result.label).toBe("Hora GPS anómala");
    expect(result.copy).toContain("parece anómala");
    expect(result.movement.state).toBe("UNKNOWN");
  });

  it("does not infer movement from ignition when a recent speed is absent", () => {
    const result = present({ kind: "SIGNAL", signal: signal({ speedKmh: null, ignition: true }) });

    expect(result.status).toBe("FRESH");
    expect(result.ignition).toBe(true);
    expect(result.movement).toEqual({ state: "UNKNOWN", label: "Movimiento no disponible" });
  });

  it.each([
    ["UNAVAILABLE", "GPS no disponible", "No se puede confirmar una señal actual."],
    ["NO_LINK", "Sin vínculo GPS", "no tiene un vínculo GPS aprobado."],
    ["NO_SIGNAL", "Sin señal GPS", "no hay una señal disponible."],
  ] as const)("presents %s with clear degraded copy", (kind, label, copyFragment) => {
    const source: GpsContextSource = kind === "UNAVAILABLE" ? { kind, reason: "REMOTE" } : { kind };
    const result = present(source);

    expect(result).toMatchObject({
      status: kind,
      label,
      recordedAt: null,
      speedKmh: null,
      ignition: null,
      odometerKm: null,
      movement: { state: "UNKNOWN", label: "Movimiento no disponible" },
    });
    expect(result.copy).toContain(copyFragment);
  });

  it("rejects invalid optional evidence instead of inventing a value", () => {
    expect(() =>
      present({ kind: "SIGNAL", signal: signal({ speedKmh: -1, odometerKm: Number.NaN }) }),
    ).toThrow("La velocidad GPS debe ser un número finito no negativo");
  });

  it("shows the exact signal without inventing a freshness category when no policy is approved", () => {
    const result = createGpsContextPresentation({ kind: "SIGNAL", signal: signal() }, now, null);

    expect(result).toMatchObject({
      status: "FRESHNESS_UNCONFIGURED",
      label: "Última señal GPS",
      movement: { state: "UNKNOWN", label: "Movimiento no disponible" },
    });
    expect(result.copy).toContain("sin clasificar");
  });

  it("explains that GPS is online-only when the browser is offline", () => {
    const result = present({ kind: "UNAVAILABLE", reason: "OFFLINE" });

    expect(result).toMatchObject({ status: "UNAVAILABLE", label: "GPS requiere conexión" });
    expect(result.copy).toContain("no forma parte de la copia local");
  });

  it("hides the operational card when the unit has no active GPS source", () => {
    expect(shouldRenderGpsContext({ kind: "NO_LINK" })).toBe(false);
    expect(shouldRenderGpsContext({ kind: "NO_SIGNAL" })).toBe(true);
    expect(shouldRenderGpsContext({ kind: "SIGNAL", signal: signal() })).toBe(true);
  });
});
