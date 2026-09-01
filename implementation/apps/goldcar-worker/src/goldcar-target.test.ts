import { describe, expect, it } from "vitest";
import {
  deriveGoldcarPortalVisibleTarget,
  normalizeGoldcarPortalNameCanonicalId,
} from "./goldcar-target";

describe("Goldcar approved portal-name selector", () => {
  it("normalizes only the approved canonical namespace to a visible DOM name", () => {
    expect(normalizeGoldcarPortalNameCanonicalId(" portal-name:x3n-719 ")).toBe(
      "PORTAL-NAME:X3N-719",
    );
    expect(deriveGoldcarPortalVisibleTarget("PORTAL-NAME:X3N-719")).toBe("X3N-719");
  });

  it("fails closed for bare names, routes, queries, or unsafe display selectors", () => {
    for (const target of [
      "X3N-719",
      "PORTAL-ID:X3N-719",
      "PORTAL-NAME:X3N-719?tab=sensors",
      "PORTAL-NAME:X3N 719",
      "PORTAL-NAME:/objects/48291",
    ]) {
      expect(() => deriveGoldcarPortalVisibleTarget(target)).toThrow("PORTAL-NAME");
    }
  });
});
