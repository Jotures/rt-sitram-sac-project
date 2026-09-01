import {
  normalizeGpsPosition,
  normalizeGpsProviderKind,
  type GpsPosition,
} from "@rt-sitram/domain";
import { GpsProviderError, type GpsExternalAsset, type GpsProvider } from "@rt-sitram/integrations";
import { describe, expect, it } from "vitest";
import { runGoldcarManualSync, type GoldcarManualSyncOptions } from "./manual-sync-service";
import {
  GpsSyncRepositoryError,
  type BeginGpsSyncRunInput,
  type FinishGpsSyncRunInput,
  type GpsSyncIngestResult,
  type GpsSyncRepository,
  type GpsSyncRun,
  type IngestGpsPositionForSyncInput,
} from "./sync-contract";

const providerKind = normalizeGpsProviderKind("GOLDCAR_PORTAL_RPA");
const runId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const operatorProfileId = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";

const options: GoldcarManualSyncOptions = {
  companyId,
  operatorProfileId,
  leaseSeconds: 120,
  maxDurationSeconds: 240,
  persistenceMaxAttempts: 3,
  persistenceRetryBaseMs: 250,
  now: () => new Date("2026-08-20T15:00:00.000Z"),
  random: () => 0,
  requestId: () => requestId,
};

function position(assetId: string, recordedAt: string): GpsPosition {
  return normalizeGpsPosition({
    provider: providerKind,
    providerAssetId: assetId,
    providerEventId: null,
    recordedAt,
    receivedAt: "2026-08-20T15:00:00.000Z",
    latitude: -13.5,
    longitude: -71.9,
  });
}

function activeRun(overrides: Partial<GpsSyncRun> = {}): GpsSyncRun {
  return {
    id: runId,
    status: "started",
    leaseExpiresAt: "2026-08-20T15:02:00.000Z",
    deadlineAt: "2026-08-20T15:04:00.000Z",
    assetsSeen: 0,
    positionsReceived: 0,
    positionsPersisted: 0,
    positionsDeduplicated: 0,
    positionsUnlinked: 0,
    sourceAttempts: 0,
    providerCheckpointAt: null,
    errorCode: null,
    ...overrides,
  };
}

class TestProvider implements GpsProvider {
  readonly kind = providerKind;
  readonly #assets: readonly GpsExternalAsset[];
  readonly #positions: ReadonlyMap<string, GpsPosition | null>;
  readonly #listError: Error | null;
  listCalls = 0;
  latestCalls = 0;

  constructor(
    assets: readonly GpsExternalAsset[],
    positions: ReadonlyMap<string, GpsPosition | null>,
    listError: Error | null = null,
  ) {
    this.#assets = assets;
    this.#positions = positions;
    this.#listError = listError;
  }

  async listAssets(): Promise<readonly GpsExternalAsset[]> {
    this.listCalls += 1;
    if (this.#listError) throw this.#listError;
    return this.#assets;
  }

  async getLatestPosition(externalAssetId: string): Promise<GpsPosition | null> {
    this.latestCalls += 1;
    return this.#positions.get(externalAssetId) ?? null;
  }

  async getPositionHistory(): Promise<readonly GpsPosition[]> {
    return [];
  }
}

class RecordingRepository implements GpsSyncRepository {
  readonly ingestResults: GpsSyncIngestResult[];
  readonly beginInputs: BeginGpsSyncRunInput[] = [];
  readonly finishInputs: FinishGpsSyncRunInput[] = [];
  readonly ingestInputs: IngestGpsPositionForSyncInput[] = [];
  heartbeatCalls = 0;
  beginError: Error | null = null;
  ingestError: Error | null = null;

  constructor(ingestResults: readonly GpsSyncIngestResult[]) {
    this.ingestResults = [...ingestResults];
  }

  async begin(input: BeginGpsSyncRunInput): Promise<GpsSyncRun> {
    this.beginInputs.push(input);
    if (this.beginError) {
      const error = this.beginError;
      this.beginError = null;
      throw error;
    }
    return activeRun();
  }

  async heartbeat(): Promise<GpsSyncRun> {
    this.heartbeatCalls += 1;
    return activeRun();
  }

  async ingest(input: IngestGpsPositionForSyncInput): Promise<GpsSyncIngestResult> {
    this.ingestInputs.push(input);
    if (this.ingestError) {
      const error = this.ingestError;
      this.ingestError = null;
      throw error;
    }
    const next = this.ingestResults.shift();
    if (!next) throw new Error("Missing test ingest result.");
    return next;
  }

  async finish(input: FinishGpsSyncRunInput): Promise<GpsSyncRun> {
    this.finishInputs.push(input);
    return activeRun({
      status: input.status,
      leaseExpiresAt: null,
      assetsSeen: input.assetsSeen,
      positionsReceived: input.positionsReceived,
      positionsPersisted: input.positionsPersisted,
      positionsDeduplicated: input.positionsDeduplicated,
      positionsUnlinked: input.positionsUnlinked,
      sourceAttempts: input.sourceAttempts,
      providerCheckpointAt: input.providerCheckpointAt,
      errorCode: input.errorCode,
    });
  }
}

function assets(...assetIds: string[]): readonly GpsExternalAsset[] {
  return assetIds.map((externalAssetId) => ({
    provider: providerKind,
    externalAssetId,
    displayName: `Asset ${externalAssetId}`,
  }));
}

describe("Goldcar manual snapshot synchronization", () => {
  it("loads the provider snapshot once and records persisted, deduplicated and empty observations honestly", async () => {
    const provider = new TestProvider(
      assets("asset-a", "asset-b", "asset-c"),
      new Map([
        ["asset-a", position("asset-a", "2026-08-20T14:58:00.000Z")],
        ["asset-b", position("asset-b", "2026-08-20T14:59:00.000Z")],
        ["asset-c", null],
      ]),
    );
    const repository = new RecordingRepository([
      { positionId: "55555555-5555-4555-8555-555555555555", disposition: "persisted" },
      { positionId: "66666666-6666-4666-8666-666666666666", disposition: "deduplicated" },
    ]);

    const summary = await runGoldcarManualSync({ provider, repository, options });

    expect(summary).toMatchObject({
      status: "succeeded",
      assetsSeen: 3,
      positionsReceived: 2,
      positionsPersisted: 1,
      positionsDeduplicated: 1,
      positionsUnlinked: 0,
      sourceAttempts: 1,
      providerCheckpointAt: "2026-08-20T14:59:00.000Z",
      errorCode: null,
    });
    expect(provider.listCalls).toBe(1);
    expect(provider.latestCalls).toBe(3);
    expect(repository.beginInputs).toMatchObject([{ companyId, operatorProfileId, requestId }]);
    expect(repository.finishInputs).toMatchObject([{ status: "succeeded", errorCode: null }]);
    expect(repository.ingestInputs).toHaveLength(2);
  });

  it("keeps processing a snapshot with unlinked assets, then records a visible failed outcome", async () => {
    const provider = new TestProvider(
      assets("linked", "unlinked"),
      new Map([
        ["linked", position("linked", "2026-08-20T14:58:00.000Z")],
        ["unlinked", position("unlinked", "2026-08-20T14:59:00.000Z")],
      ]),
    );
    const repository = new RecordingRepository([
      { positionId: "77777777-7777-4777-8777-777777777777", disposition: "persisted" },
      { positionId: null, disposition: "unlinked" },
    ]);

    const summary = await runGoldcarManualSync({ provider, repository, options });

    expect(summary).toMatchObject({
      status: "failed",
      positionsPersisted: 1,
      positionsUnlinked: 1,
      errorCode: "UNLINKED_ASSET",
    });
    expect(repository.finishInputs).toMatchObject([
      { status: "failed", errorCode: "UNLINKED_ASSET" },
    ]);
  });

  it("retries transient persistence without fetching Goldcar a second time", async () => {
    const provider = new TestProvider(
      assets("asset-a"),
      new Map([["asset-a", position("asset-a", "2026-08-20T14:58:00.000Z")]]),
    );
    const repository = new RecordingRepository([
      { positionId: "88888888-8888-4888-8888-888888888888", disposition: "persisted" },
    ]);
    repository.ingestError = new GpsSyncRepositoryError("PERSISTENCE_UNAVAILABLE", true);
    const sleeps: number[] = [];

    const summary = await runGoldcarManualSync({
      provider,
      repository,
      options: { ...options, sleep: async (milliseconds) => void sleeps.push(milliseconds) },
    });

    expect(summary.status).toBe("succeeded");
    expect(provider.listCalls).toBe(1);
    expect(repository.ingestInputs).toHaveLength(2);
    expect(sleeps).toEqual([250]);
  });

  it("retries the idempotent run start with the same request id before opening Goldcar", async () => {
    const provider = new TestProvider(
      assets("asset-a"),
      new Map([["asset-a", position("asset-a", "2026-08-20T14:58:00.000Z")]]),
    );
    const repository = new RecordingRepository([
      { positionId: "99999999-9999-4999-8999-999999999999", disposition: "persisted" },
    ]);
    repository.beginError = new GpsSyncRepositoryError("PERSISTENCE_UNAVAILABLE", true);
    const sleeps: number[] = [];

    const summary = await runGoldcarManualSync({
      provider,
      repository,
      options: { ...options, sleep: async (milliseconds) => void sleeps.push(milliseconds) },
    });

    expect(summary.status).toBe("succeeded");
    expect(repository.beginInputs).toHaveLength(2);
    expect(repository.beginInputs.map((input) => input.requestId)).toEqual([requestId, requestId]);
    expect(provider.listCalls).toBe(1);
    expect(sleeps).toEqual([250]);
  });

  it("does not retry the fragile portal source after a rate limit", async () => {
    const provider = new TestProvider(
      assets("asset-a"),
      new Map(),
      new GpsProviderError("RATE_LIMITED", "provider-only diagnostic"),
    );
    const repository = new RecordingRepository([]);

    const summary = await runGoldcarManualSync({ provider, repository, options });

    expect(summary).toMatchObject({
      status: "failed",
      sourceAttempts: 1,
      errorCode: "RATE_LIMITED",
    });
    expect(provider.listCalls).toBe(1);
    expect(provider.latestCalls).toBe(0);
    expect(repository.finishInputs).toMatchObject([
      { status: "failed", errorCode: "RATE_LIMITED" },
    ]);
  });
});
