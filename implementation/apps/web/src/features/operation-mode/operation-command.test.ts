import { UpdateType, type CommonPowerSyncDatabase } from "@powersync/web";
import { describe, expect, it, vi } from "vitest";
import {
  enqueueOperationCommand,
  makeOperationCommand,
  operationMovementId,
} from "./operation-command";
import { mapProductUpload } from "../../lib/powersync/upload";

const id = "e7000000-0000-4000-8000-000000000001";
const cycle = "e7000000-0000-4000-8000-000000000002";
describe("typed UI to RPC operation commands", () => {
  it("preserves scope, complete payload and contract through SQLite and upload", async () => {
    const command = makeOperationCommand(
      {
        kind: "advance",
        payload: {
          cycle_id: cycle,
          amount: 200,
          method: "transfer",
          occurred_at: "2026-09-01T12:00:00.000Z",
          description: null,
        },
      },
      id,
    );
    const execute = vi.fn();
    const db = {
      writeTransaction: async (callback: (transaction: unknown) => Promise<void>) =>
        callback({ getOptional: async () => null, execute }),
    } as unknown as CommonPowerSyncDatabase;
    await enqueueOperationCommand(db, command, {
      companyId: cycle,
      profileId: id,
      sourceDeviceId: "office",
    });
    const fields = execute.mock.calls[0]?.[1] as unknown[];
    const entry = {
      id,
      op: UpdateType.PUT,
      table: "operation_commands",
      opData: {
        company_id: fields[1],
        actor_id: fields[2],
        kind: fields[3],
        payload: fields[4],
        contract_version: fields[5],
        dependency_id: fields[6],
        source_device_id: fields[7],
        status: "pending",
        created_at: fields[8],
      },
    };
    const mutation = mapProductUpload(entry);
    expect(mutation.rpc).toBe("apply_operation_command");
    expect(mutation.args.p_dependency_id).toBe(cycle);
    expect(JSON.parse(String(mutation.args.p_payload))).toEqual(command.payload);
    expect(mutation.args.p_contract_version).toBe(1);
  });
  it("reuses stable child identities when a departure is retried", () => {
    expect(operationMovementId(id, 1)).toBe(operationMovementId(id, 1));
    expect(new Set([id, operationMovementId(id, 1), operationMovementId(id, 2)]).size).toBe(3);
  });
  it("rejects an unsupported envelope without enqueuing an orphan", () => {
    expect(() =>
      mapProductUpload({
        id,
        op: UpdateType.PUT,
        table: "operation_commands",
        opData: { kind: "expense", contract_version: 2, payload: "{}" },
      }),
    ).toThrow(/version/);
  });
});
