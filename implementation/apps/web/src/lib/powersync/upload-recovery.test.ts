import { UpdateType, type CommonPowerSyncDatabase } from "@powersync/web";
import { describe, expect, it, vi } from "vitest";
import {
  classifyUploadFailure,
  discardUploadDeadLetter,
  isRepairableLegacyUpload,
  recordUploadDeadLetter,
  retryUploadDeadLetter,
  uploadFailureMessage,
  type UploadDeadLetterRow,
} from "./upload-recovery";

const entryId = "10000000-0000-4000-8000-000000000001";
const tripId = "10000000-0000-4000-8000-000000000002";

function row(overrides: Partial<UploadDeadLetterRow> = {}): UploadDeadLetterRow {
  return {
    id: `trip_transition_requests:${entryId}`,
    source_table: "trip_transition_requests",
    source_record_id: entryId,
    operation: String(UpdateType.PUT),
    op_data_json: JSON.stringify({
      trip_id: tripId,
      requested_action: "arrive",
      odometer_km: null,
      cargo_delivered: 0,
      occurred_at: "2026-08-13T15:00:00.000Z",
      source_device_id: "android-a",
      created_at: "2026-08-13T15:00:00.000Z",
    }),
    error_code: "P0001",
    error_message: "Invalid trip transition.",
    status: "pending_review",
    attempts: 1,
    first_failed_at: "2026-08-13T15:01:00.000Z",
    last_failed_at: "2026-08-13T15:01:00.000Z",
    resolved_at: null,
    resolution: null,
    resolution_note: null,
    retry_record_id: null,
    ...overrides,
  };
}

describe("terminal upload recovery service", () => {
  it("classifies only proven validation/business errors as terminal", () => {
    expect(
      classifyUploadFailure(new Error("PowerSync upload rejected: invalid UUID.")),
    ).toMatchObject({
      kind: "terminal",
    });
    expect(classifyUploadFailure({ code: "P0001", message: "Invalid transition" })).toMatchObject({
      kind: "terminal",
    });
    expect(classifyUploadFailure(new TypeError("Failed to fetch"))).toMatchObject({
      kind: "retryable",
    });
    expect(classifyUploadFailure(new Error("Unknown infrastructure failure"))).toMatchObject({
      kind: "retryable",
    });
  });

  it("persists the complete failed mutation before queue completion", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    await recordUploadDeadLetter(
      { execute } as unknown as Pick<CommonPowerSyncDatabase, "execute">,
      {
        id: entryId,
        op: UpdateType.PUT,
        table: "trip_transition_requests",
        opData: JSON.parse(row().op_data_json),
      },
      { kind: "terminal", code: "P0001", message: "Invalid transition" },
      new Date("2026-08-13T15:01:00.000Z"),
    );

    expect(execute).toHaveBeenCalledTimes(2);
    expect(String(execute.mock.calls[0]?.[0])).toContain("UPDATE upload_dead_letters");
    expect(String(execute.mock.calls[1]?.[0])).toContain("INSERT INTO upload_dead_letters");
    expect(String(execute.mock.calls[1]?.[0])).not.toContain("ON CONFLICT");
    expect(execute.mock.calls[1]?.[1]).toContain(row().op_data_json);
  });

  it("requires confirmation and requeues a validated copy with a new id", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = {
      execute,
      getAll: vi.fn(async <T>() => [row()] as T[]),
      writeTransaction: async (
        callback: (transaction: { execute: typeof execute }) => Promise<unknown>,
      ) => callback({ execute }),
    };

    const recoveryDatabase = database as unknown as Parameters<typeof retryUploadDeadLetter>[0];
    await expect(retryUploadDeadLetter(recoveryDatabase, row().id, false)).rejects.toThrow(
      "Confirma",
    );
    const retryId = await retryUploadDeadLetter(
      recoveryDatabase,
      row().id,
      true,
      new Date("2026-08-13T16:00:00.000Z"),
    );

    expect(retryId).not.toBe(entryId);
    expect(String(execute.mock.calls[0]?.[0])).toContain("INSERT INTO trip_transition_requests");
    expect(String(execute.mock.calls[1]?.[0])).toContain("status = 'retry_queued'");
  });

  it("repairs legacy shifted fuel fields and relinks pending evidence on retry", async () => {
    const originalEntityId = "10000000-0000-4000-8000-000000000009";
    const legacyFuel = row({
      id: `fuel_entries:${tripId}`,
      source_table: "fuel_entries",
      source_record_id: tripId,
      error_message: "PowerSync upload rejected: quantity must be greater than zero.",
      op_data_json: JSON.stringify({
        trip_id: "10000000-0000-4000-8000-000000000003",
        supplier_id: "2026-08-13T14:30:00.000Z",
        fueled_at: "Cusco",
        location: 10_000,
        odometer_km: 10,
        quantity: "gallon",
        volume_unit: 15,
        unit_price: 150,
        total_amount: "PEN",
        receipt_number: "android-a",
        source_device_id: originalEntityId,
        idempotency_key: "2026-08-13T15:00:00.000Z",
        created_at: "2026-08-13T15:00:00.000Z",
      }),
    });
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = {
      execute,
      getAll: vi.fn(async <T>() => [legacyFuel] as T[]),
      writeTransaction: async (
        callback: (transaction: { execute: typeof execute }) => Promise<unknown>,
      ) => callback({ execute }),
    } as unknown as Parameters<typeof retryUploadDeadLetter>[0];

    expect(isRepairableLegacyUpload(legacyFuel)).toBe(true);
    expect(uploadFailureMessage(legacyFuel)).toContain("versión anterior");
    const retryId = await retryUploadDeadLetter(
      database,
      legacyFuel.id,
      true,
      new Date("2026-08-13T16:00:00.000Z"),
    );

    const insertParameters = execute.mock.calls[0]?.[1] ?? [];
    expect(insertParameters[0]).toBe(retryId);
    expect(insertParameters[1]).toBe(tripId);
    expect(insertParameters[7]).toBe(10);
    expect(insertParameters[8]).toBe("gallon");
    expect(insertParameters[9]).toBe(15);
    expect(insertParameters[10]).toBe(150);
    expect(insertParameters[11]).toBe("PEN");
    expect(insertParameters[16]).toBe(retryId);

    expect(String(execute.mock.calls[1]?.[0])).toContain("UPDATE attachment_queue");
    expect(execute.mock.calls[1]?.[1]).toEqual([
      retryId,
      "2026-08-13T16:00:00.000Z",
      "fuel_entry",
      tripId,
      originalEntityId,
    ]);
    expect(execute.mock.calls[2]?.[1]).toContain(
      "Copia corregida y reintento confirmado por el usuario.",
    );
  });

  it.each([
    {
      label: "expense",
      legacy: row({
        id: "expenses:trip",
        source_table: "expenses",
        source_record_id: "trip",
        error_message: "PowerSync upload rejected: assignment_type has an unsupported value.",
        op_data_json: JSON.stringify({
          assignment_type: tripId,
          trip_id: "10000000-0000-4000-8000-000000000003",
          vehicle_id: "10000000-0000-4000-8000-000000000004",
          supplier_id: "2026-08-13T14:30:00.000Z",
          incurred_at: 42.5,
          amount: "PEN",
          receipt_number: "Peaje",
          description: "driver_mobile",
          source: "android-a",
          source_device_id: "10000000-0000-4000-8000-000000000009",
          idempotency_key: "2026-08-13T15:00:00.000Z",
          created_at: "2026-08-13T15:00:00.000Z",
        }),
      }),
    },
    {
      label: "incident",
      legacy: row({
        id: `incidents:${tripId}`,
        source_table: "incidents",
        source_record_id: tripId,
        error_message: "PowerSync upload rejected: occurred_at is required.",
        op_data_json: JSON.stringify({
          trip_id: "10000000-0000-4000-8000-000000000003",
          vehicle_id: "2026-08-13T14:30:00.000Z",
          occurred_at: "Cusco",
          location: "delay",
          incident_type: "high",
          severity: "Bloqueo en la vía",
          description: "Se tomó un desvío",
          action_taken: "android-a",
          source_device_id: "10000000-0000-4000-8000-000000000009",
          idempotency_key: "2026-08-13T15:00:00.000Z",
          created_at: "2026-08-13T15:00:00.000Z",
        }),
      }),
    },
  ])("repairs a legacy shifted $label before queuing its copy", async ({ legacy }) => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = {
      execute,
      getAll: vi.fn(async <T>() => [legacy] as T[]),
      writeTransaction: async (
        callback: (transaction: { execute: typeof execute }) => Promise<unknown>,
      ) => callback({ execute }),
    } as unknown as Parameters<typeof retryUploadDeadLetter>[0];

    expect(isRepairableLegacyUpload(legacy)).toBe(true);
    await expect(retryUploadDeadLetter(database, legacy.id, true)).resolves.toMatch(
      /^[0-9a-f-]{36}$/i,
    );
    expect(String(execute.mock.calls[0]?.[0])).toContain(`INSERT INTO ${legacy.source_table}`);
  });

  it("requires an explicit reason before an irreversible discard", async () => {
    const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
    const database = {
      execute,
      getAll: vi.fn(async <T>() => [row()] as T[]),
    } as unknown as Parameters<typeof discardUploadDeadLetter>[0];

    await expect(discardUploadDeadLetter(database, row().id, true, "")).rejects.toThrow("por qué");
    await discardUploadDeadLetter(
      database,
      row().id,
      true,
      "Registro duplicado confirmado",
      new Date("2026-08-13T16:00:00.000Z"),
    );

    expect(String(execute.mock.calls[0]?.[0])).toContain("status = 'discarded'");
    expect(execute.mock.calls[0]?.[1]).toContain("Registro duplicado confirmado");
  });
});
