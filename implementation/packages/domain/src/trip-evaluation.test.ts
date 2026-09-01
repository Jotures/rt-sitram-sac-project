import { describe, expect, it } from "vitest";
import {
  calculateTripEvaluation,
  type EvaluationPolicy,
  type TripEvaluationInput,
} from "./trip-evaluation";

const revenuePolicy: EvaluationPolicy = {
  id: "policy-a",
  version: 3,
  currency: "PEN",
  taxBasis: "INCLUDED",
  marginBasis: "REVENUE",
  minimumMarginRate: 0.1,
  targetMarginRate: 0.2,
};

const returnInput: TripEvaluationInput = {
  offerAmount: 1_000,
  outboundDirectCosts: [{ category: "Combustible ida", amount: 400 }],
  emptyReturnDirectCosts: [{ category: "Combustible retorno vacío", amount: 100 }],
  returnStatus: "PROBABLE",
  returnIncome: 1_000,
  returnDirectCosts: [{ category: "Combustible retorno cargado", amount: 500 }],
  returnProbabilityRate: 0.5,
  estimatedDistanceKm: 1_000,
  estimatedDays: 5,
  excludedCosts: ["Mantenimiento", "Administración"],
};

describe("trip evaluator domain", () => {
  it("keeps conservative, probable and favorable return scenarios separate", () => {
    const result = calculateTripEvaluation(returnInput, revenuePolicy);

    expect(result.coverage).toBe("DIRECT_ONLY");
    expect(result.excludedCostCopy).toContain("Mantenimiento");
    expect(result.scenarios.CONSERVATIVE).toMatchObject({
      directRevenue: 1_000,
      directCost: 500,
      directMargin: 500,
      marginRate: 0.5,
      prices: { equilibrium: 500, minimum: 555.56, target: 625 },
    });
    expect(result.scenarios.PROBABLE).toMatchObject({
      directRevenue: 1_500,
      directCost: 700,
      directMargin: 800,
      marginRate: 0.5333,
    });
    expect(result.scenarios.FAVORABLE).toMatchObject({
      directRevenue: 2_000,
      directCost: 900,
      directMargin: 1_100,
      marginRate: 0.55,
    });
    expect(result.scenarios.CONSERVATIVE.metrics).toMatchObject({
      directCostPerDay: 100,
      directRevenuePerDay: 200,
      directMarginPerDay: 100,
    });
    expect(result.assessment).toEqual({
      thresholdScenario: "CONSERVATIVE",
      offerAmount: 1_000,
      minimumPrice: 555.56,
      requiresException: false,
    });
  });

  it("uses the policy margin basis for negotiation prices", () => {
    const result = calculateTripEvaluation(returnInput, {
      ...revenuePolicy,
      marginBasis: "COST",
    });

    expect(result.scenarios.CONSERVATIVE.prices).toEqual({
      equilibrium: 500,
      minimum: 550,
      target: 600,
    });
    expect(result.scenarios.CONSERVATIVE.marginRate).toBe(1);
  });

  it("does not invent return revenue or metrics when the inputs are unavailable", () => {
    const result = calculateTripEvaluation(
      {
        offerAmount: 800,
        outboundDirectCosts: [{ category: "Peajes", amount: 80 }],
        returnStatus: "NONE",
      },
      revenuePolicy,
    );

    expect(result.scenarios.PROBABLE).toEqual(result.scenarios.CONSERVATIVE);
    expect(result.scenarios.FAVORABLE).toEqual(result.scenarios.CONSERVATIVE);
    expect(result.scenarios.CONSERVATIVE.metrics).toMatchObject({
      estimatedDistanceKm: null,
      estimatedDays: null,
      directCostPerKm: null,
      directCostPerDay: null,
      directRevenuePerDay: null,
      directMarginPerDay: null,
    });
  });

  it("requires the inputs that make a return or policy meaningful", () => {
    const { returnProbabilityRate, ...inputWithoutProbability } = returnInput;
    expect(returnProbabilityRate).toBe(0.5);
    expect(() => calculateTripEvaluation(inputWithoutProbability, revenuePolicy)).toThrow(
      "probabilidad explícita",
    );
    expect(() =>
      calculateTripEvaluation(returnInput, { ...revenuePolicy, targetMarginRate: 0.05 }),
    ).toThrow("objetivo no puede ser menor");
    expect(() =>
      calculateTripEvaluation({ ...returnInput, estimatedDays: 0 }, revenuePolicy),
    ).toThrow("mayor que cero");
  });

  it("requires a confirmed return to remain 100% instead of silently changing its scenario", () => {
    expect(() =>
      calculateTripEvaluation(
        { ...returnInput, returnStatus: "CONFIRMED", returnProbabilityRate: 0.8 },
        revenuePolicy,
      ),
    ).toThrow("retorno confirmado");
  });

  it("flags a below-minimum offer using the policy instead of a hardcoded threshold", () => {
    const result = calculateTripEvaluation(
      {
        offerAmount: 520,
        outboundDirectCosts: [{ category: "Peajes", amount: 500 }],
        returnStatus: "NONE",
      },
      revenuePolicy,
    );

    expect(result.assessment).toMatchObject({
      offerAmount: 520,
      minimumPrice: 555.56,
      requiresException: true,
    });
  });
});
