import { describe, expect, it } from "vitest";
import {
  deriveGpsFreshness,
  getGpsPositionFingerprint,
  isGpsPositionNewer,
  normalizeGpsPosition,
  normalizeGpsProviderKind,
  selectLatestGpsPosition,
  type GpsPositionInput,
} from "./gps";

const receivedAt = "2026-08-20T15:04:01.000Z";
const testProvider = normalizeGpsProviderKind("TEST_GPS");

function position(overrides: Partial<GpsPositionInput> = {}) {
  return normalizeGpsPosition({
    provider: testProvider,
    providerAssetId: "unit-271",
    providerEventId: "message-001",
    recordedAt: "2026-08-20T15:03:59.000Z",
    receivedAt,
    latitude: -13.5,
    longitude: -71.9,
    speedKmh: 0,
    headingDegrees: 0,
    altitudeMeters: 3_200,
    ignition: false,
    odometerKm: 98_585,
    ...overrides,
  });
}

describe("GPS evidence domain", () => {
  it("normalizes a provider-neutral position and preserves optional evidence", () => {
    const result = position({ providerEventId: "  event-42  " });

    expect(result).toMatchObject({
      provider: testProvider,
      providerAssetId: "unit-271",
      providerEventId: "event-42",
      recordedAt: "2026-08-20T15:03:59.000Z",
      ignition: false,
      odometerKm: 98_585,
    });
    expect(getGpsPositionFingerprint(result)).toBe("TEST_GPS:unit-271:event:event-42");
  });

  it("rejects malformed coordinates, timestamps and physical values instead of inventing data", () => {
    expect(() => position({ latitude: -91 })).toThrow("latitud");
    expect(() => position({ longitude: 181 })).toThrow("longitud");
    expect(() => position({ speedKmh: -1 })).toThrow("velocidad");
    expect(() => position({ headingDegrees: 360 })).toThrow("rumbo");
    expect(() => position({ recordedAt: "2026-08-20 15:03:59" })).toThrow("ISO 8601");
    expect(() => position({ provider: "test-gps" })).toThrow("identificador del proveedor");
  });

  it("creates a stable fallback fingerprint when a provider omits an event identifier", () => {
    const withoutEvent = position({ providerEventId: null });
    const moved = position({ providerEventId: null, longitude: -71.899 });

    expect(getGpsPositionFingerprint(withoutEvent)).toBe(
      "TEST_GPS:unit-271:sample:2026-08-20T15:03:59.000Z:-13.5000000:-71.9000000:0.000:0.000:98585.000",
    );
    expect(getGpsPositionFingerprint(moved)).not.toBe(getGpsPositionFingerprint(withoutEvent));
  });

  it("keeps freshness separate from vehicle movement and exposes clock skew", () => {
    expect(
      deriveGpsFreshness({
        recordedAt: "2026-08-20T15:03:59.000Z",
        now: "2026-08-20T15:04:30.000Z",
        staleAfterMs: 60_000,
        futureToleranceMs: 5_000,
      }),
    ).toBe("FRESH");
    expect(
      deriveGpsFreshness({
        recordedAt: "2026-08-20T15:03:59.000Z",
        now: "2026-08-20T15:10:00.000Z",
        staleAfterMs: 60_000,
        futureToleranceMs: 5_000,
      }),
    ).toBe("STALE");
    expect(
      deriveGpsFreshness({
        recordedAt: "2026-08-20T15:04:10.000Z",
        now: "2026-08-20T15:04:00.000Z",
        staleAfterMs: 60_000,
        futureToleranceMs: 5_000,
      }),
    ).toBe("CLOCK_SKEW");
  });

  it("does not let a late observation move the latest-position projection backwards", () => {
    const current = position();
    const older = position({
      providerEventId: "message-older",
      recordedAt: "2026-08-20T15:02:59.000Z",
      receivedAt: "2026-08-20T15:05:00.000Z",
    });
    const sameRecordedLaterReceived = position({
      providerEventId: "message-replayed",
      receivedAt: "2026-08-20T15:04:02.000Z",
    });

    expect(isGpsPositionNewer(older, current)).toBe(false);
    expect(selectLatestGpsPosition(current, older)).toBe(current);
    expect(isGpsPositionNewer(sameRecordedLaterReceived, current)).toBe(true);
    expect(selectLatestGpsPosition(current, sameRecordedLaterReceived)).toBe(
      sameRecordedLaterReceived,
    );
  });

  it("never compares evidence from different external assets as if it were one unit", () => {
    const current = position();
    const otherAsset = position({ providerAssetId: "unit-270" });

    expect(() => isGpsPositionNewer(otherAsset, current)).toThrow("misma unidad externa");
  });
});
