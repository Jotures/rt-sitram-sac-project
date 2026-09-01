import {
  calculateSettlement,
  evaluateSettlementClosure,
  type SettlementCalculation,
  type TripOperationalStatus,
} from "@rt-sitram/domain";
import {
  type ActorContext,
  type Clock,
  type IdGenerator,
  requireFiniteNonNegative,
  requirePermission,
  requireSameCompany,
  requireText,
  toIsoTimestamp,
} from "../shared/application";
import type { ProductCommandTransport } from "../shared/supabase-rpc";

export type ExpenseValidationStatus = "PENDING_REVIEW" | "VALIDATED" | "OBSERVED" | "REJECTED";

export interface ExpenseModel {
  readonly id: string;
  readonly companyId: string;
  readonly tripId: string;
  readonly driverProfileId: string;
  readonly categoryId: string;
  readonly amount: number;
  readonly occurredAt: string;
  readonly description: string;
  readonly receiptLocalId: string | null;
  readonly validationStatus: ExpenseValidationStatus;
}

export interface FuelEntryModel {
  readonly id: string;
  readonly companyId: string;
  readonly tripId: string;
  readonly vehicleId: string;
  readonly driverProfileId: string;
  readonly occurredAt: string;
  readonly mileage: number;
  readonly quantity: number;
  readonly volumeUnit: "LITRE" | "GALLON";
  readonly unitPrice: number;
  readonly total: number;
  readonly supplierName: string;
  readonly receiptLocalId: string | null;
}

export interface AdvanceModel {
  readonly id: string;
  readonly companyId: string;
  readonly tripId: string;
  readonly driverId: string;
  readonly amount: number;
  readonly concept: string;
}

export interface SettlementContext {
  readonly id: string;
  readonly companyId: string;
  readonly tripId: string;
  readonly tripOperationalStatus: TripOperationalStatus;
  readonly advances: readonly number[];
  readonly approvedExpenses: readonly number[];
  readonly pendingExpenseCount: number;
  readonly observedExpenseCount: number;
  readonly allAdvancesIncluded: boolean;
  readonly balanceResolved: boolean;
  readonly state: "PENDING" | "IN_REVIEW" | "OBSERVED" | "APPROVED" | "CLOSED";
}

export interface TripMoneyOfflineStore {
  createExpense(expense: ExpenseModel): Promise<void>;
  createFuelEntry(fuelEntry: FuelEntryModel): Promise<void>;
  getSettlementContext(settlementId: string): Promise<SettlementContext | null>;
}

export interface TripMoneyCommandGateway {
  issueAdvance(input: {
    readonly tripId: string;
    readonly driverId: string;
    readonly amount: number;
    readonly concept: string;
  }): Promise<string>;
  closeSettlement(input: {
    readonly settlementId: string;
    readonly resolutionMethod: string;
    readonly resolutionReference: string;
    readonly resolutionNote: string | null;
  }): Promise<void>;
  reopenSettlement(input: {
    readonly settlementId: string;
    readonly reason: string;
  }): Promise<void>;
}

export async function recordExpenseOffline(
  dependencies: {
    readonly store: TripMoneyOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  input: {
    readonly tripId: string;
    readonly categoryId: string;
    readonly amount: number;
    readonly description: string;
    readonly receiptLocalId?: string | null;
  },
): Promise<ExpenseModel> {
  requirePermission(actor, "RECORD_OWN_TRIP_ACTIVITY");
  requireFiniteNonNegative(input.amount, "El monto del gasto");
  if (input.amount === 0) {
    throw new Error("El monto del gasto debe ser mayor que cero.");
  }
  const expense: ExpenseModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    tripId: requireText(input.tripId, "El viaje"),
    driverProfileId: actor.profileId,
    categoryId: requireText(input.categoryId, "La categoría"),
    amount: input.amount,
    occurredAt: toIsoTimestamp(dependencies.clock.now()),
    description: input.description.trim(),
    receiptLocalId: input.receiptLocalId ?? null,
    validationStatus: "PENDING_REVIEW",
  };
  await dependencies.store.createExpense(expense);
  return expense;
}

export async function recordFuelOffline(
  dependencies: {
    readonly store: TripMoneyOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  input: {
    readonly tripId: string;
    readonly vehicleId: string;
    readonly mileage: number;
    readonly quantity: number;
    readonly volumeUnit: "LITRE" | "GALLON";
    readonly unitPrice: number;
    readonly total: number;
    readonly supplierName: string;
    readonly receiptLocalId?: string | null;
  },
): Promise<FuelEntryModel> {
  requirePermission(actor, "RECORD_OWN_TRIP_ACTIVITY");
  requireFiniteNonNegative(input.mileage, "El kilometraje");
  requireFiniteNonNegative(input.quantity, "La cantidad de combustible");
  requireFiniteNonNegative(input.unitPrice, "El precio unitario");
  requireFiniteNonNegative(input.total, "El total del combustible");
  if (input.quantity === 0 || input.total === 0) {
    throw new Error("La cantidad y el total del combustible deben ser mayores que cero.");
  }
  const expectedTotal = Math.round(input.quantity * input.unitPrice * 100) / 100;
  if (Math.abs(expectedTotal - input.total) > 0.01) {
    throw new Error("El total del combustible no coincide con cantidad por precio unitario.");
  }
  const fuelEntry: FuelEntryModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    tripId: requireText(input.tripId, "El viaje"),
    vehicleId: requireText(input.vehicleId, "La unidad"),
    driverProfileId: actor.profileId,
    occurredAt: toIsoTimestamp(dependencies.clock.now()),
    mileage: input.mileage,
    quantity: input.quantity,
    volumeUnit: input.volumeUnit,
    unitPrice: input.unitPrice,
    total: input.total,
    supplierName: requireText(input.supplierName, "El grifo"),
    receiptLocalId: input.receiptLocalId ?? null,
  };
  await dependencies.store.createFuelEntry(fuelEntry);
  return fuelEntry;
}

export async function issueAdvance(
  gateway: TripMoneyCommandGateway,
  actor: ActorContext,
  input: {
    readonly tripId: string;
    readonly driverId: string;
    readonly amount: number;
    readonly concept: string;
  },
): Promise<string> {
  requirePermission(actor, "MANAGE_TRIPS");
  requireFiniteNonNegative(input.amount, "El adelanto");
  if (input.amount === 0) {
    throw new Error("El adelanto debe ser mayor que cero.");
  }
  return gateway.issueAdvance({ ...input, concept: requireText(input.concept, "El concepto") });
}

export async function closeSettlement(
  store: TripMoneyOfflineStore,
  gateway: TripMoneyCommandGateway,
  actor: ActorContext,
  settlementId: string,
  resolution: {
    readonly method: string;
    readonly reference: string;
    readonly note?: string | null;
  },
): Promise<SettlementCalculation> {
  requirePermission(actor, "CLOSE_SETTLEMENT");
  const context = await store.getSettlementContext(settlementId);
  if (context === null) {
    throw new Error("La rendición no existe o no está disponible.");
  }
  requireSameCompany(actor, context.companyId);
  if (context.state === "CLOSED") {
    throw new Error("La rendición ya se encuentra cerrada.");
  }
  const decision = evaluateSettlementClosure({
    tripOperationalStatus: context.tripOperationalStatus,
    pendingExpenseCount: context.pendingExpenseCount,
    observedExpenseCount: context.observedExpenseCount,
    allAdvancesIncluded: context.allAdvancesIncluded,
    balanceResolved: context.balanceResolved,
  });
  if (!decision.allowed) {
    throw new Error(decision.reasons.join(" "));
  }
  const calculation = calculateSettlement(context.advances, context.approvedExpenses);
  await gateway.closeSettlement({
    settlementId,
    resolutionMethod: requireText(resolution.method, "El método de conciliación"),
    resolutionReference: requireText(resolution.reference, "La referencia de conciliación"),
    resolutionNote: resolution.note?.trim() || null,
  });
  return calculation;
}

export async function reopenSettlement(
  gateway: TripMoneyCommandGateway,
  actor: ActorContext,
  context: SettlementContext,
  reason: string,
): Promise<void> {
  requirePermission(actor, "REOPEN_CLOSED_RECORDS");
  requireSameCompany(actor, context.companyId);
  if (context.state !== "CLOSED") {
    throw new Error("Solo una rendición cerrada puede reabrirse.");
  }
  await gateway.reopenSettlement({
    settlementId: context.id,
    reason: requireText(reason, "El motivo"),
  });
}

export function createRpcTripMoneyCommandGateway(
  transport: ProductCommandTransport,
): TripMoneyCommandGateway {
  return {
    async issueAdvance(input): Promise<string> {
      const result = await transport.invoke("issue_trip_advance", {
        trip_id: input.tripId,
        driver_id: input.driverId,
        amount: input.amount,
        concept: input.concept,
      });
      if (typeof result !== "string" || result.trim() === "") {
        throw new Error("El adelanto no devolvió un identificador válido.");
      }
      return result;
    },
    closeSettlement: async (input) =>
      void (await transport.invoke("close_settlement", {
        settlement_id: input.settlementId,
        resolution_method: input.resolutionMethod,
        resolution_reference: input.resolutionReference,
        resolution_note: input.resolutionNote,
      })),
    reopenSettlement: async (input) =>
      void (await transport.invoke("reopen_settlement", {
        settlement_id: input.settlementId,
        reason: input.reason,
      })),
  };
}
