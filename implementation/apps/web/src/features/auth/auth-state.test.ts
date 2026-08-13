import { describe, expect, it } from "vitest";
import { createAuthState, createInitializingAuthState } from "./auth-state";

describe("auth state", () => {
  it("starts in the explicit initializing state", () => {
    expect(createInitializingAuthState()).toMatchObject({
      status: "INITIALIZING",
      session: null,
      error: null,
    });
  });

  it("represents an absent session and its error as unauthenticated", () => {
    expect(createAuthState(null, "No session available.")).toEqual({
      status: "UNAUTHENTICATED",
      session: null,
      error: "No session available.",
    });
  });
});
