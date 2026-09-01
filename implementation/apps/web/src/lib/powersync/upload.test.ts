import { UpdateType } from "@powersync/web";
import { describe, expect, it } from "vitest";
import { mapProductUpload } from "./upload";

const ids = {
  entry: "10000000-0000-4000-8000-000000000001",
  trip: "10000000-0000-4000-8000-000000000002",
  vehicle: "10000000-0000-4000-8000-000000000003",
  category: "10000000-0000-4000-8000-000000000004",
};

describe("PowerSync product upload allowlist", () => {
  it("maps an odometer insert to an auth-bound RPC without company or actor IDs", () => {
    const mutation = mapProductUpload({
      id: ids.entry,
      op: UpdateType.PUT,
      table: "odometer_entries",
      opData: {
        trip_id: ids.trip,
        vehicle_id: ids.vehicle,
        reading_km: 428_320,
        reading_at: "2026-08-13T15:00:00.000Z",
        reading_type: "current",
        source_device_id: "android-a",
      },
    });

    expect(mutation).toMatchObject({
      rpc: "record_odometer_entry",
      table: "odometer_entries",
      args: {
        p_id: ids.entry,
        p_idempotency_key: ids.entry,
        p_trip_id: ids.trip,
        p_reading_km: 428_320,
      },
    });
    expect(Object.keys(mutation.args)).not.toContain("company_id");
    expect(Object.keys(mutation.args)).not.toContain("created_by");
    expect(Object.keys(mutation.args)).not.toContain("driver_id");
  });

  it("validates fuel arithmetic before calling the backend", () => {
    expect(() =>
      mapProductUpload({
        id: ids.entry,
        op: UpdateType.PUT,
        table: "fuel_entries",
        opData: {
          trip_id: ids.trip,
          vehicle_id: ids.vehicle,
          fueled_at: "2026-08-13T15:00:00.000Z",
          odometer_km: 428_320,
          quantity: 10,
          volume_unit: "gallon",
          unit_price: 15,
          total_amount: 175,
        },
      }),
    ).toThrow("fuel total does not match");
  });

  it("maps a driver trip expense with conservative defaults", () => {
    expect(
      mapProductUpload({
        id: ids.entry,
        op: UpdateType.PUT,
        table: "expenses",
        opData: {
          assignment_type: "trip",
          trip_id: ids.trip,
          category_id: ids.category,
          incurred_at: "2026-08-13T15:00:00.000Z",
          amount: 35,
          source: "driver_mobile",
        },
      }),
    ).toMatchObject({
      rpc: "record_expense",
      args: {
        p_trip_id: ids.trip,
        p_amount: 35,
        p_currency: "PEN",
      },
    });
  });

  it("rejects company and actor spoofing as unexpected fields", () => {
    for (const forbiddenField of ["company_id", "created_by", "driver_id"]) {
      expect(() =>
        mapProductUpload({
          id: ids.entry,
          op: UpdateType.PUT,
          table: "odometer_entries",
          opData: {
            trip_id: ids.trip,
            vehicle_id: ids.vehicle,
            reading_km: 1,
            reading_at: "2026-08-13T15:00:00.000Z",
            reading_type: "current",
            [forbiddenField]: ids.entry,
          },
        }),
      ).toThrow(`unexpected field ${forbiddenField}`);
    }
  });

  it("rejects non-allowlisted tables and all updates or deletes", () => {
    expect(() =>
      mapProductUpload({
        id: ids.entry,
        op: UpdateType.PUT,
        opData: {},
        table: "profiles",
      }),
    ).toThrow("unsupported table profiles");

    expect(() =>
      mapProductUpload({
        id: ids.entry,
        op: UpdateType.PATCH,
        opData: { amount: 99 },
        table: "expenses",
      }),
    ).toThrow("append-only");

    expect(() =>
      mapProductUpload({
        id: ids.entry,
        op: UpdateType.DELETE,
        table: "incidents",
      }),
    ).toThrow("append-only");
  });

  it("requires an incident to be scoped to an assigned trip", () => {
    expect(() =>
      mapProductUpload({
        id: ids.entry,
        op: UpdateType.PUT,
        table: "incidents",
        opData: {
          occurred_at: "2026-08-13T15:00:00.000Z",
          incident_type: "delay",
          severity: "medium",
          description: "Bloqueo en la vía",
        },
      }),
    ).toThrow("trip_id is required");
  });

  it("maps an offline transition without accepting company, actor, or version", () => {
    const mutation = mapProductUpload({
      id: ids.entry,
      op: UpdateType.PUT,
      table: "trip_transition_requests",
      opData: {
        trip_id: ids.trip,
        requested_action: "complete",
        odometer_km: 428_500,
        cargo_delivered: 1,
        occurred_at: "2026-08-13T18:00:00.000Z",
        source_device_id: "android-a",
      },
    });
    expect(mutation).toMatchObject({
      rpc: "apply_driver_trip_transition",
      args: {
        p_request_id: ids.entry,
        p_trip_id: ids.trip,
        p_action: "complete",
        p_cargo_delivered: true,
      },
    });
    expect(Object.keys(mutation.args)).not.toContain("company_id");
    expect(Object.keys(mutation.args)).not.toContain("expected_version");
  });

  it("maps an explicit loaded or empty segment to the append-only command", () => {
    expect(
      mapProductUpload({
        id: ids.entry,
        op: UpdateType.PUT,
        table: "trip_load_state_events",
        opData: {
          trip_id: ids.trip,
          vehicle_id: ids.vehicle,
          load_state: "empty",
          effective_at: "2026-08-13T18:00:00.000Z",
          odometer_km: 428_500,
          source_device_id: "android-a",
          idempotency_key: ids.entry,
          supersedes_event_id: null,
          correction_reason: null,
        },
      }),
    ).toMatchObject({
      rpc: "record_trip_load_state_event",
      args: { p_trip_id: ids.trip, p_load_state: "empty", p_odometer_km: 428_500 },
    });
  });
});
