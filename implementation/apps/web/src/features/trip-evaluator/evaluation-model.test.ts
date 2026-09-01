import { describe, expect, it } from "vitest";
import {
  createEconomicPolicyDraft,
  createTripEvaluatorDraft,
  hydrateTripEvaluatorDraft,
  toEvaluationRpcInput,
  toPolicyCommandInput,
  toTripEvaluationInput,
} from "./evaluation-model";

describe("trip evaluator form model", () => {
  it("keeps economic policy values outside source-code defaults", () => {
    const draft = createEconomicPolicyDraft();
    expect(draft.currency).toBe("");
    expect(draft.taxBasis).toBe("");
    expect(draft.marginBasis).toBe("");
    expect(draft.minimumMarginPercent).toBe("");
    expect(draft.targetMarginPercent).toBe("");
    expect(() =>
      toPolicyCommandInput({
        ...draft,
        policyKey: "SIN-UMBRAL",
        name: "Sin umbral",
        taxRatePercent: "0",
      }),
    ).toThrow("margen mínimo");
  });

  it("normalizes a policy configuration and preserves its coverage labels", () => {
    const input = toPolicyCommandInput({
      ...createEconomicPolicyDraft(),
      policyKey: "NEGOCIACION-2026-08",
      name: "Negociación agosto",
      currency: "PEN",
      taxBasis: "INCLUDED",
      taxRatePercent: "18",
      marginBasis: "REVENUE",
      minimumMarginPercent: "12",
      targetMarginPercent: "20",
      directCostCategories: "Combustible, Peajes, Viáticos",
      excludedCostLabels: "Mantenimiento, Administración",
    });
    expect(input).toEqual({
      policyKey: "NEGOCIACION-2026-08",
      name: "Negociación agosto",
      currency: "PEN",
      taxBasis: "INCLUDED",
      taxRate: 0.18,
      marginBasis: "REVENUE",
      minimumMarginRate: 0.12,
      targetMarginRate: 0.2,
      costCoverage: {
        directCostCategories: ["Combustible", "Peajes", "Viáticos"],
        excludedCostLabels: ["Mantenimiento", "Administración"],
      },
    });
  });

  it("turns explicit user assumptions into a domain and RPC input", () => {
    const initial = createTripEvaluatorDraft();
    const input = toTripEvaluationInput(
      {
        ...initial,
        offerAmount: "3500",
        outboundCosts: [{ id: "outbound-1", category: "Combustible", amount: "1200" }],
        emptyReturnCosts: [{ id: "empty-1", category: "Retorno vacío", amount: "400" }],
        returnStatus: "PROBABLE",
        returnIncome: "3200",
        returnCosts: [{ id: "return-1", category: "Combustible retorno", amount: "900" }],
        returnProbabilityPercent: "75",
        estimatedDistanceKm: "2200",
        estimatedDays: "8",
      },
      {
        directCostCategories: ["Combustible", "Retorno vacío", "Combustible retorno"],
        excludedCostLabels: ["Neumáticos", "Administración"],
      },
    );
    expect(input.returnProbabilityRate).toBe(0.75);
    expect(toEvaluationRpcInput(input)).toMatchObject({
      offer_amount: 3500,
      origin: null,
      destination: null,
      outbound_direct_costs: [{ category: "Combustible", amount: 1200 }],
      estimated_distance_km: 2200,
      estimated_days: 8,
      excluded_costs: ["Neumáticos", "Administración"],
      return: { status: "PROBABLE", income: 3200, probability_rate: 0.75 },
    });
  });

  it("does not accept partially entered cost rows or an unbounded percentage", () => {
    const draft = createTripEvaluatorDraft();
    expect(() =>
      toTripEvaluationInput({
        ...draft,
        offerAmount: "100",
        outboundCosts: [{ id: "outbound-1", category: "Peajes", amount: "" }],
      }),
    ).toThrow("categoría y monto");
    expect(() =>
      toPolicyCommandInput({
        ...createEconomicPolicyDraft(),
        policyKey: "P",
        name: "P",
        taxRatePercent: "0",
        minimumMarginPercent: "100",
        targetMarginPercent: "100",
      }),
    ).toThrow("margen mínimo");
  });

  it("keeps the preview aligned with policy coverage and clears a hidden NONE return", () => {
    const input = toTripEvaluationInput(
      {
        ...createTripEvaluatorDraft(),
        offerAmount: "1000",
        origin: "Lima",
        destination: "Arequipa",
        outboundCosts: [{ id: "outbound-1", category: "combustible", amount: "200" }],
        returnStatus: "NONE",
        returnCosts: [{ id: "return-1", category: "Combustible", amount: "300" }],
      },
      {
        directCostCategories: ["Combustible"],
        excludedCostLabels: ["Administración"],
      },
    );

    expect(input).toMatchObject({
      origin: "Lima",
      destination: "Arequipa",
      outboundDirectCosts: [{ category: "Combustible", amount: 200 }],
      returnDirectCosts: [],
      excludedCosts: ["Administración"],
    });
    expect(() =>
      toTripEvaluationInput(
        {
          ...createTripEvaluatorDraft(),
          offerAmount: "1000",
          outboundCosts: [{ id: "outbound-1", category: "Peajes", amount: "200" }],
        },
        { directCostCategories: ["Combustible"], excludedCostLabels: [] },
      ),
    ).toThrow("categorías incluidas");
  });

  it("rehydrates an authoritative draft snapshot for a versioned update", () => {
    const draft = hydrateTripEvaluatorDraft({
      reference: "CARGA-EDITABLE",
      clientId: "client-a",
      vehicleId: "vehicle-a",
      input: {
        currency: "PEN",
        origin: "Lima",
        destination: "Cusco",
        offer_amount: 3500,
        outbound_direct_costs: [{ category: "Combustible", amount: 1200 }],
        empty_return_direct_costs: [{ category: "Peajes", amount: 300 }],
        return: {
          status: "PROBABLE",
          income: 2800,
          direct_costs: [{ category: "Combustible", amount: 900 }],
          probability_rate: 0.25,
        },
        estimated_distance_km: 2200,
        estimated_days: 8,
        excluded_costs: ["Administración"],
      },
    });

    expect(draft).toMatchObject({
      reference: "CARGA-EDITABLE",
      clientId: "client-a",
      vehicleId: "vehicle-a",
      origin: "Lima",
      destination: "Cusco",
      offerAmount: "3500",
      returnStatus: "PROBABLE",
      returnIncome: "2800",
      returnProbabilityPercent: "25",
      estimatedDistanceKm: "2200",
      estimatedDays: "8",
      outboundCosts: [{ category: "Combustible", amount: "1200" }],
      emptyReturnCosts: [{ category: "Peajes", amount: "300" }],
      returnCosts: [{ category: "Combustible", amount: "900" }],
    });
  });
});
