import { usePowerSync, useQuery } from "@powersync/react";
import { Link } from "react-router-dom";
import { useIdentity } from "../identity/IdentityProvider";
import { getOrCreateDeviceId } from "./device-and-evidence";
import { MovementForm } from "../operation-mode/QuickWorkspace";
import { CycleCaptureChannel } from "../operation-mode/CycleCaptureChannel";
import { enqueueOperationCommand, makeOperationCommand } from "../operation-mode/operation-command";

interface DriverCycle {
  readonly id: string;
  readonly code: string;
  readonly status: string;
  readonly capture_channel: string;
  readonly primary_driver_id: string;
}
export function useDriverCycle() {
  const state = useIdentity().state;
  const profileId = state.status === "READY" ? state.identity.profile.id : "";
  const query = useQuery<DriverCycle>(
    `SELECT c.id,c.code,c.status,c.capture_channel,c.primary_driver_id
    FROM operational_cycles c JOIN drivers d ON d.id=c.primary_driver_id
    WHERE d.profile_id=? AND c.status IN ('planned','active') ORDER BY c.created_at DESC LIMIT 1`,
    [profileId],
  );
  return { cycle: query.data[0] ?? null, isLoading: query.isLoading };
}
export function DriverCycleCapture({
  cycle,
  action,
}: {
  readonly cycle: DriverCycle;
  readonly action?: "expense" | "fuel";
}): React.JSX.Element {
  const database = usePowerSync();
  const state = useIdentity().state;
  const { data: categories } = useQuery<{ id: string; name: string }>(
    "SELECT id,name FROM expense_categories WHERE active=1 ORDER BY name",
  );
  if (state.status !== "READY") return <p>Preparando tu salida…</p>;
  const context = { companyId: state.identity.company.id, profileId: state.identity.profile.id };
  return (
    <section className="driver-page">
      <h1>Mi salida · {cycle.code}</h1>
      <p>El dinero y los gastos corresponden a todo el recorrido hasta regresar a Cusco.</p>
      {cycle.capture_channel !== "driver_app" ? (
        <p>Oficina está registrando la actividad de esta salida.</p>
      ) : action ? (
        <MovementForm
          context={context}
          cycleId={cycle.id}
          action={action}
          options={null}
          categories={categories.map((c) => ({ id: c.id, label: c.name, status: "" }))}
          onSave={(body, id) =>
            enqueueOperationCommand(database, makeOperationCommand(body, id), {
              ...context,
              sourceDeviceId: getOrCreateDeviceId(),
            })
          }
        />
      ) : (
        <div className="operation-quick-actions">
          <Link to="/registrar/gasto">Registrar gasto</Link>
          <Link to="/registrar/combustible">Registrar combustible</Link>
        </div>
      )}
      <CycleCaptureChannel cycleId={cycle.id} canChange={false} />
      <Link to="/sincronizacion">Ver registros pendientes y sincronización</Link>
    </section>
  );
}
