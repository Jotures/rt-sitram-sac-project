import { describe, expect, it } from "vitest";
import {
  calculateCyclePerformance,
  calculateInvoiceBalance,
  calculateProfitability,
  calculateSettlement,
  calculateTripDirectFinancials,
  deriveInvoiceCollectionStatus,
  evaluateSettlementClosure,
  roundMoney,
  sumMoney,
} from "./money";

describe("money primitives", () => {
  it("rounds and sums monetary values consistently", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
  });

  it("rejects non-finite and negative source amounts", () => {
    expect(() => roundMoney(Number.NaN)).toThrow("debe ser finito");
    expect(() => sumMoney([1, -0.01])).toThrow("finito no negativo");
  });
});

describe("settlements", () => {
  it("calculates all three settlement directions", () => {
    expect(calculateSettlement([500, 200], [110, 240.5])).toEqual({
      totalAdvances: 700,
      totalApprovedExpenses: 350.5,
      balance: 349.5,
      direction: "DRIVER_RETURNS",
    });
    expect(calculateSettlement([100], [150]).direction).toBe("COMPANY_REIMBURSES");
    expect(calculateSettlement([100], [100]).direction).toBe("BALANCED");
  });

  it("allows closure only after transport and financial review are resolved", () => {
    expect(
      evaluateSettlementClosure({
        tripOperationalStatus: "COMPLETED",
        pendingExpenseCount: 0,
        observedExpenseCount: 0,
        allAdvancesIncluded: true,
        balanceResolved: true,
      }),
    ).toEqual({ allowed: true, reasons: [] });

    const blocked = evaluateSettlementClosure({
      tripOperationalStatus: "UNLOADING",
      pendingExpenseCount: 2,
      observedExpenseCount: 1,
      allAdvancesIncluded: false,
      balanceResolved: false,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toHaveLength(5);
  });

  it("rejects invalid review counters", () => {
    expect(() =>
      evaluateSettlementClosure({
        tripOperationalStatus: "COMPLETED",
        pendingExpenseCount: 0.5,
        observedExpenseCount: 0,
        allAdvancesIncluded: true,
        balanceResolved: true,
      }),
    ).toThrow("entero no negativo");
  });
});

describe("invoices and payments", () => {
  it("calculates balances and rejects overpayment", () => {
    expect(calculateInvoiceBalance(1000, [200, 300])).toBe(500);
    expect(calculateInvoiceBalance(100, [100])).toBe(0);
    expect(() => calculateInvoiceBalance(100, [101])).toThrow("no pueden superar");
  });

  it("derives paid, partial, unpaid, overdue and voided statuses", () => {
    const dueDate = new Date("2026-08-20T00:00:00.000Z");
    const beforeDue = new Date("2026-08-13T00:00:00.000Z");
    const afterDue = new Date("2026-08-21T00:00:00.000Z");

    expect(
      deriveInvoiceCollectionStatus({ total: 100, payments: [], dueDate, asOf: beforeDue }),
    ).toBe("UNPAID");
    expect(
      deriveInvoiceCollectionStatus({ total: 100, payments: [20], dueDate, asOf: beforeDue }),
    ).toBe("PARTIALLY_PAID");
    expect(
      deriveInvoiceCollectionStatus({ total: 100, payments: [100], dueDate, asOf: afterDue }),
    ).toBe("PAID");
    expect(
      deriveInvoiceCollectionStatus({ total: 100, payments: [], dueDate, asOf: afterDue }),
    ).toBe("OVERDUE");
    expect(
      deriveInvoiceCollectionStatus({
        total: 100,
        payments: [],
        dueDate: new Date("invalid"),
        asOf: beforeDue,
        voided: true,
      }),
    ).toBe("VOIDED");
  });
});

describe("trip and cycle financials", () => {
  it("separates direct margin from allocated operating margin", () => {
    expect(
      calculateProfitability({
        income: [3200, 8500, 1000],
        directCosts: [7631, 500],
        allocatedOperatingCosts: [600],
      }),
    ).toEqual({
      grossIncome: 12700,
      directCosts: 8131,
      directMargin: 4569,
      allocatedOperatingCosts: 600,
      operatingMargin: 3969,
      marginPercentage: 35.98,
      operatingMarginPercentage: 31.25,
    });
  });

  it("returns null percentages when there is no income", () => {
    expect(calculateProfitability({ income: [], directCosts: [] })).toMatchObject({
      marginPercentage: null,
      operatingMarginPercentage: null,
    });
  });

  it("keeps fuel and other approved expenses explicit", () => {
    expect(
      calculateTripDirectFinancials({
        freight: 3200,
        additionalIncome: [100],
        fuelCosts: [1000, 500],
        approvedExpenses: [200, 50],
      }),
    ).toMatchObject({
      grossIncome: 3300,
      directCosts: 1750,
      directMargin: 1550,
    });
  });

  it("calculates cycle margin, empty kilometres and margin per elapsed day", () => {
    expect(
      calculateCyclePerformance({
        legs: [
          { grossIncome: 3200, directCosts: 2500, loadedKilometres: 1100, emptyKilometres: 0 },
          { grossIncome: 8500, directCosts: 5000, loadedKilometres: 1100, emptyKilometres: 100 },
        ],
        cycleOnlyDirectCosts: [200],
        startedAt: new Date("2026-08-01T08:00:00.000Z"),
        completedAt: new Date("2026-08-06T08:00:00.000Z"),
      }),
    ).toEqual({
      grossIncome: 11700,
      directCosts: 7700,
      directMargin: 4000,
      totalKilometres: 2300,
      loadedKilometres: 2200,
      emptyKilometres: 100,
      emptyKilometresPercentage: 4.35,
      elapsedDays: 5,
      directMarginPerDay: 800,
    });
  });

  it("does not invent daily or kilometre rates for an open empty cycle", () => {
    expect(
      calculateCyclePerformance({
        legs: [],
        startedAt: new Date("2026-08-01T08:00:00.000Z"),
        completedAt: null,
      }),
    ).toMatchObject({
      emptyKilometresPercentage: null,
      elapsedDays: 0,
      directMarginPerDay: null,
    });
  });

  it("rejects invalid cycle chronology and metrics", () => {
    expect(() =>
      calculateCyclePerformance({
        legs: [],
        startedAt: new Date("2026-08-02T00:00:00.000Z"),
        completedAt: new Date("2026-08-01T00:00:00.000Z"),
      }),
    ).toThrow("terminar antes");
    expect(() =>
      calculateCyclePerformance({
        legs: [{ grossIncome: 1, directCosts: 1, loadedKilometres: -1, emptyKilometres: 0 }],
        startedAt: new Date("2026-08-01T00:00:00.000Z"),
        completedAt: null,
      }),
    ).toThrow("finito no negativo");
  });
});
