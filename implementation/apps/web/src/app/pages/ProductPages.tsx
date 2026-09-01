import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../../components/primitives/Button";
import { Icon, type IconName } from "../../components/primitives/Icon";
import { StatusChip } from "../../components/primitives/StatusChip";
import { AdminRoutePage, adminRouteComponents } from "../../features/admin-ui/AdminRoutePage";
import { GpsOdometerManagementPage } from "../../features/gps-odometer-management/GpsOdometerManagementPage";
import { TripEvaluatorPage } from "../../features/trip-evaluator";
import {
  DriverExpensePage,
  DriverFuelPage,
  DriverHistoryPage,
  DriverHomePage as ProductDriverHomePage,
  DriverIncidentPage,
  DriverOdometerPage,
  DriverRegisterPage,
  DriverSynchronizationPage,
} from "../../features/driver-ui";
import { useIdentity } from "../../features/identity/IdentityProvider";
import { useAuth } from "../../features/auth/AuthProvider";
import { routePaths, type ProductRouteId } from "../routing/route-model";
import { getProductRouteIdForPath } from "../routing/route-experience";
import "./product-pages.css";

interface PageHeaderProps {
  readonly actionHref?: string;
  readonly actionLabel?: string;
  readonly eyebrow?: string;
  readonly description: string;
  readonly title: string;
}

function PageHeader({
  actionHref,
  actionLabel,
  description,
  eyebrow,
  title,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className="page-header">
      <div>
        {eyebrow === undefined ? null : <p className="page-header__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actionHref === undefined || actionLabel === undefined ? null : (
        <Link className="page-header__action" to={actionHref}>
          <Icon name="plus" size={18} />
          {actionLabel}
        </Link>
      )}
    </header>
  );
}

function EmptyWorkspace({
  actionHref,
  actionLabel,
  copy,
  icon,
  title,
}: {
  readonly actionHref?: string;
  readonly actionLabel?: string;
  readonly copy: string;
  readonly icon: IconName;
  readonly title: string;
}): React.JSX.Element {
  return (
    <section className="empty-workspace">
      <span className="empty-workspace__icon">
        <Icon name={icon} size={24} />
      </span>
      <h2>{title}</h2>
      <p>{copy}</p>
      {actionHref === undefined || actionLabel === undefined ? null : (
        <Link className="empty-workspace__action" to={actionHref}>
          {actionLabel}
        </Link>
      )}
    </section>
  );
}

export function DashboardPage(): React.JSX.Element {
  const { state } = useIdentity();
  const name =
    state.status === "READY" ? (state.identity.profile.displayName.split(" ")[0] ?? "") : "";

  return (
    <>
      <PageHeader
        actionHref={routePaths.fleet}
        actionLabel="Registrar primera unidad"
        description="Empieza preparando los datos de la operación. Cuando haya información registrada, aquí verás lo que requiere atención y el estado real de los viajes."
        eyebrow="Centro de control"
        title={`Buenos días${name.length > 0 ? `, ${name}` : ""}`}
      />
      <section className="dashboard-start" aria-labelledby="dashboard-start-title">
        <div className="dashboard-start__heading">
          <p className="dashboard-start__eyebrow">Primeros pasos</p>
          <h2 id="dashboard-start-title">Prepara la operación antes de crear un viaje</h2>
          <p>
            Un viaje necesita una unidad, un conductor con acceso y un cliente. Regístralos en este
            orden para evitar campos vacíos o asignaciones que no puedan usarse.
          </p>
        </div>
        <ol>
          <li>
            <span aria-hidden="true">1</span>
            <div>
              <strong>Registra una unidad</strong>
              <p>Por ejemplo: placa, kilometraje de referencia y disponibilidad.</p>
            </div>
            <Link to={routePaths.fleet}>Abrir flota</Link>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div>
              <strong>Registra al conductor</strong>
              <p>Por ejemplo: licencia vigente y acceso vinculado a la aplicación.</p>
            </div>
            <Link to={routePaths.drivers}>Abrir conductores</Link>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>
              <strong>Registra al cliente</strong>
              <p>Por ejemplo: razón social y condición de pago del servicio.</p>
            </div>
            <Link to={routePaths.clients}>Abrir clientes</Link>
          </li>
        </ol>
      </section>
      <div className="dashboard-grid">
        <section className="workspace-panel workspace-panel--wide">
          <div className="workspace-panel__header">
            <div>
              <h2>Estado de la flota</h2>
              <p>Disponibilidad, kilometraje y la siguiente acción de cada unidad.</p>
            </div>
            <StatusChip label="Sin datos cargados" />
          </div>
          <EmptyWorkspace
            actionHref={routePaths.fleet}
            actionLabel="Registrar primera unidad"
            copy="Registra la placa y el kilometraje de referencia de cada unidad. Con ello podrás programar viajes y controlar su disponibilidad."
            icon="truck"
            title="Aún no hay unidades registradas"
          />
        </section>
        <section className="workspace-panel">
          <div className="workspace-panel__header">
            <div>
              <h2>Atención prioritaria</h2>
              <p>Alertas, rendiciones y cobros que necesitarán revisión.</p>
            </div>
          </div>
          <div className="quiet-state">
            <Icon name="alert" />
            <p>Las alertas aparecerán aquí cuando exista operación para revisar.</p>
          </div>
        </section>
        <section className="workspace-panel workspace-panel--wide">
          <div className="workspace-panel__header">
            <div>
              <h2>Viajes recientes</h2>
              <p>Ruta, unidad, etapa y fecha de los servicios creados.</p>
            </div>
            <Link to={routePaths.trips}>Ver todos</Link>
          </div>
          <div className="table-placeholder" role="table" aria-label="Viajes recientes">
            <div className="table-placeholder__head" role="row">
              <span>Código</span>
              <span>Ruta</span>
              <span>Unidad</span>
              <span>Estado</span>
              <span>Fecha</span>
            </div>
            <div className="table-placeholder__empty">
              Aún no hay viajes creados. Primero registra cliente, unidad y conductor; después
              podrás crear y programar el servicio.
            </div>
          </div>
        </section>
        <section className="workspace-panel">
          <div className="workspace-panel__header">
            <div>
              <h2>Cobranza</h2>
              <p>Facturas emitidas, pagos registrados y vencimientos.</p>
            </div>
          </div>
          <div className="dashboard-info-state">
            <span className="dashboard-info-state__icon">
              <Icon name="money" size={20} />
            </span>
            <div>
              <strong>La cobranza aparecerá al registrar facturas.</strong>
              <p>Al completar un viaje podrás emitir el comprobante y seguir su pago desde aquí.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export function DriverHomePage(): React.JSX.Element {
  const { state } = useIdentity();
  const name = state.status === "READY" ? state.identity.profile.displayName : "Conductor";

  return (
    <div className="driver-home">
      <PageHeader
        description="Aquí verás tu viaje asignado, la siguiente acción y los registros disponibles durante la ruta."
        eyebrow="Mi turno"
        title={`Hola, ${name}`}
      />
      <section className="driver-trip-card">
        <div className="driver-trip-card__top">
          <span className="driver-trip-card__plate">SIN ASIGNACIÓN</span>
          <StatusChip label="Disponible" tone="success" />
        </div>
        <h2>No tienes un viaje activo</h2>
        <p>
          No necesitas registrar nada por ahora. Cuando Administración te asigne una salida, aquí
          verás la ruta, la unidad y la acción que puedes realizar.
        </p>
      </section>
      <section className="driver-quick-actions" aria-label="Registros disponibles durante un viaje">
        <article>
          <Icon name="fuel" />
          <span>
            <strong>Combustible</strong>
            <small>Abastecimiento, kilometraje y comprobante.</small>
          </span>
        </article>
        <article>
          <Icon name="money" />
          <span>
            <strong>Gasto</strong>
            <small>Monto, categoría y evidencia.</small>
          </span>
        </article>
        <article>
          <Icon name="gauge" />
          <span>
            <strong>Kilometraje</strong>
            <small>Lectura visible del odómetro.</small>
          </span>
        </article>
        <article>
          <Icon name="camera" />
          <span>
            <strong>Incidencia</strong>
            <small>Avería, retraso u otro problema.</small>
          </span>
        </article>
      </section>
      <p className="driver-offline-note">
        <Icon name="offline" size={17} /> Durante un viaje, los registros se guardan primero en este
        dispositivo y podrás revisar su envío en Sincronización.
      </p>
    </div>
  );
}

const pageCatalog: Partial<
  Readonly<
    Record<
      ProductRouteId,
      {
        readonly actionHref?: string;
        readonly actionLabel?: string;
        readonly copy: string;
        readonly description: string;
        readonly icon: IconName;
        readonly title: string;
      }
    >
  >
> = {
  trips: {
    title: "Viajes",
    description:
      "Planifica y sigue cada servicio comercial sin mezclar su cierre administrativo o financiero.",
    icon: "route",
    copy: "Crea el primer viaje cuando existan cliente, unidad y conductor disponibles.",
    actionHref: routePaths.newTrip,
    actionLabel: "Nuevo viaje",
  },
  scheduling: {
    title: "Programación",
    description: "Asigna recursos con validaciones de disponibilidad, documentos y mantenimiento.",
    icon: "calendar",
    copy: "Los viajes aprobados aparecerán aquí listos para asignar.",
  },
  fleet: {
    title: "Flota",
    description: "Estado, kilometraje, documentos e historial operativo de las unidades.",
    icon: "truck",
    copy: "Registra las tres unidades reales de R&T para habilitar la programación.",
    actionHref: "/flota/nuevo",
    actionLabel: "Registrar unidad",
  },
  drivers: {
    title: "Conductores",
    description: "Disponibilidad, licencia, vínculo y asignaciones vigentes.",
    icon: "users",
    copy: "Registra los conductores reales y vincula sus cuentas cuando corresponda.",
    actionHref: "/conductores/nuevo",
    actionLabel: "Registrar conductor",
  },
  clients: {
    title: "Clientes",
    description: "Maestro comercial y condiciones de pago por empresa.",
    icon: "building",
    copy: "Agrega clientes para crear viajes y controlar la cobranza.",
    actionHref: "/clientes/nuevo",
    actionLabel: "Nuevo cliente",
  },
  expenses: {
    title: "Gastos",
    description: "Revisión de gastos operativos y sus comprobantes.",
    icon: "money",
    copy: "Los gastos enviados desde viaje o flota aparecerán aquí para revisión.",
  },
  advances: {
    title: "Adelantos",
    description: "Fondos entregados a conductores y obligación pendiente de rendición.",
    icon: "money",
    copy: "Registra adelantos vinculados a un viaje programado.",
  },
  settlements: {
    title: "Rendiciones",
    description: "Conciliación de adelantos, gastos aprobados y saldos.",
    icon: "money",
    copy: "Las rendiciones se abrirán al completar el transporte.",
  },
  collections: {
    title: "Cobranza",
    description: "Facturas, pagos parciales, saldos y vencimientos.",
    icon: "money",
    copy: "Emite una factura desde un viaje completado para iniciar la cobranza.",
  },
  maintenance: {
    title: "Mantenimiento",
    description: "Planes por fecha o kilometraje, órdenes de trabajo y repuestos.",
    icon: "tool",
    copy: "Crea planes de mantenimiento después de registrar la flota.",
    actionHref: routePaths.newMaintenance,
    actionLabel: "Nueva orden",
  },
  documents: {
    title: "Documentos",
    description: "Vigencias y archivos privados de empresa, flota, conductores y viajes.",
    icon: "file",
    copy: "Carga documentos críticos para activar bloqueos y alertas de vencimiento.",
  },
  alerts: {
    title: "Alertas",
    description: "Riesgos operativos ordenados por prioridad y fecha límite.",
    icon: "alert",
    copy: "No existen alertas activas.",
  },
  reports: {
    title: "Reportes",
    description: "Margen directo, utilización, kilómetros vacíos, combustible y cobranza.",
    icon: "chart",
    copy: "Los indicadores se habilitarán automáticamente con la operación real.",
  },
  companySettings: {
    title: "Empresa",
    description: "Datos básicos de R&T SITRAM SAC y estado operativo.",
    icon: "settings",
    copy: "La edición de empresa está reservada a Gerencia.",
  },
  profileSettings: {
    title: "Perfiles",
    description: "Usuarios, roles y estado de acceso dentro de la empresa.",
    icon: "users",
    copy: "Los perfiles se crean mediante el flujo administrativo seguro.",
  },
  profile: {
    title: "Mi perfil",
    description: "Identidad, empresa y rol de la sesión actual.",
    icon: "users",
    copy: "Tu perfil está protegido por Supabase Auth y RLS.",
  },
  synchronization: {
    title: "Sincronización",
    description: "Registros locales pendientes, errores y estado del dispositivo.",
    icon: "wifi",
    copy: "No hay movimientos pendientes de sincronizar.",
  },
  myTripHistory: {
    title: "Historial",
    description: "Viajes que ya completaste.",
    icon: "calendar",
    copy: "Todavía no tienes viajes finalizados.",
  },
};

export function CatalogPage({ routeId }: { readonly routeId: ProductRouteId }): React.JSX.Element {
  const page = pageCatalog[routeId];

  if (page === undefined) {
    return <WorkflowPage routeId={routeId} />;
  }

  return (
    <>
      <PageHeader
        description={page.description}
        title={page.title}
        {...(page.actionHref === undefined ? {} : { actionHref: page.actionHref })}
        {...(page.actionLabel === undefined ? {} : { actionLabel: page.actionLabel })}
      />
      <section className="workspace-panel workspace-panel--standalone">
        <div className="list-toolbar">
          <label>
            <span className="sr-only">Buscar</span>
            <Icon name="search" size={18} />
            <input
              aria-label={`Buscar en ${page.title}`}
              placeholder={`Buscar en ${page.title.toLowerCase()}…`}
            />
          </label>
          <Button variant="secondary">Filtros</Button>
        </div>
        <EmptyWorkspace
          copy={page.copy}
          icon={page.icon}
          title={`Sin ${page.title.toLowerCase()} todavía`}
          {...(page.actionHref === undefined ? {} : { actionHref: page.actionHref })}
          {...(page.actionLabel === undefined ? {} : { actionLabel: page.actionLabel })}
        />
      </section>
    </>
  );
}

function MyProfilePage(): React.JSX.Element {
  const { state: identityState } = useIdentity();
  const { state: authState, signOut, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (identityState.status !== "READY") {
    return (
      <EmptyWorkspace
        copy="Estamos confirmando los datos de tu sesión."
        icon="users"
        title="Preparando perfil"
      />
    );
  }
  const { profile, company } = identityState.identity;
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const roleLabels = {
    management: "Gerencia",
    administration: "Administración",
    accounting: "Contabilidad",
    driver: "Conductor",
  } as const;
  const changePassword = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (password.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setMessage("Tu contraseña se actualizó correctamente.");
  };
  return (
    <>
      <PageHeader description="Tu identidad, acceso y opciones de sesión." title="Mi perfil" />
      <section className="workspace-panel profile-panel">
        <dl>
          <div>
            <dt>Nombre</dt>
            <dd>{profile.displayName}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{authState.session?.user.email ?? "No disponible"}</dd>
          </div>
          <div>
            <dt>Empresa</dt>
            <dd>{company.tradeName ?? company.legalName}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>
              <StatusChip label={roleLabels[profile.role]} tone="info" />
            </dd>
          </div>
          <div>
            <dt>Conexión</dt>
            <dd>
              <StatusChip
                label={online ? "Conectado" : "Sin conexión"}
                tone={online ? "success" : "risk"}
              />
            </dd>
          </div>
        </dl>
        <div className="profile-panel__actions">
          <Link className="page-header__action" to={routePaths.synchronization}>
            <Icon name="wifi" size={18} /> Ver sincronización
          </Link>
          {profile.role === "management" ? (
            <Link className="page-header__action" to={routePaths.profileSettings}>
              <Icon name="users" size={18} /> Gestionar perfiles
            </Link>
          ) : null}
          <Button
            onClick={() => {
              void signOut().then((result) => {
                if (!result.ok) setError(result.message);
              });
            }}
            variant="secondary"
          >
            Cerrar sesión
          </Button>
        </div>
      </section>
      <section className="workspace-panel profile-panel">
        <h2>Cambiar contraseña</h2>
        <p>Elige una contraseña nueva para esta cuenta. Este cambio requiere conexión.</p>
        <form className="profile-panel__form" onSubmit={(event) => void changePassword(event)}>
          <label>
            Nueva contraseña
            <small>
              Usa al menos 8 caracteres y una contraseña que no emplees en otros servicios.
            </small>
            <input
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label>
            Repite la nueva contraseña
            <small>Escríbela exactamente igual para confirmar que no tiene errores.</small>
            <input
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          {error === null ? null : (
            <p className="auth-feedback auth-feedback--error" role="alert">
              {error}
            </p>
          )}
          {message === null ? null : (
            <p className="auth-feedback" role="status">
              {message}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy ? "Guardando…" : "Actualizar contraseña"}
          </Button>
        </form>
      </section>
    </>
  );
}

const workflowCopy: Partial<
  Readonly<Record<ProductRouteId, { readonly description: string; readonly title: string }>>
> = {
  newTrip: {
    title: "Nuevo viaje",
    description: "Define el servicio comercial. La asignación se validará antes de programar.",
  },
  newMaintenance: {
    title: "Nueva orden de trabajo",
    description: "Registra el mantenimiento y la indisponibilidad de la unidad.",
  },
  register: {
    title: "Registrar actividad",
    description: "Elige el movimiento que quieres guardar durante tu viaje.",
  },
  registerFuel: {
    title: "Registrar combustible",
    description: "Guarda abastecimiento, kilometraje y comprobante, incluso sin conexión.",
  },
  registerExpense: {
    title: "Registrar gasto",
    description: "Registra el monto, categoría y evidencia del gasto.",
  },
  registerIncident: {
    title: "Registrar incidencia",
    description: "Describe el evento y adjunta evidencia sin demorar la operación.",
  },
  registerOdometer: {
    title: "Registrar kilometraje",
    description:
      "El servidor conserva la lectura y protege el kilometraje oficial cuando exista una fuente GPS autorizada.",
  },
};

export function WorkflowPage({ routeId }: { readonly routeId: ProductRouteId }): React.JSX.Element {
  const copy = workflowCopy[routeId] ?? {
    title: "Detalle operativo",
    description: "Consulta y ejecuta las acciones permitidas para este registro.",
  };
  const isDriverRecord = routeId.startsWith("register");

  return (
    <>
      <PageHeader description={copy.description} title={copy.title} />
      <section className="workflow-panel">
        {isDriverRecord ? (
          <div className="workflow-panel__offline">
            <Icon name="wifi" size={17} /> Disponible sin conexión
          </div>
        ) : null}
        <div className="workflow-panel__placeholder">
          <Icon name={isDriverRecord ? "camera" : "route"} size={26} />
          <h2>Faltan datos previos</h2>
          <p>
            Este flujo está preparado, pero necesita maestros y una asignación válida antes de crear
            movimientos reales.
          </p>
        </div>
      </section>
    </>
  );
}

export function CurrentRoutePage(): React.JSX.Element {
  const { pathname } = useLocation();
  const { state: identityState } = useIdentity();
  const routeId = getProductRouteIdForPath(pathname) ?? "home";

  if (routeId === "profile") {
    return <MyProfilePage />;
  }

  if (identityState.status === "READY" && identityState.identity.profile.role === "driver") {
    switch (routeId) {
      case "myTrip":
        return <ProductDriverHomePage />;
      case "myTripHistory":
        return <DriverHistoryPage />;
      case "register":
        return <DriverRegisterPage />;
      case "registerFuel":
        return <DriverFuelPage />;
      case "registerExpense":
        return <DriverExpensePage />;
      case "registerIncident":
        return <DriverIncidentPage />;
      case "registerOdometer":
        return <DriverOdometerPage />;
      case "synchronization":
        return <DriverSynchronizationPage />;
      default:
        break;
    }
  }

  if (routeId === "synchronization") {
    return <DriverSynchronizationPage audience="staff" />;
  }

  if (
    identityState.status === "READY" &&
    identityState.identity.profile.role !== "driver" &&
    adminRouteComponents[routeId] !== undefined
  ) {
    return <AdminRoutePage pathname={pathname} routeId={routeId} />;
  }

  if (routeId === "tripEvaluator") {
    return <TripEvaluatorPage />;
  }

  if (routeId === "gpsOdometerSettings") {
    return <GpsOdometerManagementPage />;
  }

  if (routeId === "home") {
    return <DashboardPage />;
  }
  if (routeId === "myTrip") {
    return <DriverHomePage />;
  }
  if (pageCatalog[routeId] !== undefined) {
    return <CatalogPage routeId={routeId} />;
  }
  return <WorkflowPage routeId={routeId} />;
}
