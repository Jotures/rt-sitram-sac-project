import type { DomainDecision, TripOperationalStatus } from "./trip";

export type VehicleStatus =
  | "AVAILABLE"
  | "SCHEDULED"
  | "ON_TRIP"
  | "WAITING_LOAD"
  | "RETURNING_EMPTY"
  | "PREVENTIVE_MAINTENANCE"
  | "REPAIR"
  | "WAITING_WORKSHOP"
  | "NO_DRIVER"
  | "BLOCKED"
  | "IMMOBILIZED"
  | "OUT_OF_SERVICE";

export type DriverStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "ON_TRIP"
  | "REST"
  | "VACATION"
  | "LEAVE"
  | "UNAVAILABLE"
  | "INACTIVE";

export interface VehicleScheduleCheck {
  readonly status: VehicleStatus;
  readonly hasActiveTrip: boolean;
  readonly hasCriticalMaintenanceBlock: boolean;
  readonly criticalDocumentsValid: boolean;
  readonly driverAvailable: boolean;
}

export type ScheduleDecision = DomainDecision;

export function canScheduleVehicle(input: VehicleScheduleCheck): ScheduleDecision {
  const reasons: string[] = [];

  appendVehicleReasons(input, reasons);
  if (!input.driverAvailable) {
    reasons.push("No existe un conductor disponible para la asignación.");
  }

  return { allowed: reasons.length === 0, reasons };
}

export interface TripSchedulingCheck {
  readonly trip: {
    readonly companyId: string;
    readonly operationalStatus: TripOperationalStatus;
  };
  readonly vehicle: {
    readonly companyId: string;
    readonly status: VehicleStatus;
    readonly hasActiveTrip: boolean;
    readonly hasCriticalMaintenanceBlock: boolean;
    readonly criticalDocumentsValid: boolean;
  };
  readonly driver: {
    readonly companyId: string;
    readonly status: DriverStatus;
    readonly hasActiveTrip: boolean;
    readonly criticalDocumentsValid: boolean;
  };
}

export function evaluateTripScheduling(input: TripSchedulingCheck): ScheduleDecision {
  const reasons: string[] = [];

  if (input.trip.operationalStatus !== "APPROVED") {
    reasons.push("Solo un viaje aprobado puede programarse.");
  }
  if (
    input.vehicle.companyId !== input.trip.companyId ||
    input.driver.companyId !== input.trip.companyId
  ) {
    reasons.push("El viaje, la unidad y el conductor deben pertenecer a la misma empresa.");
  }

  appendVehicleReasons(input.vehicle, reasons);

  if (input.driver.status !== "AVAILABLE") {
    reasons.push("El conductor no está disponible.");
  }
  if (input.driver.hasActiveTrip) {
    reasons.push("El conductor ya tiene un viaje activo.");
  }
  if (!input.driver.criticalDocumentsValid) {
    reasons.push("El conductor tiene documentación crítica vencida o faltante.");
  }

  return { allowed: reasons.length === 0, reasons };
}

function appendVehicleReasons(
  input: Pick<
    VehicleScheduleCheck,
    "status" | "hasActiveTrip" | "hasCriticalMaintenanceBlock" | "criticalDocumentsValid"
  >,
  reasons: string[],
): void {
  if (input.status !== "AVAILABLE") {
    reasons.push("La unidad no está disponible.");
  }
  if (input.hasActiveTrip) {
    reasons.push("La unidad ya tiene un viaje activo.");
  }
  if (input.hasCriticalMaintenanceBlock) {
    reasons.push("La unidad tiene un bloqueo crítico de mantenimiento.");
  }
  if (!input.criticalDocumentsValid) {
    reasons.push("La unidad tiene documentación crítica vencida o faltante.");
  }
}

export type MaintenanceDueStatus = "OK" | "UPCOMING" | "OVERDUE";

export function deriveMaintenanceDueStatus(input: {
  readonly currentMileage: number;
  readonly nextMileage: number | null;
  readonly today: Date;
  readonly nextDate: Date | null;
  readonly mileageWarningThreshold?: number;
  readonly dayWarningThreshold?: number;
}): MaintenanceDueStatus {
  assertFiniteNonNegative(input.currentMileage, "El kilometraje actual");
  if (input.nextMileage !== null) {
    assertFiniteNonNegative(input.nextMileage, "El próximo kilometraje");
  }
  assertValidDate(input.today, "La fecha actual");
  if (input.nextDate !== null) {
    assertValidDate(input.nextDate, "La fecha del próximo mantenimiento");
  }

  const mileageThreshold = input.mileageWarningThreshold ?? 500;
  const dayThreshold = input.dayWarningThreshold ?? 15;
  assertFiniteNonNegative(mileageThreshold, "El umbral de kilometraje");
  assertFiniteNonNegative(dayThreshold, "El umbral de días");

  const millisecondsPerDay = 86_400_000;
  const daysUntilDue =
    input.nextDate === null
      ? null
      : Math.ceil((input.nextDate.getTime() - input.today.getTime()) / millisecondsPerDay);

  if (
    (input.nextMileage !== null && input.currentMileage >= input.nextMileage) ||
    (daysUntilDue !== null && daysUntilDue <= 0)
  ) {
    return "OVERDUE";
  }

  if (
    (input.nextMileage !== null && input.nextMileage - input.currentMileage <= mileageThreshold) ||
    (daysUntilDue !== null && daysUntilDue <= dayThreshold)
  ) {
    return "UPCOMING";
  }

  return "OK";
}

export function isVehicleSchedulableStatus(status: VehicleStatus): boolean {
  return status === "AVAILABLE";
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} debe ser un número finito no negativo.`);
  }
}

function assertValidDate(value: Date, label: string): void {
  if (!Number.isFinite(value.getTime())) {
    throw new Error(`${label} debe ser válida.`);
  }
}
