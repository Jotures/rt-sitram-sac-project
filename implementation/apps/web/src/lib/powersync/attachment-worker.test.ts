import type { CommonPowerSyncDatabase } from "@powersync/web";
import { describe, expect, it, vi } from "vitest";
import {
  createAttachmentStoragePath,
  processNextAttachment,
  type AttachmentRemoteGateway,
} from "./attachment-worker";

const row = {
  id: "queue-a",
  entity_type: "expense" as const,
  entity_id: "10000000-0000-4000-8000-000000000002",
  local_uri: "opfs://rt-sitram-evidence/10000000-0000-4000-8000-000000000003",
  original_name: "Boleta N° 1.jpg",
  mime_type: "image/jpeg",
  size_bytes: 3,
  content_hash: null,
  remote_file_id: "10000000-0000-4000-8000-000000000004",
  storage_path: null,
  attempts: 0,
};

describe("attachment queue worker", () => {
  it("derives a private path under the authenticated company", () => {
    expect(
      createAttachmentStoragePath({
        companyId: "company-a",
        entityType: "expense",
        entityId: row.entity_id,
        fileId: row.remote_file_id,
        originalName: row.original_name,
      }),
    ).toBe(
      `companies/company-a/trip-activity/expense/${row.entity_id}/${row.remote_file_id}-Boleta-N-1.jpg`,
    );
  });

  it("uploads, records and links the next queued evidence", async () => {
    const execute = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 }));
    const database = {
      getAll: vi.fn(async () => [row]),
      execute,
    } as unknown as CommonPowerSyncDatabase;
    const remote: AttachmentRemoteGateway = {
      upload: vi.fn(async () => undefined),
      createFileMetadata: vi.fn(async () => undefined),
      linkToEntity: vi.fn(async () => undefined),
    };

    await expect(
      processNextAttachment({
        database,
        blobs: { read: async () => new Blob(["abc"], { type: "image/jpeg" }) },
        remote,
        companyId: "company-a",
        profileId: "user-a",
      }),
    ).resolves.toBe("UPLOADED");
    expect(remote.upload).toHaveBeenCalledOnce();
    expect(remote.createFileMetadata).toHaveBeenCalledOnce();
    expect(remote.linkToEntity).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'uploaded'"),
      expect.any(Array),
    );
  });

  it("retains a failed row for bounded retry", async () => {
    const execute = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 }));
    const database = {
      getAll: vi.fn(async () => [row]),
      execute,
    } as unknown as CommonPowerSyncDatabase;
    const remote: AttachmentRemoteGateway = {
      upload: vi.fn(async () => {
        throw new Error("offline");
      }),
      createFileMetadata: vi.fn(async () => undefined),
      linkToEntity: vi.fn(async () => undefined),
    };
    await expect(
      processNextAttachment({
        database,
        blobs: { read: async () => new Blob(["abc"]) },
        remote,
        companyId: "company-a",
        profileId: "user-a",
      }),
    ).resolves.toBe("FAILED");
    expect(execute).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'failed'"),
      expect.arrayContaining(["offline"]),
    );
  });

  it("stops automatic retries at attempt five for explicit user recovery", async () => {
    const database = {
      getAll: vi.fn(async () => []),
      execute: vi.fn(async () => ({ rowsAffected: 0 })),
    } as unknown as CommonPowerSyncDatabase;
    const remote: AttachmentRemoteGateway = {
      upload: vi.fn(async () => undefined),
      createFileMetadata: vi.fn(async () => undefined),
      linkToEntity: vi.fn(async () => undefined),
    };

    await expect(
      processNextAttachment({
        database,
        blobs: { read: vi.fn(async () => new Blob(["abc"])) },
        remote,
        companyId: "company-a",
        profileId: "user-a",
      }),
    ).resolves.toBe("IDLE");

    expect(database.getAll).toHaveBeenCalledWith(expect.stringContaining("attempts < 5"));
    expect(remote.upload).not.toHaveBeenCalled();
  });
});
