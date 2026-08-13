import { describe, expect, it } from "vitest";
import { formatBuildLabel } from "@rt-sitram/shared";

describe("technical workspace integration", () => {
  it("consumes the non-domain shared package", () => {
    expect(formatBuildLabel("Technical foundation", "0.1.0")).toBe("Technical foundation · 0.1.0");
  });
});
