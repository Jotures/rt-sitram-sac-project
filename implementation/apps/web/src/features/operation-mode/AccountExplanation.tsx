import { Link } from "react-router-dom";
import type { Snapshot } from "./CycleRendition";
import { explainRendition } from "./rendition-explanation";

const money = (value: number): string =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
export function AccountExplanation({
  data,
  usingLocal,
}: {
  readonly data: Snapshot;
  readonly usingLocal: boolean;
}): React.JSX.Element {
  const explanation = explainRendition(data);
  return (
    <section className="admin-card account-explanation" aria-label="Explicación de la cuenta">
      <details>
        <summary>Cómo se forma esta cuenta</summary>
        <p>
          {usingLocal
            ? "Según la última copia guardada en este dispositivo."
            : "Según los importes confirmados por el servidor."}{" "}
          Las ediciones de la hoja aún sin aprobar no cambian estos totales.
        </p>
        <dl className="account-equation">
          <dt>
            <a href="#rendition-advances">Dinero entregado vigente</a>
          </dt>
          <dd>+ {money(data.total_advances)}</dd>
          <dt>
            <a href="#rendition-records">Gastos validados del recorrido</a>
          </dt>
          <dd>− {money(explanation.recognizedExpenses)}</dd>
          <dt>
            <a href="#rendition-sheet">Adicional reconocido de la hoja aprobada</a>
          </dt>
          <dd>− {money(explanation.additionalSheet)}</dd>
          <dt>
            <a href="#rendition-records">Combustible del fondo del conductor</a>
          </dt>
          <dd>− {money(data.driver_fuel)}</dd>
          <dt>Saldo antes de devoluciones y reembolsos</dt>
          <dd>{money(data.balance)}</dd>
          <dt>
            <a href="#rendition-payments">Devoluciones ya registradas</a>
          </dt>
          <dd>− {money(explanation.returned)}</dd>
          <dt>
            <a href="#rendition-payments">Reembolsos ya registrados</a>
          </dt>
          <dd>+ {money(explanation.reimbursed)}</dd>
          <dt>
            <strong>
              {data.remaining > 0
                ? "Por devolver a la empresa"
                : data.remaining < 0
                  ? "Por reembolsar al conductor"
                  : "Cuenta saldada"}
            </strong>
          </dt>
          <dd>
            <strong>{money(Math.abs(data.remaining))}</strong>
          </dd>
        </dl>
        <p>
          El combustible pagado por la empresa ({money(data.company_fuel)}) es costo de la salida y
          no se descuenta del fondo del conductor. Los adelantos y pagos anulados y los gastos
          rechazados quedan fuera de este cálculo.
        </p>
        {explanation.rejected > 0 && (
          <p>{explanation.rejected} gasto(s) o abastecimiento(s) rechazados: excluidos.</p>
        )}
      </details>
      {!explanation.consistent && (
        <p role="alert">
          Los componentes consultados no coinciden con el total. Actualiza la cuenta y revisa los
          registros antes de conciliar.
        </p>
      )}
      {explanation.steps.length > 0 && (
        <div className="account-next-steps">
          <h3>Para continuar</h3>
          <ul>
            {explanation.steps.map((step) => (
              <li key={step.text}>
                {step.href.startsWith("#") ? (
                  <a href={step.href}>{step.text}</a>
                ) : (
                  <Link to={step.href}>{step.text}</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
