import {
  canCloseTripOperationally,
  evaluateOperationalCycle,
  evaluateTripScheduling,
  type CycleReturnStatus,
  type DriverStatus,
  type TripAdministrativeStatus,
  type TripFinancialStatus,
  type TripOperationalStatus,
  type VehicleStatus,
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

export interface TripModel {
  readonly id: string;
  readonly companyId: string;
  readonly code: string | null;
  readonly clientId: string;
  readonly cycleId: string | null;
  readonly vehicleId: string | null;
  readonly driverId: string | null;
  readonly driverProfileId: string | null;
  readonly origin: string;
  readonly destination: string;
  readonly plannedAt: string;
  readonly operationalStatus: TripOperationalStatus;
  readonly administrativeStatus: TripAdministrativeStatus;
  readonly financialStatus: TripFinancialStatus;
  readonly initialMileage: number | null;
  readonly finalMileage: number | null;
  readonly freight: number;
  readonly additionalIncome: number;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface OperationalCycleModel {
  readonly id: string;
  readonly companyId: string;
  readonly code: string | null;
  readonly vehicleId: string;
  readonly tripIds: readonly string[];
  readonly returnStatus: CycleReturnStatus;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface TripOfflineStore {
  createTrip(trip: TripModel): Promise<void>;
  createCycle(cycle: OperationalCycleModel): Promise<void>;
  enqueueDriverActivity(activity: DriverActivity): Promise<void>;
  getTrip(tripId: string): Promise<TripModel | null>;
  listTrips(companyId: string): Promise<readonly TripModel[]>;
}

export interface TripCommandGateway {
  approveTrip(tripId: string): Promise<void>;
  scheduleTrip(input: {
    readonly tripId: string;
    readonly vehicleId: string;
    readonly driverId: string;
  }): Promise<void>;
  startTrip(input: { readonly tripId: string; readonly initialMileage: number }): Promise<void>;
  completeTrip(input: {
    readonly tripId: string;
    readonly finalMileage: number;
    readonly cargoDelivered: boolean;
  }): Promise<void>;
}

export interface CreateTripDraftInput {
  readonly clientId: string;
  readonly cycleId?: string | null;
  readonly origin: string;
  readonly destination: string;
  readonly plannedAt: Date;
  readonly freight: number;
  readonly additionalIncome?: number;
}

export async function createTripDraft(
  dependencies: {
    readonly store: TripOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  input: CreateTripDraftInput,
): Promise<TripModel> {
  requirePermission(actor, "MANAGE_TRIPS");
  requireFiniteNonNegative(input.freight, "El flete");
  requireFiniteNonNegative(input.additionalIncome ?? 0, "El ingreso adicional");
  const createdAt = toIsoTimestamp(dependencies.clock.now());
  const trip: TripModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    code: null,
    clientId: requireText(input.clientId, "El cliente"),
    cycleId: input.cycleId ?? null,
    vehicleId: null,
    driverId: null,
    driverProfileId: null,
    origin: requireText(input.origin, "El origen"),
    destination: requireText(input.destination, "El destino"),
    plannedAt: toIsoTimestamp(input.plannedAt),
    operationalStatus: "DRAFT",
    administrativeStatus: "NOT_REQUIRED",
    financialStatus: "UNBILLED",
    initialMileage: null,
    finalMileage: null,
    freight: input.freight,
    additionalIncome: input.additionalIncome ?? 0,
    createdBy: actor.profileId,
    createdAt,
  };
  await dependencies.store.createTrip(trip);
  return trip;
}

export async function approveTrip(
  gateway: TripCommandGateway,
  actor: ActorContext,
  trip: TripModel,
): Promise<void> {
  requirePermission(actor, "MANAGE_TRIPS");
  requireSameCompany(actor, trip.companyId);
  if (trip.operationalStatus !== "DRAFT") {
    throw new Error("Solo un viaje en borrador puede aprobarse.");
  }
  await gateway.approveTrip(trip.id);
}

export interface SchedulingResources {
  readonly vehicle: {
    readonly id: string;
    readonly companyId: string;
    readonly status: VehicleStatus;
    readonly hasActiveTrip: boolean;
    readonly hasCriticalMaintenanceBlock: boolean;
    readonly criticalDocumentsValid: boolean;
  };
  readonly driver: {
    readonly id: string;
    readonly companyId: string;
    readonly status: DriverStatus;
    readonly hasActiveTrip: boolean;
    readonly criticalDocumentsValid: boolean;
  };
}

export async function scheduleTrip(
  gateway: TripCommandGateway,
  actor: ActorContext,
  trip: TripModel,
  resources: SchedulingResources,
): Promise<void> {
  requirePermission(actor, "MANAGE_TRIPS");
  requireSameCompany(actor, trip.companyId);
  const decision = evaluateTripScheduling({
    trip: { companyId: trip.companyId, operationalStatus: trip.operationalStatus },
    vehicle: resources.vehicle,
    driver: resources.driver,
  });
  if (!decision.allowed) {
    throw new Error(decision.reasons.join(" "));
  }
  await gateway.scheduleTrip({
    tripId: trip.id,
    vehicleId: resources.vehicle.id,
    driverId: resources.driver.id,
  });
}

export async function startTrip(
  gateway: TripCommandGateway,
  actor: ActorContext,
  trip: TripModel,
  initialMileage: number,
): Promise<void> {
  requirePermission(actor, "MANAGE_TRIPS");
  requireSameCompany(actor, trip.companyId);
  if (trip.operationalStatus !== "SCHEDULED") {
    throw new Error("Solo un viaje programado puede iniciarse.");
  }
  // The server owns the context-sensitive master rule. In particular, an
  // authoritative GPS unit must retain a lower manual/trip reading as evidence
  // instead of letting the client reject it before the audited RPC can decide.
  await gateway.startTrip({ tripId: trip.id, initialMileage });
}

export async function completeTrip(
  gateway: TripCommandGateway,
  actor: ActorContext,
  trip: TripModel,
  input: {
    readonly finalMileage: number;
    readonly cargoDelivered: boolean;
    readonly requiredDocumentsSatisfied: boolean;
  },
): Promise<void> {
  requirePermission(actor, "MANAGE_TRIPS");
  requireSameCompany(actor, trip.companyId);
  if (trip.operationalStatus !== "UNLOADING") {
    throw new Error("Solo un viaje en descarga puede completar el transporte.");
  }
  if (
    !canCloseTripOperationally({
      initialMileage: trip.initialMileage,
      finalMileage: input.finalMileage,
      cargoDelivered: input.cargoDelivered,
      requiredDocumentsSatisfied: input.requiredDocumentsSatisfied,
    })
  ) {
    throw new Error("El viaje no cumple las condiciones para completar el transporte.");
  }
  await gateway.completeTrip({
    tripId: trip.id,
    finalMileage: input.finalMileage,
    cargoDelivered: input.cargoDelivered,
  });
}

export type DriverActivity =
  | {
      readonly id: string;
      readonly companyId: string;
      readonly tripId: string;
      readonly driverProfileId: string;
      readonly occurredAt: string;
      readonly type: "ODOMETER";
      readonly mileage: number;
    }
  | {
      readonly id: string;
      readonly companyId: string;
      readonly tripId: string;
      readonly driverProfileId: string;
      readonly occurredAt: string;
      readonly type: "INCIDENT";
      readonly description: string;
      readonly severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    }
  | {
      readonly id: string;
      readonly companyId: string;
      readonly tripId: string;
      readonly driverProfileId: string;
      readonly occurredAt: string;
      readonly type: "ARRIVAL";
      readonly mileage: number;
    };

export async function recordDriverActivityOffline(
  dependencies: {
    readonly store: TripOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  trip: TripModel,
  input:
    | { readonly type: "ODOMETER"; readonly mileage: number }
    | { readonly type: "ARRIVAL"; readonly mileage: number }
    | {
        readonly type: "INCIDENT";
        readonly description: string;
        readonly severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      },
): Promise<DriverActivity> {
  requirePermission(actor, "RECORD_OWN_TRIP_ACTIVITY");
  requireSameCompany(actor, trip.companyId);
  if (trip.driverProfileId !== actor.profileId) {
    throw new Error("Solo el conductor asignado puede registrar actividad del viaje.");
  }
  if (!["LOADING", "IN_TRANSIT", "UNLOADING"].includes(trip.operationalStatus)) {
    throw new Error("El viaje no admite actividad de conductor en su estado actual.");
  }

  const common = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    tripId: trip.id,
    driverProfileId: actor.profileId,
    occurredAt: toIsoTimestamp(dependencies.clock.now()),
  } as const;
  let activity: DriverActivity;
  if (input.type === "INCIDENT") {
    activity = {
      ...common,
      type: input.type,
      description: requireText(input.description, "La descripción"),
      severity: input.severity,
    };
  } else {
    requireFiniteNonNegative(input.mileage, "El kilometraje");
    activity = { ...common, type: input.type, mileage: input.mileage };
  }
  await dependencies.store.enqueueDriverActivity(activity);
  return activity;
}

export async function createOperationalCycle(
  dependencies: {
    readonly store: TripOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  vehicleId: string,
  trips: readonly TripModel[],
): Promise<OperationalCycleModel> {
  requirePermission(actor, "MANAGE_TRIPS");
  const decision = evaluateOperationalCycle({
    companyId: actor.companyId,
    vehicleId,
    legs: trips.map((trip) => ({
      id: trip.id,
      companyId: trip.companyId,
      vehicleId: trip.vehicleId ?? "",
      origin: trip.origin,
      destination: trip.destination,
      startedAt: new Date(trip.plannedAt),
      completedAt: new Date(trip.plannedAt),
    })),
  });
  if (!decision.allowed) {
    throw new Error(decision.reasons.join(" "));
  }
  const cycle: OperationalCycleModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    code: null,
    vehicleId: requireText(vehicleId, "La unidad"),
    tripIds: trips.map((trip) => trip.id),
    returnStatus: "UNIDENTIFIED",
    createdBy: actor.profileId,
    createdAt: toIsoTimestamp(dependencies.clock.now()),
  };
  await dependencies.store.createCycle(cycle);
  return cycle;
}

export function createRpcTripCommandGateway(
  transport: ProductCommandTransport,
): TripCommandGateway {
  return {
    approveTrip: async (tripId) =>
      void (await transport.invoke("approve_trip", { trip_id: tripId })),
    scheduleTrip: async (input) =>
      void (await transport.invoke("schedule_trip", {
        trip_id: input.tripId,
        vehicle_id: input.vehicleId,
        driver_id: input.driverId,
      })),
    startTrip: async (input) =>
      void (await transport.invoke("start_trip", {
        trip_id: input.tripId,
        initial_mileage: input.initialMileage,
      })),
    completeTrip: async (input) =>
      void (await transport.invoke("complete_trip", {
        trip_id: input.tripId,
        final_mileage: input.finalMileage,
        cargo_delivered: input.cargoDelivered,
      })),
  };
}
