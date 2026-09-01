import { describe, expect, it, vi } from "vitest";
import { ensureLogoutWillNotDiscardLocalWork } from "./lifecycle";

type LogoutSafetyDatabase = NonNullable<Parameters<typeof ensureLogoutWillNotDiscardLocalWork>[0]>;

function database(uploadCount: number, attachmentCount: number, deadLetterCount: number) {
  const getAll = vi.fn(async () => [
    { attachment_count: attachmentCount, dead_letter_count: deadLetterCount },
  ]);
  return {
    init: vi.fn(async () => undefined),
    getUploadQueueStats: vi.fn(async () => ({ count: uploadCount })),
    getAll,
  } as unknown as LogoutSafetyDatabase;
}

describe("PowerSync logout safety", () => {
  it("rejects logout while CRUD or evidence remains local", async () => {
    await expect(ensureLogoutWillNotDiscardLocalWork(database(2, 1, 1))).rejects.toThrow(
      "pendientes",
    );
  });

  it("allows logout only after both queues are empty", async () => {
    await expect(ensureLogoutWillNotDiscardLocalWork(database(0, 0, 0))).resolves.toBeUndefined();
  });

  it("rejects logout while a terminal mutation still needs a decision", async () => {
    await expect(ensureLogoutWillNotDiscardLocalWork(database(0, 0, 1))).rejects.toThrow(
      "error(es) por revisar",
    );
  });

  it("counts only unresolved attachment states so an audited discard can unblock logout", async () => {
    const local = database(0, 0, 0);

    await ensureLogoutWillNotDiscardLocalWork(local);

    expect(local.getAll).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('pending', 'uploading', 'failed', 'discarding')"),
    );
    expect(local.getAll).toHaveBeenCalledWith(expect.not.stringContaining("status <> 'uploaded'"));
  });
});
