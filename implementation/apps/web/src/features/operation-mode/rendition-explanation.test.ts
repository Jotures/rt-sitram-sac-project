import { describe, expect, it } from "vitest";
import { explainRendition } from "./rendition-explanation";
import type { Snapshot } from "./CycleRendition";
const movement = {
  id: "expense",
  version: 1,
  amount: 200,
  approved_amount: 200,
  validation_status: "validated",
  updated_at: "2026-09-11",
};
const snapshot: Snapshot = {
  cycle: {
    id: "cycle",
    code: "SAL-1",
    primary_driver_id: "driver",
    status: "completed",
    returned_at: "2026-09-11",
  },
  settlement: { id: "account", status: "open" },
  summary: { lines: [], status: "approved", version: 1, baseline: "same" },
  baseline: "same",
  total_advances: 1000,
  expense_total: 300,
  driver_fuel: 100,
  company_fuel: 500,
  balance: 600,
  remaining: 400,
  advances_list: [
    { id: "advance", amount: 1000, version: 1, status: "delivered", delivered_at: "2026-09-10" },
  ],
  expenses: [
    movement,
    { ...movement, id: "pending", amount: 99, validation_status: "pending_review" },
    { ...movement, id: "rejected", validation_status: "rejected" },
  ],
  fuel: [],
  categories: [],
  evidence: [],
  payments: [
    {
      id: "payment",
      amount: 200,
      direction: "DRIVER_RETURNS",
      occurred_at: "2026-09-11",
      cancelled_at: null,
    },
    {
      id: "void",
      amount: 500,
      direction: "DRIVER_RETURNS",
      occurred_at: "2026-09-11",
      cancelled_at: "2026-09-11",
    },
  ],
};
describe("explain existing server account", () => {
  it("separates recognized rows, sheet additions and effective payments", () => {
    expect(explainRendition(snapshot)).toMatchObject({
      recognizedExpenses: 200,
      additionalSheet: 100,
      returned: 200,
      reimbursed: 0,
      pendingReview: 1,
      rejected: 1,
      consistent: true,
    });
  });
  it("handles company reimbursements and cents without sign inversion", () => {
    const data = {
      ...snapshot,
      total_advances: 100,
      expense_total: 200.01,
      driver_fuel: 0,
      balance: -100.01,
      remaining: -50.01,
      payments: [
        {
          id: "p",
          amount: 50,
          direction: "COMPANY_REIMBURSES",
          occurred_at: "2026-09-11",
          cancelled_at: null,
        },
      ],
    };
    expect(explainRendition(data)).toMatchObject({ consistent: true, reimbursed: 50, returned: 0 });
  });
  it("identifies stale summaries and unfinished services without inventing balances", () => {
    const data = {
      ...snapshot,
      cycle: { ...snapshot.cycle, status: "active" },
      baseline: "changed",
    };
    const result = explainRendition(data);
    expect(result.steps.map((step) => step.text).join(" ")).toContain("movimientos cambiaron");
    expect(result.steps.map((step) => step.text).join(" ")).toContain("servicios");
    expect(explainRendition({ ...snapshot, remaining: 900 }).consistent).toBe(false);
  });
  it("does not ask to change a closed account", () => {
    expect(
      explainRendition({ ...snapshot, settlement: { id: "a", status: "closed" } }).steps,
    ).toEqual([]);
  });
});
