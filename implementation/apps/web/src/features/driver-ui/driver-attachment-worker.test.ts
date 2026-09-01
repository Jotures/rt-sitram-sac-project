/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./DriverAttachmentWorker.tsx", import.meta.url)),
  "utf8",
);

describe("driver attachment worker ordering", () => {
  it("waits for the structured upload queue before sending evidence", () => {
    expect(source).toContain("useUploadQueue(runtime.sqliteReady)");
    expect(source).toContain("uploadQueue.pending > 0");
    expect(source).toContain("uploadQueue.error !== null");
  });
});
