import { describe, expect, it, vi } from "vitest";
import type { ActorContext, Clock, IdGenerator } from "../shared/application";
import {
  getDocumentExpiryState,
  queueDocumentOffline,
  type DocumentOfflineStore,
} from "./documents";

const actor: ActorContext = { profileId: "driver", companyId: "company-a", role: "driver" };
const clock: Clock = { now: () => new Date("2026-08-13T00:00:00.000Z") };
const ids: IdGenerator = { next: () => "document-a" };

describe("offline documents", () => {
  it("queues private file metadata under the actor company", async () => {
    const enqueueDocument = vi.fn(() => Promise.resolve());
    const store: DocumentOfflineStore = {
      enqueueDocument,
      listDocuments: () => Promise.resolve([]),
    };
    const document = await queueDocumentOffline({ store, ids, clock }, actor, {
      companyId: "company-a",
      ownerType: "TRIP",
      ownerId: "trip-a",
      documentType: "RECEIPT",
      localFileId: "local-file-a",
    });
    expect(document).toMatchObject({
      companyId: "company-a",
      syncStatus: "PENDING",
      queuedBy: "driver",
    });
    expect(enqueueDocument).toHaveBeenCalledWith(document);
  });

  it("rejects cross-company metadata and classifies expiry", async () => {
    const store: DocumentOfflineStore = {
      enqueueDocument: () => Promise.resolve(),
      listDocuments: () => Promise.resolve([]),
    };
    await expect(
      queueDocumentOffline({ store, ids, clock }, actor, {
        companyId: "company-b",
        ownerType: "TRIP",
        ownerId: "trip",
        documentType: "GUIDE",
        localFileId: "file",
      }),
    ).rejects.toThrow("otra empresa");
    expect(getDocumentExpiryState("2026-08-20T00:00:00.000Z", clock.now())).toBe("DUE_SOON");
    expect(getDocumentExpiryState("2026-08-01T00:00:00.000Z", clock.now())).toBe("EXPIRED");
  });
});
