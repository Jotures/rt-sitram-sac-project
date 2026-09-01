import { describe, expect, it } from "vitest";
import { isAppRole, isIdentityActive, type CurrentIdentity } from "./identity-model";

const activeIdentity: CurrentIdentity = {
  company: {
    id: "company-a",
    legalName: "R&T SITRAM SAC",
    tradeName: "R&T SITRAM",
    active: true,
  },
  profile: {
    id: "user-a",
    companyId: "company-a",
    displayName: "Usuario A",
    role: "management",
    active: true,
  },
};

describe("identity model", () => {
  it.each(["management", "administration", "driver", "accounting"])(
    "recognizes the %s role",
    (role) => {
      expect(isAppRole(role)).toBe(true);
    },
  );

  it("requires both the profile and company to be active", () => {
    expect(isIdentityActive(activeIdentity)).toBe(true);
    expect(
      isIdentityActive({
        ...activeIdentity,
        profile: { ...activeIdentity.profile, active: false },
      }),
    ).toBe(false);
    expect(
      isIdentityActive({
        ...activeIdentity,
        company: { ...activeIdentity.company, active: false },
      }),
    ).toBe(false);
  });
});
