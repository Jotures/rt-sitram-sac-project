import { describe, expect, it } from "vitest";
import { buildReport, type ReportSnapshot } from "./report-calculations";

const snapshot: ReportSnapshot = {
  generatedAt: "2026-08-30T10:00:00.000Z",
  availableFrom: "2026-08-30T10:00:00.000Z",
  trips: [
    {
      trip_id: "trip-a",
      trip_code: "V-001",
      origin: "Lima",
      destination: "Ica",
      vehicle_id: "vehicle-a",
      vehicle_plate: "ABC-123",
      client_id: "client-a",
      client_name: "Cliente",
      currency: "PEN",
      contracted_revenue: 1000,
      tons: 10,
      direct_cost: 250,
      settlement_closed: true,
      pending_cost_records: 0,
    },
  ],
  fuel: [],
  maintenance: [],
  intervals: [],
  collections: [
    {
      invoice_id: "invoice-a",
      series: "F001",
      number: "1",
      client_id: "client-a",
      client_name: "Cliente",
      issued_on: "2026-08-10",
      currency: "PEN",
      total: 1000,
      status: "issued",
      payment_id: "payment-a",
      paid_at: "2026-08-20T10:00:00.000Z",
      payment_amount: 400,
      payment_currency: "PEN",
      cancelled_at: null,
    },
    {
      invoice_id: "invoice-a",
      series: "F001",
      number: "1",
      client_id: "client-a",
      client_name: "Cliente",
      issued_on: "2026-08-10",
      currency: "PEN",
      total: 1000,
      status: "issued",
      payment_id: "payment-b",
      paid_at: "2026-08-29T10:00:00.000Z",
      payment_amount: 200,
      payment_currency: "PEN",
      cancelled_at: "2026-08-30T10:00:00.000Z",
    },
  ],
  segments: [
    {
      vehicle_id: "vehicle-a",
      vehicle_plate: "ABC-123",
      load_state: "loaded",
      kilometres: 90,
      coverage_gap: null,
    },
    {
      vehicle_id: "vehicle-a",
      vehicle_plate: "ABC-123",
      load_state: "empty",
      kilometres: 10,
      coverage_gap: null,
    },
  ],
};

describe("report calculations", () => {
  it("keeps a direct margin confirmed only when the settlement and costs are complete", () => {
    const result = buildReport(
      "company-a",
      "DIRECT_MARGIN",
      { from: "2026-08-01", to: "2026-08-31" },
      snapshot,
    );
    expect(result.rows[0]).toMatchObject({ value: 750, secondaryValue: 250, state: "CONFIRMED" });
  });

  it("subtracts only non-cancelled partial payments as of the period end", () => {
    const result = buildReport(
      "company-a",
      "COLLECTIONS",
      { from: "2026-08-01", to: "2026-08-31" },
      snapshot,
    );
    expect(result.rows[0]).toMatchObject({ value: 600, secondaryValue: 400, state: "CONFIRMED" });
  });

  it("includes a payment made during the final hour of the Lima reporting day", () => {
    const paymentAtLimaDayEnd = {
      ...snapshot.collections[0],
      paid_at: "2026-09-01T04:30:00.000Z",
    };
    const result = buildReport(
      "company-a",
      "OVERVIEW",
      { from: "2026-08-01", to: "2026-08-31" },
      { ...snapshot, collections: [paymentAtLimaDayEnd] },
    );
    expect(result.summary.find((item) => item.id === "collected")?.money).toEqual([
      { currency: "PEN", value: 400, state: "CONFIRMED" },
    ]);
  });

  it("shows the fuel date in Lima instead of its stored UTC calendar date", () => {
    const result = buildReport(
      "company-a",
      "FUEL",
      { from: "2026-08-01", to: "2026-08-31" },
      {
        ...snapshot,
        fuel: [
          {
            fuel_entry_id: "fuel-a",
            vehicle_id: "vehicle-a",
            vehicle_plate: "ABC-123",
            fueled_at: "2026-09-01T04:30:00.000Z",
            quantity: 60,
            volume_unit: "litros",
            total_amount: 320,
            completed_distance_km: 180,
            currency: "PEN",
            validation_status: "validated",
          },
        ],
      },
    );
    expect(result.rows[0]?.detail).toContain("2026-08-31");
  });

  it("reports explicit loaded and empty kilometres without inferring either state", () => {
    const result = buildReport(
      "company-a",
      "EMPTY_KILOMETRES",
      { from: "2026-08-01", to: "2026-08-31" },
      snapshot,
    );
    expect(result.rows[0]).toMatchObject({ value: 10, secondaryValue: 10 });
  });
});
