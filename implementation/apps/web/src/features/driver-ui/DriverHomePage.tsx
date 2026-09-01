import { Link } from "react-router-dom";
import { Icon } from "../../components/primitives/Icon";
import { StatusChip } from "../../components/primitives/StatusChip";
import { useIdentity } from "../identity/IdentityProvider";
import {
  DriverErrorState,
  DriverLoadingState,
  DriverPageHeader,
  DriverTripSummary,
  formatDriverDate,
} from "./DriverUiParts";
import { useDriverTrips } from "./driver-data";
import { DriverTripLifecycle } from "./DriverTripLifecycle";

const driverRegisterActions = [
  {
    to: "/registrar/combustible",
    icon: "fuel" as const,
    label: "Combustible",
    copy: "Abastecimiento, kilometraje y comprobante",
  },
  {
    to: "/registrar/gasto",
    icon: "money" as const,
    label: "Gasto",
    copy: "Monto, categoría y evidencia",
  },
  {
    to: "/registrar/kilometraje",
    icon: "gauge" as const,
    label: "Kilometraje",
    copy: "Lectura visible del odómetro",
  },
  {
    to: "/registrar/incidencia",
    icon: "alert" as const,
    label: "Incidencia",
    copy: "Avería, retraso u otro problema",
  },
] as const;

export function getDriverHomeRegisterGuidance(
  hasActiveTrip: boolean,
  hasNextTrip: boolean,
): { readonly title: string; readonly copy: string } {
  if (hasActiveTrip) {
    return {
      title: "¿Qué necesitas registrar?",
      copy: "Elige lo que ocurrió durante el viaje. Cada registro se guarda primero en este dispositivo.",
    };
  }

  if (hasNextTrip) {
    return {
      title: "Los registros se habilitan al iniciar el viaje",
      copy: "Cuando la unidad esté lista para salir, registra el kilometraje inicial. Después podrás guardar combustible, gastos, kilometraje e incidencias.",
    };
  }

  return {
    title: "Los registros se activan durante un viaje",
    copy: "Cuando Administración te asigne una salida, aquí podrás guardar combustible, gastos, kilometraje e incidencias.",
  };
}

export function DriverHomePage(): React.JSX.Element {
  const { state } = useIdentity();
  const trips = useDriverTrips();
  const name = state.status === "READY" ? state.identity.profile.displayName : "Conductor";
  const registerGuidance = getDriverHomeRegisterGuidance(
    trips.activeTrip !== null && trips.activeTrip.capture_mode === "driver_app",
    trips.nextTrip !== null,
  );

  if (trips.isLoading) {
    return <DriverLoadingState />;
  }

  if (trips.error !== null) {
    return (
      <DriverErrorState message="No pudimos cargar la información del viaje en este dispositivo. Vuelve a intentarlo o revisa la sincronización si el problema continúa." />
    );
  }

  return (
    <div className="driver-page">
      <DriverPageHeader
        description="Consulta tu viaje, sigue la etapa en curso y registra lo que suceda en la ruta. Cada registro se guarda primero en este dispositivo."
        eyebrow="Ruta de hoy"
        title={`Hola, ${name}`}
      />

      {trips.activeTrip === null ? (
        <section className="driver-home-empty">
          <div>
            <span>Sin viaje activo</span>
            <StatusChip label="Disponible" tone="success" />
          </div>
          <h2>
            {trips.nextTrip === null
              ? "No tienes una salida asignada"
              : "Tu próximo viaje está programado"}
          </h2>
          {trips.nextTrip === null ? (
            <p>
              No necesitas registrar nada por ahora. Cuando Administración asigne una salida a tu
              cuenta, aquí verás la ruta, la unidad y la acción que puedes realizar.
            </p>
          ) : (
            <>
              <p>
                Verifica la ruta y registra el kilometraje inicial cuando la unidad esté lista para
                salir.
              </p>
              <dl className="driver-home-empty__details">
                <div>
                  <dt>Ruta</dt>
                  <dd>
                    {trips.nextTrip.origin} → {trips.nextTrip.destination}
                  </dd>
                </div>
                <div>
                  <dt>Viaje</dt>
                  <dd>{trips.nextTrip.code}</dd>
                </div>
                <div>
                  <dt>Salida programada</dt>
                  <dd>{formatDriverDate(trips.nextTrip.scheduled_at)}</dd>
                </div>
              </dl>
            </>
          )}
        </section>
      ) : (
        <>
          <DriverTripSummary trip={trips.activeTrip} />
          <DriverTripLifecycle trip={trips.activeTrip} />
        </>
      )}

      {trips.activeTrip === null && trips.nextTrip !== null ? (
        <DriverTripLifecycle trip={trips.nextTrip} />
      ) : null}

      <section className="driver-home-register" aria-labelledby="driver-register-title">
        <div className="driver-home-register__heading">
          <div>
            <p className="driver-eyebrow">Bitácora de ruta</p>
            <h2 id="driver-register-title">{registerGuidance.title}</h2>
          </div>
          <small>{registerGuidance.copy}</small>
        </div>
        {trips.activeTrip === null || trips.activeTrip.capture_mode !== "driver_app" ? null : (
          <div className="driver-home-register__actions">
            {driverRegisterActions.map((action) => (
              <Link key={action.to} to={action.to}>
                <Icon name={action.icon} />
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.copy}</small>
                </span>
              </Link>
            ))}
          </div>
        )}
        {trips.activeTrip?.capture_mode === "staff_assisted" ? (
          <p className="driver-authoritative-note" role="status">
            La oficina controla este viaje. Los registros operativos están temporalmente bloqueados
            para evitar duplicados.
          </p>
        ) : null}
      </section>

      <Link className="driver-sync-shortcut" to="/sincronizacion">
        <span className="driver-sync-shortcut__icon">
          <Icon name="offline" size={19} />
        </span>
        <span>
          <strong>Revisar sincronización</strong>
          <small>
            Consulta qué quedó guardado aquí, qué espera envío y si algún registro requiere
            revisión.
          </small>
        </span>
        <Icon name="chevron" size={18} />
      </Link>
    </div>
  );
}
