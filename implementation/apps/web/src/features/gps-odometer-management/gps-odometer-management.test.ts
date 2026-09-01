import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorityStatusLabel,
  bootstrapActionLabel,
  canManageGpsOdometer,
  canOfferTestPlaceholderCorrection,
  createGpsOdometerIdempotencyKey,
  getGpsOdometerManagementScreenState,
  shouldLoadGpsOdometerManagement,
  validateGpsOdometerPositiveDecimal,
  validateGpsOdometerReason,
  type GpsOdometerCandidate,
} from "./gps-odometer-management";

function candidate(overrides: Partial<GpsOdometerCandidate> = {}): GpsOdometerCandidate {
  return {
    positionId: "position-a",
    providerLinkId: "link-a",
    vehicleId: "vehicle-a",
    vehicleLabel: "VDR-768",
    recordedAt: "2026-08-22T09:40:23.000Z",
    receivedAt: "2026-08-22T09:41:00.000Z",
    odometerKm: 12_874,
    currentOdometerKm: 141_601,
    authorityStatus: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GPS odometer management access and screen state", () => {
  it("reserves authoritative odometer management for Gerencia", () => {
    expect(canManageGpsOdometer("management")).toBe(true);
    expect(canManageGpsOdometer("administration")).toBe(false);
    expect(canManageGpsOdometer("accounting")).toBe(false);
    expect(canManageGpsOdometer("driver")).toBe(false);

    expect(shouldLoadGpsOdometerManagement("management", true, true)).toBe(true);
    expect(shouldLoadGpsOdometerManagement("management", false, true)).toBe(false);
    expect(shouldLoadGpsOdometerManagement("management", true, false)).toBe(false);
    expect(shouldLoadGpsOdometerManagement("administration", true, true)).toBe(false);
    expect(shouldLoadGpsOdometerManagement(null, true, true)).toBe(false);
  });

  it("uses a truthful state precedence before any online configuration query", () => {
    expect(
      getGpsOdometerManagementScreenState({
        identityReady: false,
        role: "management",
        online: true,
        serverConfigured: true,
      }),
    ).toBe("PREPARING");
    expect(
      getGpsOdometerManagementScreenState({
        identityReady: true,
        role: "administration",
        online: true,
        serverConfigured: true,
      }),
    ).toBe("FORBIDDEN");
    expect(
      getGpsOdometerManagementScreenState({
        identityReady: true,
        role: "management",
        online: false,
        serverConfigured: true,
      }),
    ).toBe("OFFLINE");
    expect(
      getGpsOdometerManagementScreenState({
        identityReady: true,
        role: "management",
        online: true,
        serverConfigured: false,
      }),
    ).toBe("UNAVAILABLE");
    expect(
      getGpsOdometerManagementScreenState({
        identityReady: true,
        role: "management",
        online: true,
        serverConfigured: true,
      }),
    ).toBe("READY");
  });
});

describe("GPS odometer management safeguards", () => {
  it("offers the one-time test-placeholder correction only for its narrow visual case", () => {
    expect(canOfferTestPlaceholderCorrection(candidate())).toBe(true);
    expect(canOfferTestPlaceholderCorrection(candidate({ vehicleLabel: "X3N-719" }))).toBe(false);
    expect(canOfferTestPlaceholderCorrection(candidate({ currentOdometerKm: 141_600 }))).toBe(
      false,
    );
    expect(canOfferTestPlaceholderCorrection(candidate({ odometerKm: 141_601 }))).toBe(false);
    expect(canOfferTestPlaceholderCorrection(candidate({ authorityStatus: "active" }))).toBe(false);
  });

  it("normalizes a reason and rejects blank or oversized justifications", () => {
    expect(validateGpsOdometerReason("  Validación del odómetro visible.  ")).toBe(
      "Validación del odómetro visible.",
    );
    expect(() => validateGpsOdometerReason("   ")).toThrow("entre 1 y 500 caracteres");
    expect(() => validateGpsOdometerReason("x".repeat(501))).toThrow("entre 1 y 500 caracteres");
  });

  it("accepts only positive decimal thresholds with up to two decimals", () => {
    expect(validateGpsOdometerPositiveDecimal("150", "El avance máximo")).toBe(150);
    expect(validateGpsOdometerPositiveDecimal("95.25", "La velocidad máxima")).toBe(95.25);
    expect(() => validateGpsOdometerPositiveDecimal("0", "El avance máximo")).toThrow(
      "número positivo",
    );
    expect(() => validateGpsOdometerPositiveDecimal("1.234", "El avance máximo")).toThrow(
      "hasta dos decimales",
    );
    expect(() => validateGpsOdometerPositiveDecimal("infinito", "El avance máximo")).toThrow(
      "número positivo",
    );
  });

  it("uses browser-generated idempotency keys and fails safely when unavailable", () => {
    const randomUUID = vi.fn(() => "00000000-0000-4000-8000-000000000001");
    vi.stubGlobal("crypto", { randomUUID });

    expect(createGpsOdometerIdempotencyKey()).toBe("00000000-0000-4000-8000-000000000001");
    expect(randomUUID).toHaveBeenCalledOnce();

    vi.stubGlobal("crypto", {});
    expect(() => createGpsOdometerIdempotencyKey()).toThrow("clave segura");
  });

  it("keeps authority and bootstrap labels explicit", () => {
    expect(authorityStatusLabel("active")).toBe("Fuente oficial activa");
    expect(authorityStatusLabel("suspended")).toBe("Fuente oficial suspendida");
    expect(authorityStatusLabel(null)).toBe("Sin fuente oficial");
    expect(bootstrapActionLabel(candidate())).toBe("Usar como fuente oficial");
    expect(bootstrapActionLabel(candidate({ authorityStatus: "suspended" }))).toBe(
      "Volver a activar como fuente oficial",
    );
  });
});
