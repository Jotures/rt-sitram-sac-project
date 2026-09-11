import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  AdminDataGateway,
  AdminListRow,
  AdminOperationalCycleRow,
} from "../admin-ui/admin-data";
import { cycleIdentity, cycleNextStep, cycleStateLabel, outingPath } from "./workspace-model";
import { useOperationActivity } from "./useOperationActivity";

export function OperationHome({
  gateway,
  companyId,
}: {
  readonly gateway: AdminDataGateway;
  readonly companyId: string;
}): React.JSX.Element {
  const [cycles, setCycles] = useState<readonly AdminOperationalCycleRow[] | null>(null);
  const [settlements, setSettlements] = useState<readonly AdminListRow[] | null>(null);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [revision, setRevision] = useState(0);
  const commands = useOperationActivity(companyId);
  const confirmation = commands.map((command) => `${command.id}:${command.status}`).join(",");
  useEffect(() => {
    let current = true;
    void Promise.allSettled([gateway.listOperationalCycles(), gateway.listSettlements()]).then(
      ([outings, accounts]) => {
        if (!current) return;
        setCycles(outings.status === "fulfilled" ? outings.value : null);
        setSettlements(accounts.status === "fulfilled" ? accounts.value : null);
        setErrors([
          ...(outings.status === "rejected" ? ["No se pudieron consultar las salidas."] : []),
          ...(accounts.status === "rejected" ? ["No se pudieron consultar las rendiciones."] : []),
        ]);
      },
    );
    return () => {
      current = false;
    };
  }, [gateway, confirmation, revision]);
  const inProgress =
    cycles?.filter((cycle) => cycle.status === "active" && !cycle.returnedAt) ?? [];
  const planned = cycles?.filter((cycle) => cycle.status === "planned") ?? [];
  const accounts = settlements?.filter((row) => !/cerrad|closed|cancel/i.test(row.status)) ?? [];
  const pending = commands.filter((command) => command.status !== "confirmed");
  return (
    <section className="quick-workspace operation-home" aria-label="Resumen de la operación">
      <header className="operation-page-heading">
        <div>
          <h1>Inicio</h1>
          <p>Tu operación y lo que necesita atención.</p>
        </div>
        <Link className="button button--primary" to={outingPath(undefined, "departure")}>
          Registrar salida
        </Link>
      </header>
      {errors.length > 0 && (
        <div className="admin-notice" role="alert">
          {errors.join(" ")}{" "}
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Volver a cargar
          </button>
        </div>
      )}
      <div className="operation-summary" aria-label="Estado de la operación">
        <Link to={`${outingPath()}?estado=active`}>
          <strong>{cycles === null ? "—" : inProgress.length}</strong>
          <span>En recorrido</span>
        </Link>
        <Link to={`${outingPath()}?estado=planned`}>
          <strong>{cycles === null ? "—" : planned.length}</strong>
          <span>Programadas</span>
        </Link>
        <Link to="/finanzas/rendiciones">
          <strong>{settlements === null ? "—" : accounts.length}</strong>
          <span>Rendiciones abiertas</span>
        </Link>
      </div>
      {pending.length > 0 && (
        <Link className="operation-pending-link" to="/sincronizacion">
          <strong>
            {pending.length}{" "}
            {pending.length === 1 ? "registro por confirmar" : "registros por confirmar"}
          </strong>
          <span>
            {pending.some((row) => row.error_message)
              ? "Hay registros que requieren revisión."
              : "Guardados en este dispositivo. Revisa su envío."}
          </span>
        </Link>
      )}
      <section className="quick-outings" aria-labelledby="home-attention-title">
        <div className="quick-section-heading">
          <h2 id="home-attention-title">Para continuar</h2>
        </div>
        {cycles === null && !errors.length && <p role="status">Consultando la operación…</p>}
        {cycles !== null &&
          planned.length === 0 &&
          inProgress.length === 0 &&
          accounts.length === 0 &&
          settlements !== null && (
            <p className="quick-outings__empty">
              No hay recorridos activos ni rendiciones abiertas. Cuando una unidad vaya a salir,
              registra su salida.
            </p>
          )}
        {accounts.slice(0, 3).map((row) => (
          <Link
            className="operation-attention-row"
            key={row.id}
            to={`/finanzas/rendiciones/${row.id}`}
          >
            <div>
              <strong>{row.title}</strong>
              <p>{row.description}</p>
            </div>
            <span>Revisar rendición</span>
          </Link>
        ))}
        {planned.slice(0, 3).map((cycle) => (
          <Link
            className="operation-attention-row"
            key={cycle.id}
            to={outingPath(cycle.id, "start")}
          >
            <div>
              <strong>{cycleIdentity(cycle)}</strong>
              <p>
                {cycle.notes ? `${cycle.notes} · ` : ""}
                {cycle.title}
              </p>
            </div>
            <span>Registrar partida</span>
          </Link>
        ))}
        {accounts.length > 3 && (
          <Link className="admin-text-link" to="/finanzas/rendiciones">
            Ver todas las rendiciones
          </Link>
        )}
        {planned.length > 3 && (
          <Link className="admin-text-link" to={`${outingPath()}?estado=planned`}>
            Ver todas las programadas
          </Link>
        )}
        {inProgress.slice(0, 4).map((cycle) => (
          <Link className="operation-attention-row" key={cycle.id} to={outingPath(cycle.id)}>
            <div>
              <strong>{cycleIdentity(cycle)}</strong>
              <p>
                {cycle.notes ? `${cycle.notes} · ` : ""}
                {cycle.title} · {cycleStateLabel(cycle)}
              </p>
            </div>
            <span>{cycleNextStep(cycle).label}</span>
          </Link>
        ))}
        {(cycles?.length ?? 0) > 0 && (
          <Link className="admin-text-link" to={outingPath()}>
            Ver todas las salidas
          </Link>
        )}
      </section>
      <Link className="operation-search-link" to="/buscar">
        Buscar por placa, conductor, ruta o documento
      </Link>
    </section>
  );
}
