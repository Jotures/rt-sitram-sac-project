import { describe, expect, it } from "vitest";
import { normalizeGpsPosition, normalizeGpsProviderKind } from "@rt-sitram/domain";
import { GpsProviderError } from "./contract";
import { FakeGpsProvider } from "./fake-provider";
import { GpsProviderRegistry } from "./provider-registry";

const testProvider = normalizeGpsProviderKind("TEST_GPS");

function makePosition(recordedAt: string) {
  return normalizeGpsPosition({
    provider: testProvider,
    providerAssetId: "gps-271",
    providerEventId: null,
    recordedAt,
    receivedAt: "2026-08-20T15:05:00.000Z",
    latitude: -13.5,
    longitude: -71.9,
  });
}

function createProvider() {
  return new FakeGpsProvider(testProvider, {
    assets: [
      {
        provider: testProvider,
        externalAssetId: "gps-271",
        displayName: "Unidad de prueba 271",
      },
    ],
    positionsByAssetId: {
      "gps-271": [
        makePosition("2026-08-20T15:03:00.000Z"),
        makePosition("2026-08-20T15:01:00.000Z"),
      ],
    },
  });
}

describe("GPS provider contract", () => {
  it("requires an explicit provider registration instead of guessing a portal integration", () => {
    const registry = new GpsProviderRegistry();

    expect(() => registry.resolve(testProvider)).toThrow(GpsProviderError);
    expect(() => registry.resolve(testProvider)).toThrow("adaptador GPS habilitado");
  });

  it("returns only explicitly configured external assets and never maps an unknown asset", async () => {
    const provider = createProvider();

    await expect(provider.listAssets()).resolves.toEqual([
      {
        provider: testProvider,
        externalAssetId: "gps-271",
        displayName: "Unidad de prueba 271",
      },
    ]);
    await expect(provider.getLatestPosition("gps-unknown")).rejects.toMatchObject({
      code: "ASSET_NOT_FOUND",
    });
  });

  it("uses a bounded and chronologically ordered history query", async () => {
    const provider = createProvider();

    await expect(
      provider.getPositionHistory({
        externalAssetId: "gps-271",
        from: new Date("2026-08-20T15:00:00.000Z"),
        to: new Date("2026-08-20T15:04:00.000Z"),
        limit: 1,
      }),
    ).resolves.toMatchObject([{ recordedAt: "2026-08-20T15:01:00.000Z" }]);

    await expect(
      provider.getPositionHistory({
        externalAssetId: "gps-271",
        from: new Date("2026-08-20T15:04:00.000Z"),
        to: new Date("2026-08-20T15:00:00.000Z"),
        limit: 10,
      }),
    ).rejects.toThrow("rango de historial");
  });

  it("keeps the latest projection deterministic when a replay has the same provider time", async () => {
    const provider = new FakeGpsProvider(testProvider, {
      assets: [
        {
          provider: testProvider,
          externalAssetId: "gps-271",
          displayName: "Unidad de prueba 271",
        },
      ],
      positionsByAssetId: {
        "gps-271": [
          makePosition("2026-08-20T15:03:00.000Z"),
          normalizeGpsPosition({
            provider: testProvider,
            providerAssetId: "gps-271",
            providerEventId: "replayed-event",
            recordedAt: "2026-08-20T15:03:00.000Z",
            receivedAt: "2026-08-20T15:06:00.000Z",
            latitude: -13.5,
            longitude: -71.9,
          }),
        ],
      },
    });

    await expect(provider.getLatestPosition("gps-271")).resolves.toMatchObject({
      providerEventId: "replayed-event",
    });
  });

  it("does not allow duplicate provider registrations", () => {
    const provider = createProvider();
    const registry = new GpsProviderRegistry([provider]);

    expect(() => registry.register(provider)).toThrow("ya está registrado");
  });
});
