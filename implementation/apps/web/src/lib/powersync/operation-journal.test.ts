import { describe, expect, it, vi } from "vitest";
import type { CommonPowerSyncDatabase } from "@powersync/web";
import { restoreOperationJournal } from "./operation-journal";
describe("upgrade with pending operation envelopes", () => {
  it("restores readability without completing, altering or uploading the original queue", async () => {
    const complete = vi.fn(),
      execute = vi.fn();
    const db = {
      getCrudBatch: async () => ({
        crud: [
          {
            id: "operation-a",
            table: "operation_commands",
            opData: {
              company_id: "company-a",
              actor_id: "actor-a",
              kind: "departure",
              payload: '{"advance":{"amount":800}}',
              contract_version: 1,
              dependency_id: null,
              source_device_id: "device-a",
              status: "pending",
              created_at: "2026-09-07",
            },
          },
        ],
        complete,
      }),
      writeTransaction: async (fn: (tx: unknown) => Promise<void>) => fn({ execute }),
    } as unknown as CommonPowerSyncDatabase;
    await restoreOperationJournal(db);
    expect(execute.mock.calls[0]?.[0]).toContain("INSERT OR IGNORE INTO operation_command_journal");
    expect(execute.mock.calls[0]?.[1]).toEqual([
      "operation-a",
      "company-a",
      "actor-a",
      "departure",
      '{"advance":{"amount":800}}',
      1,
      null,
      "device-a",
      "pending",
      "2026-09-07",
    ]);
    expect(complete).not.toHaveBeenCalled();
  });
});
