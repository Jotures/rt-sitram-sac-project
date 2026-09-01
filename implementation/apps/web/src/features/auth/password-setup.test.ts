import { describe, expect, it } from "vitest";
import {
  createSanitizedPasswordSetupUrl,
  inspectPasswordRequirements,
  inspectPasswordSetupLink,
  validatePasswordSetup,
} from "./password-setup";

describe("password setup links", () => {
  it("recognizes invite and recovery links from fixed intent or Supabase callback type", () => {
    expect(
      inspectPasswordSetupLink(
        new URL(
          "https://app.example.com/auth/establecer-clave?intent=invite#access_token=secret&type=invite",
        ),
      ),
    ).toEqual({ intent: "invite", errorMessage: null });

    expect(
      inspectPasswordSetupLink(
        new URL("https://app.example.com/auth/establecer-clave#type=recovery"),
      ),
    ).toEqual({ intent: "recovery", errorMessage: null });
  });

  it("turns an expired or invalid callback into a safe Spanish error", () => {
    const link = inspectPasswordSetupLink(
      new URL(
        "https://app.example.com/auth/establecer-clave?intent=invite#error=access_denied&error_code=otp_expired&error_description=raw-provider-message",
      ),
    );

    expect(link.intent).toBe("invite");
    expect(link.errorMessage).toContain("venció");
    expect(link.errorMessage).not.toContain("raw-provider-message");
  });

  it("rejects a page visit that has no invite or recovery intent", () => {
    expect(
      inspectPasswordSetupLink(new URL("https://app.example.com/auth/establecer-clave")),
    ).toEqual({ intent: null, errorMessage: null });
  });

  it("removes callback credentials and provider errors from browser history", () => {
    expect(
      createSanitizedPasswordSetupUrl(
        new URL(
          "https://app.example.com/auth/establecer-clave?intent=invite&code=secret#error=denied&access_token=secret",
        ),
      ),
    ).toBe("/auth/establecer-clave?intent=invite");
  });
});

describe("password policy", () => {
  it("enforces the Supabase minimum, uppercase, lowercase and digit requirements", () => {
    expect(inspectPasswordRequirements("shortA1").valid).toBe(false);
    expect(inspectPasswordRequirements("alllowercase1").hasUppercase).toBe(false);
    expect(inspectPasswordRequirements("ALLUPPERCASE1").hasLowercase).toBe(false);
    expect(inspectPasswordRequirements("NoDigitsHere").hasDigit).toBe(false);
    expect(inspectPasswordRequirements("ClaveSegura1").valid).toBe(true);
  });

  it("requires matching confirmation", () => {
    expect(validatePasswordSetup("ClaveSegura1", "OtraClave2")).toBe(
      "Las contraseñas no coinciden.",
    );
    expect(validatePasswordSetup("ClaveSegura1", "ClaveSegura1")).toBeNull();
  });
});
