import { describe, expect, it } from "vitest";
import {
  actionFromSearch,
  cycleNextStep,
  cycleStateLabel,
  matchesSearch,
  outingPath,
  possibleDuplicate,
  type OperationActivity,
} from "./workspace-model";
import type { OperationCommandBody } from "./operation-command";

const expense = {
  kind: "expense",
  payload: {
    cycle_id: "outing-a",
    amount: 85,
    occurred_at: "2026-09-11T12:00:00Z",
    category_id: "food",
    description: "Almuerzo",
  },
} as const satisfies OperationCommandBody;
const previous = (overrides: Partial<OperationActivity> = {}): OperationActivity => ({
  id: "saved",
  kind: "expense",
  payload: JSON.stringify(expense.payload),
  status: "confirmed",
  dependency_id: "outing-a",
  created_at: "2026-09-11T12:00:00Z",
  error_message: null,
  ...overrides,
});

describe("contextual operation navigation", () => {
  it("preserves the exact outing and action, including escaped identifiers", () => {
    const path = outingPath("a/b", "expense");
    const params = new URLSearchParams(path.split("?")[1]);
    expect(params.get("salida")).toBe("a/b");
    expect(actionFromSearch(params)).toBe("expense");
    expect(actionFromSearch(new URLSearchParams("accion=unknown"))).toBeNull();
  });
  it("never recommends another departure or return after a recorded return or cancellation", () => {
    expect(cycleNextStep({ status: "planned" }).action).toBe("start");
    expect(cycleNextStep({ status: "active", returnedAt: "2026-09-10" }).action).toBeNull();
    expect(cycleStateLabel({ status: "cancelled" })).toBe("Cancelada");
    expect(cycleNextStep({ status: "cancelled" }).label).toBe("Consultar salida");
  });
  it("finds multiword names, plates and dates despite accents, separators and word order", () => {
    expect(matchesSearch("José Cáceres · ABC-123 · 11/9/2026", "caceres jose abc 123")).toBe(true);
    expect(matchesSearch("Cusco → Lima", "lima cusco")).toBe(true);
    expect(matchesSearch("ABC-123", "ABC999")).toBe(false);
  });
});

describe("advisory duplicate detection", () => {
  it("warns about a separate record of the same expense near the same time", () => {
    expect(possibleDuplicate(expense, "new", [previous()])).toContain("Almuerzo");
    expect(possibleDuplicate(expense, "new", [previous({ status: "pending" })])).not.toBeNull();
  });
  it("allows idempotent retries and does not treat failed records as delivered money", () => {
    expect(possibleDuplicate(expense, "saved", [previous()])).toBeNull();
    expect(possibleDuplicate(expense, "new", [previous({ status: "failed" })])).toBeNull();
  });
  it.each([
    { cycle_id: "another" },
    { amount: 90 },
    { category_id: "toll" },
    { occurred_at: "2026-09-10T12:00:00Z" },
    { occurred_at: "invalid" },
  ])("does not warn when the facts differ: %o", (change) => {
    expect(
      possibleDuplicate(expense, "new", [
        previous({ payload: JSON.stringify({ ...expense.payload, ...change }) }),
      ]),
    ).toBeNull();
  });
  it("ignores malformed historical data", () => {
    expect(possibleDuplicate(expense, "new", [previous({ payload: "{" })])).toBeNull();
  });
  it("distinguishes fuel quantity, units and payment source", () => {
    const fuel = {
      kind: "fuel",
      payload: {
        cycle_id: "outing-a",
        occurred_at: expense.payload.occurred_at,
        id: "fuel-new",
        quantity: 10,
        total_amount: 150,
        unit_price: 15,
        volume_unit: "gallon",
        payment_source: "company",
        odometer_km: null,
      },
    } as const satisfies OperationCommandBody;
    const saved = previous({ kind: "fuel", payload: JSON.stringify(fuel.payload) });
    expect(possibleDuplicate(fuel, "fuel-new", [saved])).not.toBeNull();
    expect(
      possibleDuplicate(fuel, "fuel-new", [
        { ...saved, payload: JSON.stringify({ ...fuel.payload, payment_source: "driver_fund" }) },
      ]),
    ).toBeNull();
  });
});
