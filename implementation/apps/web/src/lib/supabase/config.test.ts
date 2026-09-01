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

  it("explains invalid URL configuration without exposing internal variable names or values", () => {
    const configuration = readSupabaseConfiguration({
      VITE_SUPABASE_URL: "not-a-url",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    });

    expect(configuration).toEqual({
      status: "NOT_CONFIGURED",
      problems: ["INVALID_URL"],
    });
    const description = describeSupabaseConfigurationProblems(["INVALID_URL"]);

    expect(description).toContain("conexión del sistema");
    expect(description).toContain("Comunícate con Gerencia");
    expect(description).not.toContain("VITE_");
    expect(description).not.toContain("not-a-url");
  });
});
