import type { DomainDecision, TripOperationalStatus } from "./trip";

export type SettlementDirection = "DRIVER_RETURNS" | "BALANCED" | "COMPANY_REIMBURSES";

export interface SettlementCalculation {
  readonly totalAdvances: number;
  readonly totalApprovedExpenses: number;
  readonly balance: number;
  readonly direction: SettlementDirection;
}

export type InvoiceCollectionStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOIDED";

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} debe ser un monto finito no negativo.`);
  }
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("El monto debe ser finito.");
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sumMoney(values: readonly number[]): number {
  return roundMoney(
    values.reduce((total, value) => {
      assertFiniteNonNegative(value, "El monto");
      return total + value;
    }, 0),
  );
}

export function calculateSettlement(
  advances: readonly number[],
  approvedExpenses: readonly number[],
): SettlementCalculation {
  const totalAdvances = sumMoney(advances);
  const totalApprovedExpenses = sumMoney(approvedExpenses);
  const balance = roundMoney(totalAdvances - totalApprovedExpenses);

  return {
    totalAdvances,
    totalApprovedExpenses,
    balance,
    direction: balance > 0 ? "DRIVER_RETURNS" : balance < 0 ? "COMPANY_REIMBURSES" : "BALANCED",
  };
}

export interface SettlementClosureInput {
  readonly tripOperationalStatus: TripOperationalStatus;
  readonly pendingExpenseCount: number;
  readonly observedExpenseCount: number;
  readonly allAdvancesIncluded: boolean;
  readonly balanceResolved: boolean;
}

export function evaluateSettlementClosure(input: SettlementClosureInput): DomainDecision {
  const reasons: string[] = [];

  assertNonNegativeInteger(input.pendingExpenseCount, "La cantidad de gastos pendientes");
  assertNonNegativeInteger(input.observedExpenseCount, "La cantidad de gastos observados");

  if (input.tripOperationalStatus !== "COMPLETED") {
    reasons.push("El transporte debe estar completado antes de cerrar la rendición.");
  }
  if (input.pendingExpenseCount > 0) {
    reasons.push("Existen gastos pendientes de revisión.");
  }
  if (input.observedExpenseCount > 0) {
    reasons.push("Existen gastos observados sin resolver.");
  }
  if (!input.allAdvancesIncluded) {
    reasons.push("Todos los adelantos del viaje deben incluirse en la rendición.");
  }
  if (!input.balanceResolved) {
    reasons.push("El saldo de la rendición debe estar resuelto.");
  }

  return { allowed: reasons.length === 0, reasons };
}

export function calculateInvoiceBalance(total: number, payments: readonly number[]): number {
  assertFiniteNonNegative(total, "El total de la factura");
  const balance = roundMoney(total - sumMoney(payments));

  if (balance < 0) {
    throw new Error("Los pagos no pueden superar el total de la factura.");
  }

  return balance;
}

export function deriveInvoiceCollectionStatus(input: {
  readonly total: number;
  readonly payments: readonly number[];
  readonly dueDate: Date;
  readonly asOf: Date;
  readonly voided?: boolean;
}): InvoiceCollectionStatus {
  if (input.voided === true) {
    return "VOIDED";
  }

  assertValidDate(input.dueDate, "La fecha de vencimiento");
  assertValidDate(input.asOf, "La fecha de evaluación");
  const balance = calculateInvoiceBalance(input.total, input.payments);

  if (balance === 0) {
    return "PAID";
  }
  if (input.asOf.getTime() > input.dueDate.getTime()) {
    return "OVERDUE";
  }
  return balance < input.total ? "PARTIALLY_PAID" : "UNPAID";
}

export interface ProfitabilityCalculation {
  readonly grossIncome: number;
  readonly directCosts: number;
  readonly directMargin: number;
  readonly allocatedOperatingCosts: number;
  readonly operatingMargin: number;
  /** Porcentaje de margen directo; no representa utilidad neta. */
  readonly marginPercentage: number | null;
  readonly operatingMarginPercentage: number | null;
}

export function calculateProfitability(input: {
  readonly income: readonly number[];
  readonly directCosts: readonly number[];
  readonly allocatedOperatingCosts?: readonly number[];
}): ProfitabilityCalculation {
  const grossIncome = sumMoney(input.income);
  const directCosts = sumMoney(input.directCosts);
  const allocatedOperatingCosts = sumMoney(input.allocatedOperatingCosts ?? []);
  const directMargin = roundMoney(grossIncome - directCosts);
  const operatingMargin = roundMoney(directMargin - allocatedOperatingCosts);

  return {
    grossIncome,
    directCosts,
    directMargin,
    allocatedOperatingCosts,
    operatingMargin,
    marginPercentage: grossIncome === 0 ? null : roundMoney((directMargin / grossIncome) * 100),
    operatingMarginPercentage:
      grossIncome === 0 ? null : roundMoney((operatingMargin / grossIncome) * 100),
  };
}

export interface TripDirectFinancialInput {
  readonly freight: number;
  readonly additionalIncome?: readonly number[];
  readonly fuelCosts: readonly number[];
  /** No debe contener combustible: se suma por separado para evitar doble contabilización. */
  readonly approvedExpenses: readonly number[];
}

export function calculateTripDirectFinancials(
  input: TripDirectFinancialInput,
): ProfitabilityCalculation {
  return calculateProfitability({
    income: [input.freight, ...(input.additionalIncome ?? [])],
    directCosts: [...input.fuelCosts, ...input.approvedExpenses],
  });
}

export interface CycleLegPerformance {
  readonly grossIncome: number;
  readonly directCosts: number;
  readonly loadedKilometres: number;
  readonly emptyKilometres: number;
}

export interface CyclePerformance {
  readonly grossIncome: number;
  readonly directCosts: number;
  readonly directMargin: number;
  readonly totalKilometres: number;
  readonly loadedKilometres: number;
  readonly emptyKilometres: number;
  readonly emptyKilometresPercentage: number | null;
  readonly elapsedDays: number;
  readonly directMarginPerDay: number | null;
}

export function calculateCyclePerformance(input: {
  readonly legs: readonly CycleLegPerformance[];
  readonly cycleOnlyDirectCosts?: readonly number[];
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}): CyclePerformance {
  assertValidDate(input.startedAt, "La fecha de inicio del ciclo");
  if (input.completedAt !== null) {
    assertValidDate(input.completedAt, "La fecha de cierre del ciclo");
    if (input.completedAt < input.startedAt) {
      throw new Error("El ciclo no puede terminar antes de comenzar.");
    }
  }

  let grossIncome = 0;
  let directCosts = 0;
  let loadedKilometres = 0;
  let emptyKilometres = 0;

  for (const leg of input.legs) {
    assertFiniteNonNegative(leg.grossIncome, "El ingreso del viaje");
    assertFiniteNonNegative(leg.directCosts, "El costo directo del viaje");
    assertFiniteNonNegative(leg.loadedKilometres, "Los kilómetros cargados");
    assertFiniteNonNegative(leg.emptyKilometres, "Los kilómetros vacíos");
    grossIncome += leg.grossIncome;
    directCosts += leg.directCosts;
    loadedKilometres += leg.loadedKilometres;
    emptyKilometres += leg.emptyKilometres;
  }

  directCosts += sumMoney(input.cycleOnlyDirectCosts ?? []);
  grossIncome = roundMoney(grossIncome);
  directCosts = roundMoney(directCosts);
  const directMargin = roundMoney(grossIncome - directCosts);
  const totalKilometres = loadedKilometres + emptyKilometres;
  const elapsedDays =
    input.completedAt === null
      ? 0
      : Math.max(
          1,
          Math.ceil((input.completedAt.getTime() - input.startedAt.getTime()) / 86_400_000),
        );

  return {
    grossIncome,
    directCosts,
    directMargin,
    totalKilometres,
    loadedKilometres,
    emptyKilometres,
    emptyKilometresPercentage:
      totalKilometres === 0 ? null : roundMoney((emptyKilometres / totalKilometres) * 100),
    elapsedDays,
    directMarginPerDay: input.completedAt === null ? null : roundMoney(directMargin / elapsedDays),
  };
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} debe ser un entero no negativo.`);
  }
}

function assertValidDate(value: Date, label: string): void {
  if (!Number.isFinite(value.getTime())) {
    throw new Error(`${label} debe ser válida.`);
  }
}
