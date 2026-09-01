/**
 * GPS is operational evidence. These types deliberately do not contain a trip
 * state transition, a financial effect, or a provider-specific DTO.
 */
declare const gpsProviderKindBrand: unique symbol;

/**
 * Stable technical identifier assigned only after an adapter is approved.
 * It is intentionally not an enum of presumed Goldcar technologies.
 */
export type GpsProviderKind = string & {
  readonly [gpsProviderKindBrand]: "GpsProviderKind";
};

export type GpsFreshness = "FRESH" | "STALE" | "CLOCK_SKEW";

export interface GpsPositionInput {
  readonly provider: string;
  readonly providerAssetId: string;
  readonly providerEventId?: string | null;
  /** ISO 8601 timestamp emitted by the provider, including a timezone. */
  readonly recordedAt: string;
  /** ISO 8601 timestamp assigned when R&T received the observation. */
  readonly receivedAt: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly speedKmh?: number | null;
  readonly headingDegrees?: number | null;
  readonly altitudeMeters?: number | null;
  readonly ignition?: boolean | null;
  readonly odometerKm?: number | null;
}

export interface GpsPosition {
  readonly provider: GpsProviderKind;
  readonly providerAssetId: string;
  readonly providerEventId: string | null;
  readonly recordedAt: string;
  readonly receivedAt: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly speedKmh: number | null;
  readonly headingDegrees: number | null;
  readonly altitudeMeters: number | null;
  readonly ignition: boolean | null;
  readonly odometerKm: number | null;
}

export interface GpsFreshnessInput {
  readonly recordedAt: string;
  readonly now: string;
  /** Maximum age for a position to be called fresh. */
  readonly staleAfterMs: number;
  /** Accepted clock drift before exposing a provider timestamp as anomalous. */
  readonly futureToleranceMs: number;
}

/**
 * Validates provider-neutral GPS evidence and normalizes timestamps before it
 * reaches persistence or a UI. A caller must map the provider DTO first.
 */
export function normalizeGpsPosition(input: GpsPositionInput): GpsPosition {
  const providerAssetId = normalizeRequiredText(input.providerAssetId, "El identificador externo");
  const providerEventId = normalizeOptionalText(
    input.providerEventId,
    "El identificador del evento",
  );

  return {
    provider: normalizeGpsProviderKind(input.provider),
    providerAssetId,
    providerEventId,
    recordedAt: normalizeTimestamp(input.recordedAt, "La hora de la posición"),
    receivedAt: normalizeTimestamp(input.receivedAt, "La hora de recepción"),
    latitude: assertRange(input.latitude, -90, 90, "La latitud"),
    longitude: assertRange(input.longitude, -180, 180, "La longitud"),
    speedKmh: normalizeOptionalNonNegative(input.speedKmh, "La velocidad"),
    headingDegrees: normalizeOptionalHeading(input.headingDegrees),
    altitudeMeters: normalizeOptionalFinite(input.altitudeMeters, "La altitud"),
    ignition: normalizeOptionalBoolean(input.ignition, "La ignición"),
    odometerKm: normalizeOptionalNonNegative(input.odometerKm, "El odómetro"),
  };
}

/**
 * Accepts an adapter identifier only when it has a stable, configuration-safe
 * form. Registration remains explicit; validation alone never enables a
 * provider or infers its protocol.
 */
export function normalizeGpsProviderKind(value: string): GpsProviderKind {
  const normalized = normalizeRequiredText(value, "El identificador del proveedor GPS");
  if (!/^[A-Z][A-Z0-9_]{1,63}$/u.test(normalized)) {
    throw new Error(
      "El identificador del proveedor GPS debe usar mayúsculas, números o guiones bajos.",
    );
  }
  return normalized as GpsProviderKind;
}

/**
 * Produces a stable deduplication key when a provider does not expose a
 * message identifier. It is evidence bookkeeping, not a business identity.
 */
export function getGpsPositionFingerprint(position: GpsPosition): string {
  const prefix = `${position.provider}:${position.providerAssetId}`;
  if (position.providerEventId !== null) return `${prefix}:event:${position.providerEventId}`;

  return [
    prefix,
    "sample",
    position.recordedAt,
    position.latitude.toFixed(7),
    position.longitude.toFixed(7),
    position.speedKmh?.toFixed(3) ?? "none",
    position.headingDegrees?.toFixed(3) ?? "none",
    position.odometerKm?.toFixed(3) ?? "none",
  ].join(":");
}

/**
 * Determines display freshness without inferring that an old signal means the
 * vehicle stopped. Clock anomalies remain visible instead of being hidden.
 */
export function deriveGpsFreshness(input: GpsFreshnessInput): GpsFreshness {
  const recordedAt = parseTimestamp(input.recordedAt, "La hora de la posición");
  const now = parseTimestamp(input.now, "La hora actual");
  assertFiniteNonNegative(input.staleAfterMs, "El umbral de señal atrasada");
  assertFiniteNonNegative(input.futureToleranceMs, "La tolerancia de reloj");

  if (recordedAt - now > input.futureToleranceMs) return "CLOCK_SKEW";
  if (now - recordedAt > input.staleAfterMs) return "STALE";
  return "FRESH";
}

/**
 * Returns true only when a candidate can safely replace the latest known
 * position for the same provider asset. Equal observations do not churn the
 * latest-position projection.
 */
export function isGpsPositionNewer(candidate: GpsPosition, current: GpsPosition): boolean {
  assertSameProviderAsset(candidate, current);

  const candidateRecordedAt = parseTimestamp(candidate.recordedAt, "La hora de la posición");
  const currentRecordedAt = parseTimestamp(current.recordedAt, "La hora de la posición");
  if (candidateRecordedAt !== currentRecordedAt) return candidateRecordedAt > currentRecordedAt;

  const candidateReceivedAt = parseTimestamp(candidate.receivedAt, "La hora de recepción");
  const currentReceivedAt = parseTimestamp(current.receivedAt, "La hora de recepción");
  return candidateReceivedAt > currentReceivedAt;
}

export function selectLatestGpsPosition(
  current: GpsPosition | null,
  candidate: GpsPosition,
): GpsPosition {
  if (current === null || isGpsPositionNewer(candidate, current)) return candidate;
  return current;
}

function assertSameProviderAsset(left: GpsPosition, right: GpsPosition): void {
  if (left.provider !== right.provider || left.providerAssetId !== right.providerAssetId) {
    throw new Error("Solo pueden compararse posiciones de la misma unidad externa.");
  }
}

function normalizeTimestamp(value: string, label: string): string {
  return new Date(parseTimestamp(value, label)).toISOString();
}

function parseTimestamp(value: string, label: string): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    throw new Error(`${label} debe ser una fecha ISO 8601 con zona horaria.`);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} no es válida.`);
  return timestamp;
}

function normalizeRequiredText(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} es obligatorio.`);
  }
  return value.trim();
}

function normalizeOptionalText(value: string | null | undefined, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${label} debe ser texto cuando se indique.`);
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function assertRange(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} debe estar entre ${minimum} y ${maximum}.`);
  }
  return value;
}

function normalizeOptionalFinite(value: number | null | undefined, label: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) throw new Error(`${label} debe ser un número finito.`);
  return value;
}

function normalizeOptionalNonNegative(
  value: number | null | undefined,
  label: string,
): number | null {
  if (value === null || value === undefined) return null;
  assertFiniteNonNegative(value, label);
  return value;
}

function normalizeOptionalHeading(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value >= 360) {
    throw new Error("El rumbo debe estar entre 0 y menos de 360 grados.");
  }
  return value;
}

function normalizeOptionalBoolean(
  value: boolean | null | undefined,
  label: string,
): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "boolean") throw new Error(`${label} debe ser booleana cuando se indique.`);
  return value;
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} debe ser un número finito no negativo.`);
  }
}
