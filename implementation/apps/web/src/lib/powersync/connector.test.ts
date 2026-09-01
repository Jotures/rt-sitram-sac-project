import { UpdateType, type CommonPowerSyncDatabase, type CrudEntry } from "@powersync/web";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../supabase";
import { SupabasePowerSyncConnector } from "./connector";

const ids = {
  invalid: "10000000-0000-4000-8000-000000000001",
  valid: "10000000-0000-4000-8000-000000000002",
  trip: "10000000-0000-4000-8000-000000000003",
  category: "10000000-0000-4000-8000-000000000004",
};

function expense(id: string, tripId = ids.trip): CrudEntry {
  return {
    id,
    op: UpdateType.PUT,
    table: "expenses",
    opData: {
      assignment_type: "trip",
      trip_id: tripId,
      category_id: ids.category,
      incurred_at: "2026-08-13T15:00:00.000Z",
      amount: 20,
      source: "driver_mobile",
    },
  } as unknown as CrudEntry;
}

function client(rpc: ReturnType<typeof vi.fn>): SupabaseClient<Database> {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-a" } }, error: null })),
    },
    rpc,
  } as unknown as SupabaseClient<Database>;
}

function database(crud: CrudEntry[]) {
  const complete = vi.fn(async () => undefined);
  const execute = vi.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 1 }));
  const value = {
    execute,
    getCrudBatch: vi.fn(async () => ({ crud, haveMore: false, complete })),
  } as unknown as CommonPowerSyncDatabase;

  return { complete, execute, value };
}

describe("PowerSync upload recovery", () => {
  it("dead-letters a terminal entry and continues the rest of the batch", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const local = database([expense(ids.invalid, "not-a-uuid"), expense(ids.valid)]);
    const connector = new SupabasePowerSyncConnector(client(rpc), "https://sync.example.test");

    await connector.uploadData(local.value);

    expect(local.execute).toHaveBeenCalledTimes(2);
    expect(String(local.execute.mock.calls[0]?.[0])).toContain("UPDATE upload_dead_letters");
    expect(String(local.execute.mock.calls[1]?.[0])).toContain("INSERT INTO upload_dead_letters");
    expect(String(local.execute.mock.calls[1]?.[0])).not.toContain("ON CONFLICT");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(local.complete).toHaveBeenCalledTimes(1);
  });

  it("dead-letters an authoritative business rejection instead of blocking globally", async () => {
    const rpc = vi.fn(async () => ({
      error: { code: "P0001", message: "Trip is no longer assigned to this driver." },
    }));
    const local = database([expense(ids.valid)]);
    const connector = new SupabasePowerSyncConnector(client(rpc), "https://sync.example.test");

    await connector.uploadData(local.value);

    expect(local.execute).toHaveBeenCalledTimes(2);
    expect(local.complete).toHaveBeenCalledTimes(1);
  });

  it("keeps retryable network failures in PowerSync's queue", async () => {
    const rpc = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const local = database([expense(ids.valid)]);
    const connector = new SupabasePowerSyncConnector(client(rpc), "https://sync.example.test");

    await expect(connector.uploadData(local.value)).rejects.toThrow("Failed to fetch");
    expect(local.execute).not.toHaveBeenCalled();
    expect(local.complete).not.toHaveBeenCalled();
  });
});
