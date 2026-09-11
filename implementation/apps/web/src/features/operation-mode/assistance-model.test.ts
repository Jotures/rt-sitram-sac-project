import { describe, expect, it } from "vitest";
import {
  captureWarnings,
  operationNextSteps,
  comparableHistory,
  type CaptureValues,
} from "./assistance-model";
import type { AdminListRow, AdminOperationalCycleRow } from "../admin-ui/admin-data";

const values: CaptureValues = {
  vehicleId: "vehicle-a",
  occurredAt: "2026-09-11T14:00:00Z",
  amount: "100",
  quantity: "10",
  volumeUnit: "gallon",
  categoryId: "food",
  odometerKm: "",
};
const history = (overrides: Partial<AdminListRow> = {}): AdminListRow => ({
  id: crypto.randomUUID(),
  title: "Abastecimiento",
  description: "",
  amount: 100,
  date: "2026-09-10T14:00:00Z",
  status: "Validado",
  rawStatus: "validated",
  captureContext: {
    vehicleId: "vehicle-a",
    tripId: null,
    categoryId: "food",
    currency: "PEN",
    quantity: 10,
    volumeUnit: "gallon",
    odometerKm: 15000,
    supplierId: "supplier-a",
    local: false,
  },
  ...overrides,
});
const cycle = (
  id: string,
  patch: Partial<AdminOperationalCycleRow> = {},
): AdminOperationalCycleRow => ({
  id,
  title: id,
  description: `ABC-123 · Juan`,
  status: "active",
  amount: null,
  date: "2026-09-10",
  vehicleId: "vehicle-a",
  primaryDriverId: "driver-a",
  returnStatus: "unidentified",
  notes: null,
  version: 1,
  returnedAt: null,
  ...patch,
});

describe("contextual next steps", () => {
  it("prioritizes returned accounts and avoids a second card for the same outing", () => {
    const result = operationNextSteps(
      [cycle("planned", { status: "planned" }), cycle("returned", { returnedAt: "2026-09-11" })],
      [history({ id: "account", cycleId: "returned", rawStatus: "open" })],
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "returned", href: "/finanzas/rendiciones/account" });
    expect(result[0]?.reason).toContain("regreso");
  });
  it("does not invent a missing account when the account source is unavailable", () => {
    expect(operationNextSteps([cycle("returned", { status: "completed" })], null)).toEqual([]);
    expect(operationNextSteps([cycle("returned", { status: "completed" })], [])[0]?.action).toBe(
      "Preparar rendición",
    );
  });
  it("excludes closed accounts and cancelled outings; orders observed first", () => {
    const accounts = [
      history({ id: "closed", cycleId: "done", rawStatus: "closed" }),
      history({ id: "observed", rawStatus: "observed" }),
    ];
    expect(
      operationNextSteps(
        [cycle("done", { status: "completed" }), cycle("cancelled", { status: "cancelled" })],
        accounts,
      ).map((row) => row.id),
    ).toEqual(["account:observed"]);
  });
});
describe("capture warnings", () => {
  it("compares odometer with an earlier confirmed fuel entry, including zero", () => {
    expect(captureWarnings("fuel", [history()], { ...values, odometerKm: "0" })[0]).toContain(
      "15,000",
    );
    expect(captureWarnings("fuel", [history()], { ...values, odometerKm: "15010" })).toEqual([]);
    expect(
      captureWarnings("fuel", [history()], {
        ...values,
        occurredAt: "2026-09-09T14:00:00Z",
        odometerKm: "10000",
      }),
    ).toEqual([]);
  });
  it("compares fuel unit price rather than a larger refill total", () => {
    const rows = Array.from({ length: 5 }, () => history());
    expect(captureWarnings("fuel", rows, { ...values, amount: "1000", quantity: "100" })).toEqual(
      [],
    );
    expect(captureWarnings("fuel", rows, { ...values, amount: "500" })[0]).toContain(
      "mediana de 5",
    );
    expect(
      captureWarnings("fuel", rows, { ...values, amount: "500", volumeUnit: "liter" }),
    ).toEqual([]);
  });
  it("needs five records in the same category for expense warnings", () => {
    const rows = Array.from({ length: 5 }, () => history());
    expect(captureWarnings("expense", rows.slice(0, 4), { ...values, amount: "1000" })).toEqual([]);
    expect(captureWarnings("expense", rows, { ...values, amount: "1000" })).toHaveLength(1);
    expect(
      captureWarnings("expense", rows, { ...values, categoryId: "toll", amount: "1000" }),
    ).toEqual([]);
  });
  it("ignores rejected, future, old, other-currency and other-vehicle history", () => {
    const base = history();
    const rows = [
      history({ rawStatus: "pending_review" }),
      history({ rawStatus: "rejected" }),
      history({ date: "2026-10-11" }),
      history({ date: "2026-01-01" }),
      history({ captureContext: { ...base.captureContext!, currency: "USD" } }),
      history({ captureContext: { ...base.captureContext!, vehicleId: "vehicle-b" } }),
    ];
    expect(comparableHistory(rows, values)).toEqual([]);
  });
});
