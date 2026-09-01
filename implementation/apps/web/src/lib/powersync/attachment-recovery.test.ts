import type { CommonPowerSyncDatabase } from "@powersync/web";
import { describe, expect, it, vi } from "vitest";
import {
  discardFailedAttachment,
  retryFailedAttachment,
  type FailedAttachmentRow,
} from "./attachment-recovery";
import { processNextAttachment, type AttachmentRemoteGateway } from "./attachment-worker";

const initialRow: FailedAttachmentRow = {
  id: "queue-a",
  entity_type: "expense",
  entity_id: "10000000-0000-4000-8000-000000000002",
  local_uri: "opfs://rt-sitram-evidence/10000000-0000-4000-8000-000000000003",
  original_name: "boleta.jpg",
  mime_type: "image/jpeg",
  size_bytes: 3,
  attempts: 4,
  last_error: "offline",
  status: "failed",
  updated_at: "2026-08-13T15:00:00.000Z",
};

function recoveryDatabase(seed: FailedAttachmentRow) {
  let state = { ...seed };
  const events: string[] = [];
  const executedSql: string[] = [];

  const execute = vi.fn(async (sql: string, parameters: unknown[] = []) => {
    executedSql.push(sql);
    if (sql.includes("INSERT INTO attachment_recovery_events")) {
      events.push(String(parameters[2]));
    } else if (sql.includes("status = 'uploading'")) {
      state = {
        ...state,
        status: "failed",
        attempts: state.attempts + 1,
        last_error: null,
      };
    } else if (sql.includes("status = 'uploaded'")) {
      state = { ...state, status: "failed", last_error: null };
      Object.assign(state, { status: "uploaded" });
    } else if (sql.includes("SET status = 'pending'")) {
      state = { ...state, status: "failed", attempts: 0, last_error: null };
      Object.assign(state, { status: "pending" });
    } else if (sql.includes("SET status = 'discarding'")) {
      state = { ...state, status: "discarding" };
    } else if (sql.includes("SET status = 'discarded'")) {
      Object.assign(state, { status: "discarded", last_error: null });
    } else if (sql.includes("SET status = 'failed', last_error")) {
      state = { ...state, status: "failed", last_error: String(parameters[0]) };
    }
    return { rowsAffected: 1 };
  });

  const getAll = vi.fn(async <T>(sql: string) => {
    if (sql.includes("attempts < 5")) {
      return (
        state.attempts < 5 && ["pending", "failed", "uploading"].includes(state.status)
          ? [state]
          : []
      ) as T[];
    }
    if (sql.includes("FROM attachment_queue")) {
      return (
        (state.status === "failed" && state.attempts >= 5) || state.status === "discarding"
          ? [state]
          : []
      ) as T[];
    }
    return [] as T[];
  });

  const database = {
    execute,
    getAll,
    writeTransaction: async <T>(
      callback: (transaction: { execute: typeof execute }) => Promise<T>,
    ) => callback({ execute }),
  };

  return {
    database,
    events,
    executedSql,
    state: () => state as FailedAttachmentRow & { readonly status: string },
  };
}

function failingRemote(): AttachmentRemoteGateway {
  return {
    upload: vi.fn(async () => {
      throw new Error("offline");
    }),
    createFileMetadata: vi.fn(async () => undefined),
    linkToEntity: vi.fn(async () => undefined),
  };
}

function successfulRemote(): AttachmentRemoteGateway {
  return {
    upload: vi.fn(async () => undefined),
    createFileMetadata: vi.fn(async () => undefined),
    linkToEntity: vi.fn(async () => undefined),
  };
}

describe("manual attachment recovery", () => {
  it("moves attempt five to manual review, then retries from zero through upload", async () => {
    const local = recoveryDatabase(initialRow);
    const database = local.database as unknown as CommonPowerSyncDatabase;
    const blobs = {
      read: vi.fn(async () => new Blob(["abc"], { type: "image/jpeg" })),
      remove: vi.fn(async () => undefined),
    };

    await expect(
      processNextAttachment({
        database,
        blobs,
        remote: failingRemote(),
        companyId: "company-a",
        profileId: "user-a",
      }),
    ).resolves.toBe("FAILED");
    expect(local.state().attempts).toBe(5);
    expect(local.state().status).toBe("failed");

    await retryFailedAttachment(
      local.database as unknown as Parameters<typeof retryFailedAttachment>[0],
      initialRow.id,
      true,
    );
    expect(local.state()).toMatchObject({ status: "pending", attempts: 0, last_error: null });
    expect(local.events).toContain("retry");

    await expect(
      processNextAttachment({
        database,
        blobs,
        remote: successfulRemote(),
        companyId: "company-a",
        profileId: "user-a",
      }),
    ).resolves.toBe("UPLOADED");
    expect(local.state().status).toBe("uploaded");
  });

  it("discards only the confirmed OPFS evidence and records the decision", async () => {
    const local = recoveryDatabase({ ...initialRow, attempts: 5 });
    const remove = vi.fn(async () => undefined);

    await expect(
      discardFailedAttachment(
        local.database as unknown as Parameters<typeof discardFailedAttachment>[0],
        { remove },
        initialRow.id,
        false,
        "Comprobante duplicado",
      ),
    ).rejects.toThrow("Confirma");
    expect(remove).not.toHaveBeenCalled();

    await discardFailedAttachment(
      local.database as unknown as Parameters<typeof discardFailedAttachment>[0],
      { remove },
      initialRow.id,
      true,
      "Comprobante duplicado",
    );

    expect(remove).toHaveBeenCalledWith(initialRow.local_uri);
    expect(local.state().status).toBe("discarded");
    expect(local.events).toEqual(["discard_requested", "discard_completed"]);
    expect(local.executedSql.join("\n")).not.toMatch(
      /DELETE FROM (expenses|fuel_entries|incidents)/u,
    );
  });
});
