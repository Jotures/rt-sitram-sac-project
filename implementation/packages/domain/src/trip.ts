export type TripOperationalStatus =
  | "DRAFT"
  | "APPROVED"
  | "SCHEDULED"
  | "LOADING"
  | "IN_TRANSIT"
  | "UNLOADING"
  | "COMPLETED"
  | "CANCELLED";

export type TripAdministrativeStatus =
  | "NOT_REQUIRED"
  | "SETTLEMENT_PENDING"
  | "SETTLEMENT_REVIEW"
  | "SETTLEMENT_OBSERVED"
  | "SETTLEMENT_CLOSED";

export type TripFinancialStatus =
  | "UNBILLED"
  | "BILLED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "FINANCIALLY_CLOSED";

export type CycleReturnStatus =
  | "UNIDENTIFIED"
  | "PROBABLE"
  | "CONFIRMED"
  | "COMPLETED"
  | "EMPTY_RETURN";

export type OperationalCycleStatus = "OPEN" | "COMPLETED" | "CANCELLED";

export interface DomainDecision {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

const operationalTransitions: Readonly<
  Record<TripOperationalStatus, readonly TripOperationalStatus[]>
> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["LOADING", "CANCELLED"],
  LOADING: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["UNLOADING", "CANCELLED"],
  UNLOADING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const administrativeTransitions: Readonly<
  Record<TripAdministrativeStatus, readonly TripAdministrativeStatus[]>
> = {
  NOT_REQUIRED: ["SETTLEMENT_PENDING"],
  SETTLEMENT_PENDING: ["SETTLEMENT_REVIEW"],
  SETTLEMENT_REVIEW: ["SETTLEMENT_OBSERVED", "SETTLEMENT_CLOSED"],
  SETTLEMENT_OBSERVED: ["SETTLEMENT_REVIEW"],
  SETTLEMENT_CLOSED: [],
};

const financialTransitions: Readonly<Record<TripFinancialStatus, readonly TripFinancialStatus[]>> =
  {
    UNBILLED: ["BILLED"],
    BILLED: ["PARTIALLY_PAID", "PAID"],
    PARTIALLY_PAID: ["PAID"],
    PAID: ["FINANCIALLY_CLOSED"],
    FINANCIALLY_CLOSED: [],
  };

export function canTransitionTrip(from: TripOperationalStatus, to: TripOperationalStatus): boolean {
  return operationalTransitions[from].includes(to);
}

export function canTransitionTripAdministration(
  from: TripAdministrativeStatus,
  to: TripAdministrativeStatus,
): boolean {
  return administrativeTransitions[from].includes(to);
}

export function canTransitionTripFinance(
  from: TripFinancialStatus,
  to: TripFinancialStatus,
): boolean {
  return financialTransitions[from].includes(to);
}

export function validateTripTransition(
  from: TripOperationalStatus,
  to: TripOperationalStatus,
): void {
  if (!canTransitionTrip(from, to)) {
    throw new Error(`Transición operativa de viaje no permitida: ${from} -> ${to}.`);
  }
}

export interface OperationalCloseInput {
  readonly initialMileage?: number | null;
  readonly finalMileage: number | null;
  readonly cargoDelivered?: boolean;
  readonly requiredDocumentsSatisfied: boolean;
  /** @deprecated El cierre de rendición pertenece al estado administrativo y no bloquea el transporte. */
  readonly settlementClosed?: boolean;
}

export function evaluateOperationalCompletion(input: OperationalCloseInput): DomainDecision {
  const reasons: string[] = [];
  const hasValidInitialMileage =
    input.initialMileage === undefined ||
    input.initialMileage === null ||
    (Number.isFinite(input.initialMileage) && input.initialMileage >= 0);
  const hasValidFinalMileage =
    input.finalMileage !== null && Number.isFinite(input.finalMileage) && input.finalMileage >= 0;

  if (!hasValidInitialMileage) {
    reasons.push("El kilometraje inicial debe ser válido.");
  }

  if (!hasValidFinalMileage) {
    reasons.push("Debe registrarse un kilometraje final válido.");
  }

  if (
    input.initialMileage !== undefined &&
    input.initialMileage !== null &&
    input.finalMileage !== null &&
    hasValidInitialMileage &&
    hasValidFinalMileage &&
    input.finalMileage < input.initialMileage
  ) {
    reasons.push("El kilometraje final no puede ser menor que el inicial.");
  }

  if (input.cargoDelivered === false) {
    reasons.push("La entrega de la carga debe estar confirmada.");
  }

  if (!input.requiredDocumentsSatisfied) {
    reasons.push("Faltan documentos operativos obligatorios o su justificación.");
  }

  return { allowed: reasons.length === 0, reasons };
}

export function canCloseTripOperationally(input: OperationalCloseInput): boolean {
  return evaluateOperationalCompletion(input).allowed;
}

export interface OdometerProgressionInput {
  readonly previousMileage: number;
  readonly currentMileage: number;
  readonly correctionAuthorized?: boolean;
  readonly correctionReason?: string;
}

export function validateOdometerProgression(input: OdometerProgressionInput): void {
  assertValidMileage(input.previousMileage, "El kilometraje anterior");
  assertValidMileage(input.currentMileage, "El kilometraje actual");

  if (input.currentMileage >= input.previousMileage) {
    return;
  }

  if (!input.correctionAuthorized) {
    throw new Error("El kilometraje no puede disminuir sin una corrección autorizada.");
  }

  if (input.correctionReason?.trim() === "" || input.correctionReason === undefined) {
    throw new Error("Una corrección de kilometraje debe incluir un motivo.");
  }
}

export function calculateTravelledDistance(initialMileage: number, finalMileage: number): number {
  validateOdometerProgression({ previousMileage: initialMileage, currentMileage: finalMileage });
  return finalMileage - initialMileage;
}

export interface CycleTripLeg {
  readonly id: string;
  readonly companyId: string;
  readonly vehicleId: string;
  readonly origin: string;
  readonly destination: string;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

export interface OperationalCycleInput {
  readonly companyId: string;
  readonly vehicleId: string;
  readonly legs: readonly CycleTripLeg[];
}

export function evaluateOperationalCycle(input: OperationalCycleInput): DomainDecision {
  const reasons: string[] = [];
  const seenIds = new Set<string>();
  let previous: CycleTripLeg | undefined;

  if (input.legs.length === 0) {
    reasons.push("El ciclo operativo debe contener al menos un viaje.");
  }

  for (const leg of input.legs) {
    if (seenIds.has(leg.id)) {
      reasons.push(`El viaje ${leg.id} está duplicado dentro del ciclo.`);
    }
    seenIds.add(leg.id);

    if (leg.companyId !== input.companyId) {
      reasons.push(`El viaje ${leg.id} pertenece a otra empresa.`);
    }
    if (leg.vehicleId !== input.vehicleId) {
      reasons.push(`El viaje ${leg.id} pertenece a otra unidad.`);
    }
    if (leg.origin.trim() === "" || leg.destination.trim() === "") {
      reasons.push(`El viaje ${leg.id} debe tener origen y destino.`);
    }
    if (
      !isValidDate(leg.startedAt) ||
      (leg.completedAt !== null && !isValidDate(leg.completedAt))
    ) {
      reasons.push(`El viaje ${leg.id} contiene fechas inválidas.`);
    } else if (leg.completedAt !== null && leg.completedAt < leg.startedAt) {
      reasons.push(`El viaje ${leg.id} termina antes de comenzar.`);
    }

    if (
      previous !== undefined &&
      previous.completedAt !== null &&
      leg.startedAt < previous.completedAt
    ) {
      reasons.push(`El viaje ${leg.id} se superpone con el viaje anterior del ciclo.`);
    }
    if (previous !== undefined && previous.completedAt === null) {
      reasons.push(`El viaje ${leg.id} no puede seguir a un viaje todavía abierto.`);
    }

    previous = leg;
  }

  return { allowed: reasons.length === 0, reasons };
}

function assertValidMileage(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} debe ser un número finito no negativo.`);
  }
}

function isValidDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}
