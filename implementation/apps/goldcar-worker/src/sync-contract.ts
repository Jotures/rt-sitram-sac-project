import type { GpsPosition } from "@rt-sitram/domain";

export type GpsSyncRunStatus = "started" | "succeeded" | "failed" | "cancelled";

export type GpsSyncFailureCode =
  | "CONFIGURATION"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "MALFORMED_RESPONSE"
  | "REMOTE_ERROR"
  | "PERSISTENCE_UNAVAILABLE"
  | "PERSISTENCE_ERROR"
  | "TIMEOUT"
  | "UNLINKED_ASSET"
  | "LEASE_EXPIRED";

export interface GpsSyncRun {
  readonly id: string;
  readonly status: GpsSyncRunStatus;
  readonly leaseExpiresAt: string | null;
  readonly deadlineAt: string | null;
  readonly assetsSeen: number;
  readonly positionsReceived: number;
  readonly positionsPersisted: number;
  readonly positionsDeduplicated: number;
  readonly positionsUnlinked: number;
  readonly sourceAttempts: number;
  readonly providerCheckpointAt: string | null;
  readonly errorCode: GpsSyncFailureCode | null;
}

export interface BeginGpsSyncRunInput {
  readonly companyId: string;
  readonly providerKind: string;
  readonly requestId: string;
  readonly operatorProfileId: string;
  readonly leaseSeconds: number;
  readonly maxDurationSeconds: number;
}

export interface FinishGpsSyncRunInput {
  readonly runId: string;
  readonly status: "succeeded" | "failed";
  readonly assetsSeen: number;
  readonly positionsReceived: number;
  readonly positionsPersisted: number;
  readonly positionsDeduplicated: number;
  readonly positionsUnlinked: number;
  readonly sourceAttempts: number;
  readonly providerCheckpointAt: string | null;
  readonly errorCode: GpsSyncFailureCode | null;
}

export interface IngestGpsPositionForSyncInput {
  readonly runId: string;
  readonly position: GpsPosition;
  readonly observationKey: string;
}

export type GpsSyncIngestDisposition = "persisted" | "deduplicated" | "unlinked";

export interface GpsSyncIngestResult {
  readonly positionId: string | null;
  readonly disposition: GpsSyncIngestDisposition;
}

export interface GpsSyncRepository {
  begin(input: BeginGpsSyncRunInput): Promise<GpsSyncRun>;
  heartbeat(runId: string, leaseSeconds: number): Promise<GpsSyncRun>;
  ingest(input: IngestGpsPositionForSyncInput): Promise<GpsSyncIngestResult>;
  finish(input: FinishGpsSyncRunInput): Promise<GpsSyncRun>;
}

/** Safe, classified error from the server-side persistence boundary. */
export class GpsSyncRepositoryError extends Error {
  readonly code: GpsSyncFailureCode;
  readonly retryable: boolean;

  constructor(code: GpsSyncFailureCode, retryable: boolean) {
    super("La persistencia de telemetría no completó la operación solicitada.");
    this.name = "GpsSyncRepositoryError";
    this.code = code;
    this.retryable = retryable;
  }
}
