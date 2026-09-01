import { routePaths, type ProductRouteId } from "./route-model";

/**
 * Presentation-only route metadata. It deliberately does not participate in
 * authorization or route resolution rules: those remain in route-model.ts.
 */
export type ProductSurfaceFamily =
  | "access"
  | "system"
  | "overview"
  | "operations"
  | "management"
  | "finance"
  | "driver";

export type ProductRouteVariant = "root" | "flow" | "detail" | "capture";

export interface ProductRouteExperience {
  readonly label: string;
  readonly family: ProductSurfaceFamily;
  readonly variant: ProductRouteVariant;
  readonly parentId?: ProductRouteId;
}

export const productRouteExperience: Readonly<Record<ProductRouteId, ProductRouteExperience>> = {
  login: { label: "Ingresar", family: "access", variant: "root" },
  passwordSetup: { label: "Establecer contraseña", family: "access", variant: "flow" },
  noAccess: { label: "Sin acceso", family: "system", variant: "root" },
  home: { label: "Inicio", family: "overview", variant: "root" },
  trips: { label: "Viajes", family: "operations", variant: "root" },
  newTrip: { label: "Nuevo viaje", family: "operations", variant: "flow", parentId: "trips" },
  tripSummary: {
    label: "Resumen del viaje",
    family: "operations",
    variant: "detail",
    parentId: "trips",
  },
  tripOperation: {
    label: "Operación del viaje",
    family: "operations",
    variant: "detail",
    parentId: "trips",
  },
  tripMoney: { label: "Dinero del viaje", family: "finance", variant: "detail", parentId: "trips" },
  tripDocuments: {
    label: "Documentos del viaje",
    family: "operations",
    variant: "detail",
    parentId: "trips",
  },
  tripIncidents: {
    label: "Incidencias del viaje",
    family: "operations",
    variant: "detail",
    parentId: "trips",
  },
  tripHistory: {
    label: "Historial del viaje",
    family: "operations",
    variant: "detail",
    parentId: "trips",
  },
  scheduling: { label: "Programación", family: "operations", variant: "root" },
  operationalCycles: { label: "Ciclos operativos", family: "operations", variant: "root" },
  tripEvaluator: { label: "Evaluar viaje", family: "operations", variant: "root" },
  fleet: { label: "Flota", family: "management", variant: "root" },
  vehicleDetail: { label: "Unidad", family: "management", variant: "detail", parentId: "fleet" },
  maintenance: { label: "Mantenimiento", family: "management", variant: "root" },
  newMaintenance: {
    label: "Nueva orden",
    family: "management",
    variant: "flow",
    parentId: "maintenance",
  },
  maintenanceDetail: {
    label: "Orden de trabajo",
    family: "management",
    variant: "detail",
    parentId: "maintenance",
  },
  drivers: { label: "Conductores", family: "management", variant: "root" },
  driverDetail: {
    label: "Conductor",
    family: "management",
    variant: "detail",
    parentId: "drivers",
  },
  clients: { label: "Clientes", family: "management", variant: "root" },
  clientDetail: { label: "Cliente", family: "management", variant: "detail", parentId: "clients" },
  suppliers: { label: "Proveedores", family: "management", variant: "root" },
  expenses: { label: "Gastos", family: "finance", variant: "root" },
  fuelEntries: { label: "Combustible", family: "finance", variant: "root" },
  advances: { label: "Adelantos", family: "finance", variant: "root" },
  settlements: { label: "Rendiciones", family: "finance", variant: "root" },
  settlementDetail: {
    label: "Detalle de rendición",
    family: "finance",
    variant: "detail",
    parentId: "settlements",
  },
  collections: { label: "Cobranza", family: "finance", variant: "root" },
  documents: { label: "Documentos", family: "management", variant: "root" },
  alerts: { label: "Alertas", family: "operations", variant: "root" },
  reports: { label: "Reportes", family: "finance", variant: "root" },
  companySettings: { label: "Empresa", family: "management", variant: "root" },
  profileSettings: { label: "Perfiles", family: "management", variant: "root" },
  gpsOdometerSettings: { label: "Odómetro GPS", family: "management", variant: "root" },
  myTrip: { label: "Mi viaje", family: "driver", variant: "root" },
  myTripHistory: { label: "Historial", family: "driver", variant: "flow", parentId: "myTrip" },
  register: { label: "Registrar", family: "driver", variant: "root" },
  registerFuel: {
    label: "Combustible",
    family: "driver",
    variant: "capture",
    parentId: "register",
  },
  registerExpense: { label: "Gasto", family: "driver", variant: "capture", parentId: "register" },
  registerIncident: {
    label: "Incidencia",
    family: "driver",
    variant: "capture",
    parentId: "register",
  },
  registerOdometer: {
    label: "Kilometraje",
    family: "driver",
    variant: "capture",
    parentId: "register",
  },
  profile: { label: "Mi perfil", family: "system", variant: "root" },
  synchronization: { label: "Sincronización", family: "system", variant: "root" },
  search: { label: "Buscar", family: "overview", variant: "root" },
};

export function getProductRouteIdForPath(pathname: string): ProductRouteId | null {
  for (const [routeId, pattern] of Object.entries(routePaths) as [ProductRouteId, string][]) {
    const matcher = new RegExp(`^${pattern.replace(/:[^/]+/g, "[^/]+")}$`);
    if (matcher.test(pathname)) return routeId;
  }
  return null;
}

export function getRouteExperience(routeId: ProductRouteId): ProductRouteExperience {
  return productRouteExperience[routeId];
}

export function getRouteParentPath(routeId: ProductRouteId): string | null {
  const parentId = productRouteExperience[routeId].parentId;
  return parentId === undefined ? null : routePaths[parentId];
}
