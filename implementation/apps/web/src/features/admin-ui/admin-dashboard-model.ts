import type { AdminDashboardSnapshot, AdminListRow, AdminTripRow } from "./admin-data";

const ACTIVE_TRIP_STATUSES = new Set(["scheduled", "loading", "in_transit", "unloading"]);

const nextStepByTripStatus: Readonly<Record<string, string>> = {
  draft: "Revisar y aprobar el servicio",
  approved: "Asignar unidad y conductor",
  scheduled: "Confirmar preparación para salida",
  loading: "Dar seguimiento a la carga",
  in_transit: "Monitorear el recorrido",
  unloading: "Confirmar descarga y entrega",
};

export interface DashboardTripStep {
  readonly trip: AdminTripRow;
  readonly action: string;
}

export interface AdminDashboardSummary {
  readonly activeTrips: readonly AdminTripRow[];
  readonly nextSteps: readonly DashboardTripStep[];
  readonly activeAlerts: readonly AdminListRow[];
  readonly pendingSettlements: readonly AdminListRow[];
  readonly pendingInvoices: readonly AdminListRow[];
  readonly pendingInvoiceAmount: number;
  readonly availableVehicles: number;
  readonly operatingVehicles: number;
  readonly attentionVehicles: number;
  readonly attentionCount: number;
}

export function summarizeAdminDashboard(data: AdminDashboardSnapshot): AdminDashboardSummary {
  const activeTrips = data.trips.filter((trip) => ACTIVE_TRIP_STATUSES.has(trip.operationalStatus));
  const activeAlerts = data.alerts.filter(
    (row) => !matchesStatus(row.status, ["resolved", "resuelt"]),
  );
  const pendingSettlements = data.settlements.filter(
    (row) => !matchesStatus(row.status, ["closed", "cerrad"]),
  );
  const pendingInvoices = data.invoices.filter(
    (row) => !matchesStatus(row.status, ["paid", "pagad", "cancelled", "anulad"]),
  );
  const availableVehicles = data.vehicles.filter((row) =>
    matchesStatus(row.status, ["available", "disponible"]),
  ).length;
  const operatingVehicles = data.vehicles.filter((row) =>
    matchesStatus(row.status, [
      "scheduled",
      "programad",
      "in trip",
      "en viaje",
      "waiting load",
      "esperando carga",
      "returning empty",
      "retorno vacio",
    ]),
  ).length;

  return {
    activeTrips,
    nextSteps: data.trips.flatMap((trip) => {
      const action = nextStepByTripStatus[trip.operationalStatus];
      return action === undefined ? [] : [{ trip, action }];
    }),
    activeAlerts,
    pendingSettlements,
    pendingInvoices,
    pendingInvoiceAmount: pendingInvoices.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    availableVehicles,
    operatingVehicles,
    attentionVehicles: Math.max(0, data.vehicles.length - availableVehicles - operatingVehicles),
    attentionCount: activeAlerts.length + pendingSettlements.length + pendingInvoices.length,
  };
}

function matchesStatus(status: string, candidates: readonly string[]): boolean {
  const normalized = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE");
  return candidates.some((candidate) => normalized.includes(candidate));
}
