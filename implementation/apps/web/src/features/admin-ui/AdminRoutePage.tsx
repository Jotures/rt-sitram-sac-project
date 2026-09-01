import {
  useCallback,
  useEffect,
  useId,
  lazy,
  useMemo,
  useRef,
  useState,
  Suspense,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePowerSync } from "@powersync/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { routePaths, type ProductRouteId } from "../../app/routing/route-model";
import { getRouteExperience } from "../../app/routing/route-experience";
import type { AppRole, CurrentCompany } from "../identity/identity-model";
import { Button } from "../../components/primitives/Button";
import { Icon } from "../../components/primitives/Icon";
import { StatusChip } from "../../components/primitives/StatusChip";
import { useIdentity } from "../identity/IdentityProvider";
import { GpsContextCard } from "../gps-context/GpsContextCard";
import { GpsFleetExceptionsCard } from "../gps-context/GpsFleetExceptionsCard";
import { getSupabaseClient } from "../../lib/supabase";
import {
  createSupabaseAdminDataGateway,
  type AdminDataGateway,
  type AdminClientDetail,
  type AdminDriverDetail,
  type AdminDashboardSnapshot,
  type AdminDocumentRow,
  type AdminCreatedTrip,
  type AdminListRow,
  type AdminMaintenanceDetail,
  type AdminMaintenanceRow,
  type AdminMaintenanceOptions,
  type AdminOption,
  type AdminOperationalCycleDetail,
  type OperationalCycleLegKind,
  type OperationalCycleReturnStatus,
  type OperationalCycleStatus,
  type AdminPrivateFile,
  type AdminProfileRow,
  type AdminSettlementDetail,
  type AdminSupplierRow,
  type AdminStaffCaptureOptions,
  type AdminTripDetail,
  type AdminTripDetailLine,
  type AdminTripDetailSection,
  type AdminTripRow,
  type AdminTripSetupOptions,
  type AdminVehicleDetail,
  type AdminWorkOrderStatus,
  type AdminWriteContext,
} from "./admin-data";
import { summarizeAdminDashboard } from "./admin-dashboard-model";
import "./admin-ui.css";

const LazyReportsPage = lazy(async () => {
  const module = await import("../reports/ReportsPage");
  return { default: module.ReportsPage };
});

interface AdminRoutePageProps {
  readonly routeId: ProductRouteId;
  readonly gateway?: AdminDataGateway;
  readonly pathname?: string;
  readonly search?: string;
}

interface ResourceState<T> {
  readonly status: "LOADING" | "READY" | "ERROR";
  readonly data: T | null;
  readonly error: string | null;
}

const pageCopy: Readonly<
  Partial<Record<ProductRouteId, { readonly title: string; readonly description: string }>>
> = {
  clients: { title: "Clientes", description: "Datos comerciales y condiciones de pago." },
  suppliers: {
    title: "Proveedores",
    description: "Grifos, talleres, repuestos y otros aliados de la operación.",
  },
  fleet: { title: "Flota", description: "Unidades reales, kilometraje y disponibilidad." },
  drivers: { title: "Conductores", description: "Disponibilidad y datos operativos del personal." },
  trips: {
    title: "Viajes",
    description: "Servicios comerciales y su estado operativo independiente.",
  },
  scheduling: {
    title: "Programación",
    description: "Asignación de unidad y conductor a viajes aprobados.",
  },
  operationalCycles: {
    title: "Ciclos operativos",
    description: "Relaciona ida, retorno o continuación sin mezclar los cierres de cada viaje.",
  },
  expenses: {
    title: "Gastos",
    description: "Registra o revisa gastos reales vinculados a un viaje.",
  },
  fuelEntries: {
    title: "Combustible",
    description: "Registra y revisa abastecimientos reales vinculados a un viaje.",
  },
  advances: { title: "Adelantos", description: "Fondos entregados antes o durante un viaje." },
  settlements: {
    title: "Rendiciones",
    description: "Conciliación y cierre auditado del dinero del viaje.",
  },
  maintenance: { title: "Mantenimiento", description: "Planes preventivos y órdenes de trabajo." },
  documents: {
    title: "Documentos",
    description: "Vigencias por empresa, unidad, conductor, viaje o cliente.",
  },
  collections: {
    title: "Cobranza",
    description: "Facturas, pagos parciales, saldos y vencimientos.",
  },
  alerts: { title: "Alertas", description: "Excepciones operativas ordenadas por impacto." },
  reports: {
    title: "Reportes",
    description: "Indicadores derivados de los registros disponibles.",
  },
  search: {
    title: "Buscar",
    description:
      "Encuentra rutas, unidades, conductores, clientes y documentos con los permisos de tu sesión.",
  },
};

const workOrderProgressOptions: readonly AdminOption[] = [
  { id: "scheduled", label: "Programada", status: "Aún sin iniciar" },
  { id: "waiting_workshop", label: "En espera de taller", status: "Pendiente de atención" },
  { id: "in_workshop", label: "En taller", status: "Unidad ingresada" },
  { id: "in_progress", label: "En proceso", status: "Trabajo en ejecución" },
  { id: "waiting_part", label: "En espera de repuesto", status: "Pendiente de repuesto" },
];

const vehicleOwnershipOptions: readonly AdminOption[] = [
  { id: "owned", label: "Propia", status: "Empresa" },
  { id: "leased", label: "Alquilada", status: "Contrato" },
  { id: "third_party", label: "De tercero", status: "Propietario externo" },
];

const clientRelationshipOptions: readonly AdminOption[] = [
  { id: "direct", label: "Directo", status: "Cliente final" },
  { id: "intermediary", label: "Intermediario", status: "Gestiona el servicio" },
  { id: "third_party", label: "Tercero", status: "Relación comercial externa" },
];

const driverAvailabilityOptions: readonly AdminOption[] = [
  { id: "available", label: "Disponible", status: "Puede programarse" },
  { id: "rest", label: "Descanso", status: "No programar" },
  { id: "vacation", label: "Vacaciones", status: "No programar" },
  { id: "leave", label: "Licencia", status: "No programar" },
  { id: "unavailable", label: "No disponible", status: "No programar" },
];

const supplierTypeOptions: readonly AdminOption[] = [
  { id: "grifo", label: "Grifo", status: "Combustible" },
  { id: "taller", label: "Taller", status: "Mantenimiento" },
  { id: "repuestos", label: "Repuestos", status: "Partes" },
  { id: "otro", label: "Otro", status: "Proveedor" },
];

export function AdminRoutePage({
  routeId,
  gateway: providedGateway,
  pathname,
  search,
}: AdminRoutePageProps): React.JSX.Element {
  const { state: identityState } = useIdentity();
  const localDatabase = usePowerSync();
  const isOnline = useNetworkOnline();
  const companyId = identityState.status === "READY" ? identityState.identity.company.id : null;
  const gateway = useMemo(() => {
    if (providedGateway !== undefined) return providedGateway;
    const client = getSupabaseClient();
    if (client === null) return null;
    return companyId === null
      ? createSupabaseAdminDataGateway(client)
      : createSupabaseAdminDataGateway(client, {
          database: localDatabase,
          companyId,
          isOffline: () => !isOnline,
        });
  }, [companyId, isOnline, localDatabase, providedGateway]);

  if (identityState.status !== "READY") {
    return (
      <AdminNotice
        title="Preparando datos"
        copy="Esperando la identidad empresarial de la sesión."
      />
    );
  }
  if (gateway === null) {
    return (
      <AdminNotice
        title="Supabase no está configurado"
        copy="La interfaz no puede consultar ni guardar información en este entorno."
        tone="error"
      />
    );
  }

  const context: AdminWriteContext = {
    companyId: identityState.identity.company.id,
    profileId: identityState.identity.profile.id,
  };
  const role = identityState.identity.profile.role;
  const routeExperience = getRouteExperience(routeId);
  const canMutate = isOnline && (role === "management" || role === "administration");
  const resolvedPathname = pathname ?? globalThis.location?.pathname ?? "";
  const resolvedSearch = search ?? globalThis.location?.search ?? "";

  const page = (() => {
    switch (routeId) {
      case "home":
        return (
          <Dashboard
            gateway={gateway}
            canMutate={canMutate}
            canAccessOperations={role === "management" || role === "administration"}
            role={role}
            online={isOnline}
            search={resolvedSearch}
          />
        );
      case "clients":
        return <ClientsPage context={context} gateway={gateway} canMutate={canMutate} />;
      case "fleet":
        return <FleetPage context={context} gateway={gateway} canMutate={canMutate} />;
      case "drivers":
        return <DriversPage context={context} gateway={gateway} canMutate={canMutate} />;
      case "newTrip":
        return (
          <NewTripPage
            context={context}
            gateway={gateway}
            canMutate={canMutate}
            search={resolvedSearch}
          />
        );
      case "trips":
        return (
          <TripsPage gateway={gateway} canMutate={canMutate} mode="trips" search={resolvedSearch} />
        );
      case "scheduling":
        return (
          <TripsPage
            gateway={gateway}
            canMutate={canMutate}
            mode="scheduling"
            search={resolvedSearch}
          />
        );
      case "operationalCycles":
        return <OperationalCyclesPage gateway={gateway} canMutate={canMutate} />;
      case "expenses":
        return (
          <ExpensesPage
            context={context}
            gateway={gateway}
            canMutate={canMutate}
            online={isOnline}
            search={resolvedSearch}
          />
        );
      case "fuelEntries":
        return (
          <FuelEntriesPage
            context={context}
            gateway={gateway}
            canMutate={canMutate}
            online={isOnline}
            search={resolvedSearch}
          />
        );
      case "advances":
        return (
          <AdvancesPage
            context={context}
            gateway={gateway}
            canMutate={canMutate}
            online={isOnline}
            search={resolvedSearch}
          />
        );
      case "settlements":
        return (
          <SettlementsPage
            gateway={gateway}
            canMutate={canMutate}
            role={role}
            search={resolvedSearch}
          />
        );
      case "maintenance":
      case "newMaintenance":
        return (
          <MaintenancePage
            context={context}
            gateway={gateway}
            canMutate={canMutate}
            online={isOnline}
            selectedVehicleId={vehicleIdFromSearch(resolvedSearch)}
            search={resolvedSearch}
          />
        );
      case "maintenanceDetail":
        return (
          <MaintenanceOrderDetailPage
            workOrderId={detailIdFromPath(routeId, resolvedPathname)}
            context={context}
            gateway={gateway}
            canMutate={canMutate}
            online={isOnline}
          />
        );
      case "documents":
        return (
          <DocumentsPage
            context={context}
            gateway={gateway}
            canMutate={canMutate}
            online={isOnline}
            selectedVehicleId={vehicleIdFromSearch(resolvedSearch)}
            search={resolvedSearch}
          />
        );
      case "suppliers":
        return <SuppliersPage gateway={gateway} canMutate={canMutate} search={resolvedSearch} />;
      case "collections":
        return (
          <CollectionsPage
            context={context}
            gateway={gateway}
            canMutate={canMutate}
            search={resolvedSearch}
          />
        );
      case "alerts":
        return <AlertsPage context={context} gateway={gateway} canMutate={canMutate} />;
      case "reports":
        return (
          <Suspense
            fallback={
              <AdminNotice
                title="Cargando Reportes"
                copy="Preparando analítica y visualizaciones."
              />
            }
          >
            <LazyReportsPage />
          </Suspense>
        );
      case "search":
        return <OperationalSearchPage gateway={gateway} search={resolvedSearch} />;
      case "companySettings":
        return <CompanySettingsPage company={identityState.identity.company} />;
      case "profileSettings":
        return <ProfileSettingsPage gateway={gateway} role={role} canMutate={canMutate} />;
      case "tripSummary":
      case "tripOperation":
      case "tripMoney":
      case "tripDocuments":
      case "tripIncidents":
      case "tripHistory":
        return (
          <AdminDetailPage
            routeId={routeId}
            pathname={resolvedPathname}
            gateway={gateway}
            role={role}
            online={isOnline}
          />
        );
      case "clientDetail":
        return (
          <ClientDetailPage
            clientId={detailIdFromPath(routeId, resolvedPathname)}
            gateway={gateway}
            canMutate={canMutate}
          />
        );
      case "driverDetail":
        return (
          <DriverDetailPage
            driverId={detailIdFromPath(routeId, resolvedPathname)}
            gateway={gateway}
            canMutate={canMutate}
          />
        );
      case "settlementDetail":
        return (
          <SettlementDetailPage
            settlementId={detailIdFromPath(routeId, resolvedPathname)}
            gateway={gateway}
            canMutate={canMutate}
            role={role}
          />
        );
      case "vehicleDetail":
        return (
          <VehicleDetailPage
            vehicleId={detailIdFromPath(routeId, resolvedPathname)}
            gateway={gateway}
            role={role}
            online={isOnline}
            canMutate={canMutate}
          />
        );
      default:
        return (
          <AdminNotice
            title="Vista no disponible"
            copy="Esta ruta no forma parte del paquete administrativo entregado."
          />
        );
    }
  })();
  return (
    <>
      {isOnline ? null : (
        <ReadOnlyNotice copy="Sin conexión: se muestra la última copia local sincronizada donde está disponible. Las altas, revisiones, cambios de estado y cierres requieren conexión." />
      )}
      <div
        className={`admin-route admin-route--${routeExperience.family} admin-route--${routeExperience.variant}`}
      >
        {page}
      </div>
    </>
  );
}

function useNetworkOnline(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine !== false,
  );
  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    globalThis.addEventListener?.("online", markOnline);
    globalThis.addEventListener?.("offline", markOffline);
    return () => {
      globalThis.removeEventListener?.("online", markOnline);
      globalThis.removeEventListener?.("offline", markOffline);
    };
  }, []);
  return online;
}

function useResource<T>(
  loader: () => Promise<T>,
): ResourceState<T> & { readonly reload: () => void } {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({
    status: "LOADING",
    data: null,
    error: null,
  });
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setState({ status: "LOADING", data: null, error: null });
    void loader().then(
      (data) => {
        if (active) setState({ status: "READY", data, error: null });
      },
      (error: unknown) => {
        if (active) setState({ status: "ERROR", data: null, error: getErrorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [loader, revision]);

  return { ...state, reload };
}

function PageHeader({
  title,
  description,
  action,
  variant,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
  readonly variant?: "dashboard" | "trips" | "fleet" | undefined;
}): React.JSX.Element {
  return (
    <header
      className={`admin-page-header${variant === undefined ? "" : ` admin-page-header--${variant}`}`}
    >
      <div>
        <p className="admin-page-header__eyebrow">Centro de control</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function PageState<T>({
  resource,
  emptyCopy,
  children,
}: {
  readonly resource: ResourceState<T> & { readonly reload?: () => void };
  readonly emptyCopy: string;
  readonly children: (data: T) => ReactNode;
}): React.JSX.Element {
  if (resource.status === "LOADING")
    return (
      <AdminNotice
        title="Actualizando panorama"
        copy="Consultando datos autorizados para tu empresa."
        tone="loading"
      />
    );
  if (resource.status === "ERROR")
    return (
      <AdminNotice
        title="No se pudo cargar"
        copy={resource.error ?? "Error desconocido."}
        tone="error"
        action={
          resource.reload === undefined ? undefined : (
            <Button onClick={resource.reload} variant="secondary">
              Reintentar
            </Button>
          )
        }
      />
    );
  if (resource.data === null || (Array.isArray(resource.data) && resource.data.length === 0))
    return <AdminNotice title="Sin registros" copy={emptyCopy} />;
  return <>{children(resource.data)}</>;
}

function AdminNotice({
  title,
  copy,
  tone = "neutral",
  action,
}: {
  readonly title: string;
  readonly copy: string;
  readonly tone?: "neutral" | "loading" | "error";
  readonly action?: ReactNode;
}): React.JSX.Element {
  return (
    <section
      className={`admin-notice admin-notice--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={tone === "error" ? "alert" : tone === "loading" ? "gauge" : "file"} />
      <h2>{title}</h2>
      <p>{copy}</p>
      {action}
    </section>
  );
}

function Feedback({
  message,
  error,
}: {
  readonly message: string | null;
  readonly error: string | null;
}): React.JSX.Element | null {
  if (message === null && error === null) return null;
  return (
    <p
      className={`admin-feedback ${error === null ? "admin-feedback--success" : "admin-feedback--error"}`}
      role={error === null ? "status" : "alert"}
    >
      {error ?? message}
    </p>
  );
}

function AdminFormDisclosure({
  label,
  copy,
  children,
}: {
  readonly label: string;
  readonly copy: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <details className="admin-disclosure">
      <summary>
        <span className="admin-disclosure__lead">
          <span className="admin-disclosure__icon" aria-hidden="true">
            <Icon name="plus" size={18} />
          </span>
          <span>
            <strong>{label}</strong>
            <small>{copy}</small>
          </span>
        </span>
        <span className="admin-disclosure__chevron" aria-hidden="true">
          <Icon name="chevron" size={18} />
        </span>
      </summary>
      <div className="admin-disclosure__body">{children}</div>
    </details>
  );
}

function AdminActionDialog({
  title,
  copy,
  onClose,
  children,
}: {
  readonly title: string;
  readonly copy: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      className="admin-action-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <article className="admin-action-dialog__panel">
        <header className="admin-action-dialog__header">
          <div>
            <p className="admin-section-kicker">Acción sobre registro</p>
            <h2>{title}</h2>
            <p>{copy}</p>
          </div>
          <button
            aria-label="Cerrar panel"
            className="admin-action-dialog__close"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" size={19} />
          </button>
        </header>
        <div className="admin-action-dialog__body">{children}</div>
      </article>
    </dialog>
  );
}

type PrivateEvidenceView =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly file: AdminPrivateFile;
      readonly objectUrl: string;
    }
  | { readonly status: "error"; readonly message: string };

function PrivateEvidenceAction({
  gateway,
  fileId,
  online,
  label,
}: {
  readonly gateway: AdminDataGateway;
  readonly fileId: string;
  readonly online: boolean;
  readonly label: string;
}): React.JSX.Element {
  const [view, setView] = useState<PrivateEvidenceView | null>(null);
  const requestIdRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);
  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current === null) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);
  const close = useCallback(() => {
    requestIdRef.current += 1;
    revokeObjectUrl();
    setView(null);
  }, [revokeObjectUrl]);
  useEffect(
    () => () => {
      requestIdRef.current += 1;
      revokeObjectUrl();
    },
    [revokeObjectUrl],
  );
  useEffect(() => {
    if (!online && view !== null) close();
  }, [close, online, view]);

  const prepare = useCallback(async () => {
    if (!online) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    revokeObjectUrl();
    setView({ status: "loading" });
    try {
      const file = await gateway.loadPrivateFile(fileId);
      if (requestIdRef.current !== requestId) return;
      const objectUrl = URL.createObjectURL(file.blob);
      if (requestIdRef.current !== requestId) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      objectUrlRef.current = objectUrl;
      setView({ status: "ready", file, objectUrl });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setView({
        status: "error",
        message:
          error instanceof Error && error.message.trim() !== ""
            ? error.message
            : "No se pudo recuperar el archivo privado. Vuelve a intentarlo.",
      });
    }
  }, [fileId, gateway, online, revokeObjectUrl]);

  const isBusy = view?.status === "loading";
  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-label={online ? label : `${label}. La evidencia privada requiere conexión.`}
        disabled={!online || isBusy}
        icon="file"
        onClick={() => void prepare()}
        title={online ? undefined : "La evidencia privada requiere conexión."}
        variant="quiet"
      >
        {isBusy ? "Preparando…" : online ? label : "Requiere conexión"}
      </Button>
      {view === null ? null : (
        <AdminActionDialog
          title={
            view.status === "ready"
              ? `Evidencia: ${view.file.originalName}`
              : "Consulta de evidencia"
          }
          copy={
            view.status === "ready"
              ? "Consulta temporal con los permisos de tu sesión. El archivo no se guarda en la copia local."
              : "La consulta no modifica el registro ni publica el archivo."
          }
          onClose={close}
        >
          {view.status === "loading" ? (
            <div aria-live="polite" className="admin-evidence-state" role="status">
              <Icon name="file" size={22} />
              <p>Verificando y recuperando el archivo privado…</p>
            </div>
          ) : null}
          {view.status === "error" ? (
            <div className="admin-evidence-state admin-evidence-state--error" role="alert">
              <Icon name="alert" size={22} />
              <div>
                <p>{view.message}</p>
                <Button onClick={() => void prepare()} variant="secondary">
                  Reintentar
                </Button>
              </div>
            </div>
          ) : null}
          {view.status === "ready" ? (
            <>
              <div className="admin-evidence-preview">
                {view.file.mimeType === "application/pdf" ? (
                  <iframe
                    sandbox=""
                    src={view.objectUrl}
                    title={`Vista previa de ${view.file.originalName}`}
                  />
                ) : (
                  <img alt={`Vista previa de ${view.file.originalName}`} src={view.objectUrl} />
                )}
              </div>
              <p className="admin-evidence-note">
                Archivo: <strong>{view.file.originalName}</strong> ·{" "}
                {formatFileSize(view.file.sizeBytes)}
              </p>
              <a
                className="admin-header-action"
                download={view.file.originalName}
                href={view.objectUrl}
              >
                <Icon name="file" size={17} /> Descargar archivo
              </a>
            </>
          ) : null}
        </AdminActionDialog>
      )}
    </>
  );
}

type AdminTableKind =
  | "records"
  | "clients"
  | "fleet"
  | "people"
  | "trips"
  | "cycles"
  | "cycleTrips"
  | "finance"
  | "settlements"
  | "maintenance"
  | "documents"
  | "alerts"
  | "profiles"
  | "operations"
  | "fuel";

const adminTableCopy: Readonly<
  Record<
    AdminTableKind,
    {
      readonly subject: string;
      readonly status: string;
      readonly date: string;
      readonly amount: string;
      readonly showDate: boolean;
      readonly showAmount: boolean;
    }
  >
> = {
  records: {
    subject: "Registro",
    status: "Estado",
    date: "Fecha",
    amount: "Monto",
    showDate: true,
    showAmount: true,
  },
  clients: {
    subject: "Cliente",
    status: "Relación",
    date: "Alta",
    amount: "Monto",
    showDate: false,
    showAmount: false,
  },
  fleet: {
    subject: "Unidad",
    status: "Estado operativo",
    date: "Actualizado",
    amount: "Monto",
    showDate: false,
    showAmount: false,
  },
  people: {
    subject: "Persona",
    status: "Disponibilidad",
    date: "Actualizado",
    amount: "Monto",
    showDate: false,
    showAmount: false,
  },
  trips: {
    subject: "Viaje y ruta",
    status: "Etapa",
    date: "Programado",
    amount: "Flete",
    showDate: true,
    showAmount: true,
  },
  cycles: {
    subject: "Ciclo y unidad",
    status: "Etapa",
    date: "Inicio / registro",
    amount: "Monto",
    showDate: true,
    showAmount: false,
  },
  cycleTrips: {
    subject: "Viaje y tramo",
    status: "Etapa del viaje",
    date: "Programado",
    amount: "Monto",
    showDate: true,
    showAmount: false,
  },
  finance: {
    subject: "Movimiento",
    status: "Revisión",
    date: "Fecha",
    amount: "Importe",
    showDate: true,
    showAmount: true,
  },
  settlements: {
    subject: "Rendición",
    status: "Conciliación",
    date: "Inicio",
    amount: "Saldo",
    showDate: true,
    showAmount: true,
  },
  maintenance: {
    subject: "Intervención",
    status: "Estado",
    date: "Actualizado",
    amount: "Costo",
    showDate: true,
    showAmount: false,
  },
  documents: {
    subject: "Documento",
    status: "Vigencia",
    date: "Vence / registrado",
    amount: "Monto",
    showDate: true,
    showAmount: false,
  },
  alerts: {
    subject: "Situación",
    status: "Prioridad y estado",
    date: "Límite / generada",
    amount: "Monto",
    showDate: true,
    showAmount: false,
  },
  profiles: {
    subject: "Usuario",
    status: "Acceso",
    date: "Alta",
    amount: "Monto",
    showDate: true,
    showAmount: false,
  },
  operations: {
    subject: "Registro operativo",
    status: "Resultado",
    date: "Momento",
    amount: "Monto",
    showDate: true,
    showAmount: false,
  },
  fuel: {
    subject: "Abastecimiento",
    status: "Revisión",
    date: "Fecha",
    amount: "Importe",
    showDate: true,
    showAmount: true,
  },
};

function RecordTable({
  rows,
  actions,
  kind = "records",
}: {
  readonly rows: readonly AdminListRow[];
  readonly actions?: ((row: AdminListRow) => ReactNode) | undefined;
  readonly kind?: AdminTableKind;
}): React.JSX.Element {
  const copy = adminTableCopy[kind];
  return (
    <div className="admin-table-wrap">
      <table className={`admin-table admin-table--${kind}`}>
        <thead>
          <tr>
            <th>{copy.subject}</th>
            <th>{copy.status}</th>
            {copy.showDate ? <th className="admin-table__date">{copy.date}</th> : null}
            {copy.showAmount ? <th className="admin-table__amount">{copy.amount}</th> : null}
            {actions === undefined ? null : (
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.title}</strong>
                <small>{row.description}</small>
                {row.technicalReference === undefined ? null : (
                  <small className="technical-value">{row.technicalReference}</small>
                )}
              </td>
              <td>
                <StatusChip label={labelStatusForUi(row.status)} tone={toneForStatus(row.status)} />
              </td>
              {copy.showDate ? <td className="admin-table__date">{formatDate(row.date)}</td> : null}
              {copy.showAmount ? (
                <td className="admin-table__amount admin-table__number">
                  {row.amount === null ? "—" : formatMoney(row.amount)}
                </td>
              ) : null}
              {actions === undefined ? null : (
                <td className="admin-table__actions">{actions(row)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard({
  gateway,
  canMutate,
  canAccessOperations,
  role,
  online,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly canAccessOperations: boolean;
  readonly role: AppRole;
  readonly online: boolean;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.loadDashboard(), [gateway]);
  const resource = useResource(loader);
  return (
    <>
      <PageHeader
        variant="dashboard"
        title="Estado operativo"
        description="Empieza por lo que necesita una decisión y luego revisa el estado de la flota, los viajes y los pendientes de dinero."
        action={
          canMutate ? (
            <Link className="admin-header-action" to={routePaths.newTrip}>
              <Icon name="plus" size={18} />
              Crear nuevo viaje
            </Link>
          ) : undefined
        }
      />
      <PageState
        resource={resource}
        emptyCopy="La operación aún no tiene unidades, viajes ni pendientes registrados. Comienza por registrar una unidad; después podrás agregar conductores, clientes y crear viajes."
      >
        {(data) => (
          <DashboardContent
            data={data}
            canAccessOperations={canAccessOperations}
            role={role}
            online={online}
            search={search}
          />
        )}
      </PageState>
    </>
  );
}

function DashboardContent({
  data,
  canAccessOperations,
  role,
  online,
  search,
}: {
  readonly data: AdminDashboardSnapshot;
  readonly canAccessOperations: boolean;
  readonly role: AppRole;
  readonly online: boolean;
  readonly search: string;
}): React.JSX.Element {
  const pendingPanel = new URLSearchParams(search).get("panel") === "pendientes";
  const pendingPanelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!pendingPanel || pendingPanelRef.current === null) return;
    pendingPanelRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    pendingPanelRef.current.focus({ preventScroll: true });
  }, [pendingPanel]);
  const summary = summarizeAdminDashboard(data);
  const alertsUnavailable = canAccessOperations && data.unavailableMetrics.includes("alerts");
  const invoicesUnavailable = data.unavailableMetrics.includes("invoices");
  const visibleAttentionCount =
    (canAccessOperations ? summary.activeAlerts.length : 0) +
    summary.pendingSettlements.length +
    summary.pendingInvoices.length;
  const attentionDestination = dashboardAttentionDestination({
    alerts: canAccessOperations && !alertsUnavailable ? summary.activeAlerts : [],
    settlements: summary.pendingSettlements,
    invoices: invoicesUnavailable ? [] : summary.pendingInvoices,
  });
  return (
    <div className="admin-dashboard">
      {data.source === "local" ? (
        <ReadOnlyNotice copy="Vista desde la copia local. Flota, viajes y rendiciones están disponibles; alertas y cobranza requieren conexión para confirmar su estado actual." />
      ) : null}
      <section className="admin-dashboard__orientation" aria-label="Cómo usar este inicio">
        <span aria-hidden="true">
          <Icon name="route" size={19} />
        </span>
        <p>
          <strong>Cómo usar este inicio:</strong> empieza por la atención prioritaria; después
          revisa la disponibilidad de la flota y ejecuta los próximos pasos de cada viaje.
        </p>
      </section>
      <section className="admin-briefing" aria-labelledby="admin-attention-title">
        <div className="admin-briefing__marker" aria-hidden="true">
          <Icon name={visibleAttentionCount > 0 ? "alert" : "route"} size={24} />
        </div>
        <div className="admin-briefing__copy">
          <p className="admin-section-kicker">Atención prioritaria</p>
          <h2 id="admin-attention-title">
            {alertsUnavailable
              ? "Visibilidad parcial mientras estás sin conexión"
              : visibleAttentionCount === 0
                ? "Sin pendientes visibles en este momento"
                : `${visibleAttentionCount} ${visibleAttentionCount === 1 ? "pendiente requiere" : "pendientes requieren"} seguimiento`}
          </h2>
          <p>
            {alertsUnavailable
              ? "Continúa con los datos locales y vuelve a confirmar alertas y cobranza al recuperar conexión."
              : visibleAttentionCount === 0
                ? "La flota y los viajes no presentan alertas, rendiciones o cobros pendientes dentro de los datos disponibles."
                : canAccessOperations
                  ? "Primero resuelve bloqueos operativos; después concilia rendiciones y cobranza."
                  : "Concilia rendiciones y cobranza de acuerdo con los registros disponibles."}
          </p>
        </div>
        {attentionDestination === null ? null : (
          <Link className="admin-text-link" to={attentionDestination.to}>
            {attentionDestination.label}
            <Icon name="chevron" size={16} />
          </Link>
        )}
      </section>
      <section
        className="admin-work-today"
        id="pendientes"
        ref={pendingPanelRef}
        tabIndex={-1}
        aria-labelledby="work-today-title"
      >
        <div className="admin-work-today__heading">
          <p className="admin-section-kicker">Trabajo de hoy</p>
          <h2 id="work-today-title">Pendientes y próximos pasos</h2>
        </div>
        <div className="admin-operations-layout">
          <DashboardAttention data={data} showOperationalAlerts={canAccessOperations} />
          <DashboardNextSteps data={data} />
        </div>
      </section>

      <dl className="admin-operation-pulse" aria-label="Pulso de la operación">
        <DashboardSignal
          href={routePaths.fleet}
          label="Flota disponible"
          value={`${summary.availableVehicles} / ${data.vehicles.length}`}
          context={`${summary.operatingVehicles} en operación · ${summary.attentionVehicles} por revisar`}
        />
        <DashboardSignal
          href={routePaths.trips}
          label="Viajes en curso"
          value={String(summary.activeTrips.length)}
          context={
            summary.activeTrips.length === 0
              ? "Sin viajes en curso"
              : `${data.trips.length} servicios registrados en total`
          }
        />
        <DashboardSignal
          href={routePaths.settlements}
          label="Rendiciones por conciliar"
          value={String(summary.pendingSettlements.length)}
          context={
            summary.pendingSettlements.length === 0
              ? "Sin rendiciones pendientes"
              : "adelantos, gastos o saldos por cerrar"
          }
        />
        <DashboardSignal
          href={routePaths.collections}
          label="Pendiente de cobro"
          value={invoicesUnavailable ? "Sin conexión" : formatMoney(summary.pendingInvoiceAmount)}
          context={
            invoicesUnavailable
              ? "se confirma al reconectar"
              : summary.pendingInvoices.length === 0
                ? "Sin cobros pendientes"
                : `${summary.pendingInvoices.length} documento(s) pendiente(s)`
          }
        />
      </dl>

      <GpsFleetExceptionsCard
        role={role}
        online={online}
        vehicles={data.vehicles.map((vehicle) => ({ id: vehicle.id, label: vehicle.title }))}
      />

      <section
        className="admin-card admin-operation-board admin-operation-board--fleet"
        aria-labelledby="fleet-board-title"
      >
        <div className="admin-card__heading admin-card__heading--linked">
          <div>
            <p className="admin-section-kicker">Disponibilidad real</p>
            <h2 id="fleet-board-title">Estado de flota</h2>
          </div>
          {canAccessOperations ? (
            <Link className="admin-text-link" to={routePaths.fleet}>
              Gestionar unidades
              <Icon name="chevron" size={16} />
            </Link>
          ) : null}
        </div>
        {data.vehicles.length === 0 ? (
          <p className="admin-empty-copy">
            Aún no hay unidades registradas. Registra la primera unidad para controlar su
            disponibilidad y poder asignarla a un viaje.
          </p>
        ) : (
          <FleetOverview vehicles={data.vehicles} trips={data.trips} />
        )}
      </section>

      <section className="admin-card admin-operation-board" aria-labelledby="active-trips-title">
        <div className="admin-card__heading admin-card__heading--linked">
          <div>
            <p className="admin-section-kicker">Operación en movimiento</p>
            <h2 id="active-trips-title">Viajes activos</h2>
          </div>
          <Link className="admin-text-link" to={routePaths.trips}>
            Ver todos
            <Icon name="chevron" size={16} />
          </Link>
        </div>
        {summary.activeTrips.length === 0 ? (
          <p className="admin-empty-copy">
            Aún no hay viajes activos. Cuando un servicio se programe o inicie, aparecerá aquí con
            su etapa y la información necesaria para seguirlo.
          </p>
        ) : (
          <TripList
            canMutate={false}
            onManage={() => undefined}
            rows={summary.activeTrips.slice(0, 6)}
          />
        )}
      </section>
    </div>
  );
}

function DashboardSignal({
  href,
  label,
  value,
  context,
}: {
  readonly href: string;
  readonly label: string;
  readonly value: string;
  readonly context: string;
}): React.JSX.Element {
  return (
    <div>
      <Link to={href}>
        <dt>{label}</dt>
        <dd>{value}</dd>
        <small>{context}</small>
      </Link>
    </div>
  );
}

function FleetOverview({
  vehicles,
  trips,
}: {
  readonly vehicles: readonly AdminListRow[];
  readonly trips: readonly AdminTripRow[];
}): React.JSX.Element {
  const ordered = [...vehicles].sort(
    (left, right) => fleetPriority(left.status) - fleetPriority(right.status),
  );
  return (
    <ul className="admin-fleet-overview">
      {ordered.slice(0, 6).map((vehicle) => {
        const vehicleStatus = labelStatusForUi(vehicle.status);
        const activeTrip = trips.find(
          (trip) =>
            trip.vehicleId === vehicle.id &&
            ["scheduled", "loading", "in_transit", "unloading"].includes(trip.operationalStatus),
        );
        const context =
          activeTrip === undefined
            ? vehicleStatus === "Disponible"
              ? "Lista para asignar · sin viaje activo"
              : vehicleStatus === "Programado"
                ? "Tiene una salida programada · confirma la asignación"
                : "No disponible para asignación · requiere revisión operativa"
            : `${activeTrip.title} · ${labelStatusForUi(activeTrip.operationalStatus)}`;
        return (
          <li key={vehicle.id}>
            <Link to={vehicleDetailPath(vehicle.id)}>
              <span className="admin-fleet-overview__unit">{vehicle.title}</span>
              <small>{context}</small>
              <StatusChip label={vehicleStatus} tone={toneForStatus(vehicle.status)} />
              <Icon name="chevron" size={16} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function fleetPriority(status: string): number {
  const normalized = status.toLocaleLowerCase("es-PE");
  if (normalized.includes("disponible") || normalized.includes("available")) return 2;
  if (
    normalized.includes("viaje") ||
    normalized.includes("trip") ||
    normalized.includes("programad")
  )
    return 1;
  return 0;
}

export function dashboardAttentionDestination({
  alerts,
  settlements,
  invoices,
}: {
  readonly alerts: readonly AdminListRow[];
  readonly settlements: readonly AdminListRow[];
  readonly invoices: readonly AdminListRow[];
}): { readonly to: string; readonly label: string } | null {
  const total = alerts.length + settlements.length + invoices.length;
  if (total === 0) return null;
  if (total > 1) return { to: `${routePaths.home}?panel=pendientes`, label: "Ver pendientes" };
  if (alerts.length === 1) return { to: routePaths.alerts, label: "Revisar alerta" };
  if (settlements.length === 1)
    return { to: settlementDetailPath(settlements[0]!.id), label: "Revisar rendición" };
  return {
    to: `${routePaths.collections}?q=${encodeURIComponent(invoices[0]!.id)}`,
    label: "Revisar cobranza",
  };
}

function DashboardAttention({
  data,
  showOperationalAlerts,
}: {
  readonly data: AdminDashboardSnapshot;
  readonly showOperationalAlerts: boolean;
}): React.JSX.Element {
  const summary = summarizeAdminDashboard(data);
  const alertsUnavailable = showOperationalAlerts && data.unavailableMetrics.includes("alerts");
  const invoicesUnavailable = data.unavailableMetrics.includes("invoices");
  const hasVisibleWork =
    (showOperationalAlerts && summary.activeAlerts.length > 0) ||
    summary.pendingSettlements.length > 0 ||
    summary.pendingInvoices.length > 0;

  return (
    <section className="admin-card admin-priority-card" aria-labelledby="priority-list-title">
      <div className="admin-card__heading">
        <div>
          <p className="admin-section-kicker">Excepciones y dinero</p>
          <h2 id="priority-list-title">Qué atender primero</h2>
        </div>
      </div>
      {alertsUnavailable ? (
        <p className="admin-empty-copy">
          No podemos confirmar las alertas sin conexión. Vuelve a revisarlas cuando recuperes
          internet.
        </p>
      ) : null}
      {hasVisibleWork ? (
        <ul className="admin-priority-list">
          {(showOperationalAlerts ? summary.activeAlerts : []).slice(0, 2).map((alert) => (
            <li
              key={alert.id}
              className="admin-priority-list__item admin-priority-list__item--alert"
            >
              <span className="admin-priority-list__icon" aria-hidden="true">
                <Icon name="alert" size={18} />
              </span>
              <div>
                <strong>{alert.title}</strong>
                <small>{alert.description}</small>
              </div>
              <StatusChip
                label={labelStatusForUi(alert.status)}
                tone={toneForStatus(alert.status)}
              />
              <Link className="admin-priority-list__action" to={routePaths.alerts}>
                Revisar alerta
              </Link>
            </li>
          ))}
          {summary.pendingSettlements.slice(0, 3).map((settlement) => (
            <li className="admin-priority-list__item" key={settlement.id}>
              <span className="admin-priority-list__icon" aria-hidden="true">
                <Icon name="money" size={18} />
              </span>
              <div>
                <strong>{settlement.title}</strong>
                <small>{settlement.description}</small>
              </div>
              <StatusChip
                label={labelStatusForUi(settlement.status)}
                tone={toneForStatus(settlement.status)}
              />
              <Link
                className="admin-priority-list__action"
                to={settlementDetailPath(settlement.id)}
              >
                Resolver rendición
              </Link>
            </li>
          ))}
          {!invoicesUnavailable
            ? summary.pendingInvoices.slice(0, 3).map((invoice) => (
                <li className="admin-priority-list__item" key={invoice.id}>
                  <span className="admin-priority-list__icon" aria-hidden="true">
                    <Icon name="file" size={18} />
                  </span>
                  <div>
                    <strong>{invoice.title}</strong>
                    <small>{invoice.description}</small>
                  </div>
                  <StatusChip
                    label={labelStatusForUi(invoice.status)}
                    tone={toneForStatus(invoice.status)}
                  />
                  <Link
                    className="admin-priority-list__action"
                    to={`${routePaths.collections}?q=${encodeURIComponent(invoice.id)}`}
                  >
                    Revisar cobro
                  </Link>
                </li>
              ))
            : null}
        </ul>
      ) : (
        <p className="admin-empty-copy">
          No hay alertas, rendiciones ni cobros pendientes dentro de los datos disponibles.
        </p>
      )}
    </section>
  );
}

function DashboardNextSteps({
  data,
}: {
  readonly data: AdminDashboardSnapshot;
}): React.JSX.Element {
  const steps = summarizeAdminDashboard(data).nextSteps.slice(0, 4);
  return (
    <section className="admin-card admin-next-card" aria-labelledby="next-steps-title">
      <div className="admin-card__heading">
        <div>
          <p className="admin-section-kicker">Siguiente acción</p>
          <h2 id="next-steps-title">Qué hacer después</h2>
        </div>
      </div>
      {steps.length === 0 ? (
        <p className="admin-empty-copy">
          Cuando un viaje necesite aprobarse, programarse o seguirse, verás aquí la acción
          correspondiente.
        </p>
      ) : (
        <ol className="admin-next-list">
          {steps.map(({ trip, action }) => (
            <li key={trip.id}>
              <span aria-hidden="true" />
              <div>
                <strong>{action}</strong>
                <small>
                  {trip.title} ·{" "}
                  {trip.vehiclePlate === null
                    ? "Sin unidad asignada"
                    : `Unidad ${trip.vehiclePlate}`}{" "}
                  · {trip.driverName === null ? "Sin conductor asignado" : trip.driverName}
                </small>
              </div>
              <StatusChip label={labelStatusForUi(trip.status)} tone={toneForStatus(trip.status)} />
              <Link
                className="admin-next-list__action"
                to={
                  tripPrimaryAction(trip).kind === "manage"
                    ? manageTripPath(trip.id)
                    : tripSummaryPath(trip.id)
                }
              >
                {action === "Monitorear el recorrido" ? "Ver seguimiento" : "Abrir viaje"}
              </Link>
            </li>
          ))}
        </ol>
      )}
      <Link className="admin-next-card__action" to={routePaths.trips}>
        Gestionar viajes
        <Icon name="chevron" size={16} />
      </Link>
    </section>
  );
}

function Kpi({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  const normalized = label.toLocaleLowerCase("es-PE");
  const tone =
    normalized.includes("margen") ||
    normalized.includes("carga") ||
    normalized.includes("disponible")
      ? "success"
      : normalized.includes("costo") ||
          normalized.includes("gasto") ||
          normalized.includes("combustible")
        ? "copper"
        : normalized.includes("km") ||
            normalized.includes("distancia") ||
            normalized.includes("ingreso")
          ? "info"
          : "neutral";
  return (
    <article className={`admin-kpi--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ClientsPage({
  gateway,
  context,
  canMutate,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly canMutate: boolean;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listClients(), [gateway]);
  const resource = useResource(loader);
  return (
    <ResourceCrudPage
      title="Clientes"
      description={pageCopy.clients?.description ?? ""}
      resource={resource}
      emptyCopy="No existen clientes visibles para tu empresa."
      form={
        canMutate ? (
          <AdminFormDisclosure
            label="Añadir cliente"
            copy="Abre el formulario cuando tengas los datos comerciales confirmados."
          >
            <ClientForm gateway={gateway} context={context} onSaved={resource.reload} />
          </AdminFormDisclosure>
        ) : (
          <ReadOnlyNotice />
        )
      }
      listLabel="Cartera de clientes"
      tableKind="clients"
      actions={(row) => (
        <Link className="admin-text-link" to={clientDetailPath(row.id)}>
          Ver cliente <Icon name="chevron" size={16} />
        </Link>
      )}
    />
  );
}

interface ClientFormProps {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly onSaved: () => void;
}

function ClientForm({ gateway, context, onSaved }: ClientFormProps): React.JSX.Element {
  return (
    <SimpleForm
      title="Nuevo cliente"
      submitLabel="Guardar cliente"
      onSubmit={async (form) =>
        gateway.createClient(context, {
          legalName: textValue(form, "legalName"),
          taxId: optionalText(form, "taxId"),
          paymentTermsDays: numberValue(form, "paymentTermsDays", 0),
        })
      }
      onSaved={onSaved}
    >
      <Field label="Razón social" name="legalName" required />
      <Field label="RUC o DNI" name="taxId" />
      <Field
        label="Días de pago"
        name="paymentTermsDays"
        type="number"
        min="0"
        defaultValue="0"
        required
      />
    </SimpleForm>
  );
}

function SuppliersPage({
  gateway,
  canMutate,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listSuppliers(), [gateway]);
  const resource = useResource(loader);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams(search);
  const [editing, setEditing] = useState<AdminSupplierRow | null>(null);
  const type = supplierTypeFromSearch(searchParams.get("tipo"));
  const query = searchParams.get("q") ?? "";
  const returnTo = safeInternalPath(searchParams.get("volver"));
  const updateFilters = (nextType: AdminSupplierRow["supplierType"] | null, nextQuery: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextType === null) next.delete("tipo");
    else next.set("tipo", nextType);
    if (nextQuery.trim() === "") next.delete("q");
    else next.set("q", nextQuery);
    setSearchParams(next, { replace: true });
  };
  return (
    <>
      <ResourceCrudPage
        title="Proveedores"
        description={pageCopy.suppliers?.description ?? ""}
        resource={resource}
        emptyCopy="No hay proveedores registrados. Puedes empezar por un grifo o taller habitual."
        form={
          canMutate ? (
            <AdminFormDisclosure
              label={type === "grifo" ? "Registrar nuevo grifo" : "Registrar proveedor"}
              copy="No se eliminan proveedores con historial; puedes desactivarlos cuando ya no se usen."
            >
              <SimpleForm
                title={type === "grifo" ? "Nuevo grifo" : "Nuevo proveedor"}
                submitLabel="Guardar proveedor"
                onSubmit={async (form) => {
                  const supplier = await gateway.createSupplier({
                    legalName: textValue(form, "legalName"),
                    tradeName: optionalText(form, "tradeName"),
                    taxId: optionalText(form, "taxId"),
                    supplierType: supplierTypeValue(form, "supplierType"),
                    phone: optionalText(form, "phone"),
                    address: optionalText(form, "address"),
                    notes: optionalText(form, "notes"),
                  });
                  if (returnTo !== null) {
                    const separator = returnTo.includes("?") ? "&" : "?";
                    navigate(
                      `${returnTo}${separator}proveedor=${encodeURIComponent(supplier.id)}`,
                      {
                        replace: true,
                      },
                    );
                  }
                }}
                onSaved={resource.reload}
              >
                <Field label="Razón social o nombre" name="legalName" required />
                <Field label="Nombre comercial" name="tradeName" />
                <Field label="RUC o DNI" name="taxId" />
                <SelectField
                  defaultValue={type ?? undefined}
                  label="Tipo de proveedor"
                  name="supplierType"
                  options={supplierTypeOptions}
                  required
                />
                <Field label="Teléfono" name="phone" type="tel" />
                <Field label="Dirección" name="address" />
                <TextareaField label="Notas" name="notes" />
              </SimpleForm>
            </AdminFormDisclosure>
          ) : (
            <ReadOnlyNotice />
          )
        }
        listLabel="Proveedores de la empresa"
        tableKind="clients"
        listToolbar={<SupplierFilters query={query} type={type} onChange={updateFilters} />}
        rowFilter={(row) => {
          const supplier = row as AdminSupplierRow;
          if (type !== null && supplier.supplierType !== type) return false;
          if (query.trim() === "") return true;
          return `${supplier.title} ${supplier.description} ${supplier.supplierType}`
            .toLocaleLowerCase("es-PE")
            .includes(query.trim().toLocaleLowerCase("es-PE"));
        }}
        actions={
          canMutate
            ? (row) => (
                <Button onClick={() => setEditing(row as AdminSupplierRow)} variant="quiet">
                  Editar
                </Button>
              )
            : undefined
        }
      />
      {editing === null ? null : (
        <AdminActionDialog
          title={`Editar ${editing.title}`}
          copy="La desactivación conserva las operaciones históricas y evita su uso futuro."
          onClose={() => setEditing(null)}
        >
          <SimpleForm
            compact
            title={`Datos de ${editing.title}`}
            submitLabel="Guardar cambios"
            onSubmit={(form) =>
              gateway.updateSupplierMaster({
                id: editing.id,
                expectedUpdatedAt: requiredUpdatedAt(editing),
                legalName: textValue(form, "legalName"),
                tradeName: optionalText(form, "tradeName"),
                taxId: optionalText(form, "taxId"),
                supplierType: supplierTypeValue(form, "supplierType"),
                phone: optionalText(form, "phone"),
                address: optionalText(form, "address"),
                active: booleanValue(form, "active"),
                notes: optionalText(form, "notes"),
              })
            }
            onSaved={() => {
              setEditing(null);
              resource.reload();
            }}
          >
            <Field
              defaultValue={editing.legalName}
              label="Razón social o nombre"
              name="legalName"
              required
            />
            <Field
              defaultValue={editing.tradeName ?? ""}
              label="Nombre comercial"
              name="tradeName"
            />
            <Field defaultValue={editing.taxId ?? ""} label="RUC o DNI" name="taxId" />
            <SelectField
              defaultValue={editing.supplierType}
              label="Tipo"
              name="supplierType"
              options={supplierTypeOptions}
              required
            />
            <Field defaultValue={editing.phone ?? ""} label="Teléfono" name="phone" type="tel" />
            <Field defaultValue={editing.address ?? ""} label="Dirección" name="address" />
            <TextareaField defaultValue={editing.notes ?? ""} label="Notas" name="notes" />
            <CheckboxField defaultChecked={editing.active} label="Proveedor activo" name="active" />
          </SimpleForm>
        </AdminActionDialog>
      )}
    </>
  );
}

function SupplierFilters({
  type,
  query,
  onChange,
}: {
  readonly type: AdminSupplierRow["supplierType"] | null;
  readonly query: string;
  readonly onChange: (type: AdminSupplierRow["supplierType"] | null, query: string) => void;
}): React.JSX.Element {
  return (
    <div className="admin-list-filters" aria-label="Filtrar proveedores">
      <label>
        <span className="sr-only">Buscar proveedor</span>
        <input
          onChange={(event) => onChange(type, event.target.value)}
          placeholder="Buscar proveedor"
          type="search"
          value={query}
        />
      </label>
      <div className="admin-filter-chips" aria-label="Tipo de proveedor">
        <button
          aria-pressed={type === null}
          className={type === null ? "is-active" : undefined}
          onClick={() => onChange(null, query)}
          type="button"
        >
          Todos
        </button>
        {supplierTypeOptions.map((option) => (
          <button
            aria-pressed={type === option.id}
            className={type === option.id ? "is-active" : undefined}
            key={option.id}
            onClick={() => onChange(option.id as AdminSupplierRow["supplierType"], query)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FleetPage({
  gateway,
  context,
  canMutate,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly canMutate: boolean;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listVehicles(), [gateway]);
  const resource = useResource(loader);
  return (
    <ResourceCrudPage
      title="Flota"
      description={pageCopy.fleet?.description ?? ""}
      resource={resource}
      emptyCopy="No hay unidades registradas."
      form={
        canMutate ? (
          <div id="registrar-unidad">
            <AdminFormDisclosure
              label="Registrar unidad"
              copy="Mantén el maestro de flota separado de la consulta diaria."
            >
              <SimpleForm
                title="Registrar unidad"
                submitLabel="Guardar unidad"
                onSubmit={async (form) =>
                  gateway.createVehicle(context, {
                    plate: textValue(form, "plate"),
                    make: optionalText(form, "make"),
                    model: optionalText(form, "model"),
                    modelYear: nullableNumber(form, "modelYear"),
                    capacityTons: nullableNumber(form, "capacityTons"),
                    ownershipType: ownershipTypeValue(form, "ownershipType"),
                    ownerName: optionalText(form, "ownerName"),
                    notes: optionalText(form, "notes"),
                  })
                }
                onSaved={resource.reload}
              >
                <Field label="Placa" name="plate" required />
                <Field label="Marca" name="make" />
                <Field label="Modelo" name="model" />
                <Field label="Año" name="modelYear" type="number" min="1900" />
                <Field
                  label="Capacidad (t)"
                  name="capacityTons"
                  type="number"
                  min="0.001"
                  step="0.001"
                />
                <SelectField
                  label="Propiedad"
                  name="ownershipType"
                  options={vehicleOwnershipOptions}
                />
                <Field label="Propietario (si corresponde)" name="ownerName" />
                <TextareaField label="Notas" name="notes" />
              </SimpleForm>
            </AdminFormDisclosure>
          </div>
        ) : (
          <ReadOnlyNotice />
        )
      }
      listLabel="Unidades de la empresa"
      tableKind="fleet"
      headerAction={
        canMutate ? (
          <a className="admin-header-action" href="#registrar-unidad">
            <Icon name="plus" size={18} /> Registrar unidad
          </a>
        ) : undefined
      }
      headerVariant="fleet"
      actions={(row) => (
        <Link className="admin-text-link" to={vehicleDetailPath(row.id)}>
          Ver unidad <Icon name="chevron" size={16} />
        </Link>
      )}
    />
  );
}

function DriversPage({
  gateway,
  context,
  canMutate,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly canMutate: boolean;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listDrivers(), [gateway]);
  const resource = useResource(loader);
  return (
    <ResourceCrudPage
      title="Conductores"
      description={pageCopy.drivers?.description ?? ""}
      resource={resource}
      emptyCopy="No hay conductores registrados."
      form={
        canMutate ? (
          <AdminFormDisclosure
            label="Registrar conductor"
            copy="Añade personal únicamente cuando dispongas de su información operativa."
          >
            <SimpleForm
              title="Registrar conductor"
              submitLabel="Guardar conductor"
              onSubmit={async (form) =>
                gateway.createDriver(context, {
                  displayName: textValue(form, "displayName"),
                  documentNumber: optionalText(form, "documentNumber"),
                  phone: optionalText(form, "phone"),
                })
              }
              onSaved={resource.reload}
            >
              <Field label="Nombre completo" name="displayName" required />
              <Field label="DNI" name="documentNumber" />
              <Field label="Teléfono" name="phone" type="tel" />
            </SimpleForm>
          </AdminFormDisclosure>
        ) : (
          <ReadOnlyNotice />
        )
      }
      listLabel="Equipo de conducción"
      tableKind="people"
      actions={(row) => (
        <Link className="admin-text-link" to={driverDetailPath(row.id)}>
          Ver conductor <Icon name="chevron" size={16} />
        </Link>
      )}
    />
  );
}

function NewTripPage({
  gateway,
  context,
  canMutate,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly canMutate: boolean;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.loadTripSetupOptions(), [gateway]);
  const options = useResource(loader);
  const [createdTrip, setCreatedTrip] = useState<AdminCreatedTrip | null>(null);
  const preselectedClientId = new URLSearchParams(search).get("cliente");
  return (
    <>
      <PageHeader
        title="Nuevo viaje"
        description="Prepara el servicio, crea el borrador y continúa con la aprobación y programación."
      />
      {canMutate ? null : <ReadOnlyNotice />}
      <PageState resource={options} emptyCopy="No fue posible preparar los datos para este viaje.">
        {(data) => {
          const requirements = getTripSetupRequirements(data);
          const clientIsReady = requirements.find(
            (requirement) => requirement.id === "client",
          )?.ready;
          return (
            <>
              <TripSetupGuide requirements={requirements} />
              {createdTrip === null && canMutate && clientIsReady ? (
                <SimpleForm
                  title="Paso 2 · Datos del servicio"
                  submitLabel="Crear borrador de viaje"
                  onSubmit={async (form) => {
                    const cargoTons = canonicalCargoTons(form);
                    const pricing = freightPricingFromForm(form, cargoTons);
                    const trip = await gateway.createTrip(context, {
                      clientId: textValue(form, "clientId"),
                      origin: textValue(form, "origin"),
                      destination: textValue(form, "destination"),
                      scheduledAt: dateTimeValue(form, "scheduledAt"),
                      freightAmount: pricing.total,
                      cargoDescription: textValue(form, "cargoDescription"),
                      cargoTons,
                      freightPricingMode: pricing.mode,
                      freightRatePerTon: pricing.rate,
                    });
                    setCreatedTrip(trip);
                  }}
                >
                  <SelectField
                    defaultValue={
                      preselectedClientId !== null &&
                      data.clients.some((client) => client.id === preselectedClientId)
                        ? preselectedClientId
                        : undefined
                    }
                    label="Cliente"
                    name="clientId"
                    options={data.clients}
                    required
                  />
                  <Field label="Origen" name="origin" required />
                  <Field label="Destino" name="destination" required />
                  <Field label="Descripción de carga" name="cargoDescription" required />
                  <TripCaptureFields />
                  <Field
                    label="Fecha programada"
                    name="scheduledAt"
                    type="datetime-local"
                    required
                  />
                </SimpleForm>
              ) : createdTrip !== null ? (
                <TripDraftNextStep trip={createdTrip} />
              ) : canMutate ? (
                <section
                  className="admin-card admin-trip-setup__blocked"
                  aria-labelledby="trip-client-required"
                >
                  <p className="admin-section-kicker">Antes de crear el servicio</p>
                  <h2 id="trip-client-required">Registra o habilita un cliente</h2>
                  <p>
                    El cliente es obligatorio para crear el borrador. La unidad y el conductor se
                    asignarán después de aprobarlo.
                  </p>
                  <Link className="admin-header-action" to={routePaths.clients}>
                    Ir a clientes
                    <Icon name="chevron" size={16} />
                  </Link>
                </section>
              ) : null}
            </>
          );
        }}
      </PageState>
    </>
  );
}

type CargoCaptureUnit = "tons" | "kilograms";
type FreightPricingMode = "total" | "per_ton";

function TripCaptureFields(): React.JSX.Element {
  const [weightUnit, setWeightUnit] = useState<CargoCaptureUnit>("tons");
  const [weight, setWeight] = useState("");
  const [pricingMode, setPricingMode] = useState<FreightPricingMode>("total");
  const [total, setTotal] = useState("");
  const [rate, setRate] = useState("");
  const tons = captureWeightToTons(weight, weightUnit);
  const calculatedTotal =
    pricingMode === "per_ton" ? roundToMoney(tons * finiteNonNegativeNumber(rate)) : null;
  const weightLabel = weightUnit === "tons" ? "Toneladas" : "Kilogramos";
  return (
    <div className="admin-trip-capture admin-field--wide">
      <fieldset className="admin-capture-choice">
        <legend>Unidad de peso *</legend>
        <div className="admin-choice-buttons" role="group" aria-label="Unidad de peso">
          <Button
            aria-pressed={weightUnit === "tons"}
            onClick={() => setWeightUnit("tons")}
            type="button"
            variant={weightUnit === "tons" ? "primary" : "quiet"}
          >
            Toneladas
          </Button>
          <Button
            aria-pressed={weightUnit === "kilograms"}
            onClick={() => setWeightUnit("kilograms")}
            type="button"
            variant={weightUnit === "kilograms" ? "primary" : "quiet"}
          >
            Kilogramos
          </Button>
        </div>
        <label className="admin-field">
          <span>Peso de carga ({weightUnit === "tons" ? "t" : "kg"}) *</span>
          <input
            inputMode="decimal"
            min="0.001"
            name="cargoWeight"
            onChange={(event) => setWeight(event.target.value)}
            required
            step={weightUnit === "tons" ? "0.001" : "1"}
            type="number"
            value={weight}
          />
          <small className="admin-field__hint">
            Ejemplo: 22.5 t. Ingresa el peso real de la carga y confirma la unidad antes de guardar.
          </small>
        </label>
        <input name="cargoUnit" type="hidden" value={weightUnit} />
        <p className="admin-form-note" aria-live="polite">
          {tons > 0
            ? `${weightLabel}: ${formatCaptureNumber(weight)}. Se guardará como ${formatCaptureNumber(tons.toString())} t.`
            : "El peso se guardará siempre en toneladas para mantener una sola referencia operativa."}
        </p>
      </fieldset>
      <fieldset className="admin-capture-choice">
        <legend>Cómo cotizas el flete *</legend>
        <div className="admin-choice-buttons" role="group" aria-label="Modalidad de flete">
          <Button
            aria-pressed={pricingMode === "total"}
            onClick={() => setPricingMode("total")}
            type="button"
            variant={pricingMode === "total" ? "primary" : "quiet"}
          >
            Monto total
          </Button>
          <Button
            aria-pressed={pricingMode === "per_ton"}
            onClick={() => setPricingMode("per_ton")}
            type="button"
            variant={pricingMode === "per_ton" ? "primary" : "quiet"}
          >
            Tarifa por tonelada
          </Button>
        </div>
        <input name="freightPricingMode" type="hidden" value={pricingMode} />
        {pricingMode === "total" ? (
          <label className="admin-field">
            <span>Flete total (S/) *</span>
            <input
              inputMode="decimal"
              min="0"
              name="freightAmount"
              onChange={(event) => setTotal(event.target.value)}
              required
              step="0.01"
              type="number"
              value={total}
            />
            <small className="admin-field__hint">
              Ejemplo: 12 500.00. Usa el monto total realmente acordado para el servicio.
            </small>
          </label>
        ) : (
          <>
            <label className="admin-field">
              <span>Tarifa por tonelada (S/) *</span>
              <input
                inputMode="decimal"
                min="0.0001"
                name="freightRatePerTon"
                onChange={(event) => setRate(event.target.value)}
                required
                step="0.0001"
                type="number"
                value={rate}
              />
              <small className="admin-field__hint">
                Ejemplo: 85.00. Usa la tarifa por tonelada realmente acordada para este servicio.
              </small>
            </label>
            <output className="admin-capture-total" aria-live="polite">
              <span>Total calculado</span>
              <strong>S/ {formatDecimal(calculatedTotal ?? 0)}</strong>
              <small>
                {formatDecimal(tons)} t × S/ {formatDecimal(finiteNonNegativeNumber(rate), 4)}
              </small>
            </output>
          </>
        )}
      </fieldset>
    </div>
  );
}

function canonicalCargoTons(form: FormData): number {
  const rawWeight = positiveNumberValue(form, "cargoWeight");
  const unit = textValue(form, "cargoUnit");
  const tons = unit === "kilograms" ? rawWeight / 1000 : rawWeight;
  if (!Number.isFinite(tons) || tons <= 0) throw new Error("El peso de carga no es válido.");
  return Math.round((tons + Number.EPSILON) * 1000) / 1000;
}

function freightPricingFromForm(
  form: FormData,
  cargoTons: number,
): { readonly mode: FreightPricingMode; readonly rate: number | null; readonly total: number } {
  const rawMode = textValue(form, "freightPricingMode");
  if (rawMode === "total") {
    return { mode: "total", rate: null, total: roundToMoney(numberValue(form, "freightAmount")) };
  }
  if (rawMode === "per_ton") {
    const rate = positiveNumberValue(form, "freightRatePerTon");
    return { mode: "per_ton", rate: roundToRate(rate), total: roundToMoney(cargoTons * rate) };
  }
  throw new Error("La modalidad de flete no es válida.");
}

function captureWeightToTons(value: string, unit: CargoCaptureUnit): number {
  const parsed = finiteNonNegativeNumber(value);
  return unit === "kilograms" ? parsed / 1000 : parsed;
}

function finiteNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function roundToMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundToRate(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function formatDecimal(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(value);
}

function formatCaptureNumber(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("es-PE", { maximumFractionDigits: 3 }).format(numeric)
    : "0";
}

export interface TripSetupRequirement {
  readonly id: "client" | "vehicle" | "driver";
  readonly title: string;
  readonly copy: string;
  readonly href: string;
  readonly action: string;
  readonly ready: boolean;
}

export function getTripSetupRequirements(
  options: Pick<AdminTripSetupOptions, "clients" | "vehicles" | "drivers"> &
    Partial<Pick<AdminTripSetupOptions, "registeredDrivers" | "driversAwaitingAccess">>,
): readonly TripSetupRequirement[] {
  return [
    {
      id: "client",
      title: "Cliente",
      copy:
        options.clients.length > 0
          ? `${options.clients.length} cliente(s) disponible(s) para el borrador.`
          : "Necesitas un cliente activo para crear el servicio.",
      href: routePaths.clients,
      action: "Gestionar clientes",
      ready: options.clients.length > 0,
    },
    {
      id: "vehicle",
      title: "Unidad",
      copy:
        options.vehicles.length > 0
          ? `${options.vehicles.length} unidad(es) disponible(s) para programar.`
          : "No hay una unidad activa y disponible para programar este viaje.",
      href: routePaths.fleet,
      action: "Gestionar flota",
      ready: options.vehicles.length > 0,
    },
    {
      id: "driver",
      title: "Conductor",
      copy:
        options.drivers.length > 0
          ? `${options.drivers.length} conductor(es) disponible(s) con acceso vinculado.`
          : driverSetupCopy(options),
      href:
        options.driversAwaitingAccess && options.driversAwaitingAccess > 0
          ? routePaths.profileSettings
          : routePaths.drivers,
      action:
        options.driversAwaitingAccess && options.driversAwaitingAccess > 0
          ? "Vincular acceso"
          : "Gestionar conductores",
      ready: options.drivers.length > 0,
    },
  ];
}

function driverSetupCopy(
  options: Partial<Pick<AdminTripSetupOptions, "registeredDrivers" | "driversAwaitingAccess">>,
): string {
  if ((options.driversAwaitingAccess ?? 0) > 0)
    return `${options.driversAwaitingAccess} conductor(es) disponible(s) todavía no tienen un acceso de Conductor vinculado.`;
  if ((options.registeredDrivers ?? 0) > 0)
    return "No hay un conductor activo y disponible con acceso vinculado.";
  return "Registra un conductor y vincula su acceso antes de programar el viaje.";
}

function TripSetupGuide({
  requirements,
}: {
  readonly requirements: readonly TripSetupRequirement[];
}): React.JSX.Element {
  return (
    <section className="admin-card admin-trip-setup" aria-labelledby="trip-setup-title">
      <div className="admin-card__heading">
        <div>
          <p className="admin-section-kicker">Paso 1 · Preparación</p>
          <h2 id="trip-setup-title">Lo necesario para programar</h2>
        </div>
      </div>
      <p className="admin-muted">
        El cliente habilita el borrador. Después de aprobarlo, asigna una unidad y un conductor
        disponibles.
      </p>
      <ol className="admin-trip-setup__requirements">
        {requirements.map((requirement) => (
          <li key={requirement.id} data-ready={requirement.ready ? "true" : "false"}>
            <span className="admin-trip-setup__step" aria-hidden="true" />
            <div>
              <strong>{requirement.title}</strong>
              <small>{requirement.copy}</small>
            </div>
            <StatusChip
              label={requirement.ready ? "Listo" : "Pendiente"}
              tone={requirement.ready ? "success" : "warning"}
            />
            <Link className="admin-text-link" to={requirement.href}>
              {requirement.action}
              <Icon name="chevron" size={16} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TripDraftNextStep({ trip }: { readonly trip: AdminCreatedTrip }): React.JSX.Element {
  return (
    <section className="admin-trip-setup__success" aria-live="polite" role="status">
      <Icon name="route" size={19} />
      <div>
        <strong>{trip.code} se creó como borrador.</strong>
        <p>Ábrelo para aprobarlo y asignar la unidad y el conductor en el mismo flujo.</p>
      </div>
      <Link className="admin-text-link" to={manageTripPath(trip.id)}>
        Aprobar y programar
        <Icon name="chevron" size={16} />
      </Link>
    </section>
  );
}

type TripListView = "todos" | "pendientes" | "curso" | "finalizados";

function TripFilters({
  view,
  query,
  onChange,
}: {
  readonly view: TripListView;
  readonly query: string;
  readonly onChange: (view: TripListView, query: string) => void;
}): React.JSX.Element {
  const filters: readonly { readonly id: TripListView; readonly label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "pendientes", label: "Por atender" },
    { id: "curso", label: "En curso" },
    { id: "finalizados", label: "Finalizados" },
  ];
  return (
    <div className="admin-trip-filters" aria-label="Filtrar viajes">
      <label className="admin-trip-filters__search">
        <span className="sr-only">Buscar por código o ruta</span>
        <input
          value={query}
          onChange={(event) => onChange(view, event.target.value)}
          placeholder="Buscar código o ruta"
          type="search"
        />
      </label>
      <div className="admin-filter-chips" aria-label="Vista de viajes">
        {filters.map((filter) => (
          <button
            aria-pressed={view === filter.id}
            className={view === filter.id ? "is-active" : undefined}
            key={filter.id}
            onClick={() => onChange(filter.id, query)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TripList({
  rows,
  canMutate,
  onManage,
}: {
  readonly rows: readonly AdminTripRow[];
  readonly canMutate: boolean;
  readonly onManage: (trip: AdminTripRow) => void;
}): React.JSX.Element {
  return (
    <>
      <div className="admin-trip-list" aria-label="Viajes">
        {rows.map((trip) => {
          const action = tripPrimaryAction(trip);
          const canManage =
            action.kind === "manage" && canMutate && !trip.description.includes("Copia local");
          return (
            <article className="admin-trip-row" key={trip.id}>
              <div className="admin-trip-row__route">
                <strong>{trip.title}</strong>
                <small>
                  {[
                    trip.clientName,
                    trip.vehiclePlate === null ? null : `Unidad ${trip.vehiclePlate}`,
                    trip.driverName,
                  ]
                    .filter((value): value is string => value !== null)
                    .join(" · ") || "Sin recursos asignados todavía"}
                </small>
                <small>
                  {trip.date === null
                    ? "Sin fecha programada"
                    : `Programado: ${formatDate(trip.date)}`}
                  <span className="technical-value"> · {trip.code}</span>
                </small>
              </div>
              <StatusChip label={labelStatusForUi(trip.status)} tone={toneForStatus(trip.status)} />
              <div className="admin-trip-row__action">
                {canManage ? (
                  <Button onClick={() => onManage(trip)} variant="quiet">
                    {action.label}
                  </Button>
                ) : (
                  <Link className="admin-text-link" to={tripSummaryPath(trip.id)}>
                    {canMutate || action.kind !== "manage" ? action.label : "Ver resumen"}
                    <Icon name="chevron" size={16} />
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function TripsPage({
  gateway,
  canMutate,
  mode,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly mode: "trips" | "scheduling";
  readonly search: string;
}): React.JSX.Element {
  const tripsLoader = useCallback(() => gateway.listTrips(), [gateway]);
  const trips = useResource(tripsLoader);
  const optionsLoader = useCallback(() => gateway.loadTripSetupOptions(), [gateway]);
  const options = useResource(optionsLoader);
  const [selected, setSelected] = useState<AdminTripRow | null>(null);
  const [searchParams, setSearchParams] = useSearchParams(search);
  const managedTripId = managedTripIdFromSearch(searchParams.toString());
  const [resolvedManagedTripId, setResolvedManagedTripId] = useState<string | null>(null);

  useEffect(() => {
    if (managedTripId === null) setResolvedManagedTripId(null);
  }, [managedTripId]);

  useEffect(() => {
    if (managedTripId === null || managedTripId === resolvedManagedTripId || trips.data === null)
      return;
    setResolvedManagedTripId(managedTripId);
    setSelected(trips.data.find((trip) => trip.id === managedTripId) ?? null);
  }, [managedTripId, resolvedManagedTripId, trips.data]);

  const title = mode === "scheduling" ? "Programación" : "Viajes";
  const description =
    mode === "scheduling"
      ? "Asigna recursos solo a viajes aprobados; la operación continúa en la PWA del conductor."
      : "Crea, aprueba y programa servicios antes de entregarlos a la operación del conductor.";
  const view = tripViewFromSearch(searchParams.toString());
  const query = searchParams.get("q") ?? "";
  const updateFilters = (nextView: TripListView, nextQuery: string): void => {
    const next = new URLSearchParams(searchParams);
    next.set("vista", nextView);
    if (nextQuery.trim() === "") next.delete("q");
    else next.set("q", nextQuery);
    setSearchParams(next, { replace: true });
  };
  return (
    <>
      <PageHeader
        action={
          mode === "trips" && canMutate ? (
            <Link className="admin-header-action" to={routePaths.newTrip}>
              <Icon name="plus" size={18} />
              Nuevo viaje
            </Link>
          ) : undefined
        }
        description={description}
        title={title}
        variant={mode === "trips" ? "trips" : undefined}
      />
      {canMutate ? null : <ReadOnlyNotice />}
      <PageState resource={trips} emptyCopy="No existen viajes visibles para tu empresa.">
        {(rows) => {
          const scheduledRows = rows.filter((trip) =>
            mode === "scheduling"
              ? trip.operationalStatus === "approved" || trip.operationalStatus === "scheduled"
              : true,
          );
          const visibleRows =
            mode === "trips" ? filterAndSortTrips(scheduledRows, view, query) : scheduledRows;
          return (
            <>
              {mode === "trips" ? (
                <TripFilters
                  query={query}
                  view={view}
                  onChange={(nextView, nextQuery) => updateFilters(nextView, nextQuery)}
                />
              ) : null}
              {visibleRows.length === 0 ? (
                <AdminNotice
                  title={
                    mode === "scheduling"
                      ? "No hay viajes por programar"
                      : "No hay viajes en esta vista"
                  }
                  copy={
                    mode === "scheduling"
                      ? "Cuando apruebes un borrador, aparecerá aquí para asignarle unidad y conductor."
                      : "Cambia el filtro o la búsqueda para revisar otros servicios."
                  }
                />
              ) : (
                <TripList
                  rows={visibleRows}
                  canMutate={canMutate}
                  onManage={(trip) => setSelected(trip)}
                />
              )}
            </>
          );
        }}
      </PageState>
      {selected === null ? null : (
        <AdminActionDialog
          title={`Gestionar ${selected.title}`}
          copy="Completa la preparación administrativa; la ejecución operativa corresponde al conductor asignado."
          onClose={() => setSelected(null)}
        >
          <TripActionPanel
            gateway={gateway}
            options={options.data}
            trip={selected}
            onChanged={() => {
              trips.reload();
              options.reload();
            }}
          />
        </AdminActionDialog>
      )}
    </>
  );
}

function TripActionPanel({
  gateway,
  trip,
  options,
  onChanged,
}: {
  readonly gateway: AdminDataGateway;
  readonly trip: AdminTripRow;
  readonly options: AdminTripSetupOptions | null;
  readonly onChanged: () => void;
}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentTrip, setCurrentTrip] = useState(trip);
  useEffect(() => setCurrentTrip(trip), [trip]);

  function moveTo(next: Pick<AdminTripRow, "operationalStatus" | "status">): void {
    setCurrentTrip((previous) => ({ ...previous, ...next, version: previous.version + 1 }));
    onChanged();
  }

  async function run(
    operation: () => Promise<void>,
    next: Pick<AdminTripRow, "operationalStatus" | "status">,
  ): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await operation();
      moveTo(next);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card admin-action-panel" aria-labelledby="trip-action-title">
      <div>
        <h2 id="trip-action-title">Gestionar {currentTrip.title}</h2>
        <p>
          {currentTrip.description} · versión {currentTrip.version}
        </p>
      </div>
      <StatusChip label={currentTrip.status} tone={toneForStatus(currentTrip.status)} />
      <Feedback message={null} error={error} />
      {currentTrip.operationalStatus === "draft" ? (
        <Button
          disabled={busy}
          onClick={() =>
            void run(() => gateway.approveTrip({ tripId: currentTrip.id }), {
              operationalStatus: "approved",
              status: "Aprobado",
            })
          }
        >
          Aprobar viaje
        </Button>
      ) : null}
      {currentTrip.operationalStatus === "approved" ? (
        options === null ? (
          <p className="admin-muted">Preparando la disponibilidad de unidad y conductor…</p>
        ) : canScheduleTrip(options) ? (
          <SimpleForm
            compact
            title="Asignar recursos"
            submitLabel="Programar viaje"
            onSubmit={async (form) => {
              try {
                await gateway.scheduleTrip({
                  tripId: currentTrip.id,
                  vehicleId: textValue(form, "vehicleId"),
                  driverId: textValue(form, "driverId"),
                });
              } catch (caught) {
                throw new Error(scheduleTripErrorMessage(caught));
              }
            }}
            onSaved={() => moveTo({ operationalStatus: "scheduled", status: "Programado" })}
          >
            <SelectField
              label="Unidad disponible"
              name="vehicleId"
              options={options.vehicles}
              required
            />
            <SelectField
              label="Conductor con acceso vinculado"
              name="driverId"
              options={options.drivers}
              required
            />
            <p className="admin-form-note">
              Antes de confirmar, el servidor vuelve a validar documentos, mantenimiento,
              disponibilidad y cruces de programación.
            </p>
          </SimpleForm>
        ) : (
          <TripSchedulingBlocked requirements={getTripSetupRequirements(options)} />
        )
      ) : null}
      {currentTrip.operationalStatus === "scheduled" ? (
        <TripScheduledHandoff trip={currentTrip} />
      ) : null}
      {["loading", "in_transit", "unloading"].includes(currentTrip.operationalStatus) ? (
        <TripDriverOwnedNotice trip={currentTrip} />
      ) : null}
      {!["draft", "approved", "scheduled", "loading", "in_transit", "unloading"].includes(
        currentTrip.operationalStatus,
      ) ? (
        <p className="admin-muted">
          Este estado no tiene una acción administrativa disponible en esta vista.
        </p>
      ) : null}
    </section>
  );
}

function canScheduleTrip(options: AdminTripSetupOptions): boolean {
  return options.vehicles.length > 0 && options.drivers.length > 0;
}

function TripSchedulingBlocked({
  requirements,
}: {
  readonly requirements: readonly TripSetupRequirement[];
}): React.JSX.Element {
  const missing = requirements.filter(
    (requirement) => requirement.id !== "client" && !requirement.ready,
  );
  return (
    <section
      className="admin-card admin-trip-setup__blocked"
      aria-labelledby="trip-scheduling-required"
    >
      <p className="admin-section-kicker">Antes de programar</p>
      <h3 id="trip-scheduling-required">Falta preparar recursos operativos</h3>
      <ul className="admin-trip-setup__missing">
        {missing.map((requirement) => (
          <li key={requirement.id}>
            <span>{requirement.copy}</span>
            <Link className="admin-text-link" to={requirement.href}>
              {requirement.action}
              <Icon name="chevron" size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TripScheduledHandoff({ trip }: { readonly trip: AdminTripRow }): React.JSX.Element {
  return (
    <section className="admin-trip-setup__success" aria-live="polite" role="status">
      <Icon name="route" size={19} />
      <div>
        <strong>Viaje programado.</strong>
        <p>
          El conductor asignado debe verlo en Mi viaje y registrar la operación desde su PWA,
          incluso cuando esté sin conexión.
        </p>
      </div>
      <Link className="admin-text-link" to={tripSummaryPath(trip.id)}>
        Ver expediente
        <Icon name="chevron" size={16} />
      </Link>
    </section>
  );
}

function TripDriverOwnedNotice({ trip }: { readonly trip: AdminTripRow }): React.JSX.Element {
  return (
    <section className="admin-card admin-trip-setup__blocked" aria-labelledby="trip-driver-owned">
      <p className="admin-section-kicker">Operación del conductor</p>
      <h3 id="trip-driver-owned">La etapa actual se registra desde Mi viaje</h3>
      <p>
        El conductor asignado registra inicio, llegada, entrega, kilometraje, gastos y evidencias.
        Administración puede consultar el expediente sin duplicar esas acciones.
      </p>
      <Link className="admin-text-link" to={tripSummaryPath(trip.id)}>
        Consultar expediente
        <Icon name="chevron" size={16} />
      </Link>
    </section>
  );
}

const operationalCycleStatusOptions: readonly {
  readonly value: OperationalCycleStatus;
  readonly label: string;
}[] = [
  { value: "planned", label: "Planificado" },
  { value: "active", label: "Activo" },
  { value: "completed", label: "Finalizado" },
  { value: "cancelled", label: "Cancelado" },
];

const operationalCycleReturnStatusOptions: readonly {
  readonly value: OperationalCycleReturnStatus;
  readonly label: string;
}[] = [
  { value: "unidentified", label: "Sin retorno identificado" },
  { value: "probable", label: "Retorno probable" },
  { value: "confirmed", label: "Retorno confirmado" },
  { value: "completed", label: "Retorno completado" },
  { value: "empty_return", label: "Retorno vacío" },
];

const operationalCycleLegKindOptions: readonly {
  readonly value: OperationalCycleLegKind;
  readonly label: string;
}[] = [
  { value: "outbound", label: "Ida" },
  { value: "return", label: "Retorno" },
  { value: "continuation", label: "Continuación" },
];

interface OperationalCycleCommandIdentity {
  readonly id: string;
  readonly idempotencyKey: string;
}

function makeOperationalCycleCommandIdentity(): OperationalCycleCommandIdentity {
  return { id: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() };
}

function OperationalCyclesPage({
  gateway,
  canMutate,
}: {
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
}): React.JSX.Element {
  const cyclesLoader = useCallback(() => gateway.listOperationalCycles(), [gateway]);
  const cycles = useResource(cyclesLoader);
  const optionsLoader = useCallback(() => gateway.loadOperationalCycleOptions(), [gateway]);
  const options = useResource(optionsLoader);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [commandIdentity, setCommandIdentity] = useState(makeOperationalCycleCommandIdentity);
  const renewCommandIdentity = useCallback(
    () => setCommandIdentity(makeOperationalCycleCommandIdentity()),
    [],
  );

  const createForm = !canMutate ? (
    <ReadOnlyNotice />
  ) : options.status === "LOADING" ? (
    <p className="admin-muted">Preparando unidades y conductores activos para el ciclo…</p>
  ) : options.status === "ERROR" || options.data === null ? (
    <AdminNotice
      title="No se pudo preparar el ciclo"
      copy={options.error ?? "No se encontraron los recursos necesarios para crear un ciclo."}
      tone="error"
    />
  ) : options.data.vehicles.length === 0 ? (
    <AdminNotice
      title="Falta una unidad activa"
      copy="Registra o activa una unidad antes de crear un ciclo operativo."
    />
  ) : (
    <AdminFormDisclosure
      label="Crear ciclo operativo"
      copy="Agrupa viajes relacionados por continuidad; cada viaje conserva su propio dinero y cierre."
    >
      <SimpleForm
        onDirty={renewCommandIdentity}
        onSaved={() => {
          renewCommandIdentity();
          cycles.reload();
        }}
        submitLabel="Crear ciclo"
        title="Nuevo ciclo operativo"
        onSubmit={async (form) => {
          try {
            await gateway.createOperationalCycle({
              id: commandIdentity.id,
              code: textValue(form, "code"),
              vehicleId: textValue(form, "vehicleId"),
              primaryDriverId: optionalText(form, "primaryDriverId"),
              returnStatus: operationalCycleReturnStatusValue(form, "returnStatus"),
              notes: optionalText(form, "notes"),
              idempotencyKey: commandIdentity.idempotencyKey,
            });
          } catch (error) {
            throw new Error(operationalCycleErrorMessage(error));
          }
        }}
      >
        <Field label="Código del ciclo" name="code" required />
        <SelectField label="Unidad" name="vehicleId" options={options.data.vehicles} required />
        <SelectField
          label="Conductor principal (opcional)"
          name="primaryDriverId"
          options={options.data.drivers}
        />
        <OperationalCycleSelectField
          label="Situación del retorno"
          name="returnStatus"
          options={operationalCycleReturnStatusOptions}
        />
        <TextareaField label="Notas operativas (opcional)" name="notes" />
        <p className="admin-form-note">
          Un ciclo ordena continuidad, ida o retorno. No mueve flete, adelantos, gastos ni
          rendiciones entre viajes.
        </p>
      </SimpleForm>
    </AdminFormDisclosure>
  );

  return (
    <>
      <PageHeader
        title="Ciclos operativos"
        description="Relaciona tramos de una misma unidad sin convertir varios servicios en un solo cierre financiero."
      />
      {createForm}
      <section className="admin-card admin-list-card">
        <div className="admin-card__heading">
          <h2>Ciclos registrados</h2>
          {cycles.status === "READY" ? <span>{cycles.data?.length ?? 0}</span> : null}
        </div>
        <PageState
          resource={cycles}
          emptyCopy="Aún no hay ciclos. Crea uno cuando necesites controlar ida, retorno o continuidad."
        >
          {(rows) => (
            <RecordTable
              rows={rows}
              kind="cycles"
              actions={(row) => (
                <Button variant="quiet" onClick={() => setSelectedCycleId(row.id)}>
                  Ver ciclo
                </Button>
              )}
            />
          )}
        </PageState>
      </section>
      {selectedCycleId === null ? null : (
        <OperationalCycleDetailPanel
          canMutate={canMutate}
          cycleId={selectedCycleId}
          gateway={gateway}
          onChanged={cycles.reload}
          onClose={() => setSelectedCycleId(null)}
        />
      )}
    </>
  );
}

type OperationalCycleDialog =
  | { readonly kind: "update" }
  | { readonly kind: "add" }
  | { readonly kind: "remove"; readonly tripId: string; readonly tripTitle: string };

function OperationalCycleDetailPanel({
  cycleId,
  gateway,
  canMutate,
  onChanged,
  onClose,
}: {
  readonly cycleId: string;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly onChanged: () => void;
  readonly onClose: () => void;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.loadOperationalCycleDetail(cycleId), [cycleId, gateway]);
  const resource = useResource(loader);
  const [dialog, setDialog] = useState<OperationalCycleDialog | null>(null);

  function reload(): void {
    resource.reload();
    onChanged();
  }

  return (
    <section
      className="admin-card admin-list-card"
      aria-labelledby="operational-cycle-detail-title"
    >
      <div className="admin-card__heading">
        <h2 id="operational-cycle-detail-title">Detalle del ciclo</h2>
        <Button variant="quiet" onClick={onClose}>
          Cerrar detalle
        </Button>
      </div>
      <PageState resource={resource} emptyCopy="El ciclo ya no está disponible.">
        {(detail) => (
          <OperationalCycleDetailContent
            canMutate={canMutate}
            detail={detail}
            dialog={dialog}
            gateway={gateway}
            onCloseDialog={() => setDialog(null)}
            onOpenDialog={setDialog}
            onSaved={reload}
          />
        )}
      </PageState>
    </section>
  );
}

function OperationalCycleDetailContent({
  detail,
  gateway,
  canMutate,
  dialog,
  onOpenDialog,
  onCloseDialog,
  onSaved,
}: {
  readonly detail: AdminOperationalCycleDetail;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly dialog: OperationalCycleDialog | null;
  readonly onOpenDialog: (dialog: OperationalCycleDialog) => void;
  readonly onCloseDialog: () => void;
  readonly onSaved: () => void;
}): React.JSX.Element {
  const acceptsTrips = detail.cycle.status === "planned" || detail.cycle.status === "active";
  const canUpdate = canMutate && acceptsTrips;
  const canAddTrip = canMutate && acceptsTrips && detail.eligibleTrips.length > 0;
  return (
    <>
      <section className="admin-card admin-detail-card admin-list-card">
        <div className="admin-card__heading">
          <div>
            <p className="admin-section-kicker">Continuidad operativa</p>
            <h2>{detail.cycle.title}</h2>
          </div>
          <StatusChip
            label={labelStatusForUi(detail.cycle.status)}
            tone={toneForStatus(detail.cycle.status)}
          />
        </div>
        <dl>
          <DetailTerm label="Unidad" value={detail.vehicleLabel} />
          <DetailTerm
            label="Conductor principal"
            value={detail.primaryDriverLabel ?? "Sin asignar"}
          />
          <DetailTerm
            label="Situación del retorno"
            value={operationalCycleReturnStatusLabel(detail.cycle.returnStatus)}
          />
          <DetailTerm label="Versión" value={String(detail.cycle.version)} />
          <DetailTerm label="Notas" value={detail.cycle.notes ?? "Sin notas"} />
        </dl>
        <p className="admin-form-note">
          Este ciclo solo ordena los viajes relacionados. Los importes, adelantos, gastos,
          rendiciones y cierres siguen siendo independientes por viaje.
        </p>
        {canUpdate ? (
          <div className="admin-row-buttons">
            <Button variant="quiet" onClick={() => onOpenDialog({ kind: "update" })}>
              Actualizar ciclo
            </Button>
            {canAddTrip ? (
              <Button variant="quiet" onClick={() => onOpenDialog({ kind: "add" })}>
                Añadir viaje
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="admin-card admin-list-card">
        <div className="admin-card__heading">
          <h2>Viajes del ciclo</h2>
          <span>{detail.trips.length}</span>
        </div>
        {detail.trips.length === 0 ? (
          <p className="admin-muted">
            Aún no hay viajes asociados. Solo se pueden añadir viajes de la misma unidad que aún no
            pertenecen a otro ciclo.
          </p>
        ) : (
          <RecordTable
            rows={detail.trips}
            kind="cycleTrips"
            actions={
              canMutate && acceptsTrips
                ? (row) => (
                    <Button
                      variant="quiet"
                      onClick={() =>
                        onOpenDialog({ kind: "remove", tripId: row.id, tripTitle: row.title })
                      }
                    >
                      Quitar
                    </Button>
                  )
                : undefined
            }
          />
        )}
      </section>

      {dialog === null ? null : (
        <OperationalCycleDialogForm
          detail={detail}
          dialog={dialog}
          gateway={gateway}
          onClose={onCloseDialog}
          onSaved={() => {
            onCloseDialog();
            onSaved();
          }}
        />
      )}
    </>
  );
}

function OperationalCycleDialogForm({
  detail,
  dialog,
  gateway,
  onClose,
  onSaved,
}: {
  readonly detail: AdminOperationalCycleDetail;
  readonly dialog: OperationalCycleDialog;
  readonly gateway: AdminDataGateway;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}): React.JSX.Element {
  if (dialog.kind === "update") {
    return (
      <AdminActionDialog
        title={`Actualizar ${detail.cycle.title}`}
        copy="El servidor comprobará la versión antes de guardar este cambio."
        onClose={onClose}
      >
        <SimpleForm
          compact
          submitLabel="Guardar cambios"
          title="Actualizar ciclo"
          onSaved={onSaved}
          onSubmit={async (form) => {
            try {
              await gateway.updateOperationalCycle({
                cycleId: detail.cycle.id,
                expectedVersion: detail.cycle.version,
                status: operationalCycleStatusValue(form, "status"),
                returnStatus: operationalCycleReturnStatusValue(form, "returnStatus"),
                notes: optionalText(form, "notes"),
              });
            } catch (error) {
              throw new Error(operationalCycleErrorMessage(error));
            }
          }}
        >
          <OperationalCycleSelectField
            defaultValue={detail.cycle.status}
            label="Estado del ciclo"
            name="status"
            options={operationalCycleStatusOptionsFor(detail.cycle.status)}
          />
          <OperationalCycleSelectField
            defaultValue={detail.cycle.returnStatus}
            label="Situación del retorno"
            name="returnStatus"
            options={operationalCycleReturnStatusOptions}
          />
          <TextareaField
            defaultValue={detail.cycle.notes ?? ""}
            label="Notas operativas"
            name="notes"
          />
          <p className="admin-form-note">
            Al finalizar, todos los viajes asociados deben estar finalizados o cancelados. El cambio
            no modifica ningún dinero del viaje.
          </p>
        </SimpleForm>
      </AdminActionDialog>
    );
  }

  if (dialog.kind === "add") {
    return (
      <AdminActionDialog
        title={`Añadir viaje a ${detail.cycle.title}`}
        copy="Solo se muestran viajes de la misma unidad que aún no pertenecen a otro ciclo."
        onClose={onClose}
      >
        <SimpleForm
          compact
          submitLabel="Añadir viaje"
          title="Añadir viaje"
          onSaved={onSaved}
          onSubmit={async (form) => {
            try {
              await gateway.addTripToOperationalCycle({
                cycleId: detail.cycle.id,
                tripId: textValue(form, "tripId"),
                legKind: operationalCycleLegKindValue(form, "legKind"),
                expectedCycleVersion: detail.cycle.version,
              });
            } catch (error) {
              throw new Error(operationalCycleErrorMessage(error));
            }
          }}
        >
          <SelectField
            label="Viaje compatible"
            name="tripId"
            options={detail.eligibleTrips}
            required
          />
          <OperationalCycleSelectField
            label="Tipo de tramo"
            name="legKind"
            options={operationalCycleLegKindOptions}
          />
          <p className="admin-form-note">
            La asociación conserva el servicio y el cierre financiero propio de cada viaje.
          </p>
        </SimpleForm>
      </AdminActionDialog>
    );
  }

  return (
    <AdminActionDialog
      title={`Quitar ${dialog.tripTitle}`}
      copy="La eliminación de la relación queda auditada; el viaje no se elimina ni se modifica financieramente."
      onClose={onClose}
    >
      <SimpleForm
        compact
        submitLabel="Quitar del ciclo"
        title="Quitar viaje"
        onSaved={onSaved}
        onSubmit={async (form) => {
          try {
            await gateway.removeTripFromOperationalCycle({
              cycleId: detail.cycle.id,
              tripId: dialog.tripId,
              expectedCycleVersion: detail.cycle.version,
              reason: textValue(form, "reason"),
            });
          } catch (error) {
            throw new Error(operationalCycleErrorMessage(error));
          }
        }}
      >
        <TextareaField label="Motivo de retiro" name="reason" required />
      </SimpleForm>
    </AdminActionDialog>
  );
}

function OperationalCycleSelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  readonly label: string;
  readonly name: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly defaultValue?: string | undefined;
}): React.JSX.Element {
  const guidance = formFieldGuidance({ kind: "select", label, name });
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select defaultValue={defaultValue} name={name}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <small className="admin-field__hint">{guidance.hint}</small>
    </label>
  );
}

function ExpensesPage({
  context,
  gateway,
  canMutate,
  online,
  search,
}: {
  readonly context: AdminWriteContext;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly online: boolean;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listExpenses(), [gateway]);
  const resource = useResource(loader);
  const captureOptions = useStaffCaptureOptions(gateway, canMutate && online);
  const tripId = new URLSearchParams(search).get("viaje");
  const [review, setReview] = useState<{
    readonly row: AdminListRow;
    readonly status: "validated" | "observed" | "rejected";
  } | null>(null);
  return (
    <>
      <PageHeader title="Gastos" description={pageCopy.expenses?.description ?? ""} />
      {canMutate && online ? (
        <AdminFormDisclosure
          label="Registrar gasto administrativo"
          copy="Registra un gasto real en representación del viaje; requiere conexión y deja auditoría."
        >
          <StaffCaptureGuidance kind="expense" />
          <StaffCaptureFormState
            context={context}
            gateway={gateway}
            kind="expense"
            options={captureOptions}
            onSaved={resource.reload}
            defaultSupplierId={null}
            defaultTripId={tripId}
          />
        </AdminFormDisclosure>
      ) : (
        <ReadOnlyNotice copy={staffCaptureReadOnlyCopy(online)} />
      )}
      <PageState resource={resource} emptyCopy="No existen gastos para revisar.">
        {(rows) => (
          <RecordTable
            rows={rows}
            kind="finance"
            actions={
              canMutate || rows.some((row) => row.fileId !== undefined)
                ? (row) => {
                    const evidence =
                      row.fileId === undefined ? null : (
                        <PrivateEvidenceAction
                          fileId={row.fileId}
                          gateway={gateway}
                          label="Ver comprobante"
                          online={online}
                        />
                      );
                    const reviewActions =
                      !canMutate || row.status === "Solo lectura local" ? null : (
                        <>
                          <Button
                            variant="quiet"
                            onClick={() => setReview({ row, status: "validated" })}
                          >
                            Validar
                          </Button>
                          <Button
                            variant="quiet"
                            onClick={() => setReview({ row, status: "observed" })}
                          >
                            Observar
                          </Button>
                          <Button
                            variant="quiet"
                            onClick={() => setReview({ row, status: "rejected" })}
                          >
                            Rechazar
                          </Button>
                        </>
                      );
                    return evidence === null && reviewActions === null ? null : (
                      <div className="admin-row-buttons">
                        {evidence}
                        {reviewActions}
                      </div>
                    );
                  }
                : undefined
            }
          />
        )}
      </PageState>
      {review === null ? null : (
        <AdminActionDialog
          title={expenseReviewLabel(review.status)}
          copy={`${review.row.title} · ${formatMoney(review.row.amount ?? 0)}`}
          onClose={() => setReview(null)}
        >
          <SimpleForm
            compact
            title={`${expenseReviewLabel(review.status)}: ${review.row.title}`}
            submitLabel="Guardar revisión"
            onSubmit={async (form) =>
              gateway.reviewExpense({
                expenseId: review.row.id,
                validationStatus: review.status,
                approvedAmount:
                  review.status === "validated" ? numberValue(form, "approvedAmount") : null,
                note:
                  review.status === "validated"
                    ? optionalText(form, "note")
                    : textValue(form, "note"),
              })
            }
            onSaved={() => {
              setReview(null);
              resource.reload();
            }}
          >
            {review.status === "validated" ? (
              <Field
                label="Monto aprobado (S/)"
                name="approvedAmount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={String(review.row.amount ?? 0)}
                required
              />
            ) : null}
            <Field
              label={review.status === "validated" ? "Nota (opcional)" : "Motivo"}
              name="note"
              required={review.status !== "validated"}
            />
          </SimpleForm>
        </AdminActionDialog>
      )}
    </>
  );
}

function FuelEntriesPage({
  context,
  gateway,
  canMutate,
  online,
  search,
}: {
  readonly context: AdminWriteContext;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly online: boolean;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listFuelEntries(), [gateway]);
  const resource = useResource(loader);
  const captureOptions = useStaffCaptureOptions(gateway, canMutate && online);
  const supplierId = new URLSearchParams(search).get("proveedor");
  const tripId = new URLSearchParams(search).get("viaje");
  return (
    <ResourceCrudPage
      title="Combustible"
      description={pageCopy.fuelEntries?.description ?? ""}
      resource={resource}
      emptyCopy="No existen abastecimientos registrados."
      form={
        canMutate && online ? (
          <AdminFormDisclosure
            label="Registrar abastecimiento administrativo"
            copy="Registra un abastecimiento real en representación del viaje; requiere conexión y deja auditoría."
          >
            <StaffCaptureGuidance kind="fuel" />
            <StaffCaptureFormState
              context={context}
              gateway={gateway}
              kind="fuel"
              options={captureOptions}
              onSaved={resource.reload}
              defaultSupplierId={supplierId}
              defaultTripId={tripId}
            />
          </AdminFormDisclosure>
        ) : (
          <ReadOnlyNotice copy={staffCaptureReadOnlyCopy(online)} />
        )
      }
      listLabel="Abastecimientos registrados"
      tableKind="fuel"
      actions={
        resource.data?.some((row) => row.fileId !== undefined) === true
          ? (row) =>
              row.fileId === undefined ? null : (
                <PrivateEvidenceAction
                  fileId={row.fileId}
                  gateway={gateway}
                  label="Ver comprobante"
                  online={online}
                />
              )
          : undefined
      }
    />
  );
}

type StaffCaptureKind = "expense" | "fuel";

interface StaffCaptureIdentity {
  readonly recordId: string;
  readonly idempotencyKey: string;
}

const receiptTypeOptions: readonly AdminOption[] = [
  { id: "Factura", label: "Factura", status: "Comprobante" },
  { id: "Boleta", label: "Boleta", status: "Comprobante" },
  { id: "Voucher", label: "Voucher", status: "Comprobante" },
  { id: "Otro", label: "Otro", status: "Comprobante" },
];

const paymentMethodOptions: readonly AdminOption[] = [
  { id: "Transferencia", label: "Transferencia", status: "Pago" },
  { id: "Depósito", label: "Depósito", status: "Pago" },
  { id: "Efectivo", label: "Efectivo", status: "Pago" },
  { id: "Otro", label: "Otro", status: "Pago" },
];

const fuelVolumeUnitOptions: readonly AdminOption[] = [
  { id: "gallon", label: "Galones", status: "Volumen" },
  { id: "liter", label: "Litros", status: "Volumen" },
];

function useStaffCaptureOptions(
  gateway: AdminDataGateway,
  enabled: boolean,
): ResourceState<AdminStaffCaptureOptions | null> & { readonly reload: () => void } {
  const loader = useCallback(
    () => (enabled ? gateway.loadStaffCaptureOptions() : Promise.resolve(null)),
    [enabled, gateway],
  );
  return useResource(loader);
}

function StaffCaptureGuidance({ kind }: { readonly kind: StaffCaptureKind }): React.JSX.Element {
  const label = kind === "expense" ? "gasto" : "abastecimiento";
  return (
    <section className="admin-capture-guidance" role="note">
      <Icon name={kind === "expense" ? "money" : "fuel"} size={20} />
      <div>
        <strong>Registro administrativo en representación</strong>
        <p>
          Conserva la fecha real del {label}. El servidor registra por separado quién lo regularizó
          desde Administración y exige una razón para la auditoría.
        </p>
      </div>
    </section>
  );
}

function StaffCaptureFormState({
  kind,
  context,
  gateway,
  options,
  onSaved,
  defaultSupplierId,
  defaultTripId,
}: {
  readonly kind: StaffCaptureKind;
  readonly context: AdminWriteContext;
  readonly gateway: AdminDataGateway;
  readonly options: ResourceState<AdminStaffCaptureOptions | null>;
  readonly onSaved: () => void;
  readonly defaultSupplierId: string | null;
  readonly defaultTripId: string | null;
}): React.JSX.Element | null {
  if (options.status === "LOADING")
    return (
      <p className="admin-capture-state" role="status">
        <Icon name="wifi" size={18} /> Preparando los viajes y maestros autorizados…
      </p>
    );
  if (options.status === "ERROR")
    return (
      <p className="admin-capture-state admin-capture-state--error" role="alert">
        <Icon name="alert" size={18} /> No se pudo preparar el registro: {options.error}
      </p>
    );
  if (options.data === null) return null;

  const missing = [
    options.data.trips.length === 0
      ? "un viaje programado, en operación o completado visible para tu empresa"
      : null,
    kind === "expense" && options.data.expenseCategories.length === 0
      ? "una categoría de gasto activa"
      : null,
  ].filter((value): value is string => value !== null);
  if (missing.length > 0)
    return (
      <section className="admin-capture-blocked" aria-labelledby={`staff-${kind}-blocked`}>
        <Icon name="alert" size={20} />
        <div>
          <h2 id={`staff-${kind}-blocked`}>Falta preparar el registro</h2>
          <p>
            Para continuar se necesita {missing.join(" y ")}. El servidor volverá a validar el
            viaje, sus asignaciones y el estado de la rendición al guardar.
          </p>
        </div>
      </section>
    );

  return kind === "expense" ? (
    <StaffExpenseForm
      context={context}
      gateway={gateway}
      options={options.data}
      onSaved={onSaved}
      defaultTripId={defaultTripId}
    />
  ) : (
    <StaffFuelForm
      context={context}
      defaultSupplierId={defaultSupplierId}
      defaultTripId={defaultTripId}
      gateway={gateway}
      options={options.data}
      onSaved={onSaved}
    />
  );
}

function StaffExpenseForm({
  context,
  gateway,
  options,
  onSaved,
  defaultTripId,
}: {
  readonly context: AdminWriteContext;
  readonly gateway: AdminDataGateway;
  readonly options: AdminStaffCaptureOptions;
  readonly onSaved: () => void;
  readonly defaultTripId: string | null;
}): React.JSX.Element {
  const [identity, setIdentity] = useState<StaffCaptureIdentity>(makeStaffCaptureIdentity);
  const renewIdentity = useCallback(() => setIdentity(makeStaffCaptureIdentity()), []);
  return (
    <SimpleForm
      onDirty={renewIdentity}
      onSaved={() => {
        renewIdentity();
        onSaved();
      }}
      onSubmit={async (form) => {
        try {
          await gateway.recordStaffExpense(context, {
            recordId: identity.recordId,
            tripId: textValue(form, "tripId"),
            categoryId: textValue(form, "categoryId"),
            supplierId: optionalText(form, "supplierId"),
            incurredAt: dateTimeValue(form, "incurredAt"),
            amount: positiveNumberValue(form, "amount"),
            currency: "PEN",
            receiptType: optionalText(form, "receiptType"),
            receiptNumber: optionalText(form, "receiptNumber"),
            description: optionalText(form, "description"),
            reason: textValue(form, "reason"),
            idempotencyKey: identity.idempotencyKey,
            receiptFile: fileValue(form, "receiptFile"),
          });
        } catch (error) {
          throw new Error(staffCaptureErrorMessage(error));
        }
      }}
      submitLabel="Confirmar gasto administrativo"
      successMessage="Gasto administrativo confirmado por el servidor."
      title="Datos del gasto"
    >
      <SelectField
        defaultValue={optionDefaultValue(options.trips, defaultTripId)}
        label="Viaje"
        name="tripId"
        options={options.trips}
        required
      />
      <SelectField
        label="Categoría de gasto"
        name="categoryId"
        options={options.expenseCategories}
        required
      />
      <SelectField label="Proveedor (opcional)" name="supplierId" options={options.suppliers} />
      <Field
        defaultValue={localDateTimeInputValue()}
        label="Fecha y hora reales"
        name="incurredAt"
        type="datetime-local"
        required
      />
      <Field label="Monto (S/)" min="0.01" name="amount" step="0.01" type="number" required />
      <TextareaField label="Detalle (opcional)" name="description" rows={2} />
      <StaffReceiptFields />
      <TextareaField
        label="Motivo de registro en representación o regularización"
        name="reason"
        required
        rows={3}
      />
      <p className="admin-form-note">
        Los montos se registran en soles (PEN). Si la rendición ya se cerró, primero debe reabrirse
        con su motivo auditado.
      </p>
    </SimpleForm>
  );
}

function StaffFuelForm({
  context,
  defaultSupplierId,
  defaultTripId,
  gateway,
  options,
  onSaved,
}: {
  readonly context: AdminWriteContext;
  readonly defaultSupplierId: string | null;
  readonly defaultTripId: string | null;
  readonly gateway: AdminDataGateway;
  readonly options: AdminStaffCaptureOptions;
  readonly onSaved: () => void;
}): React.JSX.Element {
  const [identity, setIdentity] = useState<StaffCaptureIdentity>(makeStaffCaptureIdentity);
  const renewIdentity = useCallback(() => setIdentity(makeStaffCaptureIdentity()), []);
  return (
    <SimpleForm
      onDirty={renewIdentity}
      onSaved={() => {
        renewIdentity();
        onSaved();
      }}
      onSubmit={async (form) => {
        try {
          await gateway.recordStaffFuelEntry(context, {
            recordId: identity.recordId,
            tripId: textValue(form, "tripId"),
            supplierId: optionalText(form, "supplierId"),
            fueledAt: dateTimeValue(form, "fueledAt"),
            location: optionalText(form, "location"),
            odometerKm: numberValue(form, "odometerKm"),
            quantity: positiveNumberValue(form, "quantity"),
            volumeUnit: fuelVolumeUnitValue(form, "volumeUnit"),
            unitPrice: numberValue(form, "unitPrice"),
            totalAmount: positiveNumberValue(form, "totalAmount"),
            currency: "PEN",
            paymentMethod: optionalText(form, "paymentMethod"),
            receiptType: optionalText(form, "receiptType"),
            receiptNumber: optionalText(form, "receiptNumber"),
            reason: textValue(form, "reason"),
            idempotencyKey: identity.idempotencyKey,
            receiptFile: fileValue(form, "receiptFile"),
          });
        } catch (error) {
          throw new Error(staffCaptureErrorMessage(error));
        }
      }}
      submitLabel="Confirmar abastecimiento"
      successMessage="Abastecimiento administrativo confirmado por el servidor."
      title="Datos del abastecimiento"
    >
      <SelectField
        defaultValue={optionDefaultValue(options.trips, defaultTripId)}
        label="Viaje"
        name="tripId"
        options={options.trips}
        required
      />
      {options.suppliers.filter((supplier) => supplier.status === "grifo").length === 0 ? (
        <p className="admin-form-note">
          Aún no hay grifos registrados.{" "}
          <Link
            to={`${routePaths.suppliers}?tipo=grifo&volver=${encodeURIComponent(routePaths.fuelEntries)}`}
          >
            Registrar nuevo grifo
          </Link>
        </p>
      ) : null}
      <SelectField
        defaultValue={
          defaultSupplierId !== null &&
          options.suppliers.some((supplier) => supplier.id === defaultSupplierId)
            ? defaultSupplierId
            : undefined
        }
        label="Grifo o proveedor (opcional)"
        name="supplierId"
        options={options.suppliers.filter((supplier) => supplier.status === "grifo")}
      />
      <Field
        defaultValue={localDateTimeInputValue()}
        label="Fecha y hora reales"
        name="fueledAt"
        type="datetime-local"
        required
      />
      <Field label="Ubicación (opcional)" name="location" />
      <Field
        label="Lectura del odómetro (km)"
        min="0"
        name="odometerKm"
        step="0.01"
        type="number"
        required
      />
      <Field label="Cantidad" min="0.001" name="quantity" step="0.001" type="number" required />
      <SelectField
        label="Unidad de volumen"
        name="volumeUnit"
        options={fuelVolumeUnitOptions}
        required
      />
      <Field
        label="Precio unitario (S/)"
        min="0"
        name="unitPrice"
        step="0.0001"
        type="number"
        required
      />
      <Field
        label="Monto total (S/)"
        min="0.01"
        name="totalAmount"
        step="0.01"
        type="number"
        required
      />
      <SelectField
        label="Medio de pago (opcional)"
        name="paymentMethod"
        options={paymentMethodOptions}
      />
      <StaffReceiptFields />
      <TextareaField
        label="Motivo de registro en representación o regularización"
        name="reason"
        required
        rows={3}
      />
      <p className="admin-form-note">
        Los montos se registran en soles (PEN). El servidor valida el viaje, la lectura y que el
        total sea consistente con cantidad × precio unitario.
      </p>
    </SimpleForm>
  );
}

function StaffReceiptFields(): React.JSX.Element {
  return (
    <>
      <SelectField
        label="Tipo de comprobante (opcional)"
        name="receiptType"
        options={receiptTypeOptions}
      />
      <Field label="Número de comprobante (opcional)" name="receiptNumber" />
      <FileField label="Comprobante privado (opcional)" name="receiptFile" />
      <p className="admin-form-note">
        Puedes adjuntar PDF, JPEG, PNG o WebP de hasta 50 MB. El archivo se guarda en el repositorio
        privado y no se expone mediante un enlace público.
      </p>
    </>
  );
}

function makeStaffCaptureIdentity(): StaffCaptureIdentity {
  return { recordId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() };
}

function localDateTimeInputValue(date = new Date()): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function dateTimeInputValue(value: string | null): string {
  if (value === null) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? localDateTimeInputValue(date) : "";
}

function staffCaptureReadOnlyCopy(online: boolean): string {
  return online
    ? "Tu rol puede consultar estos movimientos; solo Gerencia y Administración los registran en representación del viaje."
    : "Sin conexión: puedes consultar la copia local disponible, pero el registro administrativo requiere confirmación del servidor.";
}

function AdvancesPage({
  gateway,
  context,
  canMutate,
  online,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly canMutate: boolean;
  readonly online: boolean;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listAdvances(), [gateway]);
  const resource = useResource(loader);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const optionsLoader = useCallback(
    () => Promise.all([gateway.listTrips(), gateway.loadOptions()]),
    [gateway],
  );
  const options = useResource(optionsLoader);
  const tripId = new URLSearchParams(search).get("viaje");
  const selectedTrip = options.data?.[0].find((trip) => trip.id === tripId);
  const form =
    options.data === null ? null : (
      <SimpleForm
        title="Registrar adelanto"
        submitLabel="Guardar adelanto"
        onSubmit={async (formData) =>
          gateway.createAdvance(context, {
            tripId: textValue(formData, "tripId"),
            driverId: textValue(formData, "driverId"),
            deliveredAt: dateTimeValue(formData, "deliveredAt"),
            amount: numberValue(formData, "amount"),
            deliveryMethod: textValue(formData, "deliveryMethod"),
            concept: textValue(formData, "concept"),
            // Keep the same command identity until the server confirms success.
            // A lost response can then be retried without duplicating money.
            idempotencyKey,
          })
        }
        onSaved={() => {
          setIdempotencyKey(crypto.randomUUID());
          resource.reload();
        }}
      >
        <SelectField
          defaultValue={optionDefaultValue(options.data[0].map(toTripOption), tripId)}
          label="Viaje"
          name="tripId"
          options={options.data[0].map(toTripOption)}
          required
        />
        <SelectField
          defaultValue={optionDefaultValue(options.data[1].drivers, selectedTrip?.driverId ?? null)}
          label="Conductor"
          name="driverId"
          options={options.data[1].drivers}
          required
        />
        <Field label="Fecha" name="deliveredAt" type="datetime-local" required />
        <Field label="Monto" name="amount" type="number" min="0.01" step="0.01" required />
        <Field label="Medio de entrega" name="deliveryMethod" required />
        <Field label="Concepto" name="concept" required />
      </SimpleForm>
    );
  return (
    <ResourceCrudPage
      title="Adelantos"
      description={pageCopy.advances?.description ?? ""}
      resource={resource}
      emptyCopy="No existen adelantos registrados."
      form={
        canMutate && form !== null ? (
          <AdminFormDisclosure
            label="Registrar adelanto"
            copy="El comando se identifica de forma segura para evitar duplicar dinero al reintentar."
          >
            {form}
          </AdminFormDisclosure>
        ) : canMutate ? null : (
          <ReadOnlyNotice />
        )
      }
      listLabel="Fondos entregados"
      tableKind="finance"
      actions={
        resource.data?.some((row) => row.fileId !== undefined) === true
          ? (row) =>
              row.fileId === undefined ? null : (
                <PrivateEvidenceAction
                  fileId={row.fileId}
                  gateway={gateway}
                  label="Ver comprobante"
                  online={online}
                />
              )
          : undefined
      }
    />
  );
}

function SettlementsPage({
  gateway,
  canMutate,
  role,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly role: AppRole;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listSettlements(), [gateway]);
  const resource = useResource(loader);
  const filtersLoader = useCallback(
    () => Promise.all([gateway.listDrivers(), gateway.listTrips()]),
    [gateway],
  );
  const filters = useResource(filtersLoader);
  const [searchParams, setSearchParams] = useSearchParams(search);
  const query = searchParams.get("q") ?? "";
  const status = searchParams.get("estado") ?? "";
  const driverId = searchParams.get("conductor") ?? "";
  const tripId = searchParams.get("viaje") ?? "";
  const period = searchParams.get("periodo") ?? "";
  const updateFilters = (next: {
    readonly q: string;
    readonly status: string;
    readonly driverId: string;
    readonly tripId: string;
    readonly period: string;
  }) => {
    const params = new URLSearchParams(searchParams);
    setOrDeleteSearchParam(params, "q", next.q);
    setOrDeleteSearchParam(params, "estado", next.status);
    setOrDeleteSearchParam(params, "conductor", next.driverId);
    setOrDeleteSearchParam(params, "viaje", next.tripId);
    setOrDeleteSearchParam(params, "periodo", next.period);
    setSearchParams(params, { replace: true });
  };
  const driverName = filters.data?.[0].find((driver) => driver.id === driverId)?.title ?? "";
  const trip = filters.data?.[1].find((item) => item.id === tripId);
  const visibleRows = (resource.data ?? []).filter((row) =>
    settlementMatchesFilters(row, { query, status, driverName, trip, period }),
  );
  const [selected, setSelected] = useState<{
    readonly row: AdminListRow;
    readonly operation: "close" | "reopen";
  } | null>(null);
  return (
    <>
      <PageHeader title="Rendiciones" description={pageCopy.settlements?.description ?? ""} />
      {canMutate ? null : <ReadOnlyNotice />}
      <SettlementFilters
        driverId={driverId}
        drivers={filters.data?.[0] ?? []}
        onChange={updateFilters}
        period={period}
        query={query}
        status={status}
        tripId={tripId}
        trips={filters.data?.[1] ?? []}
      />
      <PageState resource={resource} emptyCopy="Las rendiciones aparecerán al completar viajes.">
        {() => (
          <RecordTable
            rows={visibleRows}
            kind="settlements"
            actions={
              canMutate
                ? (row) =>
                    row.description.includes("Copia local") ? null : row.status
                        .toLowerCase()
                        .includes("closed") || row.status.toLowerCase().includes("cerrad") ? (
                      role === "management" ? (
                        <Button
                          variant="quiet"
                          onClick={() => setSelected({ row, operation: "reopen" })}
                        >
                          Reabrir
                        </Button>
                      ) : (
                        <Link className="admin-text-link" to={settlementDetailPath(row.id)}>
                          Ver rendición <Icon name="chevron" size={16} />
                        </Link>
                      )
                    ) : (
                      <Button
                        variant="quiet"
                        onClick={() => setSelected({ row, operation: "close" })}
                      >
                        Cerrar
                      </Button>
                    )
                : undefined
            }
          />
        )}
      </PageState>
      {selected === null ? null : (
        <AdminActionDialog
          title={`${selected.operation === "close" ? "Cerrar" : "Reabrir"} ${selected.row.title}`}
          copy={`${settlementDirectionCopy(selected.row.amount ?? 0)} · ${formatMoney(Math.abs(selected.row.amount ?? 0))}`}
          onClose={() => setSelected(null)}
        >
          {selected.operation === "close" ? (
            <SimpleForm
              compact
              title={`Cerrar ${selected.row.title}`}
              submitLabel="Conciliar y cerrar rendición"
              onSubmit={async (form) =>
                gateway.closeSettlement(settlementCloseInput(selected.row, form))
              }
              onSaved={() => {
                setSelected(null);
                resource.reload();
              }}
            >
              {Math.abs(selected.row.amount ?? 0) < 0.005 ? (
                <p className="admin-form-note">
                  El saldo ya es S/ 0.00. El cierre se registrará como conciliado automáticamente;
                  no necesitas indicar medio ni referencia.
                </p>
              ) : (
                <>
                  <p className="admin-form-note">
                    {settlementDirectionCopy(selected.row.amount ?? 0)}:{" "}
                    {formatMoney(Math.abs(selected.row.amount ?? 0))}. Confirma cómo se regularizó
                    este saldo antes de cerrar.
                  </p>
                  <Field label="Medio de regularización" name="resolutionMethod" required />
                  <Field label="Referencia o comprobante" name="resolutionReference" required />
                  <Field label="Nota (opcional)" name="resolutionNote" />
                </>
              )}
            </SimpleForm>
          ) : (
            <SimpleForm
              compact
              title={`Reabrir ${selected.row.title}`}
              submitLabel="Reabrir rendición"
              onSubmit={async (form) =>
                gateway.reopenSettlement({
                  settlementId: selected.row.id,
                  reason: textValue(form, "reason"),
                })
              }
              onSaved={() => {
                setSelected(null);
                resource.reload();
              }}
            >
              <Field label="Motivo de reapertura" name="reason" required />
            </SimpleForm>
          )}
        </AdminActionDialog>
      )}
    </>
  );
}

function SettlementFilters({
  query,
  status,
  driverId,
  tripId,
  period,
  drivers,
  trips,
  onChange,
}: {
  readonly query: string;
  readonly status: string;
  readonly driverId: string;
  readonly tripId: string;
  readonly period: string;
  readonly drivers: readonly AdminListRow[];
  readonly trips: readonly AdminTripRow[];
  readonly onChange: (next: {
    readonly q: string;
    readonly status: string;
    readonly driverId: string;
    readonly tripId: string;
    readonly period: string;
  }) => void;
}): React.JSX.Element {
  const update = (
    changes: Partial<{
      q: string;
      status: string;
      driverId: string;
      tripId: string;
      period: string;
    }>,
  ) => onChange({ q: query, status, driverId, tripId, period, ...changes });
  return (
    <section
      className="admin-list-filters admin-settlement-filters"
      aria-label="Filtrar rendiciones"
    >
      <label>
        <span className="sr-only">Buscar rendición</span>
        <input
          onChange={(event) => update({ q: event.target.value })}
          placeholder="Buscar ruta, conductor o código"
          type="search"
          value={query}
        />
      </label>
      <select
        aria-label="Estado"
        onChange={(event) => update({ status: event.target.value })}
        value={status}
      >
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendiente</option>
        <option value="en revisión">En revisión</option>
        <option value="observado">Observado</option>
        <option value="cerrado">Cerrado</option>
      </select>
      <select
        aria-label="Conductor"
        onChange={(event) => update({ driverId: event.target.value })}
        value={driverId}
      >
        <option value="">Todos los conductores</option>
        {drivers.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.title}
          </option>
        ))}
      </select>
      <select
        aria-label="Viaje"
        onChange={(event) => update({ tripId: event.target.value })}
        value={tripId}
      >
        <option value="">Todos los viajes</option>
        {trips.map((trip) => (
          <option key={trip.id} value={trip.id}>
            {trip.title} · {trip.code}
          </option>
        ))}
      </select>
      <select
        aria-label="Periodo"
        onChange={(event) => update({ period: event.target.value })}
        value={period}
      >
        <option value="">Cualquier fecha</option>
        <option value="30d">Últimos 30 días</option>
        <option value="90d">Últimos 90 días</option>
      </select>
    </section>
  );
}

function settlementMatchesFilters(
  row: AdminListRow,
  filters: {
    readonly query: string;
    readonly status: string;
    readonly driverName: string;
    readonly trip: AdminTripRow | undefined;
    readonly period: string;
  },
): boolean {
  const normalized = filters.query.trim().toLocaleLowerCase("es-PE");
  if (
    normalized !== "" &&
    !`${row.title} ${row.description} ${row.technicalReference ?? ""}`
      .toLocaleLowerCase("es-PE")
      .includes(normalized)
  )
    return false;
  if (filters.status !== "" && !row.status.toLocaleLowerCase("es-PE").includes(filters.status))
    return false;
  if (
    filters.driverName !== "" &&
    !row.description
      .toLocaleLowerCase("es-PE")
      .includes(filters.driverName.toLocaleLowerCase("es-PE"))
  )
    return false;
  if (
    filters.trip !== undefined &&
    !(
      row.title
        .toLocaleLowerCase("es-PE")
        .includes(filters.trip.title.toLocaleLowerCase("es-PE")) &&
      (row.technicalReference ?? "")
        .toLocaleLowerCase("es-PE")
        .includes(filters.trip.code.toLocaleLowerCase("es-PE"))
    )
  )
    return false;
  if (filters.period === "") return true;
  const date = row.date === null ? Number.NaN : Date.parse(row.date);
  const days = filters.period === "30d" ? 30 : filters.period === "90d" ? 90 : null;
  return days === null || (Number.isFinite(date) && date >= Date.now() - days * 86_400_000);
}

interface WorkOrderCommandIdentity {
  readonly recordId: string;
  readonly idempotencyKey: string;
}

interface WorkOrderEvidenceIdentity extends WorkOrderCommandIdentity {
  readonly fileId: string;
}

function makeWorkOrderCommandIdentity(): WorkOrderCommandIdentity {
  return { recordId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() };
}

function makeWorkOrderEvidenceIdentity(): WorkOrderEvidenceIdentity {
  return {
    ...makeWorkOrderCommandIdentity(),
    fileId: crypto.randomUUID(),
  };
}

function MaintenancePage({
  gateway,
  context,
  canMutate,
  online,
  selectedVehicleId,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly canMutate: boolean;
  readonly online: boolean;
  readonly selectedVehicleId: string | null;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(
    () => (online ? gateway.listMaintenance() : Promise.resolve([])),
    [gateway, online],
  );
  const resource = useResource(loader);
  const optionsLoader = useCallback(
    () => (online ? gateway.loadMaintenanceOptions() : Promise.resolve(null)),
    [gateway, online],
  );
  const options = useResource(optionsLoader);
  const [searchParams, setSearchParams] = useSearchParams(search);
  const query = searchParams.get("q") ?? "";
  const status = searchParams.get("estado") ?? "";
  const maintenanceType = searchParams.get("tipo") ?? "";
  const blocking = searchParams.get("bloqueo") ?? "";
  const updateFilters = (
    changes: Partial<{ q: string; estado: string; tipo: string; bloqueo: string }>,
  ) => {
    const next = new URLSearchParams(searchParams);
    const values = {
      q: query,
      estado: status,
      tipo: maintenanceType,
      bloqueo: blocking,
      ...changes,
    };
    setOrDeleteSearchParam(next, "q", values.q);
    setOrDeleteSearchParam(next, "estado", values.estado);
    setOrDeleteSearchParam(next, "tipo", values.tipo);
    setOrDeleteSearchParam(next, "bloqueo", values.bloqueo);
    setSearchParams(next, { replace: true });
  };
  const [workOrderIdentity, setWorkOrderIdentity] = useState<WorkOrderCommandIdentity>(
    makeWorkOrderCommandIdentity,
  );
  const renewWorkOrderIdentity = useCallback(
    () => setWorkOrderIdentity(makeWorkOrderCommandIdentity()),
    [],
  );
  const form = !canMutate ? (
    <ReadOnlyNotice />
  ) : options.status === "ERROR" ? (
    <AdminNotice
      title="No se pudieron preparar los maestros de mantenimiento"
      copy={options.error ?? "Vuelve a intentarlo en unos instantes."}
      tone="error"
    />
  ) : options.data === null ? null : (
    <div className="admin-form-grid">
      <SimpleForm
        description="Define cuándo se debe generar una tarea recurrente. Usa un ejemplo real para que el equipo entienda qué revisar y cuándo."
        title="Plan preventivo"
        submitLabel="Crear plan"
        onSubmit={async (formData) =>
          gateway.createMaintenancePlan(context, {
            vehicleId: textValue(formData, "vehicleId"),
            name: textValue(formData, "name"),
            maintenanceType: textValue(formData, "maintenanceType"),
            frequencyKm: nullableNumber(formData, "frequencyKm"),
            frequencyDays: nullableNumber(formData, "frequencyDays"),
          })
        }
        onSaved={resource.reload}
      >
        <SelectField
          defaultValue={selectedVehicleId ?? undefined}
          label="Unidad"
          name="vehicleId"
          options={options.data.vehicles}
          required
        />
        <Field
          hint="Ejemplo: Cambio de aceite y filtro."
          label="Nombre"
          name="name"
          placeholder="Ej.: Cambio de aceite y filtro"
          required
        />
        <Field
          hint="Indica si la tarea es preventiva, correctiva o una inspección."
          label="Tipo"
          name="maintenanceType"
          placeholder="Ej.: Preventivo"
          required
        />
        <Field
          hint="Déjalo vacío si el plan no depende del kilometraje."
          label="Frecuencia km"
          min="1"
          name="frequencyKm"
          placeholder="Ej.: 10 000"
          type="number"
        />
        <Field
          hint="Déjalo vacío si el plan solo se controla por kilometraje."
          label="Frecuencia días"
          min="1"
          name="frequencyDays"
          placeholder="Ej.: 180"
          type="number"
        />
      </SimpleForm>
      <SimpleForm
        onDirty={renewWorkOrderIdentity}
        onSaved={() => {
          renewWorkOrderIdentity();
          resource.reload();
        }}
        onSubmit={async (formData) => {
          try {
            await gateway.createWorkOrder({
              id: workOrderIdentity.recordId,
              vehicleId: textValue(formData, "vehicleId"),
              supplierId: optionalText(formData, "supplierId"),
              reportedProblem: textValue(formData, "reportedProblem"),
              maintenanceType: textValue(formData, "maintenanceType"),
              admittedAt: optionalDateTimeValue(formData, "admittedAt"),
              blocksOperation: booleanValue(formData, "blocksOperation"),
              notes: optionalText(formData, "notes"),
              idempotencyKey: workOrderIdentity.idempotencyKey,
            });
          } catch (error) {
            throw new Error(maintenanceWorkOrderErrorMessage(error));
          }
        }}
        submitLabel="Abrir orden"
        successMessage="La orden de trabajo fue creada y confirmada por el servidor."
        title="Orden de trabajo"
      >
        <SelectField
          defaultValue={selectedVehicleId ?? undefined}
          label="Unidad"
          name="vehicleId"
          options={options.data.vehicles}
          required
        />
        <SelectField
          label="Taller o proveedor (opcional)"
          name="supplierId"
          options={options.data.suppliers}
        />
        <Field label="Tipo" name="maintenanceType" required />
        <TextareaField label="Problema reportado" name="reportedProblem" required rows={3} />
        <Field
          defaultValue={localDateTimeInputValue()}
          label="Fecha y hora de ingreso (opcional)"
          name="admittedAt"
          type="datetime-local"
        />
        <TextareaField label="Notas iniciales (opcional)" name="notes" rows={2} />
        <CheckboxField
          label="Bloquea la programación de la unidad mientras la orden siga abierta"
          name="blocksOperation"
        />
        <p className="admin-form-note">
          El diagnóstico y el trabajo realizado se completan después en el detalle. Marcar el
          bloqueo afecta programación; no se infiere por el tipo de mantenimiento.
        </p>
      </SimpleForm>
    </div>
  );
  return (
    <>
      <PageHeader title="Mantenimiento" description={pageCopy.maintenance?.description ?? ""} />
      {!online ? (
        <AdminNotice
          title="Mantenimiento requiere conexión"
          copy="Las órdenes, sus costos y su evidencia privada se confirman en el servidor y todavía no forman parte de la copia local."
        />
      ) : (
        <>
          {canMutate && form !== null ? (
            <AdminFormDisclosure
              label="Planificar mantenimiento"
              copy="Crea un plan preventivo o abre una orden con el problema y la disponibilidad real de la unidad."
            >
              {form}
            </AdminFormDisclosure>
          ) : (
            form
          )}
          <section className="admin-card admin-list-card">
            <div className="admin-card__heading">
              <h2>Planes y órdenes</h2>
              {resource.status === "READY" ? <span>{resource.data?.length ?? 0}</span> : null}
            </div>
            <MaintenanceFilters
              blocking={blocking}
              maintenanceType={maintenanceType}
              onChange={updateFilters}
              query={query}
              status={status}
            />
            <PageState resource={resource} emptyCopy="No existen planes ni órdenes de trabajo.">
              {(rows) => {
                const filteredRows = rows.filter((row) => {
                  const maintenance = row as AdminMaintenanceRow;
                  if (selectedVehicleId !== null && maintenance.vehicleId !== selectedVehicleId)
                    return false;
                  if (
                    status !== "" &&
                    !row.status
                      .toLocaleLowerCase("es-PE")
                      .includes(status.toLocaleLowerCase("es-PE"))
                  )
                    return false;
                  if (
                    maintenanceType !== "" &&
                    !row.description
                      .toLocaleLowerCase("es-PE")
                      .includes(maintenanceType.toLocaleLowerCase("es-PE"))
                  )
                    return false;
                  if (
                    blocking === "si" &&
                    !row.description.toLocaleLowerCase("es-PE").includes("bloquea")
                  )
                    return false;
                  if (
                    blocking === "no" &&
                    row.description.toLocaleLowerCase("es-PE").includes("bloquea")
                  )
                    return false;
                  const normalizedQuery = query.trim().toLocaleLowerCase("es-PE");
                  return (
                    normalizedQuery === "" ||
                    `${row.title} ${row.description} ${row.technicalReference ?? ""}`
                      .toLocaleLowerCase("es-PE")
                      .includes(normalizedQuery)
                  );
                });
                return (
                  <RecordTable
                    rows={filteredRows}
                    kind="maintenance"
                    actions={(row) => {
                      const maintenance = rows.find((candidate) => candidate.id === row.id);
                      return maintenance?.recordType === "work_order" ? (
                        <Link
                          className="admin-text-link"
                          to={maintenanceWorkOrderPath(maintenance.id)}
                        >
                          Gestionar <Icon name="chevron" size={16} />
                        </Link>
                      ) : null;
                    }}
                  />
                );
              }}
            </PageState>
          </section>
        </>
      )}
    </>
  );
}

function MaintenanceFilters({
  query,
  status,
  maintenanceType,
  blocking,
  onChange,
}: {
  readonly query: string;
  readonly status: string;
  readonly maintenanceType: string;
  readonly blocking: string;
  readonly onChange: (
    changes: Partial<{ q: string; estado: string; tipo: string; bloqueo: string }>,
  ) => void;
}): React.JSX.Element {
  return (
    <div
      className="admin-list-filters admin-maintenance-filters"
      aria-label="Filtrar mantenimiento"
    >
      <label>
        <span className="sr-only">Buscar mantenimiento</span>
        <input
          onChange={(event) => onChange({ q: event.target.value })}
          placeholder="Buscar problema, trabajo o unidad"
          type="search"
          value={query}
        />
      </label>
      <select
        aria-label="Estado de mantenimiento"
        onChange={(event) => onChange({ estado: event.target.value })}
        value={status}
      >
        <option value="">Todos los estados</option>
        <option value="programada">Programada</option>
        <option value="taller">En taller</option>
        <option value="proceso">En proceso</option>
        <option value="repuesto">En espera de repuesto</option>
        <option value="finalizada">Finalizada</option>
      </select>
      <input
        aria-label="Tipo de mantenimiento"
        onChange={(event) => onChange({ tipo: event.target.value })}
        placeholder="Tipo: preventivo, llantas…"
        value={maintenanceType}
      />
      <select
        aria-label="Bloqueo operativo"
        onChange={(event) => onChange({ bloqueo: event.target.value })}
        value={blocking}
      >
        <option value="">Con o sin bloqueo</option>
        <option value="si">Bloquea operación</option>
        <option value="no">No bloquea</option>
      </select>
    </div>
  );
}

function MaintenanceOrderDetailPage({
  workOrderId,
  context,
  gateway,
  canMutate,
  online,
}: {
  readonly workOrderId: string | null;
  readonly context: AdminWriteContext;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly online: boolean;
}): React.JSX.Element {
  const loader = useCallback(async (): Promise<AdminMaintenanceDetail | null> => {
    if (!online || workOrderId === null) return null;
    return gateway.loadMaintenanceDetail(workOrderId);
  }, [gateway, online, workOrderId]);
  const resource = useResource(loader);
  return (
    <>
      <PageHeader
        title="Orden de trabajo"
        description="Problema, avance, repuestos, costos y evidencia privada de una intervención."
        action={
          <Link className="admin-header-action" to={routePaths.maintenance}>
            <Icon name="chevron" size={18} /> Volver a mantenimiento
          </Link>
        }
      />
      {!online ? (
        <AdminNotice
          title="Esta orden requiere conexión"
          copy="El detalle de mantenimiento se consulta y actualiza directamente en el servidor; no se presenta como información offline."
        />
      ) : workOrderId === null ? (
        <AdminNotice
          title="Orden no identificada"
          copy="Vuelve a la lista y selecciona una orden de trabajo."
        />
      ) : (
        <PageState
          resource={resource}
          emptyCopy="La orden no existe o ya no está disponible para tu empresa."
        >
          {(detail) => (
            <MaintenanceOrderDetailContent
              key={`${detail.id}-${detail.status}-${detail.finishedAt ?? "open"}`}
              canMutate={canMutate}
              context={context}
              detail={detail}
              gateway={gateway}
              onRefresh={resource.reload}
              online={online}
            />
          )}
        </PageState>
      )}
    </>
  );
}

function MaintenanceOrderDetailContent({
  detail,
  context,
  gateway,
  canMutate,
  online,
  onRefresh,
}: {
  readonly detail: AdminMaintenanceDetail;
  readonly context: AdminWriteContext;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly online: boolean;
  readonly onRefresh: () => void;
}): React.JSX.Element {
  const optionsLoader = useCallback(() => gateway.loadMaintenanceOptions(), [gateway]);
  const options = useResource(optionsLoader);
  const terminal = detail.status === "finished" || detail.status === "cancelled";
  const registeredPartsTotal = workOrderPartsTotal(detail);
  return (
    <div className="admin-trip-detail">
      <section className="admin-card admin-detail-card">
        <div className="admin-card__heading">
          <div>
            <p className="admin-page-header__eyebrow">{detail.vehicleLabel}</p>
            <h2>{detail.workPerformed ?? detail.reportedProblem ?? "Trabajo de mantenimiento"}</h2>
            <p className="technical-value">{detail.code}</p>
          </div>
          <StatusChip
            label={workOrderStatusLabelForUi(detail.status)}
            tone={toneForStatus(detail.status)}
          />
        </div>
        <dl>
          <DetailTerm label="Tipo" value={detail.maintenanceType} />
          <DetailTerm label="Taller o proveedor" value={detail.supplierLabel ?? "Sin asignar"} />
          <DetailTerm label="Ingreso" value={formatDate(detail.admittedAt)} />
          <DetailTerm label="Inicio de trabajo" value={formatDate(detail.startedAt)} />
          <DetailTerm label="Finalización" value={formatDate(detail.finishedAt)} />
          <DetailTerm
            label="Programación"
            value={
              detail.blocksOperation ? "Bloqueada por esta orden" : "No bloqueada por esta orden"
            }
          />
          <DetailTerm label="Odómetro final" value={formatNumberForUi(detail.odometerKm)} />
          <DetailTerm label="Mano de obra" value={formatMoney(detail.laborCost)} />
          <DetailTerm label="Repuestos" value={formatMoney(detail.partsCost)} />
        </dl>
      </section>
      <section className="admin-card admin-detail-card">
        <div className="admin-card__heading">
          <h2>Diagnóstico y trabajo</h2>
        </div>
        <dl>
          <DetailTerm label="Problema reportado" value={detail.reportedProblem ?? "Sin detalle"} />
          <DetailTerm label="Diagnóstico" value={detail.diagnosis ?? "Aún no registrado"} />
          <DetailTerm
            label="Trabajo realizado"
            value={detail.workPerformed ?? "Aún no registrado"}
          />
          <DetailTerm label="Notas" value={detail.notes ?? "Sin notas"} />
        </dl>
      </section>
      <TripListSection
        emptyCopy="Aún no hay repuestos registrados para esta orden."
        evidenceGateway={gateway}
        kind="maintenance"
        online={online}
        rows={detail.parts}
        title="Repuestos registrados"
      />
      <TripListSection
        emptyCopy="No se adjuntó evidencia; es opcional y puede agregarse después."
        evidenceGateway={gateway}
        kind="documents"
        online={online}
        rows={detail.evidence}
        title="Evidencia privada"
      />
      {!canMutate ? (
        <ReadOnlyNotice />
      ) : options.status === "ERROR" ? (
        <AdminNotice
          title="No se pudieron cargar los maestros de mantenimiento"
          copy={options.error ?? "Vuelve a intentar en unos instantes."}
          tone="error"
        />
      ) : options.data === null ? (
        <AdminNotice
          title="Preparando orden"
          copy="Cargando talleres, unidades y repuestos autorizados."
        />
      ) : (
        <>
          {!terminal ? (
            <>
              <AdminFormDisclosure
                label="Actualizar avance"
                copy="Registra el estado real, diagnóstico y trabajo. Finalizar exige el cierre con costos y odómetro."
              >
                <MaintenanceProgressForm
                  detail={detail}
                  gateway={gateway}
                  options={options.data}
                  onSaved={onRefresh}
                />
              </AdminFormDisclosure>
              <AdminFormDisclosure
                label="Registrar repuesto"
                copy="Cada línea queda auditada. Al cerrar, el total de repuestos debe coincidir con la suma de estas líneas."
              >
                {options.data.parts.length === 0 ? (
                  <AdminNotice
                    title="Primero registra un repuesto"
                    copy="No hay repuestos activos disponibles para esta empresa. Crea el maestro a continuación."
                  />
                ) : (
                  <MaintenancePartForm
                    detail={detail}
                    gateway={gateway}
                    options={options.data}
                    onSaved={onRefresh}
                  />
                )}
              </AdminFormDisclosure>
              <AdminFormDisclosure
                label="Crear maestro de repuesto"
                copy="Agrega un repuesto reutilizable sin modificar las líneas ya registradas."
              >
                <MaintenancePartMasterForm
                  context={context}
                  gateway={gateway}
                  onSaved={options.reload}
                />
              </AdminFormDisclosure>
              <AdminFormDisclosure
                label="Cerrar orden"
                copy="Confirma odómetro y costos finales. No se puede cerrar si el total de repuestos itemizados no coincide."
              >
                <MaintenanceCloseForm
                  detail={detail}
                  gateway={gateway}
                  registeredPartsTotal={registeredPartsTotal}
                  onSaved={onRefresh}
                />
              </AdminFormDisclosure>
            </>
          ) : null}
          <AdminFormDisclosure
            label="Adjuntar evidencia privada"
            copy="Es opcional. Admite varios archivos para revisión humana, sin alterar datos técnicos de la orden."
          >
            <MaintenanceEvidenceForm
              context={context}
              detail={detail}
              gateway={gateway}
              onSaved={onRefresh}
            />
          </AdminFormDisclosure>
        </>
      )}
    </div>
  );
}

function MaintenanceProgressForm({
  detail,
  gateway,
  options,
  onSaved,
}: {
  readonly detail: AdminMaintenanceDetail;
  readonly gateway: AdminDataGateway;
  readonly options: AdminMaintenanceOptions;
  readonly onSaved: () => void;
}): React.JSX.Element {
  return (
    <SimpleForm
      compact
      onSubmit={async (formData) => {
        try {
          await gateway.updateWorkOrderProgress({
            workOrderId: detail.id,
            supplierId: optionalText(formData, "supplierId"),
            status: workOrderProgressStatusValue(formData, "status"),
            admittedAt: optionalDateTimeValue(formData, "admittedAt"),
            startedAt: optionalDateTimeValue(formData, "startedAt"),
            diagnosis: optionalText(formData, "diagnosis"),
            workPerformed: optionalText(formData, "workPerformed"),
            notes: optionalText(formData, "notes"),
            blocksOperation: booleanValue(formData, "blocksOperation"),
          });
        } catch (error) {
          throw new Error(maintenanceWorkOrderErrorMessage(error));
        }
      }}
      onSaved={onSaved}
      submitLabel="Guardar avance"
      successMessage="El avance de la orden fue confirmado por el servidor."
      title="Avance de la orden"
    >
      <SelectField
        defaultValue={detail.status}
        label="Estado"
        name="status"
        options={workOrderProgressOptions}
        required
      />
      <SelectField
        defaultValue={detail.supplierId ?? undefined}
        label="Taller o proveedor (opcional)"
        name="supplierId"
        options={options.suppliers}
      />
      <Field
        defaultValue={dateTimeInputValue(detail.admittedAt)}
        label="Ingreso (opcional)"
        name="admittedAt"
        type="datetime-local"
      />
      <Field
        defaultValue={dateTimeInputValue(detail.startedAt)}
        label="Inicio de trabajo (opcional)"
        name="startedAt"
        type="datetime-local"
      />
      <TextareaField
        defaultValue={detail.diagnosis ?? undefined}
        label="Diagnóstico (opcional)"
        name="diagnosis"
      />
      <TextareaField
        defaultValue={detail.workPerformed ?? undefined}
        label="Trabajo realizado (opcional)"
        name="workPerformed"
      />
      <TextareaField
        defaultValue={detail.notes ?? undefined}
        label="Notas (opcional)"
        name="notes"
        rows={2}
      />
      <CheckboxField
        defaultChecked={detail.blocksOperation}
        label="Bloquea programación mientras la orden siga abierta"
        name="blocksOperation"
      />
    </SimpleForm>
  );
}

function MaintenancePartForm({
  detail,
  gateway,
  options,
  onSaved,
}: {
  readonly detail: AdminMaintenanceDetail;
  readonly gateway: AdminDataGateway;
  readonly options: AdminMaintenanceOptions;
  readonly onSaved: () => void;
}): React.JSX.Element {
  const [identity, setIdentity] = useState<WorkOrderCommandIdentity>(makeWorkOrderCommandIdentity);
  const renewIdentity = useCallback(() => setIdentity(makeWorkOrderCommandIdentity()), []);
  return (
    <SimpleForm
      compact
      onDirty={renewIdentity}
      onSaved={() => {
        renewIdentity();
        onSaved();
      }}
      onSubmit={async (formData) => {
        try {
          await gateway.recordWorkOrderPart({
            id: identity.recordId,
            workOrderId: detail.id,
            partId: textValue(formData, "partId"),
            supplierId: optionalText(formData, "supplierId"),
            quantity: positiveNumberValue(formData, "quantity"),
            unitCost: numberValue(formData, "unitCost"),
            installedAt: optionalDateTimeValue(formData, "installedAt"),
            installationOdometerKm: nullableNumber(formData, "installationOdometerKm"),
            notes: optionalText(formData, "notes"),
            idempotencyKey: identity.idempotencyKey,
          });
        } catch (error) {
          throw new Error(maintenanceWorkOrderErrorMessage(error));
        }
      }}
      submitLabel="Registrar repuesto"
      successMessage="El repuesto fue registrado y auditado."
      title="Línea de repuesto"
    >
      <SelectField label="Repuesto" name="partId" options={options.parts} required />
      <SelectField label="Proveedor (opcional)" name="supplierId" options={options.suppliers} />
      <Field label="Cantidad" min="0.001" name="quantity" required step="0.001" type="number" />
      <Field
        label="Costo unitario (S/)"
        min="0"
        name="unitCost"
        required
        step="0.0001"
        type="number"
      />
      <Field label="Fecha de instalación (opcional)" name="installedAt" type="datetime-local" />
      <Field
        label="Odómetro de instalación (km, opcional)"
        min="0"
        name="installationOdometerKm"
        step="0.01"
        type="number"
      />
      <TextareaField label="Nota (opcional)" name="notes" rows={2} />
    </SimpleForm>
  );
}

function MaintenancePartMasterForm({
  context,
  gateway,
  onSaved,
}: {
  readonly context: AdminWriteContext;
  readonly gateway: AdminDataGateway;
  readonly onSaved: () => void;
}): React.JSX.Element {
  return (
    <SimpleForm
      compact
      onSubmit={async (formData) =>
        gateway.createMaintenancePart(context, {
          name: textValue(formData, "name"),
          internalCode: optionalText(formData, "internalCode"),
          brand: optionalText(formData, "brand"),
          category: optionalText(formData, "category"),
          unit: textValue(formData, "unit"),
        })
      }
      onSaved={onSaved}
      submitLabel="Guardar repuesto"
      title="Maestro de repuesto"
    >
      <Field label="Nombre" name="name" required />
      <Field label="Código interno (opcional)" name="internalCode" />
      <Field label="Marca (opcional)" name="brand" />
      <Field label="Categoría (opcional)" name="category" />
      <Field label="Unidad de medida" name="unit" required />
    </SimpleForm>
  );
}

function MaintenanceCloseForm({
  detail,
  gateway,
  registeredPartsTotal,
  onSaved,
}: {
  readonly detail: AdminMaintenanceDetail;
  readonly gateway: AdminDataGateway;
  readonly registeredPartsTotal: number;
  readonly onSaved: () => void;
}): React.JSX.Element {
  const hasRegisteredParts = detail.parts.length > 0;
  return (
    <SimpleForm
      compact
      onSubmit={async (formData) => {
        try {
          await gateway.completeWorkOrder({
            workOrderId: detail.id,
            finalMileage: numberValue(formData, "finalMileage"),
            labourCost: numberValue(formData, "labourCost", 0),
            partsCost: numberValue(formData, "partsCost", 0),
          });
        } catch (error) {
          throw new Error(maintenanceWorkOrderErrorMessage(error));
        }
      }}
      onSaved={onSaved}
      submitLabel="Cerrar orden"
      successMessage="La orden se cerró y los costos quedaron confirmados por el servidor."
      title={`Cerrar ${detail.code}`}
    >
      <Field
        label="Odómetro final (km)"
        min="0"
        name="finalMileage"
        required
        step="0.01"
        type="number"
      />
      <Field
        defaultValue={String(detail.laborCost)}
        label="Mano de obra (S/)"
        min="0"
        name="labourCost"
        required
        step="0.01"
        type="number"
      />
      <Field
        defaultValue={String(hasRegisteredParts ? registeredPartsTotal : detail.partsCost)}
        label="Total de repuestos (S/)"
        min="0"
        name="partsCost"
        required
        step="0.01"
        type="number"
      />
      <p className="admin-form-note">
        {hasRegisteredParts
          ? `Hay ${detail.parts.length} línea(s) registrada(s). La suma orientativa es ${formatMoney(registeredPartsTotal)}; el servidor redondea cada línea a céntimos y valida el total exacto al cerrar.`
          : "Aún no hay líneas de repuesto. Puedes confirmar un monto global de repuestos al cierre."}
      </p>
    </SimpleForm>
  );
}

function MaintenanceEvidenceForm({
  detail,
  context,
  gateway,
  onSaved,
}: {
  readonly detail: AdminMaintenanceDetail;
  readonly context: AdminWriteContext;
  readonly gateway: AdminDataGateway;
  readonly onSaved: () => void;
}): React.JSX.Element {
  const [identity, setIdentity] = useState<WorkOrderEvidenceIdentity>(
    makeWorkOrderEvidenceIdentity,
  );
  const renewIdentity = useCallback(() => setIdentity(makeWorkOrderEvidenceIdentity()), []);
  return (
    <SimpleForm
      compact
      onDirty={renewIdentity}
      onSaved={() => {
        renewIdentity();
        onSaved();
      }}
      onSubmit={async (formData) => {
        try {
          await gateway.attachWorkOrderEvidence(context, {
            id: identity.recordId,
            fileId: identity.fileId,
            workOrderId: detail.id,
            notes: optionalText(formData, "notes"),
            idempotencyKey: identity.idempotencyKey,
            file: requiredFileValue(formData, "file"),
          });
        } catch (error) {
          throw new Error(maintenanceWorkOrderErrorMessage(error));
        }
      }}
      submitLabel="Adjuntar evidencia"
      successMessage="La evidencia quedó asociada a la orden para revisión humana."
      title="Archivo privado"
    >
      <FileField label="Archivo privado" name="file" required />
      <TextareaField label="Nota de evidencia (opcional)" name="notes" rows={2} />
      <p className="admin-form-note">
        Se aceptan PDF, JPEG, PNG o WebP de hasta 50 MB. El archivo no completa ni modifica
        automáticamente el diagnóstico, los trabajos, los repuestos o los costos.
      </p>
    </SimpleForm>
  );
}

function DocumentsPage({
  gateway,
  context,
  canMutate,
  online,
  selectedVehicleId,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly canMutate: boolean;
  readonly online: boolean;
  readonly selectedVehicleId: string | null;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listDocuments(), [gateway]);
  const resource = useResource(loader);
  const targetsLoader = useCallback(
    () => Promise.all([gateway.loadOptions(), gateway.listTrips()]),
    [gateway],
  );
  const targets = useResource(targetsLoader);
  const [attachmentTarget, setAttachmentTarget] = useState<AdminListRow | null>(null);
  const [searchParams, setSearchParams] = useSearchParams(search);
  const selectedAssociation =
    documentAssociationFromSearch(searchParams.toString()) ??
    (selectedVehicleId === null ? null : `vehicle:${selectedVehicleId}`);
  const documentQuery = searchParams.get("q") ?? "";
  const documentStatus = searchParams.get("estado") ?? "";
  const documentType = searchParams.get("tipo") ?? "";
  const documentAssociationFilter = searchParams.get("asociado") ?? "";
  const documentAssociationType = selectedAssociation === null ? documentAssociationFilter : "";
  const updateFilters = (next: {
    readonly q: string;
    readonly status: string;
    readonly type: string;
    readonly association: string;
  }) => {
    const params = new URLSearchParams(searchParams);
    setOrDeleteSearchParam(params, "q", next.q);
    setOrDeleteSearchParam(params, "estado", next.status);
    setOrDeleteSearchParam(params, "tipo", next.type);
    setOrDeleteSearchParam(params, "asociado", next.association);
    setSearchParams(params, { replace: true });
  };
  const form = !canMutate ? (
    <ReadOnlyNotice />
  ) : targets.status === "ERROR" ? (
    <AdminNotice
      title="No se pudieron cargar los registros asociados"
      copy={targets.error ?? "Vuelve a intentar en unos instantes."}
      tone="error"
    />
  ) : targets.data === null ? (
    <AdminNotice
      title="Preparando formulario"
      copy="Cargando empresa, unidades, conductores, viajes y clientes."
    />
  ) : (
    <SimpleForm
      title="Registrar documento"
      submitLabel="Guardar documento"
      onSubmit={async (formData) => {
        const association = parseDocumentAssociation(textValue(formData, "association"));
        await gateway.createDocument(context, {
          entityType: association.entityType,
          entityId: association.entityId,
          documentType: textValue(formData, "documentType"),
          documentNumber: optionalText(formData, "documentNumber"),
          issuedOn: optionalText(formData, "issuedOn"),
          expiresOn: optionalText(formData, "expiresOn"),
          blocksOperation: booleanValue(formData, "blocksOperation"),
          file: fileValue(formData, "file"),
        });
      }}
      onSaved={resource.reload}
    >
      <GroupedAssociationSelect
        defaultValue={selectedAssociation ?? undefined}
        label="Registro asociado"
        name="association"
        options={documentAssociationOptions(targets.data[0], targets.data[1])}
        required
      />
      <Field label="Tipo de documento" name="documentType" required />
      <Field label="Número" name="documentNumber" />
      <Field label="Emisión" name="issuedOn" type="date" />
      <Field label="Vencimiento" name="expiresOn" type="date" />
      <FileField label="Archivo privado" name="file" />
      <CheckboxField label="Bloquea programación al vencer" name="blocksOperation" />
      <p className="admin-form-note">
        Se aceptan PDF, JPEG, PNG o WebP de hasta 50 MB. Si registras un documento bloqueante sin
        archivo, el sistema conservará el faltante y no permitirá programar el recurso hasta que
        adjuntes la evidencia.
      </p>
    </SimpleForm>
  );
  return (
    <ResourceCrudPage
      title="Documentos"
      description={pageCopy.documents?.description ?? ""}
      resource={resource}
      emptyCopy="No existen documentos registrados."
      form={
        <>
          {canMutate && targets.data !== null ? (
            <AdminFormDisclosure
              label="Registrar documento"
              copy="Guarda vigencias y evidencia privada sin interrumpir la revisión del archivo actual."
            >
              {form}
            </AdminFormDisclosure>
          ) : (
            form
          )}
          {attachmentTarget === null ? null : (
            <AdminActionDialog
              title={`Adjuntar archivo a ${attachmentTarget.title}`}
              copy="El archivo quedará protegido y asociado a este registro documental."
              onClose={() => setAttachmentTarget(null)}
            >
              <SimpleForm
                compact
                title={`Adjuntar archivo a ${attachmentTarget.title}`}
                submitLabel="Subir y vincular archivo"
                onSubmit={async (formData) => {
                  const file = fileValue(formData, "attachment");
                  if (file === null) throw new Error("Selecciona el archivo que deseas adjuntar.");
                  await gateway.attachDocumentFile(context, {
                    documentId: attachmentTarget.id,
                    expectedUpdatedAt: requiredUpdatedAt(attachmentTarget),
                    file,
                  });
                }}
                onSaved={() => {
                  setAttachmentTarget(null);
                  resource.reload();
                }}
              >
                <FileField label="Archivo privado" name="attachment" required />
                <p className="admin-form-note">
                  El archivo quedará en Storage privado y vinculado al registro documental de tu
                  empresa.
                </p>
              </SimpleForm>
            </AdminActionDialog>
          )}
        </>
      }
      listLabel="Archivo documental"
      tableKind="documents"
      listToolbar={
        <DocumentFilters
          association={documentAssociationType}
          documentType={documentType}
          query={documentQuery}
          status={documentStatus}
          onChange={updateFilters}
        />
      }
      rowFilter={(row) => {
        const document = row as AdminDocumentRow;
        const normalizedQuery = documentQuery.trim().toLocaleLowerCase("es-PE");
        if (
          selectedAssociation !== null &&
          `${document.entityType}:${document.entityId ?? ""}` !== selectedAssociation
        )
          return false;
        if (documentAssociationType !== "" && document.entityType !== documentAssociationType)
          return false;
        if (
          documentType !== "" &&
          !document.title
            .toLocaleLowerCase("es-PE")
            .includes(documentType.toLocaleLowerCase("es-PE"))
        )
          return false;
        if (documentStatus === "archivo_faltante" && document.hasFile) return false;
        if (documentStatus === "con_archivo" && !document.hasFile) return false;
        if (
          documentStatus !== "" &&
          documentStatus !== "archivo_faltante" &&
          documentStatus !== "con_archivo" &&
          !document.status
            .toLocaleLowerCase("es-PE")
            .includes(documentStatus.toLocaleLowerCase("es-PE"))
        )
          return false;
        return (
          normalizedQuery === "" ||
          `${document.title} ${document.description} ${document.entityLabel} ${document.technicalReference ?? ""}`
            .toLocaleLowerCase("es-PE")
            .includes(normalizedQuery)
        );
      }}
      actions={
        canMutate || resource.data?.some((document) => document.fileId !== undefined) === true
          ? (row) => {
              const document = resource.data?.find((candidate) => candidate.id === row.id);
              const evidence =
                document?.fileId === undefined ? null : (
                  <PrivateEvidenceAction
                    fileId={document.fileId}
                    gateway={gateway}
                    label="Ver archivo"
                    online={online}
                  />
                );
              const attach =
                canMutate && document?.hasFile === false ? (
                  <Button variant="quiet" onClick={() => setAttachmentTarget(row)}>
                    Adjuntar archivo
                  </Button>
                ) : null;
              return evidence === null && attach === null ? null : (
                <div className="admin-row-buttons">
                  {evidence}
                  {attach}
                </div>
              );
            }
          : undefined
      }
    />
  );
}

function CollectionsPage({
  gateway,
  context,
  canMutate,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly canMutate: boolean;
  readonly search: string;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listInvoices(), [gateway]);
  const resource = useResource(loader);
  const optionsLoader = useCallback(
    () => Promise.all([gateway.listTrips(), gateway.loadOptions()]),
    [gateway],
  );
  const options = useResource(optionsLoader);
  const tripId = new URLSearchParams(search).get("viaje");
  const selectedTrip = options.data?.[0].find((trip) => trip.id === tripId);
  const form =
    options.data === null ? null : (
      <div className="admin-form-grid">
        <SimpleForm
          title="Registrar factura"
          submitLabel="Guardar factura"
          onSubmit={async (form) =>
            gateway.createInvoice(context, {
              clientId: textValue(form, "clientId"),
              tripId: textValue(form, "tripId"),
              series: textValue(form, "series"),
              number: textValue(form, "number"),
              issuedOn: textValue(form, "issuedOn"),
              dueOn: optionalText(form, "dueOn"),
              subtotal: numberValue(form, "subtotal"),
              tax: numberValue(form, "tax", 0),
            })
          }
          onSaved={resource.reload}
        >
          <SelectField
            defaultValue={optionDefaultValue(
              options.data[1].clients,
              selectedTrip?.clientId ?? null,
            )}
            label="Cliente"
            name="clientId"
            options={options.data[1].clients}
            required
          />
          <SelectField
            defaultValue={optionDefaultValue(options.data[0].map(toTripOption), tripId)}
            label="Viaje"
            name="tripId"
            options={options.data[0].map(toTripOption)}
            required
          />
          <Field label="Serie" name="series" required />
          <Field label="Número" name="number" required />
          <Field label="Emisión" name="issuedOn" type="date" required />
          <Field label="Vencimiento" name="dueOn" type="date" />
          <Field label="Subtotal" name="subtotal" type="number" min="0" step="0.01" required />
          <Field
            label="IGV / impuesto"
            name="tax"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
          />
        </SimpleForm>
        <SimpleForm
          title="Registrar pago"
          submitLabel="Guardar pago"
          onSubmit={async (form) => {
            const paymentId = crypto.randomUUID();
            await gateway.registerPayment(context, {
              invoiceId: textValue(form, "invoiceId"),
              paidAt: dateTimeValue(form, "paidAt"),
              amount: numberValue(form, "amount"),
              paymentMethod: textValue(form, "paymentMethod"),
              reference: optionalText(form, "reference") ?? "",
              paymentId,
              idempotencyKey: paymentId,
            });
          }}
          onSaved={resource.reload}
        >
          <SelectField
            label="Factura"
            name="invoiceId"
            options={(resource.data ?? []).map(toRowOption)}
            required
          />
          <Field label="Fecha de pago" name="paidAt" type="datetime-local" required />
          <Field label="Monto" name="amount" type="number" min="0.01" step="0.01" required />
          <Field label="Medio" name="paymentMethod" required />
          <Field label="Referencia" name="reference" />
        </SimpleForm>
      </div>
    );
  return (
    <ResourceCrudPage
      title="Cobranza"
      description={pageCopy.collections?.description ?? ""}
      resource={resource}
      emptyCopy="No existen facturas registradas."
      form={
        canMutate && form !== null ? (
          <AdminFormDisclosure
            label="Registrar movimiento de cobranza"
            copy="Emite una factura o aplica un pago solo cuando tengas la referencia confirmada."
          >
            {form}
          </AdminFormDisclosure>
        ) : canMutate ? null : (
          <ReadOnlyNotice />
        )
      }
      listLabel="Facturas y saldos"
      tableKind="finance"
    />
  );
}

function AlertsPage({
  gateway,
  context,
  canMutate,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly canMutate: boolean;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listAlerts(), [gateway]);
  const resource = useResource(loader);
  const [selected, setSelected] = useState<AdminListRow | null>(null);
  return (
    <>
      <PageHeader title="Alertas" description={pageCopy.alerts?.description ?? ""} />
      <PageState resource={resource} emptyCopy="No existen alertas activas.">
        {(rows) => (
          <RecordTable
            rows={rows}
            kind="alerts"
            actions={
              canMutate
                ? (row) => (
                    <Button variant="quiet" onClick={() => setSelected(row)}>
                      Resolver
                    </Button>
                  )
                : undefined
            }
          />
        )}
      </PageState>
      {selected === null ? null : (
        <AdminActionDialog
          title={`Resolver ${selected.title}`}
          copy={selected.description}
          onClose={() => setSelected(null)}
        >
          <SimpleForm
            compact
            title={`Resolver ${selected.title}`}
            submitLabel="Confirmar resolución"
            onSubmit={async (form) =>
              gateway.resolveAlert(context, selected.id, textValue(form, "note"))
            }
            onSaved={() => {
              setSelected(null);
              resource.reload();
            }}
          >
            <Field label="Nota de resolución" name="note" required />
          </SimpleForm>
        </AdminActionDialog>
      )}
    </>
  );
}

interface OperationalSearchResult extends AdminListRow {
  readonly category: string;
  readonly href: string;
  /** The record UUID stays separate from the table key used to render mixed results. */
  readonly sourceId: string;
}

function OperationalSearchPage({
  gateway,
  search,
}: {
  readonly gateway: AdminDataGateway;
  readonly search: string;
}): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams(search);
  const query = searchParams.get("q") ?? "";
  const loader = useCallback(async (): Promise<readonly OperationalSearchResult[]> => {
    const [trips, vehicles, drivers, clients, documents, settlements, maintenance, suppliers] =
      await Promise.all([
        gateway.listTrips(),
        gateway.listVehicles(),
        gateway.listDrivers(),
        gateway.listClients(),
        gateway.listDocuments(),
        gateway.listSettlements(),
        gateway.listMaintenance(),
        gateway.listSuppliers(),
      ]);
    return [
      ...trips.map((row) => operationalSearchResult("Viaje", row, tripSummaryPath(row.id))),
      ...vehicles.map((row) => operationalSearchResult("Unidad", row, vehicleDetailPath(row.id))),
      ...drivers.map((row) => operationalSearchResult("Conductor", row, driverDetailPath(row.id))),
      ...clients.map((row) => operationalSearchResult("Cliente", row, clientDetailPath(row.id))),
      ...suppliers.map((row) => operationalSearchResult("Proveedor", row, routePaths.suppliers)),
      ...documents.map((row) =>
        operationalSearchResult(
          "Documento",
          row,
          row.entityType === "company" || row.entityId === null
            ? routePaths.documents
            : documentsPathForAssociation(row.entityType, row.entityId),
        ),
      ),
      ...settlements.map((row) =>
        operationalSearchResult("Rendición", row, settlementDetailPath(row.id)),
      ),
      ...maintenance.map((row) =>
        operationalSearchResult(
          "Mantenimiento",
          row,
          row.recordType === "work_order"
            ? maintenanceWorkOrderPath(row.id)
            : `${routePaths.maintenance}?unidad=${encodeURIComponent(row.vehicleId)}`,
        ),
      ),
    ];
  }, [gateway]);
  const resource = useResource(loader);
  const results =
    resource.data === null
      ? null
      : resource.data
          .filter((result) => {
            const normalized = query.trim().toLocaleLowerCase("es-PE");
            return (
              normalized === "" ||
              `${result.title} ${result.description} ${result.technicalReference ?? ""} ${result.category}`
                .toLocaleLowerCase("es-PE")
                .includes(normalized)
            );
          })
          .slice(0, 50);
  return (
    <>
      <PageHeader title="Buscar" description={pageCopy.search?.description ?? ""} />
      <section className="admin-card admin-search-card">
        <label className="admin-search-card__field">
          <span>Buscar en la operación</span>
          <input
            autoFocus
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              setOrDeleteSearchParam(next, "q", event.target.value);
              setSearchParams(next, { replace: true });
            }}
            placeholder="Ruta, placa, conductor, cliente, documento o código"
            type="search"
            value={query}
          />
        </label>
        <p className="admin-form-note">
          Los resultados respetan los permisos y el alcance de empresa de tu sesión.
        </p>
      </section>
      {results === null ? (
        <PageState resource={resource} emptyCopy="No hay resultados.">
          {() => null}
        </PageState>
      ) : results.length === 0 ? (
        <AdminNotice
          title={
            query.trim() === "" ? "Escribe qué necesitas encontrar" : "No encontramos coincidencias"
          }
          copy={
            query.trim() === ""
              ? "Puedes buscar una ruta, una placa, un conductor, un cliente, un documento o un código de soporte."
              : "Prueba con menos palabras o con el nombre, la ruta, la placa o el código técnico."
          }
        />
      ) : (
        <section className="admin-card admin-list-card">
          <div className="admin-card__heading">
            <h2>Resultados</h2>
            <span>{results.length}</span>
          </div>
          <RecordTable
            rows={results.map((result) => ({
              ...result,
              description: `${result.category} · ${result.description}`,
            }))}
            actions={(row) => {
              const result = results.find((candidate) => candidate.id === row.id);
              return result === undefined ? null : (
                <Link className="admin-text-link" to={result.href}>
                  Abrir <Icon name="chevron" size={16} />
                </Link>
              );
            }}
          />
        </section>
      )}
    </>
  );
}

function operationalSearchResult(
  category: string,
  row: AdminListRow,
  href: string,
): OperationalSearchResult {
  return {
    ...row,
    id: `${category}:${row.id}`,
    sourceId: row.id,
    category,
    href,
  };
}

function CompanySettingsPage({ company }: { readonly company: CurrentCompany }): React.JSX.Element {
  return (
    <>
      <PageHeader
        title="Empresa"
        description="Identidad empresarial de la sesión. La edición permanece restringida al backend."
      />
      <section className="admin-card admin-company-card">
        <dl>
          <div>
            <dt>Razón social</dt>
            <dd>{company.legalName}</dd>
          </div>
          <div>
            <dt>Nombre comercial</dt>
            <dd>{company.tradeName ?? "No registrado"}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <StatusChip
                label={company.active ? "Activa" : "Inactiva"}
                tone={company.active ? "success" : "risk"}
              />
            </dd>
          </div>
        </dl>
        <p className="admin-muted">
          Esta vista es de solo lectura; no envía cambios de empresa ni acepta un company_id desde
          el navegador.
        </p>
      </section>
    </>
  );
}

function ProfileSettingsPage({
  gateway,
  role,
  canMutate,
}: {
  readonly gateway: AdminDataGateway;
  readonly role: AppRole;
  readonly canMutate: boolean;
}): React.JSX.Element {
  const loader = useCallback(() => gateway.listProfiles(), [gateway]);
  const resource = useResource(loader);
  const driversLoader = useCallback(
    () => (role === "management" ? gateway.listDrivers() : Promise.resolve([])),
    [gateway, role],
  );
  const drivers = useResource(driversLoader);
  const inviteForm =
    role === "management" && canMutate ? (
      <SimpleForm
        title="Invitar usuario"
        submitLabel="Enviar invitación"
        onSubmit={async (form) =>
          gateway.inviteCompanyUser({
            email: textValue(form, "email"),
            displayName: textValue(form, "displayName"),
            role: roleValue(form, "role"),
          })
        }
        onSaved={resource.reload}
      >
        <Field label="Correo electrónico" name="email" type="email" required />
        <Field label="Nombre visible" name="displayName" required />
        <SelectNative
          label="Rol"
          name="role"
          options={["management", "administration", "driver", "accounting"]}
        />
        <p className="admin-form-note">
          La empresa se toma de la sesión. Nunca se solicita una contraseña: la función segura envía
          una invitación.
        </p>
      </SimpleForm>
    ) : (
      <ReadOnlyNotice
        copy={
          role === "management"
            ? "Las invitaciones y vinculaciones requieren conexión."
            : "Administración puede consultar los perfiles de la empresa, pero solo Gerencia puede enviar invitaciones."
        }
      />
    );
  return (
    <>
      <PageHeader title="Perfiles" description="Usuarios y roles de la empresa autenticada." />
      {role === "management" && canMutate ? (
        <AdminFormDisclosure
          label="Administrar accesos"
          copy="Invita usuarios o vincula un perfil Conductor con su registro operativo."
        >
          {inviteForm}
          {resource.data !== null && drivers.data !== null ? (
            <SimpleForm
              title="Vincular conductor"
              submitLabel="Vincular perfil"
              onSubmit={async (form) =>
                gateway.linkDriverProfile({
                  profileId: textValue(form, "profileId"),
                  driverId: textValue(form, "driverId"),
                })
              }
              onSaved={() => {
                resource.reload();
                drivers.reload();
              }}
            >
              <SelectField
                label="Perfil con rol Conductor"
                name="profileId"
                options={resource.data
                  .filter((profile) => profile.role === "driver" && profile.status === "Activo")
                  .map(toRowOption)}
                required
              />
              <SelectField
                label="Registro de conductor"
                name="driverId"
                options={drivers.data
                  .filter((driver) => driver.profileId === null)
                  .map(toRowOption)}
                required
              />
              <p className="admin-form-note">
                Ambos registros se validan contra la empresa de tu sesión. Un perfil solo puede
                vincularse a su conductor empresarial.
              </p>
            </SimpleForm>
          ) : null}
        </AdminFormDisclosure>
      ) : (
        inviteForm
      )}
      <section className="admin-card admin-list-card">
        <div className="admin-card__heading">
          <h2>Usuarios</h2>
          <span>{resource.data?.length ?? 0}</span>
        </div>
        <PageState resource={resource} emptyCopy="No existen perfiles visibles.">
          {(rows) => <RecordTable rows={rows.map(profileToListRow)} kind="profiles" />}
        </PageState>
      </section>
    </>
  );
}

function AdminDetailPage({
  routeId,
  pathname,
  gateway,
  role,
  online,
}: {
  readonly routeId: ProductRouteId;
  readonly pathname: string;
  readonly gateway: AdminDataGateway;
  readonly role: AppRole;
  readonly online: boolean;
}): React.JSX.Element {
  const entityId = detailIdFromPath(routeId, pathname);
  const isTripDetail = isTripDetailRoute(routeId);
  const tripLoader = useCallback(async (): Promise<AdminTripDetail | null> => {
    if (!isTripDetail || entityId === null) return null;
    return gateway.loadTripDetail(entityId);
  }, [entityId, gateway, isTripDetail]);
  const tripResource = useResource(tripLoader);
  const loader = useCallback(async (): Promise<AdminListRow | null> => {
    if (entityId === null || isTripDetail) return null;
    const rows = await loadDetailRows(routeId, gateway);
    return rows.find((row) => row.id === entityId) ?? null;
  }, [entityId, gateway, isTripDetail, routeId]);
  const resource = useResource(loader);
  if (isTripDetail) {
    return (
      <>
        <PageHeader
          title={detailTitle(routeId)}
          description="Datos conectados del viaje consultados con las políticas RLS de tu sesión."
        />
        <PageState
          resource={tripResource}
          emptyCopy="No se encontró el viaje solicitado o no tienes acceso."
        >
          {(detail) => (
            <TripDetailView
              detail={detail}
              gateway={gateway}
              routeId={routeId}
              role={role}
              online={online}
            />
          )}
        </PageState>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title={detailTitle(routeId)}
        description="Detalle de solo lectura consultado con el alcance autorizado de tu empresa."
      />
      <PageState
        resource={resource}
        emptyCopy="No se encontró el registro solicitado o no tienes acceso."
      >
        {(row) => (
          <>
            <section className="admin-card admin-detail-card">
              <div className="admin-card__heading">
                <div>
                  <h2>{row.title}</h2>
                  <p className="admin-muted">{row.description}</p>
                </div>
                <StatusChip label={row.status} tone={toneForStatus(row.status)} />
              </div>
              <dl>
                <div>
                  <dt>Identificador</dt>
                  <dd>{row.id}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{formatDate(row.date)}</dd>
                </div>
                <div>
                  <dt>Monto</dt>
                  <dd>{row.amount === null ? "No aplica" : formatMoney(row.amount)}</dd>
                </div>
                {row.version === undefined ? null : (
                  <div>
                    <dt>Versión</dt>
                    <dd>{row.version}</dd>
                  </div>
                )}
              </dl>
              <p className="admin-muted">
                Para volver, utiliza la navegación principal o el botón Atrás del navegador.
              </p>
            </section>
            {routeId === "vehicleDetail" ? (
              <GpsContextCard vehicleId={entityId} role={role} online={online} />
            ) : null}
          </>
        )}
      </PageState>
    </>
  );
}

function ClientDetailPage({
  clientId,
  gateway,
  canMutate,
}: {
  readonly clientId: string | null;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
}): React.JSX.Element {
  const loader = useCallback(async (): Promise<AdminClientDetail | null> => {
    if (clientId === null) return null;
    return gateway.loadClientDetail(clientId);
  }, [clientId, gateway]);
  const resource = useResource(loader);
  return (
    <>
      <PageHeader title="Cliente" description="Datos comerciales, viajes, facturas y documentos." />
      <PageState
        resource={resource}
        emptyCopy="No se encontró el cliente solicitado o no tienes acceso."
      >
        {(detail) => (
          <ClientDetailView
            canMutate={canMutate}
            detail={detail}
            gateway={gateway}
            onChanged={resource.reload}
          />
        )}
      </PageState>
    </>
  );
}

function ClientDetailView({
  detail,
  gateway,
  canMutate,
  onChanged,
}: {
  readonly detail: AdminClientDetail;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly onChanged: () => void;
}): React.JSX.Element {
  const client = detail.client;
  return (
    <div className="admin-master-detail">
      <section className="admin-card admin-detail-card">
        <div className="admin-card__heading">
          <div>
            <p className="admin-section-kicker">Cliente</p>
            <h2>{client.title}</h2>
            <p className="admin-muted">{client.description}</p>
          </div>
          <StatusChip label={labelStatusForUi(client.status)} tone={toneForStatus(client.status)} />
        </div>
        <dl>
          <DetailTerm label="Razón social" value={detail.legalName} />
          <DetailTerm label="RUC o DNI" value={detail.taxId ?? "No registrado"} />
          <DetailTerm label="Teléfono" value={detail.phone ?? "No registrado"} />
          <DetailTerm label="Dirección" value={detail.address ?? "No registrada"} />
          <DetailTerm label="Condición de pago" value={`${detail.paymentTermsDays} día(s)`} />
          <DetailTerm label="Relación" value={relationshipTypeLabel(detail.relationshipType)} />
        </dl>
        {detail.notes === null ? null : <p className="admin-detail-note">{detail.notes}</p>}
        <div className="admin-vehicle-actions" aria-label={`Acciones para ${client.title}`}>
          <Link
            className="admin-text-link"
            to={`${routePaths.newTrip}?cliente=${encodeURIComponent(client.id)}`}
          >
            Crear viaje <Icon name="chevron" size={16} />
          </Link>
          <Link
            className="admin-text-link"
            to={`${routePaths.collections}?cliente=${encodeURIComponent(client.id)}`}
          >
            Ver cobranza <Icon name="chevron" size={16} />
          </Link>
          <Link className="admin-text-link" to={documentsPathForAssociation("client", client.id)}>
            Revisar documentos <Icon name="chevron" size={16} />
          </Link>
        </div>
      </section>
      {canMutate ? (
        <AdminFormDisclosure
          label="Editar datos"
          copy="Actualiza solo información comercial confirmada."
        >
          <SimpleForm
            title={`Editar ${client.title}`}
            submitLabel="Guardar cambios"
            onSubmit={async (form) =>
              gateway.updateClientMaster({
                id: client.id,
                expectedUpdatedAt: requiredUpdatedAt(client),
                legalName: textValue(form, "legalName"),
                tradeName: optionalText(form, "tradeName"),
                taxId: optionalText(form, "taxId"),
                phone: optionalText(form, "phone"),
                address: optionalText(form, "address"),
                paymentTermsDays: numberValue(form, "paymentTermsDays", 0),
                relationshipType: relationshipTypeValue(form, "relationshipType"),
                active: booleanValue(form, "active"),
                notes: optionalText(form, "notes"),
              })
            }
            onSaved={onChanged}
          >
            <Field defaultValue={detail.legalName} label="Razón social" name="legalName" required />
            <Field
              defaultValue={detail.tradeName ?? ""}
              label="Nombre comercial"
              name="tradeName"
            />
            <Field defaultValue={detail.taxId ?? ""} label="RUC o DNI" name="taxId" />
            <Field defaultValue={detail.phone ?? ""} label="Teléfono" name="phone" type="tel" />
            <Field defaultValue={detail.address ?? ""} label="Dirección" name="address" />
            <Field
              defaultValue={String(detail.paymentTermsDays)}
              label="Días de pago"
              min="0"
              name="paymentTermsDays"
              required
              type="number"
            />
            <SelectField
              defaultValue={detail.relationshipType ?? undefined}
              label="Relación"
              name="relationshipType"
              options={clientRelationshipOptions}
            />
            <TextareaField defaultValue={detail.notes ?? ""} label="Notas" name="notes" />
            <CheckboxField defaultChecked={detail.active} label="Cliente activo" name="active" />
          </SimpleForm>
        </AdminFormDisclosure>
      ) : null}
      <VehicleDetailSection
        title="Viajes"
        emptyCopy="Todavía no hay viajes asociados a este cliente."
        rows={detail.trips}
        action={(row) => (
          <Link className="admin-text-link" to={tripSummaryPath(row.id)}>
            Ver viaje <Icon name="chevron" size={16} />
          </Link>
        )}
      />
      <VehicleDetailSection
        title="Facturas y saldo"
        emptyCopy="No hay facturas visibles para este cliente."
        rows={detail.invoices}
        action={() => (
          <Link
            className="admin-text-link"
            to={`${routePaths.collections}?cliente=${encodeURIComponent(client.id)}`}
          >
            Ver cobranza <Icon name="chevron" size={16} />
          </Link>
        )}
      />
      <VehicleDetailSection
        title="Documentos"
        emptyCopy="No hay documentos asociados a este cliente."
        rows={detail.documents}
        action={() => (
          <Link className="admin-text-link" to={documentsPathForAssociation("client", client.id)}>
            Gestionar documentos <Icon name="chevron" size={16} />
          </Link>
        )}
      />
    </div>
  );
}

function DriverDetailPage({
  driverId,
  gateway,
  canMutate,
}: {
  readonly driverId: string | null;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
}): React.JSX.Element {
  const loader = useCallback(async (): Promise<AdminDriverDetail | null> => {
    if (driverId === null) return null;
    return gateway.loadDriverDetail(driverId);
  }, [driverId, gateway]);
  const detail = useResource(loader);
  const options = useResource(useCallback(() => gateway.loadOptions(), [gateway]));
  return (
    <>
      <PageHeader
        title="Conductor"
        description="Disponibilidad, viajes y documentos del equipo de conducción."
      />
      <PageState
        resource={detail}
        emptyCopy="No se encontró el conductor solicitado o no tienes acceso."
      >
        {(data) => (
          <DriverDetailView
            canMutate={canMutate}
            detail={data}
            gateway={gateway}
            options={options.data}
            onChanged={detail.reload}
          />
        )}
      </PageState>
    </>
  );
}

function DriverDetailView({
  detail,
  gateway,
  options,
  canMutate,
  onChanged,
}: {
  readonly detail: AdminDriverDetail;
  readonly gateway: AdminDataGateway;
  readonly options: Awaited<ReturnType<AdminDataGateway["loadOptions"]>> | null;
  readonly canMutate: boolean;
  readonly onChanged: () => void;
}): React.JSX.Element {
  const driver = detail.driver;
  return (
    <div className="admin-master-detail">
      <section className="admin-card admin-detail-card">
        <div className="admin-card__heading">
          <div>
            <p className="admin-section-kicker">Conductor</p>
            <h2>{driver.title}</h2>
            <p className="admin-muted">{driver.description}</p>
          </div>
          <StatusChip label={labelStatusForUi(driver.status)} tone={toneForStatus(driver.status)} />
        </div>
        <dl>
          <DetailTerm label="Documento" value={detail.documentType ?? "No registrado"} />
          <DetailTerm label="Número" value={driver.documentNumber ?? "No registrado"} />
          <DetailTerm label="Teléfono" value={driver.phone ?? "No registrado"} />
          <DetailTerm label="Licencia" value={detail.licenseNumber ?? "No registrada"} />
          <DetailTerm label="Vence licencia" value={formatDate(detail.licenseExpiresOn)} />
          <DetailTerm label="Unidad habitual" value={detail.usualVehiclePlate ?? "No asignada"} />
        </dl>
        <div className="admin-vehicle-actions" aria-label={`Acciones para ${driver.title}`}>
          {detail.activeTrip === null ? null : (
            <Link className="admin-text-link" to={tripSummaryPath(detail.activeTrip.id)}>
              Ver viaje actual <Icon name="chevron" size={16} />
            </Link>
          )}
          <Link className="admin-text-link" to={documentsPathForAssociation("driver", driver.id)}>
            Revisar documentos <Icon name="chevron" size={16} />
          </Link>
          <Link
            className="admin-text-link"
            to={`${routePaths.settlements}?conductor=${encodeURIComponent(driver.id)}`}
          >
            Ver rendiciones <Icon name="chevron" size={16} />
          </Link>
        </div>
      </section>
      {canMutate ? (
        <div className="admin-master-detail__forms">
          <AdminFormDisclosure
            label="Cambiar disponibilidad"
            copy="Solo puedes declarar disponibilidad cuando no tiene un viaje activo."
          >
            <SimpleForm
              title={`Disponibilidad de ${driver.title}`}
              submitLabel="Guardar disponibilidad"
              onSubmit={async (form) =>
                gateway.setDriverAvailability({
                  id: driver.id,
                  expectedUpdatedAt: requiredUpdatedAt(driver),
                  status: driverAvailabilityValue(form, "availabilityStatus"),
                  reason: optionalText(form, "availabilityReason"),
                })
              }
              onSaved={onChanged}
            >
              <SelectField
                label="Estado"
                name="availabilityStatus"
                options={driverAvailabilityOptions}
                required
              />
              <TextareaField
                label="Motivo (obligatorio excepto Disponible)"
                name="availabilityReason"
              />
            </SimpleForm>
          </AdminFormDisclosure>
          <AdminFormDisclosure
            label="Editar datos"
            copy="Los estados asignado y en viaje los controla el sistema."
          >
            <SimpleForm
              title={`Editar ${driver.title}`}
              submitLabel="Guardar cambios"
              onSubmit={async (form) =>
                gateway.updateDriverMaster({
                  id: driver.id,
                  expectedUpdatedAt: requiredUpdatedAt(driver),
                  displayName: textValue(form, "displayName"),
                  documentType: optionalText(form, "documentType"),
                  documentNumber: optionalText(form, "documentNumber"),
                  phone: optionalText(form, "phone"),
                  licenseNumber: optionalText(form, "licenseNumber"),
                  licenseExpiresOn: optionalText(form, "licenseExpiresOn"),
                  contractType: optionalText(form, "contractType"),
                  contractStartedOn: optionalText(form, "contractStartedOn"),
                  contractEndedOn: optionalText(form, "contractEndedOn"),
                  usualVehicleId: optionalText(form, "usualVehicleId"),
                  active: booleanValue(form, "active"),
                  notes: optionalText(form, "notes"),
                })
              }
              onSaved={onChanged}
            >
              <Field
                defaultValue={driver.title}
                label="Nombre completo"
                name="displayName"
                required
              />
              <Field
                defaultValue={detail.documentType ?? ""}
                label="Tipo de documento"
                name="documentType"
              />
              <Field
                defaultValue={driver.documentNumber ?? ""}
                label="Número de documento"
                name="documentNumber"
              />
              <Field defaultValue={driver.phone ?? ""} label="Teléfono" name="phone" type="tel" />
              <Field
                defaultValue={detail.licenseNumber ?? ""}
                label="Licencia"
                name="licenseNumber"
              />
              <Field
                defaultValue={detail.licenseExpiresOn ?? ""}
                label="Vencimiento de licencia"
                name="licenseExpiresOn"
                type="date"
              />
              <Field
                defaultValue={detail.contractType ?? ""}
                label="Tipo de contrato"
                name="contractType"
              />
              <Field
                defaultValue={detail.contractStartedOn ?? ""}
                label="Inicio de contrato"
                name="contractStartedOn"
                type="date"
              />
              <Field
                defaultValue={detail.contractEndedOn ?? ""}
                label="Fin de contrato"
                name="contractEndedOn"
                type="date"
              />
              <SelectField
                defaultValue={detail.usualVehicleId ?? undefined}
                label="Unidad habitual"
                name="usualVehicleId"
                options={options?.vehicles ?? []}
              />
              <TextareaField defaultValue={detail.notes ?? ""} label="Notas" name="notes" />
              <CheckboxField
                defaultChecked={driver.active}
                label="Conductor activo"
                name="active"
              />
            </SimpleForm>
          </AdminFormDisclosure>
        </div>
      ) : null}
      {detail.activeTrip === null ? null : (
        <VehicleDetailSection
          title="Viaje actual"
          emptyCopy=""
          rows={[detail.activeTrip]}
          action={(row) => (
            <Link className="admin-text-link" to={tripSummaryPath(row.id)}>
              Abrir expediente <Icon name="chevron" size={16} />
            </Link>
          )}
        />
      )}
      <VehicleDetailSection
        title="Viajes recientes"
        emptyCopy="No hay viajes recientes asociados a este conductor."
        rows={detail.recentTrips}
        action={(row) => (
          <Link className="admin-text-link" to={tripSummaryPath(row.id)}>
            Ver viaje <Icon name="chevron" size={16} />
          </Link>
        )}
      />
      <VehicleDetailSection
        title="Rendiciones"
        emptyCopy="No hay rendiciones visibles."
        rows={detail.settlements}
      />
      <VehicleDetailSection
        title="Incidencias"
        emptyCopy="No hay incidencias asociadas."
        rows={detail.incidents}
      />
      <VehicleDetailSection
        title="Documentos"
        emptyCopy="No hay documentos asociados a este conductor."
        rows={detail.documents}
        action={() => (
          <Link className="admin-text-link" to={documentsPathForAssociation("driver", driver.id)}>
            Gestionar documentos <Icon name="chevron" size={16} />
          </Link>
        )}
      />
    </div>
  );
}

function SettlementDetailPage({
  settlementId,
  gateway,
  canMutate,
  role,
}: {
  readonly settlementId: string | null;
  readonly gateway: AdminDataGateway;
  readonly canMutate: boolean;
  readonly role: AppRole;
}): React.JSX.Element {
  const loader = useCallback(async (): Promise<AdminSettlementDetail | null> => {
    if (settlementId === null) return null;
    return gateway.loadSettlementDetail(settlementId);
  }, [gateway, settlementId]);
  const resource = useResource(loader);
  const [operation, setOperation] = useState<"close" | "reopen" | null>(null);
  return (
    <>
      <PageHeader
        title="Rendición"
        description="Adelantos, gastos, saldo y cierre auditado del viaje."
      />
      <PageState
        resource={resource}
        emptyCopy="No se encontró la rendición solicitada o no tienes acceso."
      >
        {(detail) => (
          <div className="admin-master-detail">
            <section className="admin-card admin-detail-card">
              <div className="admin-card__heading">
                <div>
                  <p className="admin-section-kicker">Rendición de viaje</p>
                  <h2>{detail.settlement.title}</h2>
                  <p className="admin-muted">{detail.settlement.description}</p>
                  {detail.settlement.technicalReference === undefined ? null : (
                    <p className="technical-value">{detail.settlement.technicalReference}</p>
                  )}
                </div>
                <StatusChip
                  label={labelStatusForUi(detail.settlement.status)}
                  tone={toneForStatus(detail.settlement.status)}
                />
              </div>
              <dl>
                <DetailTerm label="Adelantos" value={formatMoney(detail.totalAdvances)} />
                <DetailTerm label="Gastos" value={formatMoney(detail.totalExpenses)} />
                <DetailTerm
                  label={settlementDirectionCopy(detail.balance)}
                  value={formatMoney(Math.abs(detail.balance))}
                />
                <DetailTerm label="Conductor" value={detail.driverName ?? "No registrado"} />
                <DetailTerm label="Fecha" value={formatDate(detail.settlement.date)} />
              </dl>
              <div className="admin-vehicle-actions">
                {detail.trip === null ? null : (
                  <Link className="admin-text-link" to={tripSummaryPath(detail.trip.id)}>
                    Ver viaje <Icon name="chevron" size={16} />
                  </Link>
                )}
                {detail.trip === null ? null : (
                  <Link
                    className="admin-text-link"
                    to={`${routePaths.expenses}?viaje=${encodeURIComponent(detail.trip.id)}`}
                  >
                    Revisar gastos <Icon name="chevron" size={16} />
                  </Link>
                )}
                {canMutate && detail.canClose ? (
                  <Button onClick={() => setOperation("close")}>
                    Conciliar y cerrar rendición
                  </Button>
                ) : null}
                {canMutate &&
                role === "management" &&
                isClosedSettlement(detail.settlement.status) ? (
                  <Button onClick={() => setOperation("reopen")} variant="quiet">
                    Reabrir con motivo
                  </Button>
                ) : null}
              </div>
              {detail.blockingExpenses.length === 0 ? null : (
                <p className="admin-readonly" role="note">
                  Hay {detail.blockingExpenses.length} gasto(s) pendiente(s) u observado(s).
                  Revísalos antes de cerrar.
                </p>
              )}
            </section>
            <VehicleDetailSection
              title="Adelantos"
              emptyCopy="No hay adelantos asociados."
              rows={detail.advances}
            />
            <VehicleDetailSection
              title="Gastos"
              emptyCopy="No hay gastos asociados."
              rows={detail.expenses}
              action={
                detail.trip === null
                  ? undefined
                  : () => (
                      <Link
                        className="admin-text-link"
                        to={`${routePaths.expenses}?viaje=${encodeURIComponent(detail.trip!.id)}`}
                      >
                        Revisar gasto <Icon name="chevron" size={16} />
                      </Link>
                    )
              }
            />
            {operation === null ? null : (
              <AdminActionDialog
                title={operation === "close" ? "Conciliar y cerrar rendición" : "Reabrir rendición"}
                copy={detail.settlement.title}
                onClose={() => setOperation(null)}
              >
                {operation === "close" ? (
                  <SettlementCloseForm
                    detail={detail}
                    gateway={gateway}
                    onSaved={() => {
                      setOperation(null);
                      resource.reload();
                    }}
                  />
                ) : (
                  <SimpleForm
                    compact
                    title="Reabrir rendición"
                    submitLabel="Reabrir rendición"
                    onSubmit={(form) =>
                      gateway.reopenSettlement({
                        settlementId: detail.settlement.id,
                        reason: textValue(form, "reason"),
                      })
                    }
                    onSaved={() => {
                      setOperation(null);
                      resource.reload();
                    }}
                  >
                    <TextareaField label="Motivo auditado" name="reason" required />
                  </SimpleForm>
                )}
              </AdminActionDialog>
            )}
          </div>
        )}
      </PageState>
    </>
  );
}

function SettlementCloseForm({
  detail,
  gateway,
  onSaved,
}: {
  readonly detail: AdminSettlementDetail;
  readonly gateway: AdminDataGateway;
  readonly onSaved: () => void;
}): React.JSX.Element {
  const isZero = Math.abs(detail.balance) < 0.005;
  return (
    <SimpleForm
      compact
      title="Confirmar cierre"
      submitLabel="Conciliar y cerrar rendición"
      onSubmit={(form) => gateway.closeSettlement(settlementCloseInput(detail.settlement, form))}
      onSaved={onSaved}
    >
      {isZero ? (
        <p className="admin-form-note">
          El saldo es S/ 0.00. El servidor registrará el cierre automático sin medio ni referencia.
        </p>
      ) : (
        <>
          <p className="admin-form-note">
            {settlementDirectionCopy(detail.balance)} {formatMoney(Math.abs(detail.balance))}.
            Indica el medio y la referencia para dejar trazabilidad.
          </p>
          <Field label="Medio de regularización" name="resolutionMethod" required />
          <Field label="Referencia o comprobante" name="resolutionReference" required />
          <TextareaField label="Nota (opcional)" name="resolutionNote" />
        </>
      )}
    </SimpleForm>
  );
}

function VehicleDetailPage({
  vehicleId,
  gateway,
  role,
  online,
  canMutate,
}: {
  readonly vehicleId: string | null;
  readonly gateway: AdminDataGateway;
  readonly role: AppRole;
  readonly online: boolean;
  readonly canMutate: boolean;
}): React.JSX.Element {
  const loader = useCallback(async (): Promise<AdminVehicleDetail | null> => {
    if (vehicleId === null) return null;
    return gateway.loadVehicleDetail(vehicleId);
  }, [gateway, vehicleId]);
  const resource = useResource(loader);
  return (
    <>
      <PageHeader
        title="Unidad"
        description="Situación operativa, historial y accesos de la unidad."
      />
      <PageState
        resource={resource}
        emptyCopy="No se encontró la unidad solicitada o no tienes acceso."
      >
        {(detail) => (
          <VehicleDetailView
            detail={detail}
            gateway={gateway}
            role={role}
            online={online}
            canMutate={canMutate}
            onChanged={resource.reload}
          />
        )}
      </PageState>
    </>
  );
}

function VehicleDetailView({
  detail,
  gateway,
  role,
  online,
  canMutate,
  onChanged,
}: {
  readonly detail: AdminVehicleDetail;
  readonly gateway: AdminDataGateway;
  readonly role: AppRole;
  readonly online: boolean;
  readonly canMutate: boolean;
  readonly onChanged: () => void;
}): React.JSX.Element {
  const { vehicle } = detail;
  const requiresConnection = detail.source === "local";
  return (
    <div className="admin-vehicle-detail">
      <section className="admin-card admin-vehicle-hero">
        <div>
          <p className="admin-section-kicker">Unidad operativa</p>
          <h2 className="technical-value">{vehicle.title}</h2>
          <p>{vehicle.description}</p>
        </div>
        <StatusChip label={labelStatusForUi(vehicle.status)} tone={toneForStatus(vehicle.status)} />
        <dl className="admin-vehicle-facts">
          <div>
            <dt>Odómetro oficial</dt>
            <dd>{formatNumberForUi(vehicle.currentOdometerKm)} km</dd>
          </div>
          <div>
            <dt>Modelo</dt>
            <dd>
              {[vehicle.make, vehicle.model, vehicle.modelYear].filter(Boolean).join(" · ") ||
                "Sin dato registrado"}
            </dd>
          </div>
          <div>
            <dt>Capacidad</dt>
            <dd>
              {vehicle.capacityTons === null
                ? "Sin dato registrado"
                : `${formatNumberForUi(vehicle.capacityTons)} t`}
            </dd>
          </div>
        </dl>
        <div className="admin-vehicle-actions" aria-label={`Acciones para ${vehicle.title}`}>
          {detail.activeTrip === null ? (
            <Link className="admin-text-link" to={routePaths.newTrip}>
              Crear viaje <Icon name="chevron" size={16} />
            </Link>
          ) : (
            <Link className="admin-text-link" to={tripSummaryPath(detail.activeTrip.id)}>
              Ver viaje actual <Icon name="chevron" size={16} />
            </Link>
          )}
          {canMutate && online ? (
            <Link className="admin-text-link" to={maintenancePathForVehicle(vehicle.id, true)}>
              Nueva orden <Icon name="chevron" size={16} />
            </Link>
          ) : null}
          {online ? (
            <Link className="admin-text-link" to={maintenancePathForVehicle(vehicle.id, false)}>
              Ver mantenimiento <Icon name="chevron" size={16} />
            </Link>
          ) : null}
          {online ? (
            <Link
              className="admin-text-link"
              to={documentsPathForAssociation("vehicle", vehicle.id)}
            >
              Revisar documentos <Icon name="chevron" size={16} />
            </Link>
          ) : null}
        </div>
      </section>
      {canMutate && online ? (
        <AdminFormDisclosure
          label="Editar datos"
          copy="Actualiza marca, modelo, capacidad y datos administrativos. El odómetro y el estado operativo los controla el sistema."
        >
          <SimpleForm
            title={`Editar ${vehicle.title}`}
            submitLabel="Guardar cambios"
            onSubmit={(form) =>
              gateway.updateVehicleMaster({
                id: vehicle.id,
                expectedUpdatedAt: requiredUpdatedAt(vehicle),
                plate: textValue(form, "plate"),
                make: optionalText(form, "make"),
                model: optionalText(form, "model"),
                modelYear: nullableNumber(form, "modelYear"),
                capacityTons: nullableNumber(form, "capacityTons"),
                ownershipType: ownershipTypeValue(form, "ownershipType"),
                ownerName: optionalText(form, "ownerName"),
                active: booleanValue(form, "active"),
                notes: optionalText(form, "notes"),
              })
            }
            onSaved={onChanged}
          >
            <Field defaultValue={vehicle.title} label="Placa" name="plate" required />
            <Field defaultValue={vehicle.make ?? ""} label="Marca" name="make" />
            <Field defaultValue={vehicle.model ?? ""} label="Modelo" name="model" />
            <Field
              defaultValue={vehicle.modelYear === null ? "" : String(vehicle.modelYear)}
              label="Año"
              min="1900"
              name="modelYear"
              type="number"
            />
            <Field
              defaultValue={vehicle.capacityTons === null ? "" : String(vehicle.capacityTons)}
              label="Capacidad (t)"
              min="0.001"
              name="capacityTons"
              step="0.001"
              type="number"
            />
            <SelectField
              defaultValue={vehicle.ownershipType ?? undefined}
              label="Propiedad"
              name="ownershipType"
              options={vehicleOwnershipOptions}
            />
            <Field defaultValue={vehicle.ownerName ?? ""} label="Propietario" name="ownerName" />
            <TextareaField defaultValue={vehicle.notes ?? ""} label="Notas" name="notes" />
            <CheckboxField defaultChecked={vehicle.active} label="Unidad activa" name="active" />
          </SimpleForm>
        </AdminFormDisclosure>
      ) : null}
      {requiresConnection ? (
        <ReadOnlyNotice copy="Esta ficha proviene de la copia local. Mantenimiento, documentos, alertas y GPS se confirmarán al recuperar conexión." />
      ) : null}
      {detail.activeTrip === null ? null : (
        <section className="admin-card">
          <div className="admin-card__heading">
            <div>
              <p className="admin-section-kicker">En operación</p>
              <h2>Viaje actual</h2>
            </div>
          </div>
          <p className="admin-vehicle-current-trip">
            <strong>
              {detail.activeTrip.origin} → {detail.activeTrip.destination}
            </strong>
            <span>
              {detail.activeTrip.title} · {detail.activeTrip.driverName ?? "Conductor sin dato"}
            </span>
          </p>
        </section>
      )}
      <VehicleDetailSection
        title="Viajes recientes"
        emptyCopy="No hay viajes asociados a esta unidad."
        rows={detail.recentTrips}
        action={(row) => (
          <Link className="admin-text-link" to={tripSummaryPath(row.id)}>
            Ver resumen <Icon name="chevron" size={16} />
          </Link>
        )}
      />
      <VehicleDetailSection
        title="Lecturas de odómetro"
        emptyCopy="No hay lecturas disponibles para esta unidad."
        rows={detail.odometerEntries}
      />
      {detail.unavailableSections.includes("maintenance") ? null : (
        <VehicleDetailSection
          title="Mantenimiento"
          emptyCopy="No hay planes u órdenes asociadas."
          rows={detail.maintenance}
          action={(row) => {
            const maintenance = row as AdminMaintenanceRow;
            const isWorkOrder = maintenance.recordType === "work_order";
            return (
              <Link
                className="admin-text-link"
                to={
                  isWorkOrder
                    ? maintenanceWorkOrderPath(row.id)
                    : maintenancePathForVehicle(vehicle.id, false)
                }
              >
                {isWorkOrder ? "Ver orden" : "Ver mantenimiento"} <Icon name="chevron" size={16} />
              </Link>
            );
          }}
        />
      )}
      {detail.unavailableSections.includes("documents") ? null : (
        <VehicleDetailSection
          title="Documentos"
          emptyCopy="No hay documentos asociados a esta unidad."
          rows={detail.documents}
          action={(row) => {
            const document = row as AdminDocumentRow;
            return (
              <div className="admin-row-buttons">
                {document.fileId === undefined ? null : (
                  <PrivateEvidenceAction
                    fileId={document.fileId}
                    gateway={gateway}
                    label="Ver archivo"
                    online={online}
                  />
                )}
                <Link
                  className="admin-text-link"
                  to={documentsPathForAssociation("vehicle", vehicle.id)}
                >
                  Gestionar
                </Link>
              </div>
            );
          }}
        />
      )}
      {detail.unavailableSections.includes("alerts") ? null : (
        <VehicleDetailSection
          title="Alertas de unidad"
          emptyCopy="No hay alertas activas asociadas."
          rows={detail.alerts}
          action={() => (
            <Link className="admin-text-link" to={routePaths.alerts}>
              Ver alertas <Icon name="chevron" size={16} />
            </Link>
          )}
        />
      )}
      {detail.unavailableSections.includes("gps") || !online ? null : (
        <GpsContextCard vehicleId={vehicle.id} role={role} online={online} />
      )}
    </div>
  );
}

function VehicleDetailSection({
  title,
  emptyCopy,
  rows,
  action,
}: {
  readonly title: string;
  readonly emptyCopy: string;
  readonly rows: readonly AdminListRow[];
  readonly action?: ((row: AdminListRow) => ReactNode) | undefined;
}): React.JSX.Element {
  return (
    <section className="admin-card admin-vehicle-section">
      <div className="admin-card__heading">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="admin-empty-copy">{emptyCopy}</p>
      ) : (
        <RecordTable rows={rows} actions={action} />
      )}
    </section>
  );
}

function TripDetailView({
  detail,
  gateway,
  routeId,
  role,
  online,
}: {
  readonly detail: AdminTripDetail;
  readonly gateway: AdminDataGateway;
  readonly routeId: ProductRouteId;
  readonly role: AppRole;
  readonly online: boolean;
}): React.JSX.Element {
  const allTabs = routeId === "tripSummary";
  const evidenceAccess = { evidenceGateway: gateway, online };
  const routeTitle = `${detail.trip.origin} → ${detail.trip.destination}`;
  return (
    <div className="admin-trip-detail">
      <section className="admin-card admin-detail-card">
        <div className="admin-card__heading">
          <div>
            <p className="admin-section-kicker">Expediente del viaje</p>
            <h2>{routeTitle}</h2>
            <p className="technical-value">{detail.trip.code}</p>
          </div>
          <StatusChip
            label={labelStatusForUi(detail.trip.operationalStatus)}
            tone={toneForStatus(detail.trip.operationalStatus)}
          />
        </div>
        <dl>
          <DetailTerm label="Cliente" value={detail.clientName ?? "No asignado"} />
          <DetailTerm label="Unidad" value={detail.vehiclePlate ?? "No asignada"} />
          <DetailTerm label="Conductor" value={detail.driverName ?? "No asignado"} />
          <DetailTerm label="Programado" value={formatDate(detail.trip.scheduledAt)} />
          <DetailTerm
            label="Flete"
            value={
              detail.trip.freightPricingMode === "per_ton" && detail.trip.freightRatePerTon !== null
                ? `${formatMoney(detail.trip.freightAmount)} · ${formatDecimal(detail.trip.freightRatePerTon, 4)} por t`
                : formatMoney(detail.trip.freightAmount)
            }
          />
          <DetailTerm
            label="Estado administrativo"
            value={labelStatusForUi(detail.trip.administrativeStatus)}
            hint="Indica si el expediente requiere una gestión interna antes del cierre."
          />
          <DetailTerm
            label="Estado financiero"
            value={labelStatusForUi(detail.trip.financialStatus)}
            hint="Indica si el servicio ya fue facturado o qué falta para registrar el cobro."
          />
        </dl>
      </section>
      <TripDetailNavigation current={routeId} tripId={detail.trip.id} />
      <TripDetailActions detail={detail} />
      {detail.vehicleId === null ? null : (
        <GpsContextCard vehicleId={detail.vehicleId} role={role} online={online} />
      )}
      {detail.source === "local" ? (
        <ReadOnlyNotice copy="Detalle desde la copia local: odómetro, combustible, gastos, incidencias y rendición están disponibles. Los apartados no sincronizados se indican y requieren conexión." />
      ) : null}

      {allTabs || routeId === "tripOperation" ? (
        <>
          <TripMetricGrid detail={detail} />
          <TripListSection
            title="Carga"
            rows={detail.loads}
            kind="operations"
            emptyCopy={tripSectionEmptyCopy(detail, "loads", "No hay carga registrada.")}
            {...evidenceAccess}
          />
          <TripListSection
            title="Lecturas de odómetro"
            rows={detail.odometerEntries}
            kind="operations"
            emptyCopy="No hay lecturas registradas."
            {...evidenceAccess}
          />
          <TripListSection
            title="Combustible"
            rows={detail.fuelEntries}
            kind="fuel"
            emptyCopy="No hay abastecimientos registrados."
            {...evidenceAccess}
          />
        </>
      ) : null}

      {allTabs || routeId === "tripMoney" ? (
        <>
          {detail.unavailableSections.includes("financials") ? (
            <AdminNotice
              title="Resumen financiero no disponible sin conexión"
              copy="La copia local no incluye todos los importes ni el estado de validación necesario para calcular el margen sin inventar resultados."
            />
          ) : (
            <>
              <section className="admin-trip-financials" aria-label="Margen directo del viaje">
                <Kpi
                  label="Ingreso del servicio"
                  value={formatMoney(detail.financials.serviceIncome)}
                />
                <Kpi
                  label="Combustible validado"
                  value={formatMoney(detail.financials.validatedFuelCost)}
                />
                <Kpi
                  label="Otros gastos aprobados"
                  value={formatMoney(detail.financials.approvedExpenseCost)}
                />
                <Kpi label="Margen directo" value={formatMoney(detail.financials.directMargin)} />
              </section>
              <p className="admin-calculation-note">
                Margen directo = ingreso del servicio − combustible validado − otros gastos
                aprobados. No equivale a utilidad neta.{" "}
                {detail.financials.pendingCostRecords > 0
                  ? `${detail.financials.pendingCostRecords} registro(s) de costo aún no validado(s) no se incluyeron.`
                  : "Todos los costos registrados están validados."}
              </p>
            </>
          )}
          <TripListSection
            title="Adelantos"
            rows={detail.advances}
            kind="finance"
            emptyCopy={tripSectionEmptyCopy(detail, "advances", "No hay adelantos registrados.")}
            {...evidenceAccess}
          />
          <TripListSection
            title="Gastos y comprobantes"
            rows={detail.expenses}
            kind="finance"
            emptyCopy="No hay gastos registrados."
            {...evidenceAccess}
          />
          <SettlementCard detail={detail} />
          <TripListSection
            title="Facturas"
            rows={detail.invoices}
            kind="finance"
            emptyCopy={tripSectionEmptyCopy(detail, "invoices", "No hay facturas registradas.")}
            {...evidenceAccess}
          />
          <TripListSection
            title={
              detail.unavailableSections.includes("payments")
                ? "Pagos aplicados"
                : `Pagos aplicados · ${formatMoney(detail.financials.collectedAmount)}`
            }
            rows={detail.payments}
            kind="finance"
            emptyCopy={tripSectionEmptyCopy(detail, "payments", "No hay pagos registrados.")}
            {...evidenceAccess}
          />
        </>
      ) : null}

      {allTabs || routeId === "tripDocuments" ? (
        <TripListSection
          title="Documentos"
          rows={detail.documents}
          kind="documents"
          emptyCopy={tripSectionEmptyCopy(
            detail,
            "documents",
            "No hay documentos asociados al viaje.",
          )}
          {...evidenceAccess}
        />
      ) : null}
      {allTabs || routeId === "tripIncidents" ? (
        <TripListSection
          title="Incidentes"
          rows={detail.incidents}
          kind="alerts"
          emptyCopy="No hay incidencias asociadas al viaje."
          {...evidenceAccess}
        />
      ) : null}
      {allTabs || routeId === "tripHistory" ? (
        <TripListSection
          title="Historial de estados"
          rows={detail.events}
          kind="operations"
          emptyCopy={tripSectionEmptyCopy(detail, "events", "No hay eventos registrados.")}
          {...evidenceAccess}
        />
      ) : null}
    </div>
  );
}

function TripDetailNavigation({
  tripId,
  current,
}: {
  readonly tripId: string;
  readonly current: ProductRouteId;
}): React.JSX.Element {
  const tabs: readonly {
    readonly id:
      | "tripSummary"
      | "tripOperation"
      | "tripMoney"
      | "tripDocuments"
      | "tripIncidents"
      | "tripHistory";
    readonly label: string;
  }[] = [
    { id: "tripSummary", label: "Resumen" },
    { id: "tripOperation", label: "Operación" },
    { id: "tripMoney", label: "Dinero" },
    { id: "tripDocuments", label: "Documentos" },
    { id: "tripIncidents", label: "Incidencias" },
    { id: "tripHistory", label: "Historial" },
  ];
  return (
    <nav className="admin-detail-tabs" aria-label="Secciones del viaje">
      {tabs.map((tab) => (
        <Link
          aria-current={current === tab.id ? "page" : undefined}
          className={current === tab.id ? "is-active" : undefined}
          key={tab.id}
          to={tripDetailPath(tab.id, tripId)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function TripDetailActions({ detail }: { readonly detail: AdminTripDetail }): React.JSX.Element {
  const status = detail.trip.operationalStatus;
  const primary =
    status === "draft"
      ? { label: "Aprobar viaje", href: manageTripPath(detail.trip.id) }
      : status === "approved"
        ? { label: "Programar viaje", href: manageTripPath(detail.trip.id) }
        : ["scheduled", "loading", "in_transit", "unloading"].includes(status)
          ? { label: "Ver seguimiento", href: tripDetailPath("tripOperation", detail.trip.id) }
          : detail.settlement === null
            ? {
                label: "Revisar dinero",
                href: `${routePaths.expenses}?viaje=${encodeURIComponent(detail.trip.id)}`,
              }
            : { label: "Revisar rendición", href: settlementDetailPath(detail.settlement.id) };
  return (
    <section className="admin-card admin-context-actions" aria-label="Acciones del viaje">
      <div>
        <p className="admin-section-kicker">Siguiente acción</p>
        <Link className="admin-header-action" to={primary.href}>
          {primary.label} <Icon name="chevron" size={16} />
        </Link>
      </div>
      <div className="admin-context-actions__links">
        <Link to={`${routePaths.fuelEntries}?viaje=${encodeURIComponent(detail.trip.id)}`}>
          Registrar combustible
        </Link>
        <Link to={`${routePaths.expenses}?viaje=${encodeURIComponent(detail.trip.id)}`}>
          Registrar gasto
        </Link>
        <Link to={`${routePaths.advances}?viaje=${encodeURIComponent(detail.trip.id)}`}>
          Registrar adelanto
        </Link>
        <Link to={documentsPathForAssociation("trip", detail.trip.id)}>Agregar documento</Link>
        <Link to={`${routePaths.collections}?viaje=${encodeURIComponent(detail.trip.id)}`}>
          Registrar factura
        </Link>
      </div>
    </section>
  );
}

function DetailTerm({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}): React.JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint === undefined ? null : <small>{hint}</small>}
    </div>
  );
}

function TripMetricGrid({ detail }: { readonly detail: AdminTripDetail }): React.JSX.Element {
  return (
    <section className="admin-trip-financials" aria-label="Kilometraje del viaje">
      <Kpi label="Km inicial" value={formatNumberForUi(detail.initialOdometerKm)} />
      <Kpi label="Km final" value={formatNumberForUi(detail.finalOdometerKm)} />
      <Kpi
        label="Distancia registrada"
        value={
          detail.distanceKm === null ? "Sin cierre" : `${formatNumberForUi(detail.distanceKm)} km`
        }
      />
      <Kpi
        label="Carga declarada"
        value={
          detail.unavailableSections.includes("loads")
            ? "Requiere conexión"
            : `${detail.loads.length} registro(s)`
        }
      />
    </section>
  );
}

function TripListSection({
  title,
  rows,
  emptyCopy,
  kind = "records",
  evidenceGateway,
  online,
}: {
  readonly title: string;
  readonly rows: readonly AdminTripDetailLine[];
  readonly emptyCopy: string;
  readonly kind?: AdminTableKind;
  readonly evidenceGateway: AdminDataGateway;
  readonly online: boolean;
}): React.JSX.Element {
  const hasEvidence = rows.some((row) => row.fileId !== undefined);
  return (
    <section className="admin-card admin-list-card">
      <div className="admin-card__heading">
        <h2>{title}</h2>
        <span>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="admin-muted">{emptyCopy}</p>
      ) : (
        <RecordTable
          rows={rows}
          kind={kind}
          actions={
            hasEvidence
              ? (row) =>
                  row.fileId === undefined ? null : (
                    <PrivateEvidenceAction
                      fileId={row.fileId}
                      gateway={evidenceGateway}
                      label={kind === "documents" ? "Ver archivo" : "Ver evidencia"}
                      online={online}
                    />
                  )
              : undefined
          }
        />
      )}
    </section>
  );
}

function tripSectionEmptyCopy(
  detail: AdminTripDetail,
  section: AdminTripDetailSection,
  onlineCopy: string,
): string {
  return detail.unavailableSections.includes(section)
    ? "Este apartado no forma parte de la copia local y requiere conexión."
    : onlineCopy;
}

function SettlementCard({ detail }: { readonly detail: AdminTripDetail }): React.JSX.Element {
  const settlement = detail.settlement;
  if (settlement === null)
    return (
      <section className="admin-card admin-list-card">
        <h2>Rendición</h2>
        <p className="admin-muted">No existe una rendición para este viaje.</p>
      </section>
    );
  const balanceLabel = settlementDirectionCopy(settlement.balance);
  return (
    <section className="admin-card admin-detail-card admin-list-card">
      <div className="admin-card__heading">
        <h2>Rendición</h2>
        <StatusChip label={settlement.status} tone={toneForStatus(settlement.status)} />
      </div>
      <dl>
        <DetailTerm label="Adelantos conciliados" value={formatMoney(settlement.totalAdvances)} />
        <DetailTerm label="Gastos conciliados" value={formatMoney(settlement.totalExpenses)} />
        <DetailTerm label={balanceLabel} value={formatMoney(Math.abs(settlement.balance))} />
        {settlement.resolutionDirection === null ? null : (
          <DetailTerm
            label="Dirección registrada"
            value={resolutionDirectionLabel(settlement.resolutionDirection)}
          />
        )}
        {settlement.resolvedAmount === null ? null : (
          <DetailTerm label="Monto regularizado" value={formatMoney(settlement.resolvedAmount)} />
        )}
        {settlement.resolutionMethod === null ? null : (
          <DetailTerm label="Medio de regularización" value={settlement.resolutionMethod} />
        )}
        {settlement.resolutionReference === null ? null : (
          <DetailTerm label="Referencia" value={settlement.resolutionReference} />
        )}
        {settlement.resolutionNote === null ? null : (
          <DetailTerm label="Nota" value={settlement.resolutionNote} />
        )}
        {settlement.resolvedAt === null ? null : (
          <DetailTerm label="Regularizado" value={formatDate(settlement.resolvedAt)} />
        )}
      </dl>
    </section>
  );
}

function ReadOnlyNotice({
  copy = "Tu rol tiene acceso de consulta; las acciones de modificación no están disponibles.",
}: {
  readonly copy?: string;
}): React.JSX.Element {
  return (
    <p className="admin-readonly" role="note">
      <Icon name="file" />
      {copy}
    </p>
  );
}

async function loadDetailRows(
  routeId: ProductRouteId,
  gateway: AdminDataGateway,
): Promise<readonly AdminListRow[]> {
  if (routeId === "vehicleDetail") return gateway.listVehicles();
  if (routeId === "driverDetail") return gateway.listDrivers();
  if (routeId === "clientDetail") return gateway.listClients();
  if (routeId === "settlementDetail") return gateway.listSettlements();
  if (routeId === "maintenanceDetail") return gateway.listMaintenance();
  return [];
}

function isTripDetailRoute(routeId: ProductRouteId): boolean {
  return [
    "tripSummary",
    "tripOperation",
    "tripMoney",
    "tripDocuments",
    "tripIncidents",
    "tripHistory",
  ].includes(routeId);
}

export function detailIdFromPath(routeId: ProductRouteId, pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (
    [
      "tripSummary",
      "tripOperation",
      "tripMoney",
      "tripDocuments",
      "tripIncidents",
      "tripHistory",
    ].includes(routeId)
  )
    return parts.length >= 3 ? (parts.at(-2) ?? null) : null;
  return parts.at(-1) ?? null;
}

function detailTitle(routeId: ProductRouteId): string {
  if (routeId.startsWith("trip")) return "Detalle del viaje";
  if (routeId === "vehicleDetail") return "Detalle de unidad";
  if (routeId === "driverDetail") return "Detalle de conductor";
  if (routeId === "clientDetail") return "Detalle de cliente";
  if (routeId === "settlementDetail") return "Detalle de rendición";
  return "Detalle de mantenimiento";
}

function profileToListRow(profile: AdminProfileRow): AdminListRow {
  const labels: Readonly<Record<AdminProfileRow["role"], string>> = {
    management: "Gerencia",
    administration: "Administración",
    driver: "Conductor",
    accounting: "Contabilidad",
  };
  return { ...profile, description: labels[profile.role] };
}

function ResourceCrudPage({
  title,
  description,
  resource,
  emptyCopy,
  form,
  actions,
  listLabel = "Registros",
  tableKind = "records",
  rowFilter,
  headerAction,
  headerVariant,
  formAfterList = false,
  listToolbar,
}: {
  readonly title: string;
  readonly description: string;
  readonly resource: ResourceState<readonly AdminListRow[]>;
  readonly emptyCopy: string;
  readonly form: ReactNode;
  readonly actions?: ((row: AdminListRow) => ReactNode) | undefined;
  readonly listLabel?: string;
  readonly tableKind?: AdminTableKind;
  readonly rowFilter?: ((row: AdminListRow) => boolean) | undefined;
  readonly headerAction?: ReactNode;
  readonly headerVariant?: "fleet" | undefined;
  readonly formAfterList?: boolean;
  readonly listToolbar?: ReactNode;
}): React.JSX.Element {
  return (
    <>
      <PageHeader
        action={headerAction}
        title={title}
        description={description}
        variant={headerVariant}
      />
      {formAfterList ? null : form}
      <section className="admin-card admin-list-card">
        <div className="admin-card__heading">
          <h2>{listLabel}</h2>
          {resource.status === "READY" ? <span>{resource.data?.length ?? 0}</span> : null}
        </div>
        {listToolbar}
        <PageState resource={resource} emptyCopy={emptyCopy}>
          {(rows) => (
            <RecordTable
              rows={rowFilter === undefined ? rows : rows.filter(rowFilter)}
              actions={actions}
              kind={tableKind}
            />
          )}
        </PageState>
      </section>
      {formAfterList ? form : null}
    </>
  );
}

type FormFieldKind = "text" | "textarea" | "select" | "file" | "checkbox";

type FormFieldGuidance = {
  readonly hint: string;
  readonly placeholder?: string;
};

const formGuidanceByName: Readonly<Record<string, FormFieldGuidance>> = {
  active: { hint: "Déjalo activo mientras el registro pueda usarse en nuevas operaciones." },
  admittedAt: { hint: "Registra cuándo la unidad ingresó realmente al taller." },
  approvedAmount: {
    hint: "Indica el importe autorizado después de la revisión.",
    placeholder: "Ej.: 185.50",
  },
  cargoWeight: {
    hint: "Registra el peso real de la carga usando la unidad que elegiste.",
    placeholder: "Ej.: 22.5",
  },
  contractEndedOn: { hint: "Indica la fecha real en que termina la relación o contrato." },
  contractStartedOn: { hint: "Indica la fecha real de inicio de la relación o contrato." },
  deliveryMethod: {
    hint: "Indica cómo se entregó el dinero o documento.",
    placeholder: "Ej.: Transferencia bancaria",
  },
  finalMileage: {
    hint: "Ingresa la lectura visible al terminar el trabajo.",
    placeholder: "Ej.: 12500",
  },
  fueledAt: { hint: "Selecciona la fecha y hora reales del abastecimiento." },
  incurredAt: { hint: "Selecciona la fecha y hora reales en que se generó el gasto." },
  installationOdometerKm: {
    hint: "Opcional. Registra la lectura visible cuando se instaló el repuesto.",
    placeholder: "Ej.: 12650",
  },
  installedAt: { hint: "Opcional. Selecciona cuándo se instaló realmente el repuesto." },
  labourCost: {
    hint: "Registra el costo real de mano de obra, sin símbolo de moneda.",
    placeholder: "Ej.: 450.00",
  },
  licenseExpiresOn: { hint: "Registra la fecha de vencimiento que figura en la licencia." },
  licenseNumber: {
    hint: "Copia el número de licencia tal como aparece en el documento.",
    placeholder: "Ej.: Q12345678",
  },
  note: {
    hint: "Añade una explicación breve que permita entender esta decisión.",
    placeholder: "Ej.: Revisado con el responsable",
  },
  odometerKm: {
    hint: "Registra la lectura visible del odómetro en kilómetros.",
    placeholder: "Ej.: 12500",
  },
  partsCost: {
    hint: "Registra el total real de repuestos, sin símbolo de moneda.",
    placeholder: "Ej.: 875.00",
  },
  receiptType: {
    hint: "Elige el tipo que aparece en el comprobante; déjalo vacío si no se cuenta con uno.",
  },
  unitCost: {
    hint: "Registra el costo real por unidad del repuesto, sin símbolo de moneda.",
    placeholder: "Ej.: 74.50",
  },
  unitPrice: {
    hint: "Registra el precio real por unidad, sin símbolo de moneda.",
    placeholder: "Ej.: 15.80",
  },
  volumeUnit: { hint: "Elige la unidad real que figura en la venta de combustible." },
  workPerformed: {
    hint: "Resume el trabajo realizado con datos que el equipo pueda verificar.",
    placeholder: "Ej.: Se reemplazó filtro y se verificó nivel de aceite",
  },
  address: {
    hint: "Incluye una referencia que ayude a ubicar el domicilio o punto de atención.",
    placeholder: "Ej.: Av. Industrial 245, Arequipa",
  },
  amount: {
    hint: "Registra el importe real del comprobante, sin símbolo de moneda.",
    placeholder: "Ej.: 185.50",
  },
  blocksOperation: {
    hint: "Actívalo solo si el vencimiento debe impedir programar la unidad o el viaje asociado.",
  },
  brand: { hint: "Usa la marca que figura en la pieza o comprobante.", placeholder: "Ej.: Bosch" },
  capacityTons: {
    hint: "Indica la capacidad registrada de la unidad, en toneladas.",
    placeholder: "Ej.: 28",
  },
  cargoDescription: {
    hint: "Describe la carga con palabras que permitan reconocerla durante la operación.",
    placeholder: "Ej.: Concentrado de cobre en sacos",
  },
  category: {
    hint: "Agrupa el repuesto con una categoría que el equipo pueda reconocer después.",
    placeholder: "Ej.: Frenos",
  },
  categoryId: { hint: "Elige la categoría que mejor explica el gasto o movimiento." },
  clientId: { hint: "Selecciona el cliente que contrató o recibirá este servicio." },
  code: {
    hint: "Usa un código breve y reconocible para el equipo; evita identificadores internos largos.",
    placeholder: "Ej.: CICLO-SUR-01",
  },
  concept: { hint: "Resume para qué se entregó el dinero.", placeholder: "Ej.: Viáticos de ruta" },
  contactName: {
    hint: "Escribe el nombre de la persona que el equipo puede contactar.",
    placeholder: "Ej.: Rosa Quispe",
  },
  deliveredAt: { hint: "Selecciona la fecha y hora reales en que se entregó el monto." },
  description: {
    hint: "Añade un detalle breve que permita entender el registro sin abrir otra evidencia.",
    placeholder: "Ej.: Peaje de salida en Pucusana",
  },
  destination: {
    hint: "Indica el punto de destino que el equipo reconoce para esta ruta.",
    placeholder: "Ej.: Matarani",
  },
  displayName: {
    hint: "Usa el nombre con el que esta persona será identificada dentro del sistema.",
    placeholder: "Ej.: María Quispe",
  },
  documentNumber: {
    hint: "Cópialo tal como aparece en el documento o identificación oficial.",
    placeholder: "Ej.: 74125896",
  },
  documentType: {
    hint: "Especifica el documento que respalda este registro.",
    placeholder: "Ej.: SOAT",
  },
  dueOn: { hint: "Indica la fecha límite real de pago de la factura." },
  email: {
    hint: "Usa un correo de trabajo al que la persona tenga acceso.",
    placeholder: "Ej.: nombre@empresa.com",
  },
  expiresOn: { hint: "Registra la fecha de vencimiento que figura en el documento." },
  freightAmount: {
    hint: "Ingresa el flete total acordado, sin símbolo de moneda.",
    placeholder: "Ej.: 12500.00",
  },
  freightRatePerTon: {
    hint: "Ingresa la tarifa acordada por tonelada, sin símbolo de moneda.",
    placeholder: "Ej.: 85.00",
  },
  frequencyDays: {
    hint: "Úsalo cuando el plan se controle por tiempo. Déjalo vacío si depende solo del kilometraje.",
    placeholder: "Ej.: 180",
  },
  frequencyKm: {
    hint: "Úsalo cuando el plan se controle por kilometraje. Déjalo vacío si depende solo de días.",
    placeholder: "Ej.: 10000",
  },
  internalCode: {
    hint: "Solo si tu equipo usa un código propio para reconocer este repuesto.",
    placeholder: "Ej.: FIL-ACE-01",
  },
  issuedOn: { hint: "Selecciona la fecha de emisión que figura en el documento." },
  legalName: {
    hint: "Escribe la razón social o nombre legal tal como figura en el comprobante.",
    placeholder: "Ej.: Transportes Andina S.A.C.",
  },
  location: {
    hint: "Añade una referencia útil del lugar donde ocurrió el hecho.",
    placeholder: "Ej.: Km 48 de la Panamericana Sur",
  },
  maintenanceType: {
    hint: "Indica si el trabajo es preventivo, correctivo o una inspección.",
    placeholder: "Ej.: Preventivo",
  },
  make: { hint: "Escribe la marca registrada de la unidad.", placeholder: "Ej.: Volvo" },
  model: { hint: "Escribe el modelo registrado de la unidad.", placeholder: "Ej.: FH 460" },
  modelYear: {
    hint: "Indica el año del modelo registrado de la unidad.",
    placeholder: "Ej.: 2022",
  },
  name: {
    hint: "Usa un nombre claro que el equipo pueda reconocer al buscar este registro.",
    placeholder: "Ej.: Cambio de aceite y filtro",
  },
  notes: {
    hint: "Opcional. Añade solo información útil para quien revise el registro después.",
    placeholder: "Ej.: Coordinado con el taller para el martes",
  },
  number: {
    hint: "Copia el número tal como aparece en el comprobante o documento.",
    placeholder: "Ej.: 000122",
  },
  origin: {
    hint: "Indica el punto de origen que el equipo reconoce para esta ruta.",
    placeholder: "Ej.: Lima",
  },
  ownerName: {
    hint: "Registra al propietario que figura en la documentación de la unidad.",
    placeholder: "Ej.: Transportes Andina S.A.C.",
  },
  paidAt: { hint: "Selecciona la fecha y hora reales en que se recibió el pago." },
  partId: { hint: "Elige el repuesto que se instaló o consumió en el trabajo." },
  paymentMethod: {
    hint: "Indica el medio real usado para recibir el pago.",
    placeholder: "Ej.: Transferencia bancaria",
  },
  phone: {
    hint: "Incluye un número de contacto vigente, con código si corresponde.",
    placeholder: "Ej.: 999 555 444",
  },
  plate: {
    hint: "Escríbela exactamente como figura en la tarjeta de propiedad.",
    placeholder: "Ej.: ABC-123",
  },
  quantity: {
    hint: "Indica la cantidad real, usando la unidad de medida seleccionada.",
    placeholder: "Ej.: 2",
  },
  reason: {
    hint: "Explica el motivo concreto para que la decisión pueda revisarse después.",
    placeholder: "Ej.: El viaje fue reasignado por cambio de ruta",
  },
  receiptFile: {
    hint: "Adjunta una foto o PDF legible del comprobante. El archivo permanece privado.",
  },
  receiptNumber: {
    hint: "Copia la serie o número visible en el comprobante, si existe.",
    placeholder: "Ej.: B001-000245",
  },
  reference: {
    hint: "Usa la referencia que permite ubicar este movimiento en el banco o comprobante.",
    placeholder: "Ej.: Operación 145879",
  },
  reportedProblem: {
    hint: "Describe el síntoma observable y dónde se presenta; evita diagnósticos no confirmados.",
    placeholder: "Ej.: Ruido al frenar en la rueda delantera",
  },
  resolutionMethod: {
    hint: "Indica cómo se resolvió o regularizó el registro.",
    placeholder: "Ej.: Comprobante adjunto",
  },
  resolutionReference: {
    hint: "Copia la referencia del comprobante que respalda la regularización.",
    placeholder: "Ej.: OP-45891",
  },
  series: {
    hint: "Copia la serie del comprobante tal como fue emitida.",
    placeholder: "Ej.: F001",
  },
  supplierId: { hint: "Selecciona el proveedor que emitió el comprobante o prestó el servicio." },
  subtotal: {
    hint: "Registra el subtotal real del comprobante, antes de impuestos si corresponde.",
    placeholder: "Ej.: 1250.00",
  },
  taxId: {
    hint: "Copia el RUC o DNI tal como aparece en el documento de la contraparte.",
    placeholder: "Ej.: 20123456789",
  },
  tradeName: {
    hint: "Opcional. Úsalo solo si el equipo conoce a la contraparte por otro nombre.",
    placeholder: "Ej.: Andina Cargas",
  },
  unit: {
    hint: "Indica la unidad de medida que usará el equipo al registrar este repuesto.",
    placeholder: "Ej.: Unidad",
  },
  vehicleId: { hint: "Selecciona la unidad a la que corresponde este registro." },
};

function formFieldGuidance({
  kind,
  label,
  name,
  type,
}: {
  readonly kind: FormFieldKind;
  readonly label: string;
  readonly name: string;
  readonly type?: string;
}): FormFieldGuidance {
  const namedGuidance = formGuidanceByName[name];
  if (namedGuidance !== undefined) return namedGuidance;
  if (kind === "select")
    return { hint: `Elige la opción que corresponde a ${label.toLocaleLowerCase("es-PE")}.` };
  if (kind === "textarea")
    return {
      hint: "Describe el hecho de forma concreta, con datos que el equipo pueda verificar.",
      placeholder: "Ej.: Indica qué ocurrió, dónde y cualquier dato relevante",
    };
  if (kind === "file")
    return {
      hint: "Adjunta una foto o PDF legible que respalde este registro. El archivo permanece privado.",
    };
  if (kind === "checkbox")
    return { hint: "Márcalo únicamente si esta condición realmente aplica al registro." };
  if (type === "date" || type === "datetime-local")
    return { hint: "Selecciona la fecha y hora reales del hecho que estás registrando." };
  if (type === "number")
    return { hint: "Ingresa solo la cifra real, sin símbolos ni texto.", placeholder: "Ej.: 0" };
  if (type === "email")
    return {
      hint: "Usa un correo de trabajo al que la persona tenga acceso.",
      placeholder: "Ej.: nombre@empresa.com",
    };
  if (type === "tel")
    return {
      hint: "Ingresa un teléfono vigente para contacto operativo.",
      placeholder: "Ej.: 999 555 444",
    };
  return {
    hint: "Escribe el dato tal como tu equipo lo identifica en la operación.",
    placeholder: "Ej.: Información confirmada",
  };
}

function SimpleForm({
  title,
  submitLabel,
  onSubmit,
  description = "Completa solo datos reales. Bajo cada campo encontrarás una explicación o un ejemplo para registrar el dato correcto.",
  onSaved,
  onDirty,
  successMessage = "Guardado correctamente.",
  children,
  compact = false,
}: {
  readonly title: string;
  readonly submitLabel: string;
  readonly onSubmit: (form: FormData) => Promise<void>;
  readonly description?: string;
  readonly onSaved?: () => void;
  /** Starts a fresh idempotent command when an already-attempted form is edited. */
  readonly onDirty?: () => void;
  readonly successMessage?: string;
  readonly children: ReactNode;
  readonly compact?: boolean;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await onSubmit(new FormData(formElement));
      formElement.reset();
      setMessage(successMessage);
      onSaved?.();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={`admin-form ${compact ? "admin-form--compact" : ""}`}
      onChange={onDirty}
      onSubmit={(event) => void submit(event)}
    >
      <div className="admin-form__heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="admin-form__fields">{children}</div>
      <Feedback message={message} error={error} />
      <div className="admin-form__actions">
        <Button disabled={busy} type="submit">
          {busy ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  hint,
  ...inputProps
}: {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly required?: boolean;
  readonly hint?: string;
  readonly min?: string;
  readonly max?: string;
  readonly step?: string;
  readonly placeholder?: string;
  readonly defaultValue?: string | undefined;
}): React.JSX.Element {
  const guidance = formFieldGuidance({ kind: "text", label, name, type });
  const helpId = useId();
  const resolvedHint = hint ?? guidance.hint;
  const resolvedPlaceholder = inputProps.placeholder ?? guidance.placeholder;
  return (
    <label className="admin-field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        aria-describedby={helpId}
        name={name}
        placeholder={resolvedPlaceholder}
        required={required}
        type={type}
        {...inputProps}
      />
      <small className="admin-field__hint" id={helpId}>
        {resolvedHint}
      </small>
    </label>
  );
}

function TextareaField({
  label,
  name,
  required = false,
  rows = 3,
  defaultValue,
  hint,
  placeholder,
}: {
  readonly label: string;
  readonly name: string;
  readonly required?: boolean;
  readonly rows?: number;
  readonly defaultValue?: string | undefined;
  readonly hint?: string;
  readonly placeholder?: string;
}): React.JSX.Element {
  const guidance = formFieldGuidance({ kind: "textarea", label, name });
  const helpId = useId();
  return (
    <label className="admin-field admin-field--wide">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <textarea
        aria-describedby={helpId}
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder ?? guidance.placeholder}
        required={required}
        rows={rows}
      />
      <small className="admin-field__hint" id={helpId}>
        {hint ?? guidance.hint}
      </small>
    </label>
  );
}

function FileField({
  label,
  name,
  required = false,
  hint,
}: {
  readonly label: string;
  readonly name: string;
  readonly required?: boolean;
  readonly hint?: string;
}): React.JSX.Element {
  const guidance = formFieldGuidance({ kind: "file", label, name });
  const helpId = useId();
  return (
    <label className="admin-field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        accept="application/pdf,image/jpeg,image/png,image/webp"
        aria-describedby={helpId}
        name={name}
        required={required}
        type="file"
      />
      <small className="admin-field__hint" id={helpId}>
        {hint ?? guidance.hint}
      </small>
    </label>
  );
}

function CheckboxField({
  label,
  name,
  required = false,
  defaultChecked = false,
  hint,
}: {
  readonly label: string;
  readonly name: string;
  readonly required?: boolean;
  readonly defaultChecked?: boolean;
  readonly hint?: string;
}): React.JSX.Element {
  const guidance = formFieldGuidance({ kind: "checkbox", label, name });
  const helpId = useId();
  return (
    <label className="admin-checkbox">
      <input
        aria-describedby={helpId}
        defaultChecked={defaultChecked}
        name={name}
        required={required}
        type="checkbox"
        value="true"
      />
      <span className="admin-checkbox__copy">
        <span>
          {label}
          {required ? " *" : ""}
        </span>
        <small id={helpId}>{hint ?? guidance.hint}</small>
      </span>
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  required = false,
  defaultValue,
  hint,
}: {
  readonly label: string;
  readonly name: string;
  readonly options: readonly AdminOption[];
  readonly required?: boolean;
  readonly defaultValue?: string | undefined;
  readonly hint?: string;
}): React.JSX.Element {
  const guidance = formFieldGuidance({ kind: "select", label, name });
  const helpId = useId();
  return (
    <label className="admin-field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <select aria-describedby={helpId} defaultValue={defaultValue} name={name} required={required}>
        <option value="">Selecciona…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label} · {option.status}
          </option>
        ))}
      </select>
      <small className="admin-field__hint" id={helpId}>
        {hint ?? guidance.hint}
      </small>
    </label>
  );
}

function GroupedAssociationSelect({
  label,
  name,
  options,
  required = false,
  defaultValue,
}: {
  readonly label: string;
  readonly name: string;
  readonly options: readonly AdminOption[];
  readonly required?: boolean;
  readonly defaultValue?: string | undefined;
}): React.JSX.Element {
  const [query, setQuery] = useState("");
  const grouped = groupDocumentAssociationOptions(options, query);
  return (
    <label className="admin-field admin-field--wide">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        aria-label={`Buscar ${label.toLocaleLowerCase("es-PE")}`}
        className="admin-grouped-select__search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Busca por nombre, ruta, placa o código"
        type="search"
        value={query}
      />
      <select defaultValue={defaultValue} name={name} required={required}>
        <option value="">Selecciona…</option>
        {grouped.map(([group, entries]) => (
          <optgroup key={group} label={group}>
            {entries.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.status}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <small className="admin-form-note">
        Primero busca; luego elige el registro dentro de su grupo.
      </small>
    </label>
  );
}

function DocumentFilters({
  association,
  documentType,
  query,
  status,
  onChange,
}: {
  readonly association: string;
  readonly documentType: string;
  readonly query: string;
  readonly status: string;
  readonly onChange: (next: {
    readonly q: string;
    readonly status: string;
    readonly type: string;
    readonly association: string;
  }) => void;
}): React.JSX.Element {
  const update = (
    changes: Partial<{ q: string; status: string; type: string; association: string }>,
  ) => onChange({ q: query, status, type: documentType, association, ...changes });
  return (
    <div className="admin-list-filters admin-document-filters" aria-label="Filtrar documentos">
      <label>
        <span className="sr-only">Buscar documento</span>
        <input
          onChange={(event) => update({ q: event.target.value })}
          placeholder="Buscar documento, número o asociado"
          type="search"
          value={query}
        />
      </label>
      <select
        aria-label="Asociado a"
        onChange={(event) => update({ association: event.target.value })}
        value={association}
      >
        <option value="">Todas las asociaciones</option>
        <option value="company">Empresa</option>
        <option value="vehicle">Unidades</option>
        <option value="driver">Conductores</option>
        <option value="trip">Viajes</option>
        <option value="client">Clientes</option>
      </select>
      <input
        aria-label="Tipo de documento"
        onChange={(event) => update({ type: event.target.value })}
        placeholder="Tipo: SOAT, licencia…"
        value={documentType}
      />
      <select
        aria-label="Estado documental"
        onChange={(event) => update({ status: event.target.value })}
        value={status}
      >
        <option value="">Todos los estados</option>
        <option value="vigente">Vigente</option>
        <option value="archivo_faltante">Archivo faltante</option>
        <option value="con_archivo">Con archivo</option>
      </select>
    </div>
  );
}

function SelectNative({
  label,
  name,
  options,
}: {
  readonly label: string;
  readonly name: string;
  readonly options: readonly string[];
}): React.JSX.Element {
  const guidance = formFieldGuidance({ kind: "select", label, name });
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select name={name}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <small className="admin-field__hint">{guidance.hint}</small>
    </label>
  );
}

function textValue(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`El campo ${name} es obligatorio.`);
  return value.trim();
}
function optionalText(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function requiredUpdatedAt(row: Pick<AdminListRow, "updatedAt">): string {
  if (row.updatedAt === undefined || row.updatedAt.trim() === "")
    throw new Error("El registro debe actualizarse antes de aplicar este cambio.");
  return row.updatedAt;
}

function numberValue(form: FormData, name: string, fallback?: number): number {
  const raw = optionalText(form, name);
  if (raw === null) {
    if (fallback !== undefined) return fallback;
    throw new Error(`El campo ${name} es obligatorio.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`El campo ${name} debe ser un número no negativo.`);
  return value;
}
function positiveNumberValue(form: FormData, name: string): number {
  const value = numberValue(form, name);
  if (value <= 0) throw new Error(`El campo ${name} debe ser mayor que cero.`);
  return value;
}
function nullableNumber(form: FormData, name: string): number | null {
  const raw = optionalText(form, name);
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`El campo ${name} no es válido.`);
  return value;
}
function optionalDateTimeValue(form: FormData, name: string): string | null {
  const value = optionalText(form, name);
  if (value === null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error(`El campo ${name} no contiene una fecha válida.`);
  return date.toISOString();
}
function dateTimeValue(form: FormData, name: string): string {
  const value = textValue(form, name);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error(`El campo ${name} no contiene una fecha válida.`);
  return date.toISOString();
}
function booleanValue(form: FormData, name: string): boolean {
  return form.get(name) === "true";
}
function fileValue(form: FormData, name: string): File | null {
  const value = form.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}
function requiredFileValue(form: FormData, name: string): File {
  const file = fileValue(form, name);
  if (file === null) throw new Error(`Selecciona el archivo de ${name}.`);
  return file;
}
function fuelVolumeUnitValue(form: FormData, name: string): "gallon" | "liter" {
  const value = textValue(form, name);
  if (value === "gallon" || value === "liter") return value;
  throw new Error("La unidad de volumen seleccionada no es válida.");
}

function ownershipTypeValue(
  form: FormData,
  name: string,
): "owned" | "leased" | "third_party" | null {
  const value = optionalText(form, name);
  if (value === null) return null;
  if (value === "owned" || value === "leased" || value === "third_party") return value;
  throw new Error("La propiedad de la unidad no es válida.");
}

function relationshipTypeValue(
  form: FormData,
  name: string,
): "direct" | "intermediary" | "third_party" | null {
  const value = optionalText(form, name);
  if (value === null) return null;
  if (value === "direct" || value === "intermediary" || value === "third_party") return value;
  throw new Error("La relación comercial no es válida.");
}

function relationshipTypeLabel(value: string | null): string {
  if (value === "direct") return "Directo";
  if (value === "intermediary") return "Intermediario";
  if (value === "third_party") return "Tercero";
  return "No registrada";
}

function driverAvailabilityValue(
  form: FormData,
  name: string,
): "available" | "rest" | "vacation" | "leave" | "unavailable" {
  const value = textValue(form, name);
  if (
    value === "available" ||
    value === "rest" ||
    value === "vacation" ||
    value === "leave" ||
    value === "unavailable"
  )
    return value;
  throw new Error("La disponibilidad seleccionada no es válida.");
}

function supplierTypeValue(
  form: FormData,
  name: string,
): "grifo" | "taller" | "repuestos" | "otro" {
  const value = textValue(form, name);
  if (value === "grifo" || value === "taller" || value === "repuestos" || value === "otro")
    return value;
  throw new Error("El tipo de proveedor no es válido.");
}

function supplierTypeFromSearch(value: string | null): AdminSupplierRow["supplierType"] | null {
  return value === "grifo" || value === "taller" || value === "repuestos" || value === "otro"
    ? value
    : null;
}

function safeInternalPath(value: string | null): string | null {
  if (value === null || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function isClosedSettlement(status: string): boolean {
  const normalized = status.toLocaleLowerCase("es-PE");
  return normalized.includes("cerrad") || normalized.includes("closed");
}

function roleValue(form: FormData, name: string): AdminProfileRow["role"] {
  const role = textValue(form, name);
  if (
    role === "management" ||
    role === "administration" ||
    role === "driver" ||
    role === "accounting"
  )
    return role;
  throw new Error("El rol seleccionado no es válido.");
}

function operationalCycleStatusValue(form: FormData, name: string): OperationalCycleStatus {
  const value = textValue(form, name);
  if (value === "planned" || value === "active" || value === "completed" || value === "cancelled")
    return value;
  throw new Error("El estado del ciclo seleccionado no es válido.");
}

function operationalCycleReturnStatusValue(
  form: FormData,
  name: string,
): OperationalCycleReturnStatus {
  const value = textValue(form, name);
  if (
    value === "unidentified" ||
    value === "probable" ||
    value === "confirmed" ||
    value === "completed" ||
    value === "empty_return"
  )
    return value;
  throw new Error("La situación de retorno seleccionada no es válida.");
}

function operationalCycleLegKindValue(form: FormData, name: string): OperationalCycleLegKind {
  const value = textValue(form, name);
  if (value === "outbound" || value === "return" || value === "continuation") return value;
  throw new Error("El tipo de tramo seleccionado no es válido.");
}

function workOrderProgressStatusValue(
  form: FormData,
  name: string,
): Exclude<AdminWorkOrderStatus, "finished"> {
  const value = textValue(form, name);
  if (
    value === "scheduled" ||
    value === "waiting_workshop" ||
    value === "in_workshop" ||
    value === "in_progress" ||
    value === "waiting_part" ||
    value === "cancelled"
  )
    return value;
  throw new Error("El estado de la orden no es válido para registrar un avance.");
}

function operationalCycleStatusOptionsFor(
  currentStatus: OperationalCycleStatus,
): readonly { readonly value: OperationalCycleStatus; readonly label: string }[] {
  if (currentStatus === "planned")
    return operationalCycleStatusOptions.filter(
      (option) =>
        option.value === "planned" || option.value === "active" || option.value === "cancelled",
    );
  if (currentStatus === "active")
    return operationalCycleStatusOptions.filter(
      (option) =>
        option.value === "active" || option.value === "completed" || option.value === "cancelled",
    );
  return operationalCycleStatusOptions.filter((option) => option.value === currentStatus);
}

function operationalCycleReturnStatusLabel(value: OperationalCycleReturnStatus): string {
  const labels: Readonly<Record<OperationalCycleReturnStatus, string>> = {
    unidentified: "Retorno sin identificar",
    probable: "Retorno probable",
    confirmed: "Retorno confirmado",
    completed: "Retorno completado",
    empty_return: "Retorno vacío",
  };
  return labels[value];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

export function operationalCycleErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  const normalized = message.toLocaleLowerCase("es-PE");
  if (normalized.includes("operational cycle changed"))
    return "El ciclo cambió mientras lo estabas editando. Actualiza el detalle y vuelve a intentarlo.";
  if (normalized.includes("cycle trip must use cycle vehicle"))
    return "El viaje usa otra unidad y no es compatible con este ciclo.";
  if (normalized.includes("already belongs to an operational cycle"))
    return "El viaje ya pertenece a otro ciclo operativo. Actualiza el detalle antes de continuar.";
  if (normalized.includes("terminal operational cycle"))
    return "El ciclo ya está finalizado o cancelado; no admite más cambios.";
  if (
    normalized.includes("every cycle trip must finish before completing the cycle") ||
    normalized.includes("every cycle trip must be completed or cancelled")
  )
    return "Para finalizar el ciclo, todos sus viajes deben estar finalizados o cancelados.";
  return message;
}

export function staffCaptureErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  if (/settlement.*closed|rendition.*closed|rendici[oó]n.*cerrad/iu.test(message))
    return "La rendición está cerrada. Reábrela con su motivo auditado antes de registrar este movimiento.";
  if (/allowed only from scheduling through completion/iu.test(message))
    return "Selecciona un viaje programado, en operación o completado para registrar este movimiento.";
  if (/assigned vehicle and driver|assigned driver/iu.test(message))
    return "El viaje necesita una unidad y un conductor asignados antes de registrar este movimiento.";
  return message;
}

export function maintenanceWorkOrderErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  const normalized = message.toLocaleLowerCase("es-PE");
  if (normalized.includes("parts cost must equal the sum of registered part lines"))
    return "El total de repuestos debe coincidir exactamente con la suma de las líneas registradas. Actualiza el monto o las líneas antes de cerrar.";
  if (normalized.includes("at most two decimals"))
    return "Los costos de cierre deben usar como máximo dos decimales.";
  if (normalized.includes("finished or cancelled work order"))
    return "La orden ya está finalizada o cancelada y no admite este cambio.";
  if (normalized.includes("cannot receive parts"))
    return "No se pueden registrar repuestos en una orden finalizada o cancelada.";
  if (normalized.includes("use complete_work_order"))
    return "Para finalizar la orden usa el cierre con odómetro y costos finales.";
  if (normalized.includes("start cannot precede admission"))
    return "La hora de inicio no puede ser anterior a la hora de ingreso.";
  if (
    normalized.includes("part is not active") ||
    normalized.includes("part supplier is not active")
  )
    return "El repuesto o proveedor seleccionado ya no está activo. Actualiza los maestros e inténtalo nuevamente.";
  if (normalized.includes("evidence file is not available"))
    return "El archivo privado ya no está disponible para esta empresa. Selecciónalo nuevamente.";
  if (normalized.includes("evidence file is already attached"))
    return "Ese archivo ya está adjunto a esta orden.";
  return message;
}

function workOrderStatusLabelForUi(status: AdminWorkOrderStatus): string {
  const labels: Readonly<Record<AdminWorkOrderStatus, string>> = {
    scheduled: "Programada",
    waiting_workshop: "En espera de taller",
    in_workshop: "En taller",
    in_progress: "En proceso",
    waiting_part: "En espera de repuesto",
    finished: "Finalizada",
    cancelled: "Cancelada",
  };
  return labels[status];
}

export function workOrderPartsTotal(detail: Pick<AdminMaintenanceDetail, "parts">): number {
  const total = detail.parts.reduce(
    (sum, part) => sum + Math.round((part.quantity * part.unitCost + Number.EPSILON) * 100) / 100,
    0,
  );
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function managedTripIdFromSearch(search: string): string | null {
  const tripId = new URLSearchParams(search).get("gestionar");
  return tripId === null || tripId.trim() === "" ? null : tripId;
}

export function tripViewFromSearch(search: string): TripListView {
  const value = new URLSearchParams(search).get("vista");
  return value === "pendientes" || value === "curso" || value === "finalizados" ? value : "todos";
}

export function vehicleIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("unidad");
  return value === null || value.trim() === "" ? null : value;
}

export function filterAndSortTrips(
  trips: readonly AdminTripRow[],
  view: TripListView,
  query: string,
): readonly AdminTripRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("es-PE");
  return [...trips]
    .filter((trip) => {
      const matchesView =
        view === "todos" ||
        (view === "pendientes" && ["draft", "approved"].includes(trip.operationalStatus)) ||
        (view === "curso" &&
          ["scheduled", "loading", "in_transit", "unloading"].includes(trip.operationalStatus)) ||
        (view === "finalizados" && ["completed", "cancelled"].includes(trip.operationalStatus));
      if (!matchesView) return false;
      if (normalizedQuery === "") return true;
      return `${trip.title} ${trip.code} ${trip.clientName ?? ""} ${trip.vehiclePlate ?? ""} ${trip.driverName ?? ""}`
        .toLocaleLowerCase("es-PE")
        .includes(normalizedQuery);
    })
    .sort((left, right) => {
      const priority = tripPriority(left.operationalStatus) - tripPriority(right.operationalStatus);
      if (priority !== 0) return priority;
      const date = Date.parse(right.date ?? "") - Date.parse(left.date ?? "");
      if (Number.isFinite(date) && date !== 0) return date;
      return left.code.localeCompare(right.code, "es-PE");
    });
}

function tripPriority(status: string): number {
  const ranks: Readonly<Record<string, number>> = {
    draft: 0,
    approved: 1,
    scheduled: 2,
    loading: 3,
    in_transit: 4,
    unloading: 5,
    completed: 6,
    cancelled: 7,
  };
  return ranks[status] ?? 8;
}

export function tripPrimaryAction(trip: AdminTripRow): {
  readonly label: string;
  readonly kind: "manage" | "summary";
} {
  if (trip.operationalStatus === "draft") return { label: "Aprobar", kind: "manage" };
  if (trip.operationalStatus === "approved") return { label: "Programar", kind: "manage" };
  if (["scheduled", "loading", "in_transit", "unloading"].includes(trip.operationalStatus))
    return { label: "Ver seguimiento", kind: "summary" };
  return { label: "Ver resumen", kind: "summary" };
}

function manageTripPath(tripId: string): string {
  return `${routePaths.trips}?gestionar=${encodeURIComponent(tripId)}`;
}

function tripSummaryPath(tripId: string): string {
  return routePaths.tripSummary.replace(":tripId", encodeURIComponent(tripId));
}

function tripDetailPath(
  routeId:
    | "tripSummary"
    | "tripOperation"
    | "tripMoney"
    | "tripDocuments"
    | "tripIncidents"
    | "tripHistory",
  tripId: string,
): string {
  return routePaths[routeId].replace(":tripId", encodeURIComponent(tripId));
}

function vehicleDetailPath(vehicleId: string): string {
  return routePaths.vehicleDetail.replace(":vehicleId", encodeURIComponent(vehicleId));
}

function driverDetailPath(driverId: string): string {
  return routePaths.driverDetail.replace(":driverId", encodeURIComponent(driverId));
}

function clientDetailPath(clientId: string): string {
  return routePaths.clientDetail.replace(":clientId", encodeURIComponent(clientId));
}

function maintenancePathForVehicle(vehicleId: string, create: boolean): string {
  const path = create ? routePaths.newMaintenance : routePaths.maintenance;
  return `${path}?unidad=${encodeURIComponent(vehicleId)}`;
}

function documentsPathForAssociation(
  entityType: "vehicle" | "driver" | "trip" | "client",
  entityId: string,
): string {
  return `${routePaths.documents}?asociado=${encodeURIComponent(`${entityType}:${entityId}`)}`;
}

function settlementDetailPath(settlementId: string): string {
  return routePaths.settlementDetail.replace(":settlementId", encodeURIComponent(settlementId));
}

function maintenanceWorkOrderPath(workOrderId: string): string {
  return routePaths.maintenanceDetail.replace(":workOrderId", encodeURIComponent(workOrderId));
}

function scheduleTripErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("driver") && normalized.includes("profile"))
    return "El conductor debe estar disponible y tener un perfil activo con rol Conductor vinculado. Revisa Perfiles antes de programar.";
  if (normalized.includes("driver is not available"))
    return "El conductor ya no está disponible. Actualiza la programación y elige otro conductor.";
  if (normalized.includes("vehicle is not available"))
    return "La unidad ya no está disponible. Actualiza la programación y elige otra unidad.";
  if (normalized.includes("document"))
    return "Un documento crítico de la unidad o del conductor bloquea la programación. Revisa Documentos.";
  if (normalized.includes("maintenance"))
    return "Una orden de mantenimiento bloquea la unidad seleccionada. Revisa Mantenimiento.";
  if (normalized.includes("already has an active trip"))
    return "La unidad o el conductor ya tienen un viaje activo. Actualiza la programación.";
  if (normalized.includes("trip changed") || normalized.includes("not plannable"))
    return "El viaje cambió mientras lo estabas programando. Actualiza la lista y vuelve a intentarlo.";
  return message;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024)
    return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(kilobytes)} KB`;
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(kilobytes / 1024)} MB`;
}
function formatDate(value: string | null): string {
  if (value === null) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(date)
    : value;
}
function formatNumberForUi(value: number | null): string {
  return value === null
    ? "Sin registro"
    : new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value);
}
const statusLabelsForUi: Readonly<Record<string, string>> = {
  active: "Activo",
  applied: "Aplicado",
  awaiting_approval: "Pendiente de aprobación",
  approved: "Aprobado",
  available: "Disponible",
  cancelled: "Cancelado",
  closed: "Cerrado",
  completed: "Finalizado",
  critical: "Crítica",
  draft: "Borrador",
  expired: "Vencido",
  finished: "Finalizado",
  in_progress: "En proceso",
  in_workshop: "En taller",
  in_transit: "En tránsito",
  in_trip: "En viaje",
  inactive: "Inactivo",
  issued: "Emitida",
  loading: "En carga",
  maintenance: "En mantenimiento",
  new: "Nueva",
  not_required: "No requiere gestión administrativa",
  observed: "Observado",
  open: "Abierto",
  overdue: "Vencido",
  paid: "Pagado",
  partial: "Pago parcial",
  pending: "Pendiente",
  pending_review: "Pendiente de revisión",
  planned: "Planificado",
  preventive_maintenance: "Mantenimiento preventivo",
  probable: "Probable",
  confirmed: "Confirmado",
  rejected: "Rechazado",
  repair: "Reparar",
  return: "Retorno",
  returning_empty: "Retorno vacío",
  scheduled: "Programado",
  unidentified: "Sin identificar",
  unloading: "En descarga",
  unbilled: "Sin facturar",
  under_review: "En revisión",
  valid: "Vigente",
  validated: "Validado",
  waiting_load: "Esperando carga",
  waiting_part: "En espera de repuesto",
  waiting_workshop: "En espera de taller",
  empty_return: "Retorno vacío",
  outbound: "Ida",
  continuation: "Continuación",
};

export function labelStatusForUi(status: string): string {
  return status
    .split(" · ")
    .map((segment) => {
      const normalized = segment
        .trim()
        .toLocaleLowerCase("es-PE")
        .replace(/[\s-]+/g, "_");
      return (
        statusLabelsForUi[normalized] ??
        segment
          .split("_")
          .map((part) => `${part.slice(0, 1).toLocaleUpperCase("es-PE")}${part.slice(1)}`)
          .join(" ")
      );
    })
    .join(" · ");
}
function toneForStatus(
  status: string,
): "neutral" | "success" | "info" | "warning" | "risk" | "critical" {
  const normalized = status.toLowerCase();
  if (normalized.includes("critical") || normalized.includes("crítica")) return "critical";
  if (
    normalized.includes("overdue") ||
    normalized.includes("expired") ||
    normalized.includes("vencid") ||
    normalized.includes("rechaz") ||
    normalized.includes("bloque")
  )
    return "risk";
  if (
    normalized.includes("pending") ||
    normalized.includes("observ") ||
    normalized.includes("revisión") ||
    normalized.includes("esper") ||
    normalized.includes("mantenimiento") ||
    normalized.includes("repair") ||
    normalized.includes("repar")
  )
    return "warning";
  if (
    normalized.includes("active") ||
    normalized.includes("activo") ||
    normalized.includes("available") ||
    normalized.includes("disponible") ||
    normalized.includes("paid") ||
    normalized.includes("pagad") ||
    normalized.includes("valid") ||
    normalized.includes("vigente") ||
    normalized.includes("confirmad") ||
    normalized.includes("aprob") ||
    normalized.includes("validado")
  )
    return "success";
  if (
    normalized.includes("transit") ||
    normalized.includes("tránsito") ||
    normalized.includes("viaje") ||
    normalized.includes("scheduled") ||
    normalized.includes("programad") ||
    normalized.includes("proceso") ||
    normalized.includes("taller") ||
    normalized.includes("local")
  )
    return "info";
  return "neutral";
}
function toTripOption(trip: AdminTripRow): AdminOption {
  return { id: trip.id, label: `${trip.title} · ${trip.description}`, status: trip.status };
}

function optionDefaultValue(
  options: readonly AdminOption[],
  requestedTripId: string | null,
): string | undefined {
  return requestedTripId !== null && options.some((option) => option.id === requestedTripId)
    ? requestedTripId
    : undefined;
}

function toRowOption(row: AdminListRow): AdminOption {
  return { id: row.id, label: row.title, status: row.status };
}

type DocumentEntityType = "company" | "vehicle" | "driver" | "trip" | "client";

export function parseDocumentAssociation(value: string): {
  readonly entityType: DocumentEntityType;
  readonly entityId: string | null;
} {
  if (value === "company") return { entityType: "company", entityId: null };
  const separator = value.indexOf(":");
  const entityType = value.slice(0, separator);
  const entityId = separator < 0 ? "" : value.slice(separator + 1);
  if (
    (entityType !== "vehicle" &&
      entityType !== "driver" &&
      entityType !== "trip" &&
      entityType !== "client") ||
    entityId.trim() === ""
  )
    throw new Error("El registro asociado no es válido.");
  return { entityType, entityId };
}

function documentAssociationOptions(
  options: {
    readonly clients: readonly AdminOption[];
    readonly vehicles: readonly AdminOption[];
    readonly drivers: readonly AdminOption[];
  },
  trips: readonly AdminTripRow[],
): readonly AdminOption[] {
  const prefix = (
    entityType: Exclude<DocumentEntityType, "company">,
    label: string,
    option: AdminOption,
  ) => ({
    id: `${entityType}:${option.id}`,
    label: `${label} · ${option.label}`,
    status: option.status,
  });
  return [
    { id: "company", label: "Empresa actual", status: "Empresa" },
    ...options.vehicles.map((option) => prefix("vehicle", "Unidad", option)),
    ...options.drivers.map((option) => prefix("driver", "Conductor", option)),
    ...trips.map((trip) => prefix("trip", "Viaje", toTripOption(trip))),
    ...options.clients.map((option) => prefix("client", "Cliente", option)),
  ];
}

function groupDocumentAssociationOptions(
  options: readonly AdminOption[],
  query: string,
): readonly (readonly [string, readonly AdminOption[]])[] {
  const normalized = query.trim().toLocaleLowerCase("es-PE");
  const groupLabel = (option: AdminOption): string => {
    if (option.id === "company") return "Empresa";
    if (option.id.startsWith("vehicle:")) return "Unidades";
    if (option.id.startsWith("driver:")) return "Conductores";
    if (option.id.startsWith("trip:")) return "Viajes";
    return "Clientes";
  };
  const groups = new Map<string, AdminOption[]>();
  for (const option of options) {
    if (
      normalized !== "" &&
      !`${option.label} ${option.status}`.toLocaleLowerCase("es-PE").includes(normalized)
    )
      continue;
    const label = groupLabel(option);
    const entries = groups.get(label) ?? [];
    entries.push(option);
    groups.set(label, entries);
  }
  return [...groups.entries()];
}

function documentAssociationFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("asociado");
  if (value === null || value.trim() === "") return null;
  try {
    const parsed = parseDocumentAssociation(value);
    return parsed.entityType === "company" ? "company" : `${parsed.entityType}:${parsed.entityId}`;
  } catch {
    return null;
  }
}

function setOrDeleteSearchParam(params: URLSearchParams, key: string, value: string): void {
  if (value.trim() === "") params.delete(key);
  else params.set(key, value);
}

function settlementDirectionCopy(balance: number): string {
  return balance > 0
    ? "El conductor devuelve"
    : balance < 0
      ? "La empresa reembolsa"
      : "Saldo conciliado";
}

function expenseReviewLabel(status: "validated" | "observed" | "rejected"): string {
  if (status === "validated") return "Validar gasto";
  if (status === "observed") return "Observar gasto";
  return "Rechazar gasto";
}

function settlementCloseInput(
  settlement: Pick<AdminListRow, "id" | "amount">,
  form: FormData,
): {
  readonly settlementId: string;
  readonly resolutionMethod: string;
  readonly resolutionReference: string;
  readonly resolutionNote: string | null;
} {
  if (Math.abs(settlement.amount ?? 0) < 0.005) {
    return {
      settlementId: settlement.id,
      resolutionMethod: "",
      resolutionReference: "",
      resolutionNote: optionalText(form, "resolutionNote"),
    };
  }
  return {
    settlementId: settlement.id,
    resolutionMethod: textValue(form, "resolutionMethod"),
    resolutionReference: textValue(form, "resolutionReference"),
    resolutionNote: optionalText(form, "resolutionNote"),
  };
}

function resolutionDirectionLabel(direction: string): string {
  if (direction === "DRIVER_RETURNS") return "El conductor devuelve";
  if (direction === "COMPANY_REIMBURSES") return "La empresa reembolsa";
  if (direction === "BALANCED") return "Saldo conciliado";
  return labelStatusForUi(direction);
}

export const adminRouteComponents: Readonly<
  Partial<Record<ProductRouteId, typeof AdminRoutePage>>
> = {
  home: AdminRoutePage,
  clients: AdminRoutePage,
  suppliers: AdminRoutePage,
  fleet: AdminRoutePage,
  drivers: AdminRoutePage,
  trips: AdminRoutePage,
  scheduling: AdminRoutePage,
  operationalCycles: AdminRoutePage,
  newTrip: AdminRoutePage,
  expenses: AdminRoutePage,
  fuelEntries: AdminRoutePage,
  advances: AdminRoutePage,
  settlements: AdminRoutePage,
  maintenance: AdminRoutePage,
  newMaintenance: AdminRoutePage,
  documents: AdminRoutePage,
  collections: AdminRoutePage,
  alerts: AdminRoutePage,
  reports: AdminRoutePage,
  search: AdminRoutePage,
  companySettings: AdminRoutePage,
  profileSettings: AdminRoutePage,
  tripSummary: AdminRoutePage,
  tripOperation: AdminRoutePage,
  tripMoney: AdminRoutePage,
  tripDocuments: AdminRoutePage,
  tripIncidents: AdminRoutePage,
  tripHistory: AdminRoutePage,
  vehicleDetail: AdminRoutePage,
  driverDetail: AdminRoutePage,
  clientDetail: AdminRoutePage,
  settlementDetail: AdminRoutePage,
  maintenanceDetail: AdminRoutePage,
};
