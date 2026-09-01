import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase";
import {
  type ActivateGpsOdometerAuthorityInput,
  type ConfigureGpsOdometerPlausibilityPolicyInput,
  type GpsOdometerAuthority,
  type GpsOdometerAuthorityStatus,
  type GpsOdometerBootstrapMode,
  type GpsOdometerCandidate,
  type GpsOdometerManagementBootstrap,
  type GpsOdometerPlausibilityPolicy,
  type PendingGpsOdometerReview,
  type ReviewGpsOdometerPromotionInput,
  type SuspendGpsOdometerAuthorityInput,
} from "./gps-odometer-management";

type CandidateRow = Database["public"]["Views"]["vehicle_gps_odometer_candidate"]["Row"];
type VehicleRow = Pick<
  Database["public"]["Tables"]["vehicles"]["Row"],
  "id" | "plate" | "current_odometer_km"
>;
type ProviderLinkRow = Pick<
  Database["public"]["Tables"]["gps_provider_vehicle_links"]["Row"],
  "id" | "vehicle_id" | "provider_kind" | "active"
>;
type AuthorityRow = Pick<
  Database["public"]["Tables"]["gps_odometer_authorities"]["Row"],
  | "id"
  | "vehicle_id"
  | "status"
  | "bootstrap_mode"
  | "activated_at"
  | "suspended_at"
  | "suspension_reason"
>;
type PolicyRow = Pick<
  Database["public"]["Tables"]["gps_odometer_plausibility_policies"]["Row"],
  "max_auto_advance_km" | "max_average_speed_kmh" | "configured_at" | "reason" | "version"
>;
type PromotionRow = Pick<
  Database["public"]["Tables"]["gps_odometer_promotions"]["Row"],
  | "id"
  | "vehicle_id"
  | "outcome"
  | "promotion_kind"
  | "reported_odometer_km"
  | "previous_odometer_km"
  | "source_recorded_at"
>;
type ReviewRow = Pick<
  Database["public"]["Tables"]["gps_odometer_promotion_reviews"]["Row"],
  "promotion_id"
>;

const GOLDCAR_PROVIDER_KIND = "GOLDCAR_PORTAL_RPA";

/**
 * Read and command boundary for the online-only management configuration.
 * All reads explicitly select a narrow, non-location projection and every
 * state-changing call goes through a typed, audited RPC.
 */
export interface GpsOdometerManagementGateway {
  loadBootstrap(): Promise<GpsOdometerManagementBootstrap>;
  activateAuthority(input: ActivateGpsOdometerAuthorityInput): Promise<void>;
  configurePlausibilityPolicy(input: ConfigureGpsOdometerPlausibilityPolicyInput): Promise<void>;
  suspendAuthority(input: SuspendGpsOdometerAuthorityInput): Promise<void>;
  reviewPromotion(input: ReviewGpsOdometerPromotionInput): Promise<void>;
}

export function createSupabaseGpsOdometerManagementGateway(
  client: SupabaseClient<Database>,
): GpsOdometerManagementGateway {
  return {
    async loadBootstrap(): Promise<GpsOdometerManagementBootstrap> {
      const [
        candidatesResult,
        vehiclesResult,
        linksResult,
        authoritiesResult,
        policyResult,
        promotionsResult,
        reviewsResult,
      ] = await Promise.all([
        client
          .from("vehicle_gps_odometer_candidate")
          .select(
            "position_id, vehicle_id, provider_kind, recorded_at, received_at, odometer_km, current_odometer_km, authority_status",
          )
          .eq("provider_kind", GOLDCAR_PROVIDER_KIND)
          .order("recorded_at", { ascending: false }),
        client.from("vehicles").select("id, plate, current_odometer_km"),
        client
          .from("gps_provider_vehicle_links")
          .select("id, vehicle_id, provider_kind, active")
          .eq("provider_kind", GOLDCAR_PROVIDER_KIND)
          .eq("active", true),
        client
          .from("gps_odometer_authorities")
          .select(
            "id, vehicle_id, status, bootstrap_mode, activated_at, suspended_at, suspension_reason",
          )
          .order("activated_at", { ascending: false }),
        client
          .from("gps_odometer_plausibility_policies")
          .select("max_auto_advance_km, max_average_speed_kmh, configured_at, reason, version")
          .maybeSingle(),
        client
          .from("gps_odometer_promotions")
          .select(
            "id, vehicle_id, outcome, promotion_kind, reported_odometer_km, previous_odometer_km, source_recorded_at",
          )
          .eq("promotion_kind", "sync")
          .eq("outcome", "requires_review")
          .order("source_recorded_at", { ascending: false }),
        client.from("gps_odometer_promotion_reviews").select("promotion_id"),
      ]);

      const candidates = requiredRows<CandidateRow>(candidatesResult, "las lecturas de odómetro");
      const vehicles = requiredRows<VehicleRow>(vehiclesResult, "las unidades autorizadas");
      const links = requiredRows<ProviderLinkRow>(linksResult, "los vínculos GPS aprobados");
      const authorities = requiredRows<AuthorityRow>(
        authoritiesResult,
        "las autoridades de odómetro",
      );
      const policy = optionalRow<PolicyRow>(policyResult, "la política de plausibilidad");
      const promotions = requiredRows<PromotionRow>(
        promotionsResult,
        "las lecturas pendientes de revisión",
      );
      const reviews = requiredRows<ReviewRow>(reviewsResult, "las revisiones de odómetro");

      const vehicleLabels = new Map(
        vehicles.map((row) => [
          requiredId(row.id, "la unidad"),
          requiredText(row.plate, "la placa"),
        ]),
      );
      const activeLinkByVehicle = new Map<string, string>();
      for (const link of links) {
        if (link.active !== true || link.provider_kind !== GOLDCAR_PROVIDER_KIND) continue;
        const vehicleId = requiredId(link.vehicle_id, "el vínculo GPS");
        if (!activeLinkByVehicle.has(vehicleId)) {
          activeLinkByVehicle.set(vehicleId, requiredId(link.id, "el vínculo GPS"));
        }
      }

      const parsedCandidates = candidates.map((row) =>
        parseCandidate(row, vehicleLabels, activeLinkByVehicle),
      );
      const parsedAuthorities = latestAuthoritiesByVehicle(authorities, vehicleLabels);
      const reviewedPromotionIds = new Set(
        reviews.map((row) => requiredId(row.promotion_id, "la revisión de odómetro")),
      );

      return {
        candidates: parsedCandidates,
        authorities: parsedAuthorities,
        plausibilityPolicy: policy === null ? null : parsePolicy(policy),
        pendingReviews: promotions
          .filter(
            (promotion) => !reviewedPromotionIds.has(requiredId(promotion.id, "la promoción")),
          )
          .map((promotion) => parsePendingReview(promotion, vehicleLabels)),
      };
    },

    async activateAuthority(input: ActivateGpsOdometerAuthorityInput): Promise<void> {
      const { error } = await client.rpc("activate_gps_odometer_authority", {
        p_provider_link_id: input.candidate.providerLinkId,
        p_position_id: input.candidate.positionId,
        p_expected_current_odometer_km: input.expectedCurrentOdometerKm,
        p_bootstrap_mode: input.bootstrapMode,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
      });
      throwIfCommandFailed(error, "adoptar la fuente oficial de odómetro");
    },

    async configurePlausibilityPolicy(
      input: ConfigureGpsOdometerPlausibilityPolicyInput,
    ): Promise<void> {
      const { error } = await client.rpc("configure_gps_odometer_plausibility_policy", {
        p_max_auto_advance_km: input.maxAutoAdvanceKm,
        p_max_average_speed_kmh: input.maxAverageSpeedKmh,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
      });
      throwIfCommandFailed(error, "publicar la política de plausibilidad");
    },

    async suspendAuthority(input: SuspendGpsOdometerAuthorityInput): Promise<void> {
      const { error } = await client.rpc("suspend_gps_odometer_authority", {
        p_authority_id: input.authorityId,
        p_reason: input.reason,
      });
      throwIfCommandFailed(error, "suspender la autoridad de odómetro");
    },

    async reviewPromotion(input: ReviewGpsOdometerPromotionInput): Promise<void> {
      const { error } = await client.rpc("review_gps_odometer_promotion", {
        p_promotion_id: input.promotionId,
        p_decision: input.decision,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
      });
      throwIfCommandFailed(error, "registrar la revisión de la lectura GPS");
    },
  };
}

function parseCandidate(
  row: CandidateRow,
  vehicleLabels: ReadonlyMap<string, string>,
  activeLinkByVehicle: ReadonlyMap<string, string>,
): GpsOdometerCandidate {
  if (row.provider_kind !== GOLDCAR_PROVIDER_KIND) {
    throw unavailable("la procedencia de la lectura Goldcar");
  }
  const vehicleId = requiredId(row.vehicle_id, "la lectura de odómetro");
  const providerLinkId = activeLinkByVehicle.get(vehicleId);
  if (providerLinkId === undefined) throw unavailable("el vínculo GPS de la lectura");

  return {
    positionId: requiredId(row.position_id, "la lectura de odómetro"),
    providerLinkId,
    vehicleId,
    vehicleLabel: requiredVehicleLabel(vehicleLabels, vehicleId),
    recordedAt: requiredTimestamp(row.recorded_at, "la hora de la lectura"),
    receivedAt: requiredTimestamp(row.received_at, "la recepción de la lectura"),
    odometerKm: requiredNonNegativeNumber(row.odometer_km, "el odómetro Goldcar"),
    currentOdometerKm: requiredNonNegativeNumber(
      row.current_odometer_km,
      "el odómetro maestro de la unidad",
    ),
    authorityStatus: parseAuthorityStatus(row.authority_status),
  };
}

function latestAuthoritiesByVehicle(
  rows: readonly AuthorityRow[],
  vehicleLabels: ReadonlyMap<string, string>,
): readonly GpsOdometerAuthority[] {
  const latestByVehicle = new Map<string, GpsOdometerAuthority>();
  for (const row of rows) {
    const vehicleId = requiredId(row.vehicle_id, "la autoridad de odómetro");
    if (latestByVehicle.has(vehicleId)) continue;
    latestByVehicle.set(vehicleId, {
      id: requiredId(row.id, "la autoridad de odómetro"),
      vehicleId,
      vehicleLabel: requiredVehicleLabel(vehicleLabels, vehicleId),
      status: parseAuthorityStatus(row.status) ?? unavailableStatus(),
      bootstrapMode: parseBootstrapMode(row.bootstrap_mode),
      activatedAt: requiredTimestamp(row.activated_at, "la activación de la autoridad"),
      suspendedAt: optionalTimestamp(row.suspended_at, "la suspensión de la autoridad"),
      suspensionReason: optionalText(row.suspension_reason),
    });
  }
  return [...latestByVehicle.values()];
}

function parsePolicy(row: PolicyRow): GpsOdometerPlausibilityPolicy {
  return {
    maxAutoAdvanceKm: requiredPositiveNumber(
      row.max_auto_advance_km,
      "el avance automático máximo",
    ),
    maxAverageSpeedKmh: requiredPositiveNumber(
      row.max_average_speed_kmh,
      "la velocidad promedio máxima",
    ),
    configuredAt: requiredTimestamp(row.configured_at, "la fecha de configuración"),
    reason: requiredText(row.reason, "el motivo de la política"),
    version: requiredPositiveInteger(row.version, "la versión de la política"),
  };
}

function parsePendingReview(
  row: PromotionRow,
  vehicleLabels: ReadonlyMap<string, string>,
): PendingGpsOdometerReview {
  if (row.outcome !== "requires_review" || row.promotion_kind !== "sync") {
    throw unavailable("la promoción GPS pendiente");
  }
  const vehicleId = requiredId(row.vehicle_id, "la promoción GPS pendiente");
  return {
    promotionId: requiredId(row.id, "la promoción GPS pendiente"),
    vehicleId,
    vehicleLabel: requiredVehicleLabel(vehicleLabels, vehicleId),
    reportedOdometerKm: requiredNonNegativeNumber(
      row.reported_odometer_km,
      "el odómetro GPS pendiente",
    ),
    previousOdometerKm: requiredNonNegativeNumber(
      row.previous_odometer_km,
      "el odómetro maestro previo",
    ),
    recordedAt: requiredTimestamp(row.source_recorded_at, "la hora de la lectura pendiente"),
  };
}

function parseAuthorityStatus(value: unknown): GpsOdometerAuthorityStatus | null {
  if (value === null) return null;
  if (value === "active" || value === "suspended") return value;
  throw unavailable("el estado de la autoridad GPS");
}

function parseBootstrapMode(value: unknown): GpsOdometerBootstrapMode {
  if (value === "standard" || value === "test_placeholder") return value;
  throw unavailable("el modo de enrolamiento GPS");
}

function requiredRows<T>(result: unknown, subject: string): readonly T[] {
  const parsed = queryResult(result, subject);
  if (!Array.isArray(parsed)) throw unavailable(subject);
  return parsed as readonly T[];
}

function optionalRow<T>(result: unknown, subject: string): T | null {
  const parsed = queryResult(result, subject);
  if (parsed === null) return null;
  if (typeof parsed !== "object" || Array.isArray(parsed)) throw unavailable(subject);
  return parsed as T;
}

function queryResult(result: unknown, subject: string): unknown {
  if (
    typeof result !== "object" ||
    result === null ||
    !("error" in result) ||
    !("data" in result)
  ) {
    throw unavailable(subject);
  }
  const typed = result as { readonly data: unknown; readonly error: unknown };
  if (typed.error !== null) throw unavailable(subject);
  return typed.data;
}

function throwIfCommandFailed(error: unknown, action: string): void {
  if (error !== null) {
    throw new Error(
      `El servidor no confirmó la acción de ${action}. Actualiza la evidencia y vuelve a intentarlo.`,
    );
  }
}

function requiredId(value: unknown, subject: string): string {
  return requiredText(value, subject);
}

function requiredText(value: unknown, subject: string): string {
  if (typeof value !== "string" || value.trim() === "") throw unavailable(subject);
  return value.trim();
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function requiredTimestamp(value: unknown, subject: string): string {
  const timestamp = requiredText(value, subject);
  if (!Number.isFinite(new Date(timestamp).getTime())) throw unavailable(subject);
  return timestamp;
}

function optionalTimestamp(value: unknown, subject: string): string | null {
  if (value === null) return null;
  return requiredTimestamp(value, subject);
}

function requiredNonNegativeNumber(value: unknown, subject: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw unavailable(subject);
  }
  return value;
}

function requiredPositiveNumber(value: unknown, subject: string): number {
  const number = requiredNonNegativeNumber(value, subject);
  if (number <= 0) throw unavailable(subject);
  return number;
}

function requiredPositiveInteger(value: unknown, subject: string): number {
  const number = requiredPositiveNumber(value, subject);
  if (!Number.isInteger(number)) throw unavailable(subject);
  return number;
}

function requiredVehicleLabel(labels: ReadonlyMap<string, string>, vehicleId: string): string {
  const label = labels.get(vehicleId);
  if (label === undefined) throw unavailable("la unidad de la evidencia GPS");
  return label;
}

function unavailable(subject: string): Error {
  return new Error(`No fue posible consultar de forma segura ${subject}.`);
}

function unavailableStatus(): never {
  throw unavailable("el estado de la autoridad GPS");
}
