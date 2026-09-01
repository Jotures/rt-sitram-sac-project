import type { VehicleStatus } from "@rt-sitram/domain";
import { type ActorContext, requirePermission } from "../shared/application";

export interface DashboardVehicleItem {
  readonly vehicleId: string;
  readonly plate: string;
  readonly status: VehicleStatus;
  readonly tripId: string | null;
  readonly driverName: string | null;
  readonly location: string | null;
  readonly nextAction: string;
}

export interface DashboardSnapshot {
  readonly companyId: string;
  readonly vehicles: readonly DashboardVehicleItem[];
  readonly activeTripCount: number;
  readonly pendingSettlementCount: number;
  readonly overdueInvoiceCount: number;
  readonly criticalAlertCount: number;
  readonly generatedAt: string;
}

export interface DashboardReadGateway {
  loadDashboard(companyId: string): Promise<DashboardSnapshot>;
}

export async function loadDashboard(
  gateway: DashboardReadGateway,
  actor: ActorContext,
): Promise<DashboardSnapshot> {
  requirePermission(actor, "VIEW_FULL_DASHBOARD");
  const snapshot = await gateway.loadDashboard(actor.companyId);
  if (snapshot.companyId !== actor.companyId) {
    throw new Error("El tablero devolvió información de otra empresa.");
  }
  return {
    ...snapshot,
    vehicles: [...snapshot.vehicles].sort((left, right) => left.plate.localeCompare(right.plate)),
  };
}
