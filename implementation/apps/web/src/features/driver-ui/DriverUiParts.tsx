import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/primitives/Button";
import { Icon, type IconName } from "../../components/primitives/Icon";
import { StatusChip } from "../../components/primitives/StatusChip";
import type { DriverTripRow } from "./driver-data";

const tripStatusLabels: Readonly<Record<string, string>> = {
  scheduled: "Programado",
  loading: "En carga",
  in_transit: "En tránsito",
  unloading: "En descarga",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

const routeMilestones = ["Carga", "Ruta", "Descarga", "Entrega"] as const;

function currentRouteMilestone(status: string): number {
  if (status === "in_transit") return 1;
  if (status === "unloading") return 2;
  if (status === "completed") return 3;
  return 0;
}

export function formatTripStatus(status: string): string {
  return tripStatusLabels[status] ?? status;
}

export function formatDriverDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DriverPageHeader({
  description,
  eyebrow,
  title,
}: {
  readonly description: string;
  readonly eyebrow?: string;
  readonly title: string;
}): React.JSX.Element {
  return (
    <header className="driver-page-header">
      {eyebrow === undefined ? null : <p className="driver-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      <span>{description}</span>
    </header>
  );
}

export function DriverTripSummary({
  trip,
  compact = false,
}: {
  readonly trip: DriverTripRow;
  readonly compact?: boolean;
}): React.JSX.Element {
  const activeMilestone = currentRouteMilestone(trip.operational_status);

  return (
    <section
      className={`driver-trip-summary ${compact ? "driver-trip-summary--compact" : ""}`}
      aria-label={`Viaje ${trip.code}`}
    >
      <div className="driver-trip-summary__top">
        <div>
          <p className="driver-eyebrow">Tu viaje activo</p>
          <strong>{trip.code}</strong>
        </div>
        <div className="driver-trip-summary__status">
          <small>Estado registrado en este dispositivo</small>
          <StatusChip label={formatTripStatus(trip.operational_status)} tone="info" />
        </div>
      </div>
      <div className="driver-trip-summary__route">
        <span>{trip.origin}</span>
        <Icon name="route" size={22} />
        <span>{trip.destination}</span>
      </div>
      {compact ? null : (
        <>
          <ol className="driver-route-progress" aria-label="Progreso operativo del viaje">
            {routeMilestones.map((label, index) => {
              const state =
                index < activeMilestone
                  ? "complete"
                  : index === activeMilestone
                    ? "current"
                    : "upcoming";
              return (
                <li
                  {...(state === "current" ? { "aria-current": "step" as const } : {})}
                  data-state={state}
                  key={label}
                >
                  <span aria-hidden="true">{index + 1}</span>
                  <small>{label}</small>
                </li>
              );
            })}
          </ol>
          <p className="driver-trip-summary__guidance">
            Sigue la etapa resaltada y completa el siguiente hito cuando corresponda.
          </p>
        </>
      )}
      <dl>
        <div>
          <dt>Unidad</dt>
          <dd>{trip.plate ?? "Sin placa disponible"}</dd>
        </div>
        <div>
          <dt>Kilometraje de referencia</dt>
          <dd>
            {trip.current_odometer_km === null
              ? "Pendiente"
              : `${trip.current_odometer_km.toLocaleString("es-PE")} km`}
          </dd>
          <small>Verifica el odómetro visible antes de registrar una nueva lectura.</small>
        </div>
        <div>
          <dt>{trip.started_at === null ? "Salida programada" : "Salida registrada"}</dt>
          <dd>{formatDriverDate(trip.started_at ?? trip.scheduled_at)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function DriverLoadingState(): React.JSX.Element {
  return (
    <div className="driver-state" role="status">
      <span className="driver-spinner" />
      Cargando la información guardada en este dispositivo…
    </div>
  );
}

export function DriverErrorState({ message }: { readonly message: string }): React.JSX.Element {
  return (
    <div className="driver-state driver-state--error" role="alert">
      <Icon name="alert" />
      {message}
    </div>
  );
}

export function NoActiveTrip(): React.JSX.Element {
  return (
    <section className="driver-empty-state">
      <span>
        <Icon name="route" size={26} />
      </span>
      <h2>No tienes un viaje en ejecución</h2>
      <p>
        Para registrar combustible, gastos, kilometraje o una incidencia, primero inicia el viaje
        asignado desde Mi viaje.
      </p>
      <Link to="/mi-viaje">Volver a Mi viaje</Link>
    </section>
  );
}

export function DriverFormCard({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <section className="driver-form-card">
      <div className="driver-form-card__review">
        <span aria-hidden="true">
          <Icon name="file" size={17} />
        </span>
        <p>
          <strong>Revisa los datos antes de guardar.</strong> Se guardarán primero en este
          dispositivo y se enviarán cuando haya conexión.
        </p>
      </div>
      {children}
    </section>
  );
}

type DriverFieldGuidance = {
  readonly hint: string;
  readonly example?: string;
};

const driverGuidanceByLabel: Readonly<Record<string, DriverFieldGuidance>> = {
  "¿Qué pasó?": {
    hint: "Elige el hecho principal para que Administración reciba la alerta correcta.",
    example: "Avería si la unidad no puede continuar",
  },
  "Acción tomada": {
    hint: "Opcional. Indica qué hiciste para contener el problema antes de reportarlo.",
    example: "Avisé a la central y estacioné en zona segura",
  },
  Cantidad: {
    hint: "Ingresa el volumen real que aparece en el comprobante o surtidor.",
    example: "18.5",
  },
  Categoría: {
    hint: "Elige la categoría que explica mejor el gasto realizado en ruta.",
  },
  "Cambiar condición de carga": {
    hint: "Selecciona cómo quedó la unidad en el momento del cambio.",
    example: "Vacío después de descargar",
  },
  "Condición de carga al iniciar": {
    hint: "Indica cómo sale la unidad antes de iniciar el recorrido.",
    example: "Con carga",
  },
  Descripción: {
    hint: "Describe el hecho con información observable y útil para quien lo revisará.",
    example: "Llantas traseras con baja presión en el km 48",
  },
  "Fecha y hora": {
    hint: "Confirma que corresponde al momento real del registro antes de guardarlo.",
  },
  Grifo: {
    hint: "Elige el grifo si lo reconoces; puedes dejarlo como no identificado si no aparece.",
  },
  Kilometraje: {
    hint: "Registra la lectura visible del odómetro al momento del abastecimiento.",
    example: "12 500",
  },
  "Kilometraje final": {
    hint: "Registra la lectura visible una vez que la descarga haya terminado.",
    example: "12 840",
  },
  "Kilometraje inicial": {
    hint: "Registra la lectura visible antes de mover la unidad.",
    example: "12 500",
  },
  "Lectura (km)": {
    hint: "Registra la lectura exacta que ves en el odómetro.",
    example: "12 650",
  },
  Momento: {
    hint: "Indica en qué punto del viaje se tomó esta lectura.",
  },
  "Monto (S/)": {
    hint: "Ingresa el importe real pagado, sin símbolo de moneda.",
    example: "42.50",
  },
  "Monto total (S/)": {
    hint: "Ingresa el total real de la venta de combustible, sin símbolo de moneda.",
    example: "320.00",
  },
  Nota: {
    hint: "Opcional. Añade solo un dato que ayude a comprender el gasto después.",
    example: "Peaje de salida en Pucusana",
  },
  "Odómetro al cambio": {
    hint: "Registra la lectura visible cuando cambia la condición de carga.",
    example: "12 720",
  },
  Proveedor: {
    hint: "Elige el proveedor si lo reconoces; puedes dejarlo como no identificado.",
  },
  Severidad: {
    hint: "Elige el nivel según el impacto real en la seguridad, la carga o la continuidad del viaje.",
  },
  Ubicación: {
    hint: "Indica una referencia que permita ubicar el hecho sin ambigüedad.",
    example: "Km 48 de la Panamericana Sur",
  },
  Unidad: {
    hint: "Elige la misma unidad de volumen que figura en el comprobante o surtidor.",
  },
};

function driverFieldGuidance(label: string): DriverFieldGuidance {
  return (
    driverGuidanceByLabel[label] ?? {
      hint: "Registra solo el dato real que corresponde a este momento del viaje.",
    }
  );
}

export function DriverField({
  children,
  hint,
  label,
}: PropsWithChildren<{ readonly hint?: string; readonly label: string }>): React.JSX.Element {
  const guidance = driverFieldGuidance(label);
  return (
    <label className="driver-field">
      <span>{label}</span>
      {children}
      <small>
        {hint ?? guidance.hint}
        {guidance.example === undefined ? null : ` Ejemplo: ${guidance.example}.`}
      </small>
    </label>
  );
}

export function CaptureResult({
  error,
  saved,
}: {
  readonly error: string | null;
  readonly saved: string | null;
}): React.JSX.Element | null {
  if (error !== null) {
    return (
      <div className="driver-feedback driver-feedback--error" role="alert">
        <span className="driver-feedback__icon">
          <Icon name="alert" />
        </span>
        <span className="driver-feedback__copy">
          <strong>No se guardó el registro</strong>
          <small>{error}</small>
        </span>
      </div>
    );
  }

  if (saved !== null) {
    return (
      <div className="driver-feedback driver-feedback--success" role="status">
        <span className="driver-feedback__icon">
          <Icon name="offline" />
        </span>
        <span className="driver-feedback__copy">
          <strong>
            Guardado local <em>Pendiente</em>
          </strong>
          <small>{saved}</small>
          <Link to="/sincronizacion">Ver estado del envío</Link>
        </span>
      </div>
    );
  }

  return null;
}

export function DriverSubmitButton({
  busy,
  children,
  icon,
}: PropsWithChildren<{ readonly busy: boolean; readonly icon?: IconName }>): React.JSX.Element {
  return (
    <Button
      className="driver-submit"
      disabled={busy}
      {...(icon === undefined ? {} : { icon })}
      type="submit"
    >
      {busy ? "Guardando…" : children}
    </Button>
  );
}

export function DriverActionCard({
  copy,
  icon,
  label,
  to,
}: {
  readonly copy: string;
  readonly icon: IconName;
  readonly label: string;
  readonly to: string;
}): React.JSX.Element {
  return (
    <Link className="driver-action-card" to={to}>
      <span>
        <Icon name={icon} size={23} />
      </span>
      <div>
        <strong>{label}</strong>
        <small>{copy}</small>
      </div>
      <Icon name="chevron" size={18} />
    </Link>
  );
}

export function DriverSectionTitle({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return <h2 className="driver-section-title">{children}</h2>;
}
