import { describe, expect, it } from "vitest";
import type { ActorContext } from "../shared/application";
import { runReport, type ReportReadGateway, type ReportResult } from "./reports";

const filters = { from: "2026-08-01", to: "2026-08-31" };
const base = {
  companyId: "company-a",
  period: filters,
  generatedAt: "2026-08-31T00:00:00Z",
  coverage: { availableFrom: null, eligibleRecords: 0, excludedRecords: 0, notes: [] },
  summary: [],
  series: [],
  rows: [],
} as const;

function gateway(result: ReportResult): ReportReadGateway {
  return { runReport: () => Promise.resolve(result) };
}

describe("reports", () => {
  it("allows accounting to read collections but not operational fleet reports", async () => {
    const accounting: ActorContext = {
      profileId: "accountant",
      companyId: "company-a",
      role: "accounting",
    };
    await expect(
      runReport(gateway({ ...base, kind: "COLLECTIONS" }), accounting, "COLLECTIONS", filters),
    ).resolves.toMatchObject({ kind: "COLLECTIONS" });
    await expect(
      runReport(
        gateway({ ...base, kind: "FLEET_UTILIZATION" }),
        accounting,
        "FLEET_UTILIZATION",
        filters,
      ),
    ).rejects.toThrow("No tienes permiso");
  });

  it("rejects inverted dates and mismatched projections", async () => {
    const admin: ActorContext = {
      profileId: "admin",
      companyId: "company-a",
      role: "administration",
    };
    await expect(
      runReport(
        gateway({ ...base, companyId: "company-b", kind: "TRIPS_CARGO" }),
        admin,
        "TRIPS_CARGO",
        filters,
      ),
    ).rejects.toThrow("alcance diferente");
    await expect(
      runReport(gateway({ ...base, kind: "TRIPS_CARGO" }), admin, "TRIPS_CARGO", {
        from: "2026-09-01",
        to: "2026-08-01",
      }),
    ).rejects.toThrow("periodo");
  });
});
