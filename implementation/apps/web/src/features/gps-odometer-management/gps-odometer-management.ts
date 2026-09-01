import type { AppRole } from "../identity/identity-model";

export type GpsOdometerAuthorityStatus = "active" | "suspended";
export type GpsOdometerBootstrapMode = "standard" | "test_placeholder";
export type GpsOdometerReviewDecision = "approved" | "rejected";

export interface GpsOdometerCandidate {
  /** Internal IDs are held only to invoke the authoritative RPC; the UI never renders them. */
  readonly positionId: string;
  readonly providerLinkId: string;
  readonly vehicleId: string;
  readonly vehicleLabel: string;
  readonly recordedAt: string;
  readonly receivedAt: string;
  readonly odometerKm: number;
  readonly currentOdometerKm: number;
  readonly authorityStatus: GpsOdometerAuthorityStatus | null;
}

export interface GpsOdometerAuthority {
  /** Internal ID used only by the suspension command. */
  readonly id: string;
  readonly vehicleId: string;
  readonly vehicleLabel: string;
  readonly status: GpsOdometerAuthorityStatus;
  readonly bootstrapMode: GpsOdometerBootstrapMode;
  readonly activatedAt: string;
  readonly suspendedAt: string | null;
  readonly suspensionReason: string | null;
}

export interface GpsOdometerPlausibilityPolicy {
  readonly maxAutoAdvanceKm: number;
  readonly maxAverageSpeedKmh: number;
  readonly configuredAt: string;
  readonly reason: string;
  readonly version: number;
}

export interface PendingGpsOdometerReview {
  /** Internal ID used only by the review command. */
  readonly promotionId: string;
  readonly vehicleId: string;
  readonly vehicleLabel: string;
  readonly reportedOdometerKm: number;
  readonly previousOdometerKm: number;
  readonly recordedAt: string;
}

export interface GpsOdometerManagementBootstrap {
  readonly candidates: readonly GpsOdometerCandidate[];
  readonly authorities: readonly GpsOdometerAuthority[];
  readonly plausibilityPolicy: GpsOdometerPlausibilityPolicy | null;
  readonly pendingReviews: readonly PendingGpsOdometerReview[];
}

export interface ActivateGpsOdometerAuthorityInput {
  readonly candidate: GpsOdometerCandidate;
  readonly expectedCurrentOdometerKm: number;
  readonly bootstrapMode: GpsOdometerBootstrapMode;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface ConfigureGpsOdometerPlausibilityPolicyInput {
  readonly maxAutoAdvanceKm: number;
  readonly maxAverageSpeedKmh: number;
  readonly reason: string;
  /** Reused when a network retry submits the exact same policy command. */
  readonly idempotencyKey: string;
}

export interface SuspendGpsOdometerAuthorityInput {
  readonly authorityId: string;
  readonly reason: string;
}

export interface ReviewGpsOdometerPromotionInput {
  readonly promotionId: string;
  readonly decision: GpsOdometerReviewDecision;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export type GpsOdometerManagementScreenState =
  | "PREPARING"
  | "FORBIDDEN"
  | "OFFLINE"
  | "UNAVAILABLE"
  | "READY";

/**
 * This is intentionally more restrictive than the contextual GPS reader:
 * odometer authority is a Gerencia-only configuration, never an
 * Administración capability.
 */
export function canManageGpsOdometer(role: AppRole): boolean {
  return role === "management";
}

/** A component-level guard used before creating any online GPS query. */
export function shouldLoadGpsOdometerManagement(
  role: AppRole | null,
  online: boolean,
  serverConfigured: boolean,
): boolean {
  return role !== null && canManageGpsOdometer(role) && online && serverConfigured;
}

export function getGpsOdometerManagementScreenState(input: {
  readonly identityReady: boolean;
  readonly role: AppRole | null;
  readonly online: boolean;
  readonly serverConfigured: boolean;
}): GpsOdometerManagementScreenState {
  if (!input.identityReady) return "PREPARING";
  if (input.role === null || !canManageGpsOdometer(input.role)) return "FORBIDDEN";
  if (!input.online) return "OFFLINE";
  if (!input.serverConfigured) return "UNAVAILABLE";
  return "READY";
}

/**
 * The one time DEC-032 correction remains visually explicit. The server
 * repeats every condition, so this client predicate is only an affordance.
 */
export function canOfferTestPlaceholderCorrection(candidate: GpsOdometerCandidate): boolean {
  return (
    candidate.vehicleLabel === "VDR-768" &&
    candidate.currentOdometerKm === 141_601 &&
    candidate.odometerKm < candidate.currentOdometerKm &&
    candidate.authorityStatus !== "active"
  );
}

export function validateGpsOdometerReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < 1 || normalized.length > 500) {
    throw new Error("Explica el motivo con entre 1 y 500 caracteres.");
  }
  return normalized;
}

export function validateGpsOdometerPositiveDecimal(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || Math.round(parsed * 100) !== parsed * 100) {
    throw new Error(`${label} debe ser un número positivo con hasta dos decimales.`);
  }
  return parsed;
}

export function createGpsOdometerIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("Este navegador no puede generar una clave segura para confirmar la acción.");
  }
  return globalThis.crypto.randomUUID();
}

export function authorityStatusLabel(status: GpsOdometerAuthorityStatus | null): string {
  if (status === "active") return "Fuente oficial activa";
  if (status === "suspended") return "Fuente oficial suspendida";
  return "Sin fuente oficial";
}

export function bootstrapActionLabel(candidate: GpsOdometerCandidate): string {
  if (candidate.authorityStatus === "suspended") return "Volver a activar como fuente oficial";
  return "Usar como fuente oficial";
}
