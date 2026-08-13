import { describe, expect, it } from "vitest";
import { describeSupabaseConfigurationProblems, readSupabaseConfiguration } from "./config";

describe("Supabase configuration", () => {
  it("reports every required missing public variable", () => {
    expect(readSupabaseConfiguration({})).toEqual({
      status: "NOT_CONFIGURED",
      problems: ["MISSING_URL", "MISSING_PUBLISHABLE_KEY"],
    });
  });

  it("accepts a public URL and publishable key", () => {
    expect(
      readSupabaseConfiguration({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      status: "CONFIGURED",
      config: {
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_example",
      },
    });
  });

  it("explains invalid URL configuration without exposing values", () => {
    const configuration = readSupabaseConfiguration({
      VITE_SUPABASE_URL: "not-a-url",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    });

    expect(configuration).toEqual({
      status: "NOT_CONFIGURED",
      problems: ["INVALID_URL"],
    });
    expect(describeSupabaseConfigurationProblems(["INVALID_URL"])).toContain("VITE_SUPABASE_URL");
  });
});
