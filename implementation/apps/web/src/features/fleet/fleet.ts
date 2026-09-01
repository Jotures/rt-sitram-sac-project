import {
  deriveMaintenanceDueStatus,
  type MaintenanceDueStatus,
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

export interface VehicleModel {
  readonly id: string;
  readonly companyId: string;
  readonly plate: string;
  readonly year: number;
  readonly capacityTons: number;
  readonly status: VehicleStatus;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface MaintenancePlanModel {
  readonly id: string;
  readonly companyId: string;
  readonly vehicleId: string;
  readonly name: string;
  readonly nextMileage: number | null;
  readonly nextDate: string | null;
  readonly criticalWhenOverdue: boolean;
  readonly active: boolean;
}

export interface WorkOrderModel {
  readonly id: string;
  readonly companyId: string;
  readonly vehicleId: string;
  readonly supplierId: string;
  readonly type: "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY" | "INSPECTION";
  readonly problem: string;
  readonly status:
    | "SCHEDULED"
    | "WAITING_WORKSHOP"
    | "IN_WORKSHOP"
    | "IN_PROGRESS"
    | "WAITING_PART"
    | "COMPLETED"
    | "CANCELLED";
  readonly openedAt: string;
}

export interface FleetOfflineStore {
  saveVehicle(vehicle: VehicleModel): Promise<void>;
  listVehicles(companyId: string): Promise<readonly VehicleModel[]>;
  saveMaintenancePlan(plan: MaintenancePlanModel): Promise<void>;
  listMaintenancePlans(vehicleId: string): Promise<readonly MaintenancePlanModel[]>;
  saveWorkOrder(order: WorkOrderModel): Promise<void>;
}

export interface MaintenanceCommandGateway {
  completeWorkOrder(input: {
    readonly workOrderId: string;
    readonly finalMileage: number;
    readonly labourCost: number;
    readonly partsCost: number;
  }): Promise<void>;
}

export async function createVehicle(
  dependencies: {
    readonly store: FleetOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  input: { readonly plate: string; readonly year: number; readonly capacityTons: number },
): Promise<VehicleModel> {
  requirePermission(actor, "MANAGE_MASTER_DATA");
  if (
    !Number.isInteger(input.year) ||
    input.year < 1900 ||
    input.year > dependencies.clock.now().getUTCFullYear() + 1
  ) {
    throw new Error("El año de la unidad no es válido.");
  }
  requireFiniteNonNegative(input.capacityTons, "La capacidad");
  const vehicle: VehicleModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    plate: requireText(input.plate, "La placa").toUpperCase(),
    year: input.year,
    capacityTons: input.capacityTons,
    status: "AVAILABLE",
    active: true,
    createdAt: toIsoTimestamp(dependencies.clock.now()),
  };
  await dependencies.store.saveVehicle(vehicle);
  return vehicle;
}

export async function updateVehicle(
  store: FleetOfflineStore,
  actor: ActorContext,
  vehicle: VehicleModel,
  patch: { readonly capacityTons?: number; readonly active?: boolean },
): Promise<VehicleModel> {
  requirePermission(actor, "MANAGE_MASTER_DATA");
  requireSameCompany(actor, vehicle.companyId);
  if (patch.capacityTons !== undefined) {
    requireFiniteNonNegative(patch.capacityTons, "La capacidad");
  }
  const updated: VehicleModel = {
    ...vehicle,
    capacityTons: patch.capacityTons ?? vehicle.capacityTons,
    active: patch.active ?? vehicle.active,
  };
  await store.saveVehicle(updated);
  return updated;
}

export async function createMaintenancePlan(
  dependencies: { readonly store: FleetOfflineStore; readonly ids: IdGenerator },
  actor: ActorContext,
  input: {
    readonly vehicle: VehicleModel;
    readonly name: string;
    readonly nextMileage?: number | null;
    readonly nextDate?: Date | null;
    readonly criticalWhenOverdue: boolean;
  },
): Promise<MaintenancePlanModel> {
  requirePermission(actor, "MANAGE_MAINTENANCE");
  requireSameCompany(actor, input.vehicle.companyId);
  if (input.nextMileage !== undefined && input.nextMileage !== null) {
    requireFiniteNonNegative(input.nextMileage, "El próximo kilometraje");
  }
  if ((input.nextMileage ?? null) === null && (input.nextDate ?? null) === null) {
    throw new Error("El plan debe definir una fecha o kilometraje próximo.");
  }
  const plan: MaintenancePlanModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    vehicleId: input.vehicle.id,
    name: requireText(input.name, "El mantenimiento"),
    nextMileage: input.nextMileage ?? null,
    nextDate:
      input.nextDate === undefined || input.nextDate === null
        ? null
        : toIsoTimestamp(input.nextDate),
    criticalWhenOverdue: input.criticalWhenOverdue,
    active: true,
  };
  await dependencies.store.saveMaintenancePlan(plan);
  return plan;
}

export function getMaintenanceDueStatus(
  plan: MaintenancePlanModel,
  currentMileage: number,
  today: Date,
): MaintenanceDueStatus {
  return deriveMaintenanceDueStatus({
    currentMileage,
    nextMileage: plan.nextMileage,
    today,
    nextDate: plan.nextDate === null ? null : new Date(plan.nextDate),
  });
}

export async function openWorkOrder(
  dependencies: {
    readonly store: FleetOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  input: {
    readonly vehicle: VehicleModel;
    readonly supplierId: string;
    readonly type: WorkOrderModel["type"];
    readonly problem: string;
  },
): Promise<WorkOrderModel> {
  requirePermission(actor, "MANAGE_MAINTENANCE");
  requireSameCompany(actor, input.vehicle.companyId);
  const order: WorkOrderModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    vehicleId: input.vehicle.id,
    supplierId: requireText(input.supplierId, "El proveedor"),
    type: input.type,
    problem: requireText(input.problem, "El problema reportado"),
    status: "SCHEDULED",
    openedAt: toIsoTimestamp(dependencies.clock.now()),
  };
  await dependencies.store.saveWorkOrder(order);
  return order;
}

export async function completeWorkOrder(
  gateway: MaintenanceCommandGateway,
  actor: ActorContext,
  order: WorkOrderModel,
  input: { readonly finalMileage: number; readonly labourCost: number; readonly partsCost: number },
): Promise<void> {
  requirePermission(actor, "MANAGE_MAINTENANCE");
  requireSameCompany(actor, order.companyId);
  requireFiniteNonNegative(input.finalMileage, "El kilometraje final");
  requireFiniteNonNegative(input.labourCost, "El costo de mano de obra");
  requireFiniteNonNegative(input.partsCost, "El costo de repuestos");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new Error("La orden de trabajo ya no puede completarse.");
  }
  await gateway.completeWorkOrder({ workOrderId: order.id, ...input });
}

export function createRpcMaintenanceCommandGateway(
  transport: ProductCommandTransport,
): MaintenanceCommandGateway {
  return {
    completeWorkOrder: async (input) =>
      void (await transport.invoke("complete_work_order", {
        work_order_id: input.workOrderId,
        final_mileage: input.finalMileage,
        labour_cost: input.labourCost,
        parts_cost: input.partsCost,
      })),
  };
}
