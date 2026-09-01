import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase";
import { canViewGpsTelemetry, createSupabaseGpsContextGateway } from "./gps-context-data";

type GpsContextRow = Database["public"]["Views"]["vehicle_gps_context"]["Row"];
type GpsFleetContextRow = Pick<GpsContextRow, "vehicle_id" | "recorded_at" | "received_at">;

function clientWithGpsContext(response: {
  readonly data: GpsContextRow | null;
  readonly error: unknown;
}) {
  const maybeSingle = vi.fn(() => Promise.resolve(response));
  const eqProvider = vi.fn(() => ({ maybeSingle }));
  const eqVehicle = vi.fn(() => ({ eq: eqProvider }));
  const select = vi.fn(() => ({ eq: eqVehicle }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    select,
    eqVehicle,
    eqProvider,
  };
}

function clientWithGpsFleetContext(response: {
  readonly data: readonly GpsFleetContextRow[] | null;
  readonly error: unknown;
}) {
  const eqProvider = vi.fn(() => Promise.resolve(response));
  const select = vi.fn(() => ({ eq: eqProvider }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    select,
    eqProvider,
  };
}

describe("GPS context data gateway", () => {
  it("requests only the narrow GPS projection and returns normalized evidence", async () => {
    const fixture = clientWithGpsContext({
      data: {
        vehicle_id: "vehicle-a",
        provider_kind: "GOLDCAR_PORTAL_RPA",
        recorded_at: "2026-08-22T09:40:23.000Z",
        received_at: "2026-08-22T09:41:00.000Z",
        speed_kmh: 21,
        ignition: true,
        odometer_km: 12_874,
      },
      error: null,
    });

    await expect(
      createSupabaseGpsContextGateway(fixture.client).load("vehicle-a"),
    ).resolves.toEqual({
      kind: "SIGNAL",
      signal: {
        recordedAt: "2026-08-22T09:40:23.000Z",
        speedKmh: 21,
        ignition: true,
        odometerKm: 12_874,
      },
    });

    expect(fixture.from).toHaveBeenCalledWith("vehicle_gps_context");
    expect(fixture.select).toHaveBeenCalledWith(
      "vehicle_id, recorded_at, received_at, speed_kmh, ignition, odometer_km",
    );
    expect(fixture.eqVehicle).toHaveBeenCalledWith("vehicle_id", "vehicle-a");
    expect(fixture.eqProvider).toHaveBeenCalledWith("provider_kind", "GOLDCAR_PORTAL_RPA");
  });

  it("distinguishes no approved link from an active link without a signal", async () => {
    const noLink = createSupabaseGpsContextGateway(
      clientWithGpsContext({ data: null, error: null }).client,
    );
    const noSignal = createSupabaseGpsContextGateway(
      clientWithGpsContext({
        data: {
          vehicle_id: "vehicle-a",
          provider_kind: "GOLDCAR_PORTAL_RPA",
          recorded_at: null,
          received_at: null,
          speed_kmh: null,
          ignition: null,
          odometer_km: null,
        },
        error: null,
      }).client,
    );

    await expect(noLink.load("vehicle-a")).resolves.toEqual({ kind: "NO_LINK" });
    await expect(noSignal.load("vehicle-a")).resolves.toEqual({ kind: "NO_SIGNAL" });
  });

  it("fails closed without surfacing remote errors or malformed telemetry", async () => {
    const remoteFailure = createSupabaseGpsContextGateway(
      clientWithGpsContext({ data: null, error: { message: "secret upstream response" } }).client,
    );
    const malformed = createSupabaseGpsContextGateway(
      clientWithGpsContext({
        data: {
          vehicle_id: "vehicle-a",
          provider_kind: "GOLDCAR_PORTAL_RPA",
          recorded_at: "not-a-date",
          received_at: "2026-08-22T09:41:00.000Z",
          speed_kmh: null,
          ignition: null,
          odometer_km: null,
        },
        error: null,
      }).client,
    );

    await expect(remoteFailure.load("vehicle-a")).resolves.toEqual({
      kind: "UNAVAILABLE",
      reason: "REMOTE",
    });
    await expect(malformed.load("vehicle-a")).resolves.toEqual({
      kind: "UNAVAILABLE",
      reason: "REMOTE",
    });
  });

  it("reports only safe linked signal states from the narrow context view", async () => {
    const fixture = clientWithGpsFleetContext({
      data: [
        {
          vehicle_id: "vehicle-a",
          recorded_at: "2026-08-22T09:40:23.000Z",
          received_at: "2026-08-22T09:41:00.000Z",
        },
        { vehicle_id: "vehicle-b", recorded_at: null, received_at: null },
      ],
      error: null,
    });

    await expect(
      createSupabaseGpsContextGateway(fixture.client).loadFleetContext(),
    ).resolves.toEqual({
      kind: "READY",
      linkedVehicles: [
        { vehicleId: "vehicle-a", hasSignal: true },
        { vehicleId: "vehicle-b", hasSignal: false },
      ],
    });

    expect(fixture.from).toHaveBeenCalledWith("vehicle_gps_context");
    expect(fixture.select).toHaveBeenCalledWith("vehicle_id, recorded_at, received_at");
    expect(fixture.eqProvider).toHaveBeenCalledWith("provider_kind", "GOLDCAR_PORTAL_RPA");
  });

  it("fails closed when a fleet context response is malformed or remote fails", async () => {
    const malformed = createSupabaseGpsContextGateway(
      clientWithGpsFleetContext({
        data: [
          {
            vehicle_id: "vehicle-a",
            recorded_at: "not-a-date",
            received_at: "2026-08-22T09:41:00.000Z",
          },
        ],
        error: null,
      }).client,
    );
    const remoteFailure = createSupabaseGpsContextGateway(
      clientWithGpsFleetContext({ data: null, error: { message: "provider payload" } }).client,
    );

    await expect(malformed.loadFleetContext()).resolves.toEqual({
      kind: "UNAVAILABLE",
      reason: "REMOTE",
    });
    await expect(remoteFailure.loadFleetContext()).resolves.toEqual({
      kind: "UNAVAILABLE",
      reason: "REMOTE",
    });
  });
});

describe("GPS context role guard", () => {
  it("allows only the roles that may read GPS evidence", () => {
    expect(canViewGpsTelemetry("management")).toBe(true);
    expect(canViewGpsTelemetry("administration")).toBe(true);
    expect(canViewGpsTelemetry("accounting")).toBe(false);
    expect(canViewGpsTelemetry("driver")).toBe(false);
  });
});
