import { describe, expect, it } from "vitest";
import { derivePowerSyncDisplayStatus } from "./sync-state";

const base = {
  configured: true,
  authenticated: true,
  connecting: false,
  connected: false,
  online: true,
  error: null,
};

describe("PowerSync status", () => {
  it("prioritizes configuration and session requirements", () => {
    expect(derivePowerSyncDisplayStatus({ ...base, configured: false })).toMatchObject({
      state: "NOT_CONFIGURED",
      tone: "attention",
      label: "La sincronización no está configurada",
    });
    expect(derivePowerSyncDisplayStatus({ ...base, authenticated: false })).toMatchObject({
      state: "SESSION_REQUIRED",
      tone: "pending",
      label: "Inicia sesión para sincronizar",
    });
  });

  it("explains each state without calling an active connection synchronized", () => {
    expect(derivePowerSyncDisplayStatus({ ...base, connected: true })).toMatchObject({
      state: "CONNECTED",
      tone: "ready",
      label: "La conexión de sincronización está activa",
      description: expect.stringContaining("cambios pendientes"),
    });
    expect(derivePowerSyncDisplayStatus({ ...base, online: false })).toMatchObject({
      state: "OFFLINE",
      tone: "offline",
      label: "Sin conexión a internet",
    });
    expect(derivePowerSyncDisplayStatus({ ...base, error: new Error("failed") })).toMatchObject({
      state: "ERROR",
      tone: "attention",
      label: "La sincronización requiere atención",
    });
  });

  it("makes an online but inactive connection understandable", () => {
    expect(derivePowerSyncDisplayStatus(base)).toMatchObject({
      state: "CONNECTING",
      tone: "pending",
      label: "Esperando conexión con el servidor",
    });
  });
});
