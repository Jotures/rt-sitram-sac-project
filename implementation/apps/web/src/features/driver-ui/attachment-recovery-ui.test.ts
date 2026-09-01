/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./HistoryAndSyncPages.tsx", import.meta.url)),
  "utf8",
);

describe("driver attachment recovery UI contract", () => {
  it("treats terminal attachment rows as synchronization errors", () => {
    expect(source).toContain("attachments.failed.length > 0");
    expect(source).toContain("status = 'failed' AND attempts >= ?");
    expect(source).toContain("Archivos que no pudieron enviarse");
    expect(source).toContain("last_error");
    expect(source).toContain("entity_id");
  });

  it("requires explicit UI decisions for retry and OPFS-only discard", () => {
    expect(source).not.toContain("window.confirm");
    expect(source).not.toContain("window.prompt");
    expect(source).toContain("RecoveryDecisionSheet");
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('role="dialog"');
    expect(source).toContain("minLength={3}");
    expect(source).toContain("retryFailedAttachment");
    expect(source).toContain("discardFailedAttachment");
    expect(source).toContain("new OpfsAttachmentBlobSource()");
    expect(source).toContain("No se borrará el gasto, combustible o incidencia relacionado");
  });

  it("does not claim a confirmed sync while recovery queries or errors remain", () => {
    expect(source).toContain("recoveryReady: !attachments.isLoading && !deadLetters.isLoading");
    expect(source).toContain("deadLetters.error != null");
    expect(source).toContain("attachments.failed.length > 0");
    expect(source).toContain("unresolvedCount > 0");
  });
});
