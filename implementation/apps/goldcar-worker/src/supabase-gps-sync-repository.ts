import type { GpsPosition } from "@rt-sitram/domain";
import {
  GpsSyncRepositoryError,
  type BeginGpsSyncRunInput,
  type FinishGpsSyncRunInput,
  type GpsSyncFailureCode,
  type GpsSyncIngestResult,
  type GpsSyncRepository,
  type GpsSyncRun,
  type GpsSyncRunStatus,
  type IngestGpsPositionForSyncInput,
} from "./sync-contract";

export interface SupabaseGpsSyncRepositoryConfig {
  readonly supabaseUrl: URL;
  readonly serviceRoleKey: string;
  readonly fetchImplementation?: typeof fetch;
}

/**
 * Thin server-only PostgREST RPC client. It keeps the elevated Supabase
 * credential in this worker process and never includes a response body in an
 * error.
 */
export class SupabaseGpsSyncRepository implements GpsSyncRepository {
  readonly #supabaseUrl: URL;
  readonly #serviceRoleKey: string;
  readonly #fetch: typeof fetch;

  constructor(config: SupabaseGpsSyncRepositoryConfig) {
    this.#supabaseUrl = config.supabaseUrl;
    this.#serviceRoleKey = config.serviceRoleKey;
    this.#fetch = config.fetchImplementation ?? fetch;
  }

  async begin(input: BeginGpsSyncRunInput): Promise<GpsSyncRun> {
    return parseGpsSyncRun(
      await this.invoke("begin_gps_sync_run", {
        p_company_id: input.companyId,
        p_provider_kind: input.providerKind,
        p_request_id: input.requestId,
        p_initiated_by: input.operatorProfileId,
        p_lease_seconds: input.leaseSeconds,
        p_max_duration_seconds: input.maxDurationSeconds,
      }),
    );
  }

  async heartbeat(runId: string, leaseSeconds: number): Promise<GpsSyncRun> {
    return parseGpsSyncRun(
      await this.invoke("heartbeat_gps_sync_run", {
        p_run_id: runId,
        p_lease_seconds: leaseSeconds,
      }),
    );
  }

  async ingest(input: IngestGpsPositionForSyncInput): Promise<GpsSyncIngestResult> {
    return parseIngestResult(
      await this.invoke(
        "ingest_gps_position_for_sync",
        toIngestPayload(input.runId, input.position, input.observationKey),
      ),
    );
  }

  async finish(input: FinishGpsSyncRunInput): Promise<GpsSyncRun> {
    return parseGpsSyncRun(
      await this.invoke("finish_gps_sync_run", {
        p_run_id: input.runId,
        p_status: input.status,
        p_assets_seen: input.assetsSeen,
        p_positions_received: input.positionsReceived,
        p_positions_persisted: input.positionsPersisted,
        p_positions_deduplicated: input.positionsDeduplicated,
        p_positions_unlinked: input.positionsUnlinked,
        p_source_attempts: input.sourceAttempts,
        p_provider_checkpoint_at: input.providerCheckpointAt,
        p_error_code: input.errorCode,
      }),
    );
  }

  private async invoke(
    functionName: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    const endpoint = new URL(`/rest/v1/rpc/${functionName}`, this.#supabaseUrl);
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: this.#serviceRoleKey,
    });

    // Current Supabase `sb_secret_` API keys authenticate via `apikey` only.
    // Legacy JWT-based service_role keys still need their bearer claim.
    if (!this.#serviceRoleKey.startsWith("sb_secret_")) {
      headers.set("Authorization", `Bearer ${this.#serviceRoleKey}`);
    }

    let response: Response;
    try {
      response = await this.#fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch {
      throw new GpsSyncRepositoryError("PERSISTENCE_UNAVAILABLE", true);
    }

    if (!response.ok) {
      throw await toRepositoryError(response);
    }
    try {
      return await response.json();
    } catch {
      throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
    }
  }
}

function toIngestPayload(
  runId: string,
  position: GpsPosition,
  observationKey: string,
): Readonly<Record<string, unknown>> {
  return {
    p_run_id: runId,
    p_provider_kind: position.provider,
    p_external_asset_id: position.providerAssetId,
    p_observation_key: observationKey,
    p_provider_event_id: position.providerEventId,
    p_recorded_at: position.recordedAt,
    p_received_at: position.receivedAt,
    p_latitude: position.latitude,
    p_longitude: position.longitude,
    p_speed_kmh: position.speedKmh,
    p_heading_degrees: position.headingDegrees,
    p_altitude_meters: position.altitudeMeters,
    p_ignition: position.ignition,
    p_odometer_km: position.odometerKm,
  };
}

async function toRepositoryError(response: Response): Promise<GpsSyncRepositoryError> {
  const databaseCode = await readDatabaseCode(response);
  if (response.status === 401 || response.status === 403) {
    return new GpsSyncRepositoryError("UNAUTHORIZED", false);
  }
  if (response.status === 429) {
    return new GpsSyncRepositoryError("RATE_LIMITED", true);
  }
  if (response.status === 408 || response.status === 504 || databaseCode === "57014") {
    return new GpsSyncRepositoryError("TIMEOUT", true);
  }
  if (databaseCode === "55P03") {
    return new GpsSyncRepositoryError("LEASE_EXPIRED", false);
  }
  if (response.status >= 500) {
    return new GpsSyncRepositoryError("PERSISTENCE_UNAVAILABLE", true);
  }
  if (databaseCode === "23514" || databaseCode === "P0002" || databaseCode === "42501") {
    return new GpsSyncRepositoryError("CONFIGURATION", false);
  }
  return new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
}

async function readDatabaseCode(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.clone().json();
    return isRecord(payload) && typeof payload.code === "string" ? payload.code : null;
  } catch {
    return null;
  }
}

function parseGpsSyncRun(value: unknown): GpsSyncRun {
  if (!isRecord(value)) throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
  const status = parseRunStatus(value.status);
  return {
    id: parseUuid(value.id),
    status,
    leaseExpiresAt: parseNullableTimestamp(value.lease_expires_at),
    deadlineAt: parseNullableTimestamp(value.deadline_at),
    assetsSeen: parseNonNegativeInteger(value.assets_seen),
    positionsReceived: parseNonNegativeInteger(value.positions_received),
    positionsPersisted: parseNonNegativeInteger(value.positions_persisted),
    positionsDeduplicated: parseNonNegativeInteger(value.positions_deduplicated),
    positionsUnlinked: parseNonNegativeInteger(value.positions_unlinked),
    sourceAttempts: parseNonNegativeInteger(value.source_attempts),
    providerCheckpointAt: parseNullableTimestamp(value.provider_checkpoint_at),
    errorCode: parseFailureCode(value.error_code),
  };
}

function parseIngestResult(value: unknown): GpsSyncIngestResult {
  // PostgREST serializes a `returns table (...)` RPC as a one-row array.
  // Keep accepting a record as well so the parser remains compatible with
  // direct/mock RPC clients, but reject zero or multiple rows fail-closed.
  const row = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (!isRecord(row)) throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
  const disposition = row.disposition;
  if (disposition !== "persisted" && disposition !== "deduplicated" && disposition !== "unlinked") {
    throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
  }
  const positionId = row.position_id;
  if (disposition === "unlinked") {
    if (positionId !== null) throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
    return { positionId: null, disposition };
  }
  return { positionId: parseUuid(positionId), disposition };
}

function parseRunStatus(value: unknown): GpsSyncRunStatus {
  if (value === "started" || value === "succeeded" || value === "failed" || value === "cancelled") {
    return value;
  }
  throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
}

function parseFailureCode(value: unknown): GpsSyncFailureCode | null {
  if (value === null) return null;
  const allowed: readonly GpsSyncFailureCode[] = [
    "CONFIGURATION",
    "UNAUTHORIZED",
    "RATE_LIMITED",
    "UNAVAILABLE",
    "MALFORMED_RESPONSE",
    "REMOTE_ERROR",
    "PERSISTENCE_UNAVAILABLE",
    "PERSISTENCE_ERROR",
    "TIMEOUT",
    "UNLINKED_ASSET",
    "LEASE_EXPIRED",
  ];
  if (typeof value === "string" && allowed.includes(value as GpsSyncFailureCode)) {
    return value as GpsSyncFailureCode;
  }
  throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
}

function parseUuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  ) {
    throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
  }
  return value;
}

function parseNullableTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
  }
  return new Date(value).toISOString();
}

function parseNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new GpsSyncRepositoryError("PERSISTENCE_ERROR", false);
  }
  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
