import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseClient } from "../../lib/supabase";
interface Row {
  readonly id: string;
  readonly code: string;
  readonly revenue: number;
  readonly recognized_cost: number;
  readonly pending_cost: number;
  readonly freight_pending: boolean;
  readonly driver_remaining: number;
}
export function CycleCosts(): React.JSX.Element {
  const [rows, setRows] = useState<readonly Row[]>([]),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    const client = getSupabaseClient() as unknown as {
      rpc(name: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    } | null;
    void client?.rpc("get_cycle_cost_report").then((result) => {
      if (!current) return;
      if (result.error) setError(result.error.message);
      else if (Array.isArray(result.data)) setRows(result.data as Row[]);
    });
    return () => {
      current = false;
    };
  }, []);
  const money = (value: number) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
  return (
    <section className="admin-card">
      <h2>Ingresos y costos por salida</h2>
      <p>
        Los gastos comunes pertenecen al recorrido. El resultado por servicio conserva solo sus
        costos directos y puede tener cobertura incompleta.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows.map((row) => (
        <article className="admin-list-row" key={row.id}>
          <div>
            <Link to={`/operacion/ciclos?salida=${row.id}`}>{row.code}</Link>
            <p>
              Fletes: {money(row.revenue)} · costos reconocidos: {money(row.recognized_cost)}
            </p>
            <p>
              {row.freight_pending || row.pending_cost > 0
                ? `Resultado provisional. Gastos por revisar: ${money(row.pending_cost)}${row.freight_pending ? "; hay fletes pendientes" : ""}.`
                : `Resultado operativo: ${money(row.revenue - row.recognized_cost)}`}
            </p>
            <p>Cuenta del conductor pendiente: {money(row.driver_remaining)}</p>
          </div>
        </article>
      ))}
      {!error && rows.length === 0 && <p>Los resultados aparecerán al registrar salidas.</p>}
    </section>
  );
}
