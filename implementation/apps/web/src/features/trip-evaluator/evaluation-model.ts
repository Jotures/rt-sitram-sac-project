import type {
  EvaluationPolicy,
  MarginBasis,
  TaxBasis,
  TripEvaluationCost,
  TripEvaluationInput,
  TripEvaluationReturnStatus,
} from "@rt-sitram/domain";

export interface EditableCostLine {
  readonly id: string;
  readonly category: string;
  readonly amount: string;
}

export interface TripEvaluatorDraft {
  readonly reference: string;
  readonly clientId: string;
  readonly vehicleId: string;
  readonly origin: string;
  readonly destination: string;
  readonly offerAmount: string;
  readonly outboundCosts: readonly EditableCostLine[];
  readonly emptyReturnCosts: readonly EditableCostLine[];
  readonly returnStatus: TripEvaluationReturnStatus;
  readonly returnIncome: string;
  readonly returnCosts: readonly EditableCostLine[];
  readonly returnProbabilityPercent: string;
  readonly estimatedDistanceKm: string;
  readonly estimatedDays: string;
}

export interface EconomicPolicyDraft {
  readonly policyKey: string;
  readonly name: string;
  readonly currency: string;
  readonly taxBasis: TaxBasis | "";
  readonly taxRatePercent: string;
  readonly marginBasis: MarginBasis | "";
  readonly minimumMarginPercent: string;
  readonly targetMarginPercent: string;
  readonly directCostCategories: string;
  readonly excludedCostLabels: string;
}

export interface PolicyCommandInput {
  readonly policyKey: string;
  readonly name: string;
  readonly currency: string;
  readonly taxBasis: TaxBasis;
  readonly taxRate: number;
  readonly marginBasis: MarginBasis;
  readonly minimumMarginRate: number;
  readonly targetMarginRate: number;
  readonly costCoverage: {
    readonly directCostCategories: readonly string[];
    readonly excludedCostLabels: readonly string[];
  };
}

export interface EvaluationPolicyCoverage {
  readonly directCostCategories: readonly string[];
  readonly excludedCostLabels: readonly string[];
}

/** The authoritative snapshot needed to reopen an editable server draft. */
export interface TripEvaluatorDraftSnapshot {
  readonly reference: string | null;
  readonly clientId: string | null;
  readonly vehicleId: string | null;
  readonly input: Readonly<Record<string, unknown>>;
}

export function createCostLine(id: string): EditableCostLine {
  return { id, category: "", amount: "" };
}

export function createTripEvaluatorDraft(): TripEvaluatorDraft {
  return {
    reference: "",
    clientId: "",
    vehicleId: "",
    origin: "",
    destination: "",
    offerAmount: "",
    outboundCosts: [createCostLine("outbound-1")],
    emptyReturnCosts: [createCostLine("empty-return-1")],
    returnStatus: "NONE",
    returnIncome: "",
    returnCosts: [createCostLine("return-1")],
    returnProbabilityPercent: "",
    estimatedDistanceKm: "",
    estimatedDays: "",
  };
}

/**
 * Converts an authoritative, normalized server snapshot back into editable
 * fields. Only DRAFT evaluations use this path; fixed snapshots stay immutable.
 */
export function hydrateTripEvaluatorDraft(
  snapshot: TripEvaluatorDraftSnapshot,
): TripEvaluatorDraft {
  const input = snapshot.input;
  const returnSnapshot = requiredObject(input.return, "El retorno del borrador");
  const returnStatus = requiredReturnStatus(returnSnapshot.status);

  return {
    reference: snapshot.reference ?? "",
    clientId: snapshot.clientId ?? "",
    vehicleId: snapshot.vehicleId ?? "",
    origin: optionalSnapshotText(input.origin),
    destination: optionalSnapshotText(input.destination),
    offerAmount: numberToField(input.offer_amount, "La oferta del borrador"),
    outboundCosts: snapshotCostLines(input.outbound_direct_costs, "outbound"),
    emptyReturnCosts: snapshotCostLines(input.empty_return_direct_costs, "empty-return"),
    returnStatus,
    returnIncome:
      returnStatus === "NONE" ? "" : numberToField(returnSnapshot.income, "El ingreso de retorno"),
    returnCosts: snapshotCostLines(returnSnapshot.direct_costs, "return"),
    returnProbabilityPercent:
      returnStatus === "PROBABLE"
        ? String(
            numberFromSnapshot(returnSnapshot.probability_rate, "La probabilidad de retorno") * 100,
          )
        : "",
    estimatedDistanceKm: optionalNumberToField(
      input.estimated_distance_km,
      "Los kilómetros estimados",
    ),
    estimatedDays: optionalNumberToField(input.estimated_days, "Los días estimados"),
  };
}

export function createEconomicPolicyDraft(): EconomicPolicyDraft {
  return {
    policyKey: "",
    name: "",
    currency: "",
    taxBasis: "",
    taxRatePercent: "",
    marginBasis: "",
    minimumMarginPercent: "",
    targetMarginPercent: "",
    directCostCategories: "",
    excludedCostLabels: "",
  };
}

export function toTripEvaluationInput(
  draft: TripEvaluatorDraft,
  policyCoverage?: EvaluationPolicyCoverage,
): TripEvaluationInput {
  const returnStatus = draft.returnStatus;
  const returnIncome =
    returnStatus === "NONE"
      ? undefined
      : requiredMoney(draft.returnIncome, "El ingreso de retorno");
  const probabilityRate =
    returnStatus === "PROBABLE"
      ? percentageToRate(draft.returnProbabilityPercent, "La probabilidad de retorno")
      : undefined;

  return {
    offerAmount: requiredMoney(draft.offerAmount, "La oferta"),
    ...(optionalText(draft.origin) === null ? {} : { origin: optionalText(draft.origin) }),
    ...(optionalText(draft.destination) === null
      ? {}
      : { destination: optionalText(draft.destination) }),
    outboundDirectCosts: toCostLines(
      draft.outboundCosts,
      "Los costos de ida",
      policyCoverage?.directCostCategories,
    ),
    emptyReturnDirectCosts: toCostLines(
      draft.emptyReturnCosts,
      "Los costos de retorno vacío",
      policyCoverage?.directCostCategories,
    ),
    returnStatus,
    ...(returnIncome === undefined ? {} : { returnIncome }),
    returnDirectCosts:
      returnStatus === "NONE"
        ? []
        : toCostLines(
            draft.returnCosts,
            "Los costos de retorno cargado",
            policyCoverage?.directCostCategories,
          ),
    ...(probabilityRate === undefined ? {} : { returnProbabilityRate: probabilityRate }),
    estimatedDistanceKm: optionalPositiveNumber(
      draft.estimatedDistanceKm,
      "Los kilómetros estimados",
    ),
    estimatedDays: optionalPositiveNumber(draft.estimatedDays, "Los días estimados"),
    excludedCosts: policyCoverage?.excludedCostLabels ?? [],
  };
}

export function toPolicyCommandInput(draft: EconomicPolicyDraft): PolicyCommandInput {
  const minimumMarginRate = percentageToRate(draft.minimumMarginPercent, "El margen mínimo");
  const targetMarginRate = percentageToRate(draft.targetMarginPercent, "El margen objetivo");
  if (targetMarginRate < minimumMarginRate) {
    throw new Error("El margen objetivo no puede ser menor que el margen mínimo.");
  }
  const currency = draft.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("La moneda debe tener tres letras, por ejemplo PEN.");
  }

  return {
    policyKey: requiredText(draft.policyKey, "El código de política"),
    name: requiredText(draft.name, "El nombre de política"),
    currency,
    taxBasis: requiredTaxBasis(draft.taxBasis),
    taxRate: percentageToRate(draft.taxRatePercent, "La tasa tributaria"),
    marginBasis: requiredMarginBasis(draft.marginBasis),
    minimumMarginRate,
    targetMarginRate,
    costCoverage: {
      directCostCategories: splitLabels(draft.directCostCategories),
      excludedCostLabels: splitLabels(draft.excludedCostLabels),
    },
  };
}

export function toEvaluationPolicy(row: {
  readonly id: string;
  readonly version: number;
  readonly currency: string;
  readonly taxBasis: TaxBasis;
  readonly marginBasis: MarginBasis;
  readonly minimumMarginRate: number;
  readonly targetMarginRate: number;
}): EvaluationPolicy {
  return {
    id: row.id,
    version: row.version,
    currency: row.currency,
    taxBasis: row.taxBasis,
    marginBasis: row.marginBasis,
    minimumMarginRate: row.minimumMarginRate,
    targetMarginRate: row.targetMarginRate,
  };
}

export function toEvaluationRpcInput(
  input: TripEvaluationInput,
): Readonly<Record<string, unknown>> {
  return {
    offer_amount: input.offerAmount,
    origin: input.origin ?? null,
    destination: input.destination ?? null,
    outbound_direct_costs: toRpcCostLines(input.outboundDirectCosts),
    empty_return_direct_costs: toRpcCostLines(input.emptyReturnDirectCosts ?? []),
    return: {
      status: input.returnStatus,
      income: input.returnIncome ?? 0,
      direct_costs: toRpcCostLines(input.returnDirectCosts ?? []),
      probability_rate: input.returnProbabilityRate ?? (input.returnStatus === "CONFIRMED" ? 1 : 0),
    },
    estimated_distance_km: input.estimatedDistanceKm ?? null,
    estimated_days: input.estimatedDays ?? null,
    excluded_costs: input.excludedCosts ?? [],
  };
}

function toCostLines(
  lines: readonly EditableCostLine[],
  label: string,
  allowedCategories?: readonly string[],
): readonly TripEvaluationCost[] {
  return lines.flatMap((line) => {
    const category = line.category.trim();
    const amount = line.amount.trim();
    if (category === "" && amount === "") return [];
    if (category === "" || amount === "") {
      throw new Error(`${label} requieren categoría y monto en cada fila usada.`);
    }
    const allowedCategory = allowedCategories?.find(
      (candidate) => candidate.trim().toLocaleLowerCase() === category.toLocaleLowerCase(),
    );
    if (allowedCategories !== undefined && allowedCategory === undefined) {
      throw new Error(`${label} solo permiten categorías incluidas en la política activa.`);
    }
    return [{ category: allowedCategory ?? category, amount: requiredMoney(amount, label) }];
  });
}

function toRpcCostLines(costs: readonly TripEvaluationCost[]): readonly Record<string, unknown>[] {
  return costs.map((cost) => ({ category: cost.category, amount: cost.amount }));
}

function requiredMoney(value: string, label: string): number {
  const normalized = value.trim();
  if (normalized === "") {
    throw new Error(`${label} es obligatorio.`);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} debe ser un monto finito no negativo.`);
  }
  return parsed;
}

function optionalPositiveNumber(value: string, label: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} debe ser mayor que cero cuando se indique.`);
  }
  return parsed;
}

function percentageToRate(value: string, label: string): number {
  const normalized = value.trim();
  if (normalized === "") {
    throw new Error(`${label} es obligatorio.`);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) {
    throw new Error(`${label} debe estar entre 0% y menos de 100%.`);
  }
  return parsed / 100;
}

function requiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === "") throw new Error(`${label} es obligatorio.`);
  return trimmed;
}

function requiredTaxBasis(value: EconomicPolicyDraft["taxBasis"]): TaxBasis {
  if (value === "INCLUDED" || value === "EXCLUDED") return value;
  throw new Error("La base tributaria es obligatoria.");
}

function requiredMarginBasis(value: EconomicPolicyDraft["marginBasis"]): MarginBasis {
  if (value === "REVENUE" || value === "COST") return value;
  throw new Error("La base del margen es obligatoria.");
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function requiredObject(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} no tiene una estructura válida.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function requiredReturnStatus(value: unknown): TripEvaluationReturnStatus {
  if (value === "NONE" || value === "PROBABLE" || value === "CONFIRMED") return value;
  throw new Error("La situación de retorno del borrador no es válida.");
}

function optionalSnapshotText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function snapshotCostLines(value: unknown, prefix: string): readonly EditableCostLine[] {
  if (!Array.isArray(value)) {
    throw new Error(`Los costos ${prefix} del borrador no tienen una estructura válida.`);
  }
  const lines = value.map((entry, index) => {
    const cost = requiredObject(entry, `El costo ${index + 1}`);
    const category = optionalSnapshotText(cost.category).trim();
    if (category === "") throw new Error(`El costo ${index + 1} no tiene una categoría válida.`);
    return {
      id: `${prefix}-${index + 1}`,
      category,
      amount: numberToField(cost.amount, `El monto del costo ${index + 1}`),
    };
  });
  return lines.length > 0 ? lines : [createCostLine(`${prefix}-1`)];
}

function optionalNumberToField(value: unknown, label: string): string {
  return value === null || value === undefined ? "" : numberToField(value, label);
}

function numberToField(value: unknown, label: string): string {
  return String(numberFromSnapshot(value, label));
}

function numberFromSnapshot(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} no es un número válido.`);
  }
  return value;
}

function splitLabels(value: string): readonly string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
