import { getGpsPositionFingerprint } from "@rt-sitram/domain";
import { GpsProviderError, type GpsProvider } from "@rt-sitram/integrations";
import {
  GpsSyncRepositoryError,
  type FinishGpsSyncRunInput,
  type GpsSyncFailureCode,
  type GpsSyncRepository,
  type GpsSyncRun,
} from "./sync-contract";

export interface GoldcarManualSyncOptions {
  readonly companyId: string;
  readonly operatorProfileId: string;
  readonly leaseSeconds: number;
  readonly maxDurationSeconds: number;
  readonly persistenceMaxAttempts: number;
  readonly persistenceRetryBaseMs: number;
  readonly now?: () => Date;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
  readonly requestId?: () => string;
}

export interface GoldcarManualSyncSummary {
  readonly runId: string;
  readonly status: "succeeded" | "failed";
  readonly assetsSeen: number;
  readonly positionsReceived: number;
  readonly positionsPersisted: number;
  readonly positionsDeduplicated: number;
  readonly positionsUnlinked: number;
  readonly sourceAttempts: number;
  readonly providerCheckpointAt: string | null;
  readonly durationMs: number;
  readonly errorCode: GpsSyncFailureCode | null;
}

export interface GoldcarManualSyncDependencies {
  readonly provider: GpsProvider;
  readonly repository: GpsSyncRepository;
  readonly options: GoldcarManualSyncOptions;
}

interface SyncProgress {
  assetsSeen: number;
  positionsReceived: number;
  positionsPersisted: number;
  positionsDeduplicated: number;
  positionsUnlinked: number;
  sourceAttempts: number;
  providerCheckpointAt: string | null;
}

/**
 * Executes one read-only portal snapshot and persists only normalized evidence.
 * There is intentionally no history cursor, scheduled loop, or portal retry:
 * the temporary RPA source exposes only a latest-position snapshot.
 */
export async function runGoldcarManualSync(
  dependencies: GoldcarManualSyncDependencies,
): Promise<GoldcarManualSyncSummary> {
  const { provider, repository, options } = dependencies;
  const now = options.now ?? (() => new Date());
  const sleep =
    options.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  const requestId = options.requestId ?? (() => crypto.randomUUID());
  const startedAt = now().getTime();
  const localDeadlineAt = startedAt + options.maxDurationSeconds * 1_000;
  const progress: SyncProgress = {
    assetsSeen: 0,
    positionsReceived: 0,
    positionsPersisted: 0,
    positionsDeduplicated: 0,
    positionsUnlinked: 0,
    sourceAttempts: 0,
    providerCheckpointAt: null,
  };

  const syncRequestId = requestId();
  let run = await retryStart(
    () =>
      repository.begin({
        companyId: options.companyId,
        providerKind: provider.kind,
        requestId: syncRequestId,
        operatorProfileId: options.operatorProfileId,
        leaseSeconds: options.leaseSeconds,
        maxDurationSeconds: options.maxDurationSeconds,
      }),
    options,
    now,
    sleep,
    random,
    localDeadlineAt,
  );
  if (run.status !== "started") return summaryFromRun(run, startedAt, now());

  try {
    run = await retryPersistence(
      () => repository.heartbeat(run.id, options.leaseSeconds),
      run,
      options,
      now,
      sleep,
      random,
      false,
    );
    assertBeforeDeadline(run, now());
    progress.sourceAttempts = 1;
    const assets = await provider.listAssets();
    progress.assetsSeen = assets.length;
    run = await retryPersistence(
      () => repository.heartbeat(run.id, options.leaseSeconds),
      run,
      options,
      now,
      sleep,
      random,
      false,
    );

    for (const asset of assets) {
      assertBeforeDeadline(run, now());
      const position = await provider.getLatestPosition(asset.externalAssetId);
      if (position === null) continue;
      if (
        position.provider !== provider.kind ||
        position.providerAssetId !== asset.externalAssetId
      ) {
        throw new GoldcarManualSyncError("MALFORMED_RESPONSE");
      }

      progress.positionsReceived += 1;
      progress.providerCheckpointAt = latestCheckpoint(
        progress.providerCheckpointAt,
        position.recordedAt,
      );
      run = await renewLeaseIfNeeded(run, repository, options, now, sleep, random);
      const result = await retryPersistence(
        () =>
          repository.ingest({
            runId: run.id,
            position,
            observationKey: getGpsPositionFingerprint(position),
          }),
        run,
        options,
        now,
        sleep,
        random,
        false,
      );
      if (result.disposition === "persisted") progress.positionsPersisted += 1;
      if (result.disposition === "deduplicated") progress.positionsDeduplicated += 1;
      if (result.disposition === "unlinked") progress.positionsUnlinked += 1;
    }

    if (progress.positionsUnlinked > 0) {
      return finishFailure(
        repository,
        run,
        progress,
        "UNLINKED_ASSET",
        options,
        now,
        sleep,
        random,
        startedAt,
      );
    }
    const completed = await retryPersistence(
      () => repository.finish(toFinishInput(run.id, "succeeded", progress, null)),
      run,
      options,
      now,
      sleep,
      random,
      false,
    );
    return summaryFromRun(completed, startedAt, now());
  } catch (error) {
    return finishFailure(
      repository,
      run,
      progress,
      classifyFailure(error),
      options,
      now,
      sleep,
      random,
      startedAt,
    );
  }
}

class GoldcarManualSyncError extends Error {
  readonly code: GpsSyncFailureCode;

  constructor(code: GpsSyncFailureCode) {
    super("La sincronización manual no completó la operación solicitada.");
    this.name = "GoldcarManualSyncError";
    this.code = code;
  }
}

async function finishFailure(
  repository: GpsSyncRepository,
  run: GpsSyncRun,
  progress: SyncProgress,
  errorCode: GpsSyncFailureCode,
  options: GoldcarManualSyncOptions,
  now: () => Date,
  sleep: (milliseconds: number) => Promise<void>,
  random: () => number,
  startedAt: number,
): Promise<GoldcarManualSyncSummary> {
  const completed = await retryPersistence(
    () => repository.finish(toFinishInput(run.id, "failed", progress, errorCode)),
    run,
    options,
    now,
    sleep,
    random,
    true,
  );
  return summaryFromRun(completed, startedAt, now());
}

function toFinishInput(
  runId: string,
  status: "succeeded" | "failed",
  progress: SyncProgress,
  errorCode: GpsSyncFailureCode | null,
): FinishGpsSyncRunInput {
  return {
    runId,
    status,
    assetsSeen: progress.assetsSeen,
    positionsReceived: progress.positionsReceived,
    positionsPersisted: progress.positionsPersisted,
    positionsDeduplicated: progress.positionsDeduplicated,
    positionsUnlinked: progress.positionsUnlinked,
    sourceAttempts: progress.sourceAttempts,
    providerCheckpointAt: progress.providerCheckpointAt,
    errorCode,
  };
}

async function renewLeaseIfNeeded(
  run: GpsSyncRun,
  repository: GpsSyncRepository,
  options: GoldcarManualSyncOptions,
  now: () => Date,
  sleep: (milliseconds: number) => Promise<void>,
  random: () => number,
): Promise<GpsSyncRun> {
  const leaseExpiresAt = parseTimestamp(run.leaseExpiresAt);
  const renewalThresholdMs = Math.max(5_000, options.leaseSeconds * 500);
  if (leaseExpiresAt - now().getTime() > renewalThresholdMs) return run;
  return retryPersistence(
    () => repository.heartbeat(run.id, options.leaseSeconds),
    run,
    options,
    now,
    sleep,
    random,
    false,
  );
}

async function retryPersistence<T>(
  operation: () => Promise<T>,
  run: GpsSyncRun,
  options: GoldcarManualSyncOptions,
  now: () => Date,
  sleep: (milliseconds: number) => Promise<void>,
  random: () => number,
  allowAfterDeadline: boolean,
): Promise<T> {
  for (let attempt = 1; attempt <= options.persistenceMaxAttempts; attempt += 1) {
    if (!allowAfterDeadline) assertBeforeDeadline(run, now());
    try {
      return await operation();
    } catch (error) {
      if (
        !(error instanceof GpsSyncRepositoryError) ||
        !error.retryable ||
        attempt === options.persistenceMaxAttempts
      ) {
        throw error;
      }
      const delay = getBackoffDelay(options.persistenceRetryBaseMs, attempt, random);
      if (!allowAfterDeadline && now().getTime() + delay >= parseTimestamp(run.deadlineAt)) {
        throw new GoldcarManualSyncError("TIMEOUT");
      }
      await sleep(delay);
    }
  }
  throw new GoldcarManualSyncError("PERSISTENCE_ERROR");
}

async function retryStart<T>(
  operation: () => Promise<T>,
  options: GoldcarManualSyncOptions,
  now: () => Date,
  sleep: (milliseconds: number) => Promise<void>,
  random: () => number,
  localDeadlineAt: number,
): Promise<T> {
  for (let attempt = 1; attempt <= options.persistenceMaxAttempts; attempt += 1) {
    if (now().getTime() >= localDeadlineAt) throw new GoldcarManualSyncError("TIMEOUT");
    try {
      return await operation();
    } catch (error) {
      if (
        !(error instanceof GpsSyncRepositoryError) ||
        !error.retryable ||
        attempt === options.persistenceMaxAttempts
      ) {
        throw error;
      }
      const delay = getBackoffDelay(options.persistenceRetryBaseMs, attempt, random);
      if (now().getTime() + delay >= localDeadlineAt) {
        throw new GoldcarManualSyncError("TIMEOUT");
      }
      await sleep(delay);
    }
  }
  throw new GoldcarManualSyncError("PERSISTENCE_ERROR");
}

function getBackoffDelay(baseDelayMs: number, attempt: number, random: () => number): number {
  return Math.round(
    baseDelayMs * 2 ** (attempt - 1) * (1 + Math.max(0, Math.min(1, random())) * 0.2),
  );
}

function assertBeforeDeadline(run: GpsSyncRun, now: Date): void {
  if (now.getTime() >= parseTimestamp(run.deadlineAt)) {
    throw new GoldcarManualSyncError("TIMEOUT");
  }
}

function latestCheckpoint(current: string | null, candidate: string): string {
  if (current === null || Date.parse(candidate) > Date.parse(current)) return candidate;
  return current;
}

function classifyFailure(error: unknown): GpsSyncFailureCode {
  if (error instanceof GoldcarManualSyncError || error instanceof GpsSyncRepositoryError)
    return error.code;
  if (error instanceof GpsProviderError) {
    return error.code === "ASSET_NOT_FOUND" ? "MALFORMED_RESPONSE" : error.code;
  }
  return "REMOTE_ERROR";
}

function summaryFromRun(
  run: GpsSyncRun,
  startedAt: number,
  completedAt: Date,
): GoldcarManualSyncSummary {
  return {
    runId: run.id,
    status: run.status === "succeeded" ? "succeeded" : "failed",
    assetsSeen: run.assetsSeen,
    positionsReceived: run.positionsReceived,
    positionsPersisted: run.positionsPersisted,
    positionsDeduplicated: run.positionsDeduplicated,
    positionsUnlinked: run.positionsUnlinked,
    sourceAttempts: run.sourceAttempts,
    providerCheckpointAt: run.providerCheckpointAt,
    durationMs: Math.max(0, completedAt.getTime() - startedAt),
    errorCode: run.errorCode ?? (run.status === "succeeded" ? null : "PERSISTENCE_ERROR"),
  };
}

function parseTimestamp(value: string | null): number {
  if (value === null) throw new GoldcarManualSyncError("PERSISTENCE_ERROR");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new GoldcarManualSyncError("PERSISTENCE_ERROR");
  return timestamp;
}
