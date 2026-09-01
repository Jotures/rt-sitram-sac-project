export type PowerSyncDisplayStatusTone = "ready" | "pending" | "offline" | "attention";

export interface PowerSyncDisplayStatus {
  readonly state:
    | "NOT_CONFIGURED"
    | "SESSION_REQUIRED"
    | "CONNECTING"
    | "CONNECTED"
    | "OFFLINE"
    | "ERROR";
  readonly tone: PowerSyncDisplayStatusTone;
  readonly label: string;
  readonly description: string;
}

export interface PowerSyncStatusInput {
  readonly configured: boolean;
  readonly authenticated: boolean;
  readonly connecting: boolean;
  readonly connected: boolean;
  readonly online: boolean;
  readonly error: Error | null;
}

export function derivePowerSyncDisplayStatus(input: PowerSyncStatusInput): PowerSyncDisplayStatus {
  if (!input.configured) {
    return {
      state: "NOT_CONFIGURED",
      tone: "attention",
      label: "La sincronización no está configurada",
      description:
        "Este dispositivo no puede enviar cambios al servidor hasta que se complete la configuración.",
    };
  }

  if (!input.authenticated) {
    return {
      state: "SESSION_REQUIRED",
      tone: "pending",
      label: "Inicia sesión para sincronizar",
      description: "Este dispositivo necesita una sesión iniciada antes de conectarse al servidor.",
    };
  }

  if (input.error !== null) {
    return {
      state: "ERROR",
      tone: "attention",
      label: "La sincronización requiere atención",
      description:
        "No se pudo completar una comunicación con el servidor. Revisa el aviso antes de continuar.",
    };
  }

  if (input.connected) {
    return {
      state: "CONNECTED",
      tone: "ready",
      label: "La conexión de sincronización está activa",
      description:
        "Revisa los cambios pendientes de envío antes de considerar que el trabajo quedó confirmado en el servidor.",
    };
  }

  if (input.connecting) {
    return {
      state: "CONNECTING",
      tone: "pending",
      label: "Conectando con el servidor",
      description:
        "Puedes seguir trabajando en este dispositivo mientras se establece la conexión.",
    };
  }

  if (input.online) {
    return {
      state: "CONNECTING",
      tone: "pending",
      label: "Esperando conexión con el servidor",
      description:
        "El dispositivo detecta internet, pero todavía no hay una conexión activa para sincronizar.",
    };
  }

  return {
    state: "OFFLINE",
    tone: "offline",
    label: "Sin conexión a internet",
    description:
      "Los cambios que se guarden localmente esperarán una conexión antes de poder enviarse al servidor.",
  };
}
