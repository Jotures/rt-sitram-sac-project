import type { CommonPowerSyncDatabase } from "@powersync/web";
import { describe, expect, it, vi } from "vitest";
import {
  enqueueTripTransition,
  enqueueTripStartWithLoadState,
  recordExpenseOffline,
  recordFuelOffline,
  recordTripLoadStateOffline,
  reportIncidentOffline,
} from "./product-writes";

const tripId = "10000000-0000-4000-8000-000000000002";
const vehicleId = "10000000-0000-4000-8000-000000000003";
const categoryId = "10000000-0000-4000-8000-000000000004";
const now = new Date("2026-08-13T15:00:00.000Z");

describe("offline product writes", () => {
  it("queues attachment metadata separately from a fuel entry", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = {
      execute,
      writeTransaction: async (callback: (tx: { execute: typeof execute }) => Promise<unknown>) =>
        callback({ execute }),
    } as unknown as CommonPowerSyncDatabase;

    await recordFuelOffline(
      database,
      {
        tripId,
        vehicleId,
        fueledAt: now.toISOString(),
        odometerKm: 10_000,
        quantity: 10,
        volumeUnit: "gallon",
        unitPrice: 15,
        totalAmount: 150,
        attachment: {
          localUri: "opfs://evidence/fuel.jpg",
          originalName: "comprobante.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 120_000,
        },
      },
      { sourceDeviceId: "android-a", now },
    );

    expect(execute).toHaveBeenCalledTimes(2);
    expect(String(execute.mock.calls[0]?.[0])).toContain("INSERT INTO fuel_entries");
    const fuelParameters = execute.mock.calls[0]?.[1] ?? [];
    expect(fuelParameters).toHaveLength(19);
    expect(fuelParameters[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(fuelParameters[1]).toBe(tripId);
    expect(fuelParameters[2]).toBe(vehicleId);
    expect(fuelParameters[7]).toBe(10);
    expect(fuelParameters[8]).toBe("gallon");
    expect(fuelParameters[16]).toBe(fuelParameters[0]);
    expect(String(execute.mock.calls[1]?.[0])).toContain("INSERT INTO attachment_queue");
    expect(String(execute.mock.calls[1]?.[0])).not.toContain("blob");
  });

  it("binds expense identity and business fields to their declared columns", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = { execute } as unknown as CommonPowerSyncDatabase;

    await recordExpenseOffline(
      database,
      {
        tripId,
        vehicleId,
        categoryId,
        incurredAt: now.toISOString(),
        amount: 42.5,
        description: "Peaje",
      },
      { sourceDeviceId: "android-a", now },
    );

    const parameters = execute.mock.calls[0]?.[1] ?? [];
    expect(parameters).toHaveLength(17);
    expect(parameters[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(parameters[1]).toBe("trip");
    expect(parameters[2]).toBe(tripId);
    expect(parameters[4]).toBe(categoryId);
    expect(parameters[7]).toBe(42.5);
    expect(parameters[14]).toBe(parameters[0]);
  });

  it("binds incident identity and business fields to their declared columns", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = { execute } as unknown as CommonPowerSyncDatabase;

    await reportIncidentOffline(
      database,
      {
        tripId,
        vehicleId,
        occurredAt: now.toISOString(),
        incidentType: "delay",
        severity: "high",
        description: "Bloqueo en la vía",
      },
      { sourceDeviceId: "android-a", now },
    );

    const parameters = execute.mock.calls[0]?.[1] ?? [];
    expect(parameters).toHaveLength(13);
    expect(parameters[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(parameters[1]).toBe(tripId);
    expect(parameters[2]).toBe(vehicleId);
    expect(parameters[5]).toBe("delay");
    expect(parameters[6]).toBe("high");
    expect(parameters[10]).toBe(parameters[0]);
  });

  it("validates an incident before creating a local row", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = { execute } as unknown as CommonPowerSyncDatabase;

    await expect(
      reportIncidentOffline(
        database,
        {
          tripId: "not-a-uuid",
          vehicleId,
          occurredAt: now.toISOString(),
          incidentType: "delay",
          severity: "high",
          description: "Bloqueo en la vía",
        },
        { sourceDeviceId: "android-a", now },
      ),
    ).rejects.toThrow("trip_id must be a UUID");
    expect(execute).not.toHaveBeenCalled();
  });

  it("queues a pending driver transition in SQLite", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = { execute } as unknown as CommonPowerSyncDatabase;

    await enqueueTripTransition(
      database,
      { tripId, action: "complete", odometerKm: 10_100, cargoDelivered: true },
      { sourceDeviceId: "android-a", now },
    );

    expect(String(execute.mock.calls[0]?.[0])).toContain("INSERT INTO trip_transition_requests");
  });

  it("writes the start transition and explicit initial load state atomically", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = {
      execute,
      writeTransaction: async (callback: (tx: { execute: typeof execute }) => Promise<unknown>) =>
        callback({ execute }),
    } as unknown as CommonPowerSyncDatabase;

    await enqueueTripStartWithLoadState(
      database,
      { tripId, vehicleId, action: "start", odometerKm: 10_000, loadState: "loaded" },
      { sourceDeviceId: "android-a", now },
    );

    expect(String(execute.mock.calls[0]?.[0])).toContain("INSERT INTO trip_transition_requests");
    expect(String(execute.mock.calls[1]?.[0])).toContain("INSERT INTO trip_load_state_events");
  });

  it("queues a later explicit empty segment without GPS inference", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = { execute } as unknown as CommonPowerSyncDatabase;
    await recordTripLoadStateOffline(
      database,
      { tripId, vehicleId, loadState: "empty", odometerKm: 10_100 },
      { sourceDeviceId: "android-a", now },
    );
    expect(String(execute.mock.calls[0]?.[0])).toContain("trip_load_state_events");
  });
});
