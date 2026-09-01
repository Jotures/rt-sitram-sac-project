import { useState, type FormEvent } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { Button } from "../../components/primitives/Button";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import {
  enqueueTripStartWithLoadState,
  enqueueTripTransition,
  recordTripLoadStateOffline,
} from "../../lib/powersync/product-writes";
import { CaptureResult, DriverField, formatTripStatus } from "./DriverUiParts";
import { getOrCreateDeviceId } from "./device-and-evidence";
import type { DriverTripRow } from "./driver-data";
import { parseNonNegativeNumber } from "./driver-validation";

export function DriverTripLifecycle({
  trip,
}: {
  readonly trip: DriverTripRow;
}): React.JSX.Element | null {
  const network = useNetworkStatus();
  const database = usePowerSync();
  const transitionRequests = useQuery<{ readonly requested_action: string }>(
    `SELECT requested_action FROM trip_transition_requests
     WHERE trip_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM upload_dead_letters d
         WHERE d.source_table = 'trip_transition_requests'
           AND d.source_record_id = trip_transition_requests.id
       )
     ORDER BY created_at, id`,
    [trip.id],
  );
  const [mileage, setMileage] = useState("");
  const [loadState, setLoadState] = useState<"loaded" | "empty">("loaded");
  const [loadStateMileage, setLoadStateMileage] = useState("");
  const [cargoDelivered, setCargoDelivered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const pendingActions = transitionRequests.data
    .map((item) => item.requested_action)
    .filter((action) => !isTransitionConfirmedByServer(trip.server_operational_status, action));
  const projectedStatus = projectTripStatus(trip.server_operational_status, pendingActions);
  const pendingCount = pendingActions.length;

  const execute = async (operation: () => Promise<void>, message: string): Promise<void> => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await operation();
      setSaved(message);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el viaje.");
    } finally {
      setBusy(false);
    }
  };

  const submitStart = (event: FormEvent): void => {
    event.preventDefault();
    void execute(async () => {
      const initialMileage = parseNonNegativeNumber(mileage, "El kilometraje inicial");
      if (trip.vehicle_id === null) throw new Error("El viaje no tiene una unidad asignada.");
      await enqueueTripStartWithLoadState(
        database,
        {
          tripId: trip.id,
          vehicleId: trip.vehicle_id,
          action: "start",
          odometerKm: initialMileage,
          loadState,
        },
        { sourceDeviceId: getOrCreateDeviceId() },
      );
    }, "Inicio y condición de carga guardados en el dispositivo y pendientes de validación del servidor.");
  };

  const submitCompletion = (event: FormEvent): void => {
    event.preventDefault();
    if (!cargoDelivered) {
      setSaved(null);
      setError("Confirma explícitamente que la carga fue entregada antes de completar el viaje.");
      return;
    }
    void execute(async () => {
      const finalMileage = parseNonNegativeNumber(mileage, "El kilometraje final");
      await enqueueTripTransition(
        database,
        {
          tripId: trip.id,
          action: "complete",
          odometerKm: finalMileage,
          cargoDelivered: true,
        },
        { sourceDeviceId: getOrCreateDeviceId() },
      );
    }, "Cierre guardado en el dispositivo y pendiente de validación del servidor.");
  };

  if (!["scheduled", "loading", "in_transit", "unloading"].includes(projectedStatus)) {
    return null;
  }

  return (
    <section className="driver-lifecycle" aria-labelledby="driver-lifecycle-title">
      <div className="driver-lifecycle__heading">
        <div>
          <p className="driver-eyebrow">Próximo hito de la ruta</p>
          <h2 id="driver-lifecycle-title">
            {projectedStatus === "scheduled" || projectedStatus === "loading"
              ? "Iniciar recorrido"
              : projectedStatus === "in_transit"
                ? "Confirmar llegada"
                : "Completar entrega"}
          </h2>
        </div>
        <div className="driver-lifecycle__projection" role="status">
          <small>{pendingCount === 0 ? "Estado confirmado" : "Estado proyectado"}</small>
          <strong>{formatTripStatus(projectedStatus)}</strong>
          <span>
            {pendingCount === 0
              ? "Confirmado por el servidor"
              : `${pendingCount} cambio${pendingCount === 1 ? "" : "s"} esperando confirmación del servidor`}
          </span>
        </div>
      </div>

      {projectedStatus === "scheduled" || projectedStatus === "loading" ? (
        <form className="driver-form" onSubmit={submitStart}>
          <DriverField
            hint={
              trip.current_odometer_km === null
                ? "Ingresa la lectura visible de la unidad."
                : `Última lectura sincronizada: ${trip.current_odometer_km.toLocaleString("es-PE")} km.`
            }
            label="Kilometraje inicial"
          >
            <input
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => setMileage(event.target.value)}
              placeholder="Ej.: 12 500"
              required
              value={mileage}
            />
          </DriverField>
          <DriverField
            hint="Este dato abre el primer tramo medible del viaje."
            label="Condición de carga al iniciar"
          >
            <select
              disabled={busy}
              onChange={(event) => setLoadState(event.target.value as "loaded" | "empty")}
              value={loadState}
            >
              <option value="loaded">Con carga</option>
              <option value="empty">Vacío</option>
            </select>
          </DriverField>
          <Button className="driver-primary-action" disabled={busy} icon="route" type="submit">
            {busy ? "Iniciando…" : "Iniciar viaje"}
          </Button>
        </form>
      ) : null}

      {projectedStatus === "in_transit" ? (
        <div className="driver-lifecycle__arrival">
          <p>Confirma cuando la unidad haya llegado al punto de descarga.</p>
          <form
            className="driver-form driver-lifecycle__load-state"
            onSubmit={(event) => {
              event.preventDefault();
              void execute(async () => {
                if (trip.vehicle_id === null)
                  throw new Error("El viaje no tiene una unidad asignada.");
                const nextMileage = parseNonNegativeNumber(
                  loadStateMileage,
                  "El kilometraje del cambio de carga",
                );
                await recordTripLoadStateOffline(
                  database,
                  {
                    tripId: trip.id,
                    vehicleId: trip.vehicle_id,
                    loadState,
                    odometerKm: nextMileage,
                  },
                  { sourceDeviceId: getOrCreateDeviceId() },
                );
                setLoadStateMileage("");
              }, "Cambio de condición de carga guardado en el dispositivo y pendiente de validación del servidor.");
            }}
          >
            <DriverField label="Cambiar condición de carga">
              <select
                disabled={busy}
                onChange={(event) => setLoadState(event.target.value as "loaded" | "empty")}
                value={loadState}
              >
                <option value="loaded">Con carga</option>
                <option value="empty">Vacío</option>
              </select>
            </DriverField>
            <DriverField label="Odómetro al cambio">
              <input
                disabled={busy}
                inputMode="decimal"
                onChange={(event) => setLoadStateMileage(event.target.value)}
                placeholder="Ej.: 12 720"
                required
                value={loadStateMileage}
              />
            </DriverField>
            <Button disabled={busy} type="submit" variant="secondary">
              Guardar condición
            </Button>
          </form>
          <Button
            className="driver-primary-action"
            disabled={busy}
            icon="route"
            onClick={() =>
              void execute(async () => {
                await enqueueTripTransition(
                  database,
                  { tripId: trip.id, action: "arrive" },
                  { sourceDeviceId: getOrCreateDeviceId() },
                );
              }, "Llegada guardada en el dispositivo y pendiente de validación del servidor.")
            }
          >
            {busy ? "Confirmando…" : "Llegué a descarga"}
          </Button>
        </div>
      ) : null}

      {projectedStatus === "unloading" ? (
        <form className="driver-form" onSubmit={submitCompletion}>
          <DriverField label="Kilometraje final">
            <input
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => setMileage(event.target.value)}
              placeholder="Ej.: 12 840"
              required
              value={mileage}
            />
          </DriverField>
          <label className="driver-confirmation">
            <input
              checked={cargoDelivered}
              disabled={busy}
              onChange={(event) => setCargoDelivered(event.target.checked)}
              required
              type="checkbox"
            />
            <span className="driver-confirmation__copy">
              <span>Confirmo que la carga fue entregada y la descarga terminó.</span>
              <small>
                Márcalo únicamente después de verificar que no queda carga pendiente en la unidad.
              </small>
            </span>
          </label>
          <Button
            className="driver-primary-action"
            disabled={busy || !cargoDelivered}
            icon="route"
            type="submit"
          >
            {busy ? "Completando…" : "Completar viaje"}
          </Button>
        </form>
      ) : null}

      <p className="driver-authoritative-note" role="status">
        {network === "OFFLINE"
          ? "Sin conexión: las solicitudes quedan en este dispositivo hasta recuperar internet."
          : "Cada cambio pasa primero por la cola local. El servidor verifica asignación, orden e idempotencia antes de confirmarlo."}
      </p>
      <CaptureResult error={error} saved={saved} />
    </section>
  );
}

export function projectTripStatus(remoteStatus: string, pendingActions: readonly string[]): string {
  let status = remoteStatus;
  for (const action of pendingActions) {
    if (action === "start" && (status === "scheduled" || status === "loading")) {
      status = "in_transit";
    } else if (action === "arrive" && status === "in_transit") {
      status = "unloading";
    } else if (action === "complete" && status === "unloading") {
      status = "completed";
    }
  }
  return status;
}

export function isTransitionConfirmedByServer(serverStatus: string, action: string): boolean {
  if (action === "start") {
    return ["in_transit", "unloading", "completed"].includes(serverStatus);
  }
  if (action === "arrive") {
    return ["unloading", "completed"].includes(serverStatus);
  }
  return action === "complete" && serverStatus === "completed";
}
