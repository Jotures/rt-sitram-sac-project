import { deriveGpsFreshness, type GpsFreshness } from "@rt-sitram/domain";

/**
 * The source is already scoped and authorized by a server-side read gateway.
 * It intentionally has no provider identifiers, addresses, latitude, or
 * longitude: a contextual surface does not need to receive coordinates.
 */
export type GpsContextSource =
  | { readonly kind: "UNAVAILABLE"; readonly reason: "OFFLINE" | "REMOTE" }
  | { readonly kind: "NO_LINK" }
  | { readonly kind: "NO_SIGNAL" }
  | { readonly kind: "SIGNAL"; readonly signal: GpsSignalEvidence };

/**
 * Normalized evidence that is useful in a unit or trip detail. This contextual
 * value cannot command the vehicle master: only a separately validated Goldcar
 * detail source and an explicit Gerencia action may do so.
 */
export interface GpsSignalEvidence {
  readonly recordedAt: string;
  readonly speedKmh: number | null;
  readonly ignition: boolean | null;
  readonly odometerKm: number | null;
}

export interface GpsFreshnessPolicy {
  /** Maximum age for a GPS observation to be called recent. */
  readonly staleAfterMs: number;
  /** Accepted provider clock drift before marking its timestamp anomalous. */
  readonly futureToleranceMs: number;
}

export type GpsContextStatus =
  | GpsFreshness
  | "FRESHNESS_UNCONFIGURED"
  | "NO_SIGNAL"
  | "NO_LINK"
  | "UNAVAILABLE";

/**
 * ZERO_SPEED communicates an observed zero speed, not a confirmed stopped
 * vehicle. It is only derived for a fresh observation with a known speed.
 */
export type GpsMovementState = "MOVING" | "ZERO_SPEED" | "UNKNOWN";

export interface GpsMovementPresentation {
  readonly state: GpsMovementState;
  readonly label: string;
}

/**
 * Safe view model for GPS context. Coordinates are purposefully absent from
 * both the input signal and the returned presentation.
 */
export interface GpsContextPresentation {
  readonly status: GpsContextStatus;
  readonly label: string;
  readonly copy: string;
  readonly recordedAt: string | null;
  readonly speedKmh: number | null;
  readonly ignition: boolean | null;
  readonly odometerKm: number | null;
  readonly movement: GpsMovementPresentation;
}

/**
 * A missing context row means that no GPS source is active for this unit.
 * Keep the card out of the operational surface instead of rendering archived
 * evidence as if the unit still had live telemetry.
 */
export function shouldRenderGpsContext(source: GpsContextSource): boolean {
  return source.kind !== "NO_LINK";
}

/**
 * Converts authorized GPS evidence into clear, non-authoritative Spanish UI
 * text. It does not query data, cache it, or alter vehicle/trip state.
 */
export function createGpsContextPresentation(
  source: GpsContextSource,
  now: string,
  freshnessPolicy: GpsFreshnessPolicy | null,
): GpsContextPresentation {
  switch (source.kind) {
    case "UNAVAILABLE":
      return withoutSignal(
        "UNAVAILABLE",
        source.reason === "OFFLINE" ? "GPS requiere conexión" : "GPS no disponible",
        source.reason === "OFFLINE"
          ? "La telemetría se consulta solo con conexión y no forma parte de la copia local."
          : "El servicio GPS no está disponible ahora. No se puede confirmar una señal actual.",
      );
    case "NO_LINK":
      return withoutSignal(
        "NO_LINK",
        "Sin vínculo GPS",
        "La unidad no tiene un vínculo GPS aprobado.",
      );
    case "NO_SIGNAL":
      return withoutSignal(
        "NO_SIGNAL",
        "Sin señal GPS",
        "La unidad tiene un vínculo GPS aprobado, pero no hay una señal disponible.",
      );
    case "SIGNAL":
      return withSignal(source.signal, now, freshnessPolicy);
  }
}

function withSignal(
  signal: GpsSignalEvidence,
  now: string,
  freshnessPolicy: GpsFreshnessPolicy | null,
): GpsContextPresentation {
  const status =
    freshnessPolicy === null
      ? "FRESHNESS_UNCONFIGURED"
      : deriveGpsFreshness({
          recordedAt: signal.recordedAt,
          now,
          staleAfterMs: freshnessPolicy.staleAfterMs,
          futureToleranceMs: freshnessPolicy.futureToleranceMs,
        });
  const speedKmh = normalizeOptionalNonNegative(signal.speedKmh, "La velocidad GPS");
  const odometerKm = normalizeOptionalNonNegative(signal.odometerKm, "El odómetro GPS");
  const ignition = normalizeOptionalBoolean(signal.ignition, "La ignición GPS");
  const content = statusContent(status);

  return {
    status,
    ...content,
    recordedAt: signal.recordedAt,
    speedKmh,
    ignition,
    odometerKm,
    movement: deriveMovement(status, speedKmh),
  };
}

function withoutSignal(
  status: Exclude<GpsContextStatus, GpsFreshness | "FRESHNESS_UNCONFIGURED">,
  label: string,
  copy: string,
): GpsContextPresentation {
  return {
    status,
    label,
    copy,
    recordedAt: null,
    speedKmh: null,
    ignition: null,
    odometerKm: null,
    movement: unknownMovement(),
  };
}

function statusContent(
  status: GpsFreshness | "FRESHNESS_UNCONFIGURED",
): Pick<GpsContextPresentation, "label" | "copy"> {
  switch (status) {
    case "FRESHNESS_UNCONFIGURED":
      return {
        label: "Última señal GPS",
        copy: "La antigüedad se muestra sin clasificar hasta definir el umbral de frescura.",
      };
    case "FRESH":
      return {
        label: "Señal reciente",
        copy: "La señal GPS es reciente. No sustituye el estado operativo de la unidad.",
      };
    case "STALE":
      return {
        label: "Señal atrasada",
        copy: "La última señal es antigua; no confirma la ubicación ni el estado actual de la unidad.",
      };
    case "CLOCK_SKEW":
      return {
        label: "Hora GPS anómala",
        copy: "La hora enviada por el GPS parece anómala. Revisa el proveedor antes de usar esta señal.",
      };
  }
}

function deriveMovement(
  status: GpsFreshness | "FRESHNESS_UNCONFIGURED",
  speedKmh: number | null,
): GpsMovementPresentation {
  if (status !== "FRESH" || speedKmh === null) return unknownMovement();
  if (speedKmh === 0) return { state: "ZERO_SPEED", label: "Velocidad 0 km/h" };
  return { state: "MOVING", label: "En movimiento" };
}

function unknownMovement(): GpsMovementPresentation {
  return { state: "UNKNOWN", label: "Movimiento no disponible" };
}

function normalizeOptionalNonNegative(value: number | null, label: string): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} debe ser un número finito no negativo cuando se indique.`);
  }
  return value;
}

function normalizeOptionalBoolean(value: boolean | null, label: string): boolean | null {
  if (value === null) return null;
  if (typeof value !== "boolean") {
    throw new Error(`${label} debe ser booleana cuando se indique.`);
  }
  return value;
}
