import { describe, expect, it } from "vitest";
import { browserAuthOptions } from "./client";

describe("browser Supabase Auth client", () => {
  it("detects invite and recovery sessions returned in the callback URL", () => {
    expect(browserAuthOptions).toMatchObject({
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    });
  });
});
