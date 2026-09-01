import { describe, expect, it } from "vitest";
import { loadIdentityFromRows, type IdentityRowReader } from "./identity-gateway";

function createReader({
  company = {
    id: "company-a",
    legal_name: "R&T SITRAM SAC",
    trade_name: "R&T SITRAM",
    active: true,
  },
  profile = {
    id: "user-a",
    company_id: "company-a",
    display_name: "Ana Administración",
    role: "administration",
    active: true,
  },
}: {
  readonly company?: unknown;
  readonly profile?: unknown;
} = {}): IdentityRowReader {
  return {
    readCompany: () => Promise.resolve({ data: company, error: null }),
    readProfile: () => Promise.resolve({ data: profile, error: null }),
  };
}

describe("identity gateway", () => {
  it("maps the authenticated profile and its RLS-visible company", async () => {
    const result = await loadIdentityFromRows(createReader(), "user-a");

    expect(result).toEqual({
      ok: true,
      identity: {
        company: {
          id: "company-a",
          legalName: "R&T SITRAM SAC",
          tradeName: "R&T SITRAM",
          active: true,
        },
        profile: {
          id: "user-a",
          companyId: "company-a",
          displayName: "Ana Administración",
          role: "administration",
          active: true,
        },
      },
    });
  });

  it("rejects a profile row that does not match the authenticated user", async () => {
    const result = await loadIdentityFromRows(
      createReader({
        profile: {
          id: "user-b",
          company_id: "company-b",
          display_name: "Usuario B",
          role: "management",
          active: true,
        },
      }),
      "user-a",
    );

    expect(result).toMatchObject({ ok: false, reason: "INVALID_DATA" });
  });

  it("rejects a company row that differs from profiles.company_id", async () => {
    const result = await loadIdentityFromRows(
      createReader({
        company: {
          id: "company-b",
          legal_name: "Company B",
          trade_name: null,
          active: true,
        },
      }),
      "user-a",
    );

    expect(result).toMatchObject({ ok: false, reason: "INVALID_DATA" });
  });

  it("does not accept unknown product roles", async () => {
    const result = await loadIdentityFromRows(
      createReader({
        profile: {
          id: "user-a",
          company_id: "company-a",
          display_name: "Usuario A",
          role: "owner",
          active: true,
        },
      }),
      "user-a",
    );

    expect(result).toMatchObject({ ok: false, reason: "INVALID_DATA" });
  });

  it("reports a missing product profile without attempting to infer a company", async () => {
    let companyRead = false;
    const reader: IdentityRowReader = {
      readCompany: () => {
        companyRead = true;
        return Promise.resolve({ data: null, error: null });
      },
      readProfile: () => Promise.resolve({ data: null, error: null }),
    };

    const result = await loadIdentityFromRows(reader, "user-a");

    expect(result).toMatchObject({ ok: false, reason: "NOT_FOUND" });
    expect(companyRead).toBe(false);
  });
});
