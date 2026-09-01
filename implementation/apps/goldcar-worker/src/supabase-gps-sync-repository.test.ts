import { describe, expect, it } from "vitest";
import { normalizeGpsPosition } from "@rt-sitram/domain";
import { GpsSyncRepositoryError } from "./sync-contract";
import { SupabaseGpsSyncRepository } from "./supabase-gps-sync-repository";

const serviceRoleKey = "service-role-secret-for-test";
const run = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "started",
  lease_expires_at: "2026-08-20T15:02:00.000Z",
  deadline_at: "2026-08-20T15:04:00.000Z",
  assets_seen: 0,
  positions_received: 0,
  positions_persisted: 0,
  positions_deduplicated: 0,
  positions_unlinked: 0,
  source_attempts: 0,
  provider_checkpoint_at: null,
  error_code: null,
};

describe("Supabase GPS sync repository", () => {
  it("calls only the server RPC with the service credential and parses a sanitized run", async () => {
    const requests: { input: RequestInfo | URL; init: RequestInit | undefined }[] = [];
    const repository = new SupabaseGpsSyncRepository({
      supabaseUrl: new URL("https://project.supabase.co/"),
      serviceRoleKey,
      fetchImplementation: async (input, init) => {
        requests.push({ input, init });
        return new Response(JSON.stringify(run), { status: 200 });
      },
    });

    const result = await repository.begin({
      companyId: "22222222-2222-4222-8222-222222222222",
      providerKind: "GOLDCAR_PORTAL_RPA",
      requestId: "33333333-3333-4333-8333-333333333333",
      operatorProfileId: "44444444-4444-4444-8444-444444444444",
      leaseSeconds: 120,
      maxDurationSeconds: 240,
    });

    expect(result).toMatchObject({ id: run.id, status: "started", errorCode: null });
    expect(requests).toHaveLength(1);
    const request = requests[0]!;
    expect(String(request.input)).toBe(
      "https://project.supabase.co/rest/v1/rpc/begin_gps_sync_run",
    );
    expect(new Headers(request.init?.headers).get("Authorization")).toBe(
      `Bearer ${serviceRoleKey}`,
    );
    expect(JSON.parse(String(request.init?.body))).toMatchObject({
      p_provider_kind: "GOLDCAR_PORTAL_RPA",
      p_lease_seconds: 120,
    });
  });

  it("uses a current Supabase secret key only as an API key", async () => {
    const requests: { input: RequestInfo | URL; init: RequestInit | undefined }[] = [];
    const secretKey = "sb_secret_test-only";
    const repository = new SupabaseGpsSyncRepository({
      supabaseUrl: new URL("https://project.supabase.co/"),
      serviceRoleKey: secretKey,
      fetchImplementation: async (input, init) => {
        requests.push({ input, init });
        return new Response(JSON.stringify(run), { status: 200 });
      },
    });

    await repository.begin({
      companyId: "22222222-2222-4222-8222-222222222222",
      providerKind: "GOLDCAR_PORTAL_RPA",
      requestId: "33333333-3333-4333-8333-333333333333",
      operatorProfileId: "44444444-4444-4444-8444-444444444444",
      leaseSeconds: 120,
      maxDurationSeconds: 240,
    });

    const headers = new Headers(requests[0]?.init?.headers);
    expect(headers.get("apikey")).toBe(secretKey);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("parses the single table row returned by the ingest RPC", async () => {
    const positionId = "55555555-5555-4555-8555-555555555555";
    const repository = new SupabaseGpsSyncRepository({
      supabaseUrl: new URL("https://project.supabase.co/"),
      serviceRoleKey,
      fetchImplementation: async () =>
        new Response(JSON.stringify([{ position_id: positionId, disposition: "persisted" }]), {
          status: 200,
        }),
    });

    const result = await repository.ingest({
      runId: run.id,
      observationKey: "goldcar-observation-fingerprint",
      position: normalizeGpsPosition({
        provider: "GOLDCAR_PORTAL_RPA",
        providerAssetId: "portal-name:VDR-768",
        providerEventId: null,
        recordedAt: "2026-08-22T13:53:58.000Z",
        receivedAt: "2026-08-22T14:12:12.000Z",
        latitude: -12.1,
        longitude: -77.1,
        speedKmh: null,
        headingDegrees: null,
        altitudeMeters: null,
        ignition: null,
        odometerKm: null,
      }),
    });

    expect(result).toEqual({ positionId, disposition: "persisted" });
  });

  it("classifies rate limits as retryable without retaining a remote error body", async () => {
    const repository = new SupabaseGpsSyncRepository({
      supabaseUrl: new URL("https://project.supabase.co/"),
      serviceRoleKey,
      fetchImplementation: async () =>
        new Response(
          JSON.stringify({
            message: "https://provider.test/?token=secret provider-only-diagnostic",
          }),
          { status: 429 },
        ),
    });

    const rejected = repository.heartbeat(run.id, 120);

    await expect(rejected).rejects.toMatchObject({ code: "RATE_LIMITED", retryable: true });
    await rejected.catch((error: unknown) => {
      expect(error).toBeInstanceOf(GpsSyncRepositoryError);
      expect(error instanceof Error ? error.message : "").not.toContain("provider.test");
      expect(error instanceof Error ? error.message : "").not.toContain("secret");
    });
  });

  it("classifies an unavailable durable lease without retaining the database message", async () => {
    const repository = new SupabaseGpsSyncRepository({
      supabaseUrl: new URL("https://project.supabase.co/"),
      serviceRoleKey,
      fetchImplementation: async () =>
        new Response(
          JSON.stringify({
            code: "55P03",
            message: "another sync is active for asset portal-name:SECRET",
          }),
          { status: 409 },
        ),
    });

    const rejected = repository.heartbeat(run.id, 120);

    await expect(rejected).rejects.toMatchObject({ code: "LEASE_EXPIRED", retryable: false });
    await rejected.catch((error: unknown) => {
      expect(error instanceof Error ? error.message : "").not.toContain("portal-name:SECRET");
    });
  });

  it("fails closed when an RPC returns a malformed JSON body", async () => {
    const repository = new SupabaseGpsSyncRepository({
      supabaseUrl: new URL("https://project.supabase.co/"),
      serviceRoleKey,
      fetchImplementation: async () => new Response("not-json", { status: 200 }),
    });

    await expect(repository.heartbeat(run.id, 120)).rejects.toMatchObject({
      code: "PERSISTENCE_ERROR",
      retryable: false,
    });
  });
});
