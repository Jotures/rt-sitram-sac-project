import { describe, expect, it } from "vitest";
import { getOfflineBannerPresentation, getShellSyncPresentation } from "./ProductShell";

const connected = {
  networkStatus: "ONLINE",
  configured: true,
  sqliteReady: true,
  connecting: false,
  connected: true,
  pending: 0,
  error: null,
} as const;

describe("product shell synchronization status", () => {
  it("reports connectivity without claiming that every local queue is synchronized", () => {
    expect(getShellSyncPresentation(connected)).toMatchObject({
      tone: "ready",
      label: "Conectado",
      detail: "Sin registros pendientes de envío",
    });

    expect(
      getShellSyncPresentation({ ...connected, connected: false, connecting: true }),
    ).toMatchObject({
      tone: "pending",
      label: "Conectando",
      detail: "Puedes seguir trabajando en este dispositivo",
    });
  });

  it("reports queued records instead of treating internet access as synchronization", () => {
    expect(getShellSyncPresentation({ ...connected, connected: false, pending: 3 })).toMatchObject({
      tone: "pending",
      label: "3 pendientes",
      detail: "Esperando conexión con el servidor",
    });

    expect(getShellSyncPresentation({ ...connected, pending: 2 })).toMatchObject({
      tone: "updating",
      label: "2 pendientes",
      detail: "El envío se está procesando",
    });
  });

  it("keeps offline work and synchronization errors explicit", () => {
    expect(
      getShellSyncPresentation({ ...connected, networkStatus: "OFFLINE", pending: 1 }),
    ).toMatchObject({
      tone: "offline",
      label: "1 pendiente",
      detail: "Guardado en este dispositivo",
    });

    expect(
      getShellSyncPresentation({ ...connected, error: new Error("upload rejected") }),
    ).toMatchObject({ tone: "error", label: "Revisar envío" });

    expect(
      getShellSyncPresentation({ ...connected, networkStatus: "OFFLINE", sqliteReady: false }),
    ).toMatchObject({
      tone: "offline",
      label: "Sin conexión",
      detail: "La base local se está preparando",
    });
  });

  it("explains what happens to records while the device is offline", () => {
    expect(getOfflineBannerPresentation({ pending: 1, sqliteReady: true }).detail).toBe(
      "1 registro quedó guardado en este dispositivo y se enviará al reconectar.",
    );

    expect(getOfflineBannerPresentation({ pending: 2, sqliteReady: true }).detail).toBe(
      "2 registros quedaron guardados en este dispositivo y se enviarán al reconectar.",
    );

    expect(getOfflineBannerPresentation({ pending: 0, sqliteReady: false }).detail).toBe(
      "La base local todavía se está preparando; algunos datos aún no están disponibles.",
    );
  });
});
