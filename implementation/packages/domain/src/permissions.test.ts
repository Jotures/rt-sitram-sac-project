import { describe, expect, it } from "vitest";
import { canPresent, canPresentProfile, getPresentationPermissions } from "./permissions";

describe("presentation permissions", () => {
  it("gives management exception and user administration permissions", () => {
    expect(canPresent("management", "MANAGE_USERS")).toBe(true);
    expect(canPresent("management", "APPROVE_MARGIN_EXCEPTION")).toBe(true);
    expect(canPresent("management", "REOPEN_CLOSED_RECORDS")).toBe(true);
  });

  it("gives administration operational control but not management exceptions", () => {
    expect(canPresent("administration", "MANAGE_TRIPS")).toBe(true);
    expect(canPresent("administration", "CLOSE_SETTLEMENT")).toBe(true);
    expect(canPresent("administration", "MANAGE_USERS")).toBe(false);
    expect(canPresent("administration", "APPROVE_MARGIN_EXCEPTION")).toBe(false);
  });

  it("limits drivers to their own trip presentation and capture", () => {
    expect(getPresentationPermissions("driver")).toEqual([
      "VIEW_OWN_TRIP",
      "RECORD_OWN_TRIP_ACTIVITY",
    ]);
    expect(canPresent("driver", "VIEW_PROFITABILITY")).toBe(false);
    expect(canPresent("driver", "MANAGE_TRIPS")).toBe(false);
  });

  it("keeps accounting read-only and conservative", () => {
    expect(canPresent("accounting", "VIEW_FINANCIAL_DOCUMENTS")).toBe(true);
    expect(canPresent("accounting", "EXPORT_ACCOUNTING")).toBe(true);
    expect(canPresent("accounting", "MANAGE_RECEIVABLES")).toBe(false);
    expect(canPresent("accounting", "VIEW_PROFITABILITY")).toBe(false);
  });
});

describe("profile presentation scope", () => {
  const common = {
    actorCompanyId: "company-a",
    actorProfileId: "profile-a",
    targetCompanyId: "company-a",
    targetProfileId: "profile-b",
  } as const;

  it("allows management and administration to present profiles from their company", () => {
    expect(canPresentProfile({ ...common, actorRole: "management" })).toBe(true);
    expect(canPresentProfile({ ...common, actorRole: "administration" })).toBe(true);
  });

  it("limits driver and accounting to themselves", () => {
    expect(canPresentProfile({ ...common, actorRole: "driver" })).toBe(false);
    expect(
      canPresentProfile({
        ...common,
        actorRole: "driver",
        targetProfileId: "profile-a",
      }),
    ).toBe(true);
    expect(canPresentProfile({ ...common, actorRole: "accounting" })).toBe(false);
  });

  it("denies every role across companies", () => {
    expect(
      canPresentProfile({
        ...common,
        actorRole: "management",
        targetCompanyId: "company-b",
      }),
    ).toBe(false);
  });
});
