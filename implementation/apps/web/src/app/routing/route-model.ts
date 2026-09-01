import type { AppRole } from "../../features/identity/identity-model";

export const routePaths = {
  login: "/login",
  passwordSetup: "/auth/establecer-clave",
  noAccess: "/sin-acceso",
  home: "/inicio",
  trips: "/viajes",
  newTrip: "/viajes/nuevo",
  tripSummary: "/viajes/:tripId/resumen",
  tripOperation: "/viajes/:tripId/operacion",
  tripMoney: "/viajes/:tripId/dinero",
  tripDocuments: "/viajes/:tripId/documentos",
  tripIncidents: "/viajes/:tripId/incidencias",
  tripHistory: "/viajes/:tripId/historial",
  scheduling: "/programacion",
  operationalCycles: "/operacion/ciclos",
  tripEvaluator: "/evaluador-viajes",
  fleet: "/flota",
  vehicleDetail: "/flota/:vehicleId",
  maintenance: "/mantenimiento",
  newMaintenance: "/mantenimiento/nuevo",
  maintenanceDetail: "/mantenimiento/:workOrderId",
  drivers: "/conductores",
  driverDetail: "/conductores/:driverId",
  clients: "/clientes",
  clientDetail: "/clientes/:clientId",
  suppliers: "/proveedores",
  expenses: "/finanzas/gastos",
  fuelEntries: "/finanzas/combustible",
  advances: "/finanzas/adelantos",
  settlements: "/finanzas/rendiciones",
  settlementDetail: "/finanzas/rendiciones/:settlementId",
  collections: "/finanzas/cobranza",
  documents: "/documentos",
  alerts: "/alertas",
  reports: "/reportes",
  companySettings: "/configuracion/empresa",
  profileSettings: "/configuracion/perfiles",
  gpsOdometerSettings: "/configuracion/odometro-gps",
  myTrip: "/mi-viaje",
  myTripHistory: "/mi-viaje/historial",
  register: "/registrar",
  registerFuel: "/registrar/combustible",
  registerExpense: "/registrar/gasto",
  registerIncident: "/registrar/incidencia",
  registerOdometer: "/registrar/kilometraje",
  profile: "/perfil",
  synchronization: "/sincronizacion",
  search: "/buscar",
} as const;

export type ProductRouteId = keyof typeof routePaths;

interface ProductRouteAccess {
  readonly id: ProductRouteId;
  readonly roles: readonly AppRole[];
}

const STAFF_ROLES = ["management", "administration", "accounting"] as const;
const OPERATIONS_ROLES = ["management", "administration"] as const;
const ALL_ROLES = ["management", "administration", "driver", "accounting"] as const;

export const productRouteAccess: readonly ProductRouteAccess[] = [
  { id: "home", roles: STAFF_ROLES },
  { id: "trips", roles: STAFF_ROLES },
  { id: "newTrip", roles: OPERATIONS_ROLES },
  { id: "tripSummary", roles: STAFF_ROLES },
  { id: "tripOperation", roles: OPERATIONS_ROLES },
  { id: "tripMoney", roles: STAFF_ROLES },
  { id: "tripDocuments", roles: STAFF_ROLES },
  { id: "tripIncidents", roles: OPERATIONS_ROLES },
  { id: "tripHistory", roles: STAFF_ROLES },
  { id: "scheduling", roles: OPERATIONS_ROLES },
  { id: "operationalCycles", roles: OPERATIONS_ROLES },
  { id: "tripEvaluator", roles: OPERATIONS_ROLES },
  { id: "fleet", roles: OPERATIONS_ROLES },
  { id: "vehicleDetail", roles: OPERATIONS_ROLES },
  { id: "maintenance", roles: OPERATIONS_ROLES },
  { id: "newMaintenance", roles: OPERATIONS_ROLES },
  { id: "maintenanceDetail", roles: OPERATIONS_ROLES },
  { id: "drivers", roles: OPERATIONS_ROLES },
  { id: "driverDetail", roles: OPERATIONS_ROLES },
  { id: "clients", roles: STAFF_ROLES },
  { id: "clientDetail", roles: STAFF_ROLES },
  { id: "suppliers", roles: OPERATIONS_ROLES },
  { id: "expenses", roles: STAFF_ROLES },
  { id: "fuelEntries", roles: STAFF_ROLES },
  { id: "advances", roles: STAFF_ROLES },
  { id: "settlements", roles: STAFF_ROLES },
  { id: "settlementDetail", roles: STAFF_ROLES },
  { id: "collections", roles: STAFF_ROLES },
  { id: "documents", roles: STAFF_ROLES },
  { id: "alerts", roles: OPERATIONS_ROLES },
  { id: "reports", roles: STAFF_ROLES },
  { id: "companySettings", roles: OPERATIONS_ROLES },
  { id: "profileSettings", roles: OPERATIONS_ROLES },
  { id: "gpsOdometerSettings", roles: ["management"] },
  { id: "myTrip", roles: ["driver"] },
  { id: "myTripHistory", roles: ["driver"] },
  { id: "register", roles: ["driver"] },
  { id: "registerFuel", roles: ["driver"] },
  { id: "registerExpense", roles: ["driver"] },
  { id: "registerIncident", roles: ["driver"] },
  { id: "registerOdometer", roles: ["driver"] },
  { id: "profile", roles: ALL_ROLES },
  { id: "synchronization", roles: ALL_ROLES },
  { id: "search", roles: STAFF_ROLES },
];

const routeAccessById = new Map(productRouteAccess.map((route) => [route.id, route.roles]));

export function canRoleAccessRoute(role: AppRole, routeId: ProductRouteId): boolean {
  return routeAccessById.get(routeId)?.includes(role) ?? false;
}

export function getRoleHomePath(role: AppRole): string {
  if (role === "driver") {
    return routePaths.myTrip;
  }

  if (role === "accounting") {
    return routePaths.settlements;
  }

  return routePaths.home;
}
