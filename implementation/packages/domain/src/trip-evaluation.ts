import { roundMoney, sumMoney } from "./money";

/** Defines how a policy interprets its margin percentages. */
export type MarginBasis = "REVENUE" | "COST";

/** All amounts in an evaluation must use the same declared tax treatment. */
export type TaxBasis = "INCLUDED" | "EXCLUDED";

export type TripEvaluationReturnStatus = "NONE" | "PROBABLE" | "CONFIRMED";

export type TripEvaluationScenarioType = "CONSERVATIVE" | "PROBABLE" | "FAVORABLE";

/** V1 intentionally stops before allocated operating costs or economic profit. */
export type EvaluationCoverage = "DIRECT_ONLY";

export interface EvaluationPolicy {
  readonly id?: string;
  readonly version: number;
  readonly currency: string;
  readonly taxBasis: TaxBasis;
  readonly marginBasis: MarginBasis;
  readonly minimumMarginRate: number;
  readonly targetMarginRate: number;
}

export interface TripEvaluationCost {
  readonly category: string;
  readonly amount: number;
}

export interface TripEvaluationInput {
  readonly offerAmount: number;
  readonly origin?: string | null;
  readonly destination?: string | null;
  readonly outboundDirectCosts: readonly TripEvaluationCost[];
  readonly emptyReturnDirectCosts?: readonly TripEvaluationCost[];
  readonly returnStatus: TripEvaluationReturnStatus;
  readonly returnIncome?: number;
  readonly returnDirectCosts?: readonly TripEvaluationCost[];
  /** A manual assumption. It is never represented as a historical prediction. */
  readonly returnProbabilityRate?: number;
  readonly estimatedDistanceKm?: number | null;
  readonly estimatedDays?: number | null;
  /** Labels of costs intentionally not included in direct margin. */
  readonly excludedCosts?: readonly string[];
}

export interface NegotiationPrices {
  readonly equilibrium: number;
  readonly minimum: number;
  readonly target: number;
}

export interface TripEvaluationMetrics {
  readonly estimatedDistanceKm: number | null;
  readonly estimatedDays: number | null;
  readonly directCostPerKm: number | null;
  readonly directRevenuePerKm: number | null;
  readonly directMarginPerKm: number | null;
  readonly directCostPerDay: number | null;
  readonly directRevenuePerDay: number | null;
  readonly directMarginPerDay: number | null;
}

export interface TripEvaluationAssessment {
  readonly thresholdScenario: "CONSERVATIVE";
  readonly offerAmount: number;
  readonly minimumPrice: number;
  readonly requiresException: boolean;
}

export interface TripEvaluationScenario {
  readonly type: TripEvaluationScenarioType;
  readonly directRevenue: number;
  readonly directCost: number;
  readonly directMargin: number;
  readonly marginRate: number | null;
  readonly prices: NegotiationPrices;
  readonly metrics: TripEvaluationMetrics;
}

export interface TripEvaluationResult {
  readonly coverage: EvaluationCoverage;
  readonly excludedCosts: readonly string[];
  readonly excludedCostCopy: string;
  readonly policy: EvaluationPolicy;
  readonly scenarios: Readonly<Record<TripEvaluationScenarioType, TripEvaluationScenario>>;
  readonly assessment: TripEvaluationAssessment;
}

/**
 * Calculates a commercial estimate from explicit assumptions. It does not
 * create a financial record and it never represents direct margin as net profit.
 */
export function calculateTripEvaluation(
  input: TripEvaluationInput,
  policy: EvaluationPolicy,
): TripEvaluationResult {
  validatePolicy(policy);
  validateInput(input);

  const outboundCost = sumCosts(input.outboundDirectCosts, "Los costos directos de ida");
  const emptyReturnCost = sumCosts(
    input.emptyReturnDirectCosts ?? [],
    "Los costos directos de retorno vacío",
  );
  const returnCost = sumCosts(
    input.returnDirectCosts ?? [],
    "Los costos directos de retorno cargado",
  );
  const offerAmount = assertMoney(input.offerAmount, "La oferta");
  const returnIncome = assertMoney(input.returnIncome ?? 0, "El ingreso de retorno");
  const probability = resolveReturnProbability(input);
  const distance = optionalPositiveNumber(input.estimatedDistanceKm, "Los kilómetros estimados");
  const days = optionalPositiveNumber(input.estimatedDays, "Los días estimados");

  const conservative = createScenario({
    type: "CONSERVATIVE",
    revenue: offerAmount,
    cost: roundMoney(outboundCost + emptyReturnCost),
    policy,
    distance,
    days,
  });

  if (input.returnStatus === "NONE") {
    return makeResult(policy, input.excludedCosts, conservative, conservative, conservative);
  }

  const probable = createScenario({
    type: "PROBABLE",
    revenue: roundMoney(offerAmount + probability * returnIncome),
    cost: roundMoney(outboundCost + probability * returnCost + (1 - probability) * emptyReturnCost),
    policy,
    distance,
    days,
  });
  const favorable = createScenario({
    type: "FAVORABLE",
    revenue: roundMoney(offerAmount + returnIncome),
    cost: roundMoney(outboundCost + returnCost),
    policy,
    distance,
    days,
  });

  return makeResult(policy, input.excludedCosts, conservative, probable, favorable);
}

function makeResult(
  policy: EvaluationPolicy,
  excludedCosts: readonly string[] | undefined,
  conservative: TripEvaluationScenario,
  probable: TripEvaluationScenario,
  favorable: TripEvaluationScenario,
): TripEvaluationResult {
  const normalizedExcludedCosts = (excludedCosts ?? []).map((cost) => {
    if (typeof cost !== "string" || cost.trim() === "") {
      throw new Error("Cada costo excluido debe tener una descripción.");
    }
    return cost.trim();
  });

  return {
    coverage: "DIRECT_ONLY",
    excludedCosts: normalizedExcludedCosts,
    excludedCostCopy:
      normalizedExcludedCosts.length === 0
        ? "El resultado muestra solo margen directo; no se declararon costos excluidos."
        : `El resultado muestra solo margen directo y excluye: ${normalizedExcludedCosts.join(", ")}.`,
    policy: { ...policy, currency: policy.currency.toUpperCase() },
    scenarios: { CONSERVATIVE: conservative, PROBABLE: probable, FAVORABLE: favorable },
    assessment: {
      thresholdScenario: "CONSERVATIVE",
      offerAmount: conservative.directRevenue,
      minimumPrice: conservative.prices.minimum,
      requiresException: conservative.directRevenue < conservative.prices.minimum,
    },
  };
}

function createScenario(input: {
  readonly type: TripEvaluationScenarioType;
  readonly revenue: number;
  readonly cost: number;
  readonly policy: EvaluationPolicy;
  readonly distance: number | null;
  readonly days: number | null;
}): TripEvaluationScenario {
  const directRevenue = roundMoney(input.revenue);
  const directCost = roundMoney(input.cost);
  const directMargin = roundMoney(directRevenue - directCost);

  return {
    type: input.type,
    directRevenue,
    directCost,
    directMargin,
    marginRate: calculateMarginRate(directRevenue, directCost, input.policy.marginBasis),
    prices: {
      equilibrium: directCost,
      minimum: priceForMargin(directCost, input.policy.minimumMarginRate, input.policy.marginBasis),
      target: priceForMargin(directCost, input.policy.targetMarginRate, input.policy.marginBasis),
    },
    metrics: calculateMetrics({
      directRevenue,
      directCost,
      directMargin,
      distance: input.distance,
      days: input.days,
    }),
  };
}

function calculateMetrics(input: {
  readonly directRevenue: number;
  readonly directCost: number;
  readonly directMargin: number;
  readonly distance: number | null;
  readonly days: number | null;
}): TripEvaluationMetrics {
  const hasDistance = input.distance !== null && input.distance > 0;
  const hasDays = input.days !== null && input.days > 0;
  return {
    estimatedDistanceKm: input.distance,
    estimatedDays: input.days,
    directCostPerKm: hasDistance ? roundMoney(input.directCost / input.distance) : null,
    directRevenuePerKm: hasDistance ? roundMoney(input.directRevenue / input.distance) : null,
    directMarginPerKm: hasDistance ? roundMoney(input.directMargin / input.distance) : null,
    directCostPerDay: hasDays ? roundMoney(input.directCost / input.days) : null,
    directRevenuePerDay: hasDays ? roundMoney(input.directRevenue / input.days) : null,
    directMarginPerDay: hasDays ? roundMoney(input.directMargin / input.days) : null,
  };
}

function calculateMarginRate(revenue: number, cost: number, basis: MarginBasis): number | null {
  const denominator = basis === "REVENUE" ? revenue : cost;
  if (denominator === 0) return null;
  return roundRate((revenue - cost) / denominator);
}

function priceForMargin(cost: number, rate: number, basis: MarginBasis): number {
  return basis === "REVENUE" ? roundMoney(cost / (1 - rate)) : roundMoney(cost * (1 + rate));
}

function resolveReturnProbability(input: TripEvaluationInput): number {
  if (input.returnStatus === "NONE") return 0;
  if (input.returnStatus === "CONFIRMED") {
    if (input.returnProbabilityRate !== undefined && input.returnProbabilityRate !== 1) {
      throw new Error("Un retorno confirmado debe tener probabilidad de 100%.");
    }
    return 1;
  }
  if (input.returnProbabilityRate === undefined) {
    throw new Error("Un retorno probable requiere una probabilidad explícita.");
  }
  return assertRate(input.returnProbabilityRate, "La probabilidad de retorno");
}

function validatePolicy(policy: EvaluationPolicy): void {
  if (!Number.isInteger(policy.version) || policy.version < 1) {
    throw new Error("La versión de política debe ser un entero positivo.");
  }
  if (!/^[A-Za-z]{3}$/.test(policy.currency)) {
    throw new Error("La moneda de la política debe usar tres letras.");
  }
  if (policy.taxBasis !== "INCLUDED" && policy.taxBasis !== "EXCLUDED") {
    throw new Error("La base tributaria de la política no es válida.");
  }
  if (policy.marginBasis !== "REVENUE" && policy.marginBasis !== "COST") {
    throw new Error("La base del margen de la política no es válida.");
  }
  const minimum = assertRate(policy.minimumMarginRate, "El margen mínimo");
  const target = assertRate(policy.targetMarginRate, "El margen objetivo");
  if (target < minimum) {
    throw new Error("El margen objetivo no puede ser menor que el margen mínimo.");
  }
}

function validateInput(input: TripEvaluationInput): void {
  assertMoney(input.offerAmount, "La oferta");
  validateOptionalLocation(input.origin, "El origen");
  validateOptionalLocation(input.destination, "El destino");
  if (
    input.returnStatus !== "NONE" &&
    input.returnStatus !== "PROBABLE" &&
    input.returnStatus !== "CONFIRMED"
  ) {
    throw new Error("El estado de retorno no es válido.");
  }
  if (input.returnStatus !== "NONE" && input.returnIncome === undefined) {
    throw new Error("Un retorno identificado requiere un ingreso estimado.");
  }
  optionalPositiveNumber(input.estimatedDistanceKm, "Los kilómetros estimados");
  optionalPositiveNumber(input.estimatedDays, "Los días estimados");
  sumCosts(input.outboundDirectCosts, "Los costos directos de ida");
  sumCosts(input.emptyReturnDirectCosts ?? [], "Los costos directos de retorno vacío");
  sumCosts(input.returnDirectCosts ?? [], "Los costos directos de retorno cargado");
}

function sumCosts(costs: readonly TripEvaluationCost[], label: string): number {
  for (const cost of costs) {
    if (typeof cost.category !== "string" || cost.category.trim() === "") {
      throw new Error(`${label} deben indicar una categoría.`);
    }
    assertMoney(cost.amount, label);
  }
  return sumMoney(costs.map((cost) => cost.amount));
}

function assertMoney(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} debe ser un monto finito no negativo.`);
  }
  return roundMoney(value);
}

function assertRate(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`${label} debe estar entre 0% y menos de 100%.`);
  }
  return value;
}

function optionalPositiveNumber(value: number | null | undefined, label: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} debe ser un número mayor que cero cuando se indique.`);
  }
  return value;
}

function validateOptionalLocation(value: string | null | undefined, label: string): void {
  if (value === null || value === undefined) return;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} debe ser un texto no vacío cuando se indique.`);
  }
}

function roundRate(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}
