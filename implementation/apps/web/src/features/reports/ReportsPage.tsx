import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/primitives/Button";
import { getSupabaseClient } from "../../lib/supabase";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import { useIdentity } from "../identity/IdentityProvider";
import { ReportCharts } from "./ReportCharts";
import { createSupabaseReportGateway, type ReportFilterOptions } from "./report-data";
import {
  REPORT_KINDS,
  runReport,
  type ReportFilters,
  type ReportKind,
  type ReportResult,
  type ReportTableRow,
} from "./reports";
import "./reports.css";

const labels: Readonly<Record<ReportKind, string>> = {
  OVERVIEW: "Resumen",
  TRIPS_CARGO: "Viajes y carga",
  FLEET_UTILIZATION: "Flota",
  DOWNTIME: "Tiempo improductivo",
  DIRECT_MARGIN: "Margen directo",
  FUEL: "Combustible",
  EMPTY_KILOMETRES: "Kilómetros vacíos",
  MAINTENANCE: "Mantenimiento",
  COLLECTIONS: "Cobranza",
};

const descriptions: Readonly<Record<ReportKind, string>> = {
  OVERVIEW: "Producción, cobranza y alcance de los datos disponibles.",
  TRIPS_CARGO: "Viajes finalizados y toneladas declaradas dentro del periodo.",
  FLEET_UTILIZATION:
    "Tiempo en viaje sobre el tiempo rastreado mientras la unidad está en servicio.",
  DOWNTIME: "Detenciones por estado y causa, sin valorización monetaria estimada.",
  DIRECT_MARGIN:
    "Ingresos contratados menos combustible validado y gastos aprobados; no es utilidad neta.",
  FUEL: "Costo, cantidad y razón por distancia únicamente cuando la distancia está completa.",
  EMPTY_KILOMETRES: "Tramos registrados explícitamente como cargados o vacíos.",
  MAINTENANCE: "Costo de órdenes finalizadas y visibilidad separada de órdenes abiertas.",
  COLLECTIONS: "Facturación, pagos no anulados, saldo y vencimiento de cada factura.",
};

const tableColumns: Readonly<
  Record<
    ReportKind,
    Readonly<{
      primary: string;
      secondary: string;
      secondaryFormat: "money" | "moneyPerKilometre" | "tons" | "hours" | "percent" | "none";
    }>
  >
> = {
  OVERVIEW: { primary: "Flete confirmado", secondary: "Toneladas", secondaryFormat: "tons" },
  TRIPS_CARGO: { primary: "Flete confirmado", secondary: "Toneladas", secondaryFormat: "tons" },
  FLEET_UTILIZATION: {
    primary: "Utilización",
    secondary: "Horas en viaje",
    secondaryFormat: "hours",
  },
  DOWNTIME: { primary: "Horas detenidas", secondary: "No aplica", secondaryFormat: "none" },
  DIRECT_MARGIN: {
    primary: "Margen directo",
    secondary: "Costo directo",
    secondaryFormat: "money",
  },
  FUEL: { primary: "Costo", secondary: "Costo/km", secondaryFormat: "moneyPerKilometre" },
  EMPTY_KILOMETRES: {
    primary: "Kilómetros vacíos",
    secondary: "% vacío",
    secondaryFormat: "percent",
  },
  MAINTENANCE: { primary: "Costo", secondary: "Horas inmovilizadas", secondaryFormat: "hours" },
  COLLECTIONS: { primary: "Saldo", secondary: "Cobrado", secondaryFormat: "money" },
};

const emptyOptions: ReportFilterOptions = { vehicles: [], routes: [], clients: [], drivers: [] };

function limaDate(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const read = (type: string) => parts.find((item) => item.type === type)?.value ?? "01";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function currentMonth(): Pick<ReportFilters, "from" | "to"> {
  const today = limaDate();
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

function previousPeriod(filters: ReportFilters): Pick<ReportFilters, "from" | "to"> {
  const from = new Date(`${filters.from}T12:00:00Z`);
  const to = new Date(`${filters.to}T12:00:00Z`);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const previousTo = new Date(from.getTime() - 86_400_000);
  const previousFrom = new Date(previousTo.getTime() - (days - 1) * 86_400_000);
  return {
    from: previousFrom.toISOString().slice(0, 10),
    to: previousTo.toISOString().slice(0, 10),
  };
}

function selectedKind(value: string | null, role: string): ReportKind {
  if (role === "accounting") return "COLLECTIONS";
  return REPORT_KINDS.includes(value as ReportKind) ? (value as ReportKind) : "OVERVIEW";
}

function filtersFrom(params: URLSearchParams): ReportFilters {
  const defaults = currentMonth();
  const optional = (key: string): string | undefined => params.get(key) ?? undefined;
  const vehicleId = optional("vehicle");
  const routeId = optional("route");
  const clientId = optional("client");
  const driverId = optional("driver");
  return {
    from: params.get("from") ?? defaults.from,
    to: params.get("to") ?? defaults.to,
    ...(vehicleId === undefined ? {} : { vehicleId }),
    ...(routeId === undefined ? {} : { routeId }),
    ...(clientId === undefined ? {} : { clientId }),
    ...(driverId === undefined ? {} : { driverId }),
  };
}

function updateParams(
  previous: URLSearchParams,
  changes: Readonly<Record<string, string | null>>,
): URLSearchParams {
  const next = new URLSearchParams(previous);
  Object.entries(changes).forEach(([key, value]) =>
    value === null || value.length === 0 ? next.delete(key) : next.set(key, value),
  );
  return next;
}

function visibleKinds(role: string): readonly ReportKind[] {
  return role === "accounting" ? ["COLLECTIONS"] : REPORT_KINDS;
}

export function ReportsPage(): React.JSX.Element {
  const { state: identityState } = useIdentity();
  const network = useNetworkStatus();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<ReportResult | null>(null);
  const [comparison, setComparison] = useState<ReportResult | null>(null);
  const [options, setOptions] = useState<ReportFilterOptions>(emptyOptions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const identity = identityState.status === "READY" ? identityState.identity : null;
  const role = identity?.profile.role ?? "driver";
  const kind = selectedKind(params.get("report"), role);
  const filters = filtersFrom(params);
  const client = getSupabaseClient();
  const gateway = useMemo(
    () => (client === null ? null : createSupabaseReportGateway(client)),
    [client],
  );
  const online = network !== "OFFLINE";
  const compareEnabled = params.get("compare") === "previous";
  const queryKey = params.toString();

  useEffect(() => {
    if (identity === null || gateway === null || !online) {
      setLoading(false);
      setResult(null);
      setComparison(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const actor = {
      profileId: identity.profile.id,
      companyId: identity.company.id,
      role: identity.profile.role,
    } as const;
    void Promise.all([
      runReport(gateway, actor, kind, filters),
      compareEnabled
        ? runReport(gateway, actor, kind, { ...filters, ...previousPeriod(filters) })
        : Promise.resolve(null),
      gateway.loadFilterOptions(),
    ])
      .then(([nextResult, nextComparison, nextOptions]) => {
        if (!active) return;
        setResult(nextResult);
        setComparison(nextComparison);
        setOptions(nextOptions);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "No se pudo cargar este análisis.");
        setLoading(false);
        setResult(null);
        setComparison(null);
      });
    return () => {
      active = false;
    };
  }, [
    compareEnabled,
    filters.clientId,
    filters.driverId,
    filters.from,
    filters.routeId,
    filters.to,
    filters.vehicleId,
    gateway,
    identity,
    kind,
    online,
    queryKey,
  ]);

  const change = (changes: Readonly<Record<string, string | null>>): void =>
    setParams((current) => updateParams(current, changes), { replace: true });
  const selectRow = (id: string): void => {
    const item = result?.rows.find((candidate) => candidate.id === id);
    if (item === undefined) return;
    change({
      vehicle: item.filter.vehicleId ?? null,
      client: item.filter.clientId ?? null,
      route: item.filter.routeId ?? null,
    });
  };

  if (identity === null)
    return (
      <section className="reports-notice" role="status">
        Preparando tu acceso a Reportes…
      </section>
    );
  if (gateway === null)
    return (
      <section className="reports-notice" role="alert">
        Supabase no está configurado en este entorno.
      </section>
    );
  if (!online)
    return (
      <section className="reports-notice" role="status">
        <h1>Reportes requieren conexión</h1>
        <p>
          Los análisis se calculan en el servidor y no reutilizan un snapshot antiguo como si fuera
          actual.
        </p>
      </section>
    );

  const allowed = visibleKinds(role);
  const comparisonMessage =
    comparison === null || comparison.coverage.eligibleRecords === 0
      ? "Sin histórico suficiente"
      : `${comparison.coverage.eligibleRecords} datos incluidos en el periodo anterior`;

  return (
    <section className="reports-page" aria-busy={loading}>
      <header className="reports-header">
        <div>
          <p className="reports-eyebrow">Centro de control · Analítica</p>
          <h1>Reportes</h1>
          <p>{descriptions[kind]}</p>
        </div>
        <div className="reports-export-actions">
          <Button
            disabled={result === null || exporting}
            icon="file"
            onClick={() => void exportCsv(gateway, kind, filters, result, setExporting)}
          >
            CSV
          </Button>
          <Button
            disabled={result === null || exporting}
            icon="file"
            onClick={() => void exportPdf(gateway, kind, filters, result, setExporting)}
          >
            PDF
          </Button>
          <Button
            disabled={result === null || exporting}
            variant="secondary"
            onClick={() =>
              void exportDossier(
                gateway,
                allowed,
                identity.company.id,
                identity.profile.role,
                filters,
                result,
                setExporting,
              )
            }
          >
            Informe completo
          </Button>
        </div>
      </header>

      <ReportFiltersPanel filters={filters} options={options} role={role} onChange={change} />

      <nav aria-label="Tipo de reporte" className="reports-tabs">
        {allowed.map((item) => (
          <button
            aria-current={item === kind ? "page" : undefined}
            className={item === kind ? "is-active" : ""}
            key={item}
            onClick={() => change({ report: item })}
            type="button"
          >
            {labels[item]}
          </button>
        ))}
      </nav>

      <div className="reports-compare">
        <Button
          onClick={() => change({ compare: compareEnabled ? null : "previous" })}
          variant="quiet"
        >
          {compareEnabled ? "Quitar comparación" : "Comparar periodo anterior"}
        </Button>
        {compareEnabled ? <span>{comparisonMessage}</span> : null}
      </div>

      {loading ? (
        <section className="reports-notice" role="status">
          Calculando con los registros autorizados…
        </section>
      ) : null}
      {error !== null ? (
        <section className="reports-notice reports-notice--error" role="alert">
          {error}
        </section>
      ) : null}
      {result !== null ? <ReportBody result={result} onSelect={selectRow} /> : null}
    </section>
  );
}

function ReportFiltersPanel({
  filters,
  options,
  role,
  onChange,
}: {
  readonly filters: ReportFilters;
  readonly options: ReportFilterOptions;
  readonly role: string;
  readonly onChange: (changes: Readonly<Record<string, string | null>>) => void;
}): React.JSX.Element {
  const shortcut = (kind: "previousMonth" | "quarter" | "year"): void => {
    const today = new Date(`${limaDate()}T12:00:00Z`);
    if (kind === "previousMonth") {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      onChange({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
      return;
    }
    if (kind === "quarter") {
      const month = today.getUTCMonth();
      const startMonth = Math.floor(month / 3) * 3;
      onChange({
        from: `${today.getUTCFullYear()}-${String(startMonth + 1).padStart(2, "0")}-01`,
        to: limaDate(),
      });
      return;
    }
    onChange({ from: `${today.getUTCFullYear()}-01-01`, to: limaDate() });
  };
  return (
    <section className="reports-filters" aria-label="Filtros globales de reportes">
      <div className="reports-filter-shortcuts">
        <button onClick={() => onChange(currentMonth())} type="button">
          Mes actual
        </button>
        <button onClick={() => shortcut("previousMonth")} type="button">
          Mes anterior
        </button>
        <button onClick={() => shortcut("quarter")} type="button">
          Trimestre
        </button>
        <button onClick={() => shortcut("year")} type="button">
          Año
        </button>
      </div>
      <label>
        Desde
        <input
          onChange={(event) => onChange({ from: event.target.value })}
          type="date"
          value={filters.from}
        />
      </label>
      <label>
        Hasta
        <input
          onChange={(event) => onChange({ to: event.target.value })}
          type="date"
          value={filters.to}
        />
      </label>
      {role !== "accounting" ? (
        <FilterSelect
          label="Unidad"
          name="vehicle"
          options={options.vehicles}
          value={filters.vehicleId}
          onChange={onChange}
        />
      ) : null}
      {role !== "accounting" ? (
        <FilterSelect
          label="Ruta"
          name="route"
          options={options.routes}
          value={filters.routeId}
          onChange={onChange}
        />
      ) : null}
      <FilterSelect
        label="Cliente"
        name="client"
        options={options.clients}
        value={filters.clientId}
        onChange={onChange}
      />
      {role !== "accounting" ? (
        <FilterSelect
          label="Conductor"
          name="driver"
          options={options.drivers}
          value={filters.driverId}
          onChange={onChange}
        />
      ) : null}
      <div className="reports-active-filters" aria-label="Filtros activos">
        {(
          [
            ["vehicle", filters.vehicleId, options.vehicles],
            ["route", filters.routeId, options.routes],
            ["client", filters.clientId, options.clients],
            ["driver", filters.driverId, options.drivers],
          ] as const
        ).map(([key, value, choices]) =>
          value === undefined ? null : (
            <button key={key} onClick={() => onChange({ [key]: null })} type="button">
              {choices.find((item) => item.id === value)?.label ?? key} ×
            </button>
          ),
        )}
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  name,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly name: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly value: string | undefined;
  readonly onChange: (changes: Readonly<Record<string, string | null>>) => void;
}): React.JSX.Element {
  return (
    <label>
      {label}
      <select
        onChange={(event) => onChange({ [name]: event.target.value || null })}
        value={value ?? ""}
      >
        <option value="">Todas</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReportBody({
  result,
  onSelect,
}: {
  readonly result: ReportResult;
  readonly onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <>
      {result.summary.length > 0 ? (
        <div className="reports-kpis">
          {result.summary.map((item) => (
            <article key={item.id}>
              <span>{item.label}</span>
              <strong>{formatMetric(item)}</strong>
              <small>{stateLabel(item.state)}</small>
              <p>{metricExplanation(item.id)}</p>
            </article>
          ))}
        </div>
      ) : null}
      <section className="reports-surface">
        <div className="reports-surface__heading">
          <h2>{labels[result.kind]}</h2>
          <p>
            {result.rows.length === 0
              ? "No hay datos para mostrar con los filtros actuales."
              : `${result.rows.length} registro(s) del periodo y los filtros seleccionados. Elige una barra para revisar un caso concreto.`}
          </p>
        </div>
        {result.rows.length > 0 ? (
          <ReportCharts data={result.series} kind={result.kind} onSelect={onSelect} />
        ) : null}
        <ReportTable kind={result.kind} rows={result.rows} onSelect={onSelect} />
      </section>
      <aside className="reports-coverage">
        <strong>Datos incluidos en el cálculo</strong>
        <span>
          {result.coverage.eligibleRecords} registro(s) incluidos ·{" "}
          {result.coverage.excludedRecords} registro(s) excluidos
        </span>
        <p>
          Los excluidos no cumplen los datos mínimos para este cálculo y no se estiman de forma
          automática.
        </p>
        {result.coverage.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </aside>
    </>
  );
}

function ReportTable({
  kind,
  rows,
  onSelect,
}: {
  readonly kind: ReportKind;
  readonly rows: readonly ReportTableRow[];
  readonly onSelect: (id: string) => void;
}): React.JSX.Element {
  if (rows.length === 0)
    return <p className="reports-empty">No hay filas para mostrar con los filtros actuales.</p>;
  const columns = tableColumns[kind];
  return (
    <div className="reports-table-wrap">
      <table className="reports-table">
        <thead>
          <tr>
            <th>Registro</th>
            <th>Detalle</th>
            <th>{columns.primary}</th>
            <th>{columns.secondary}</th>
            <th>Estado</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td data-label="Registro">
                <strong>{item.label}</strong>
              </td>
              <td data-label="Detalle">{item.detail}</td>
              <td data-label={columns.primary}>
                {formatRowValue(item.value, item.currency, item.unit)}
              </td>
              <td data-label={columns.secondary}>
                {formatSecondaryValue(item, columns.secondaryFormat)}
              </td>
              <td data-label="Estado">
                <span className={`reports-state reports-state--${item.state.toLowerCase()}`}>
                  {stateLabel(item.state)}
                </span>
              </td>
              <td>
                <div className="reports-row-actions">
                  <button onClick={() => onSelect(item.id)} type="button">
                    Filtrar
                  </button>
                  {item.href === null ? null : <Link to={item.href}>Abrir</Link>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatSecondaryValue(
  item: ReportTableRow,
  format: (typeof tableColumns)[ReportKind]["secondaryFormat"],
): string {
  if (format === "none") return "No aplica";
  if (item.secondaryValue === null) return "No disponible";
  if (format === "moneyPerKilometre") {
    if (item.currency === null) return "No disponible";
    return `${new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: item.currency,
    }).format(item.secondaryValue)}/km`;
  }
  return formatRowValue(item.secondaryValue, item.currency, format);
}

function formatMetric(item: ReportResult["summary"][number]): string {
  if (item.unit === "money")
    return item.money.length === 0
      ? "No disponible"
      : item.money
          .map((money) =>
            new Intl.NumberFormat("es-PE", { style: "currency", currency: money.currency }).format(
              money.value,
            ),
          )
          .join(" · ");
  return formatRowValue(item.value, null, item.unit);
}

function metricExplanation(id: ReportResult["summary"][number]["id"]): string {
  const explanations: Readonly<Record<ReportResult["summary"][number]["id"], string>> = {
    trips: "Servicios incluidos en el periodo.",
    tons: "Carga declarada en los servicios incluidos.",
    contractedRevenue: "Flete pactado antes de gastos operativos.",
    invoiced: "Importe que ya tiene comprobante emitido.",
    collected: "Pagos registrados contra las facturas.",
    directCosts: "Combustible validado y gastos aprobados.",
    directMargin: "Flete menos costos directos; no es utilidad neta.",
    utilization: "Parte del tiempo rastreado que la unidad estuvo en viaje.",
    emptyKilometres: "Distancia registrada sin carga.",
    receivables: "Saldo pendiente de cobrar a clientes.",
  };
  return explanations[id];
}

function formatRowValue(value: number | null, currency: string | null, unit: string): string {
  if (value === null) return "No disponible";
  if (unit === "money" && currency !== null)
    return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(value);
  const suffix =
    unit === "percent"
      ? "%"
      : unit === "kilometres"
        ? " km"
        : unit === "tons"
          ? " t"
          : unit === "hours"
            ? " h"
            : "";
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function stateLabel(state: string): string {
  return state === "CONFIRMED" ? "Confirmado" : "No disponible";
}

function safeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportCsv(
  gateway: ReturnType<typeof createSupabaseReportGateway>,
  kind: ReportKind,
  filters: ReportFilters,
  result: ReportResult | null,
  setExporting: (value: boolean) => void,
): Promise<void> {
  if (result === null) return;
  setExporting(true);
  try {
    await gateway.auditExport({ kind, format: "csv", filters });
    const lines = [
      ["Registro", "Detalle", "Principal", "Complementario", "Moneda", "Estado"],
      ...result.rows.map((item) => [
        item.label,
        item.detail,
        String(item.value ?? ""),
        String(item.secondaryValue ?? ""),
        item.currency ?? "",
        item.state,
      ]),
    ].map((line) => line.map((cell) => `"${safeCell(cell).replaceAll('"', '""')}"`).join(","));
    download(
      new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" }),
      `reporte-${kind.toLowerCase()}.csv`,
    );
  } finally {
    setExporting(false);
  }
}

async function exportPdf(
  gateway: ReturnType<typeof createSupabaseReportGateway>,
  kind: ReportKind,
  filters: ReportFilters,
  result: ReportResult | null,
  setExporting: (value: boolean) => void,
): Promise<void> {
  if (result === null) return;
  setExporting(true);
  try {
    await gateway.auditExport({ kind, format: "pdf", filters });
    const { createReportPdf } = await import("./report-pdf");
    download(await createReportPdf([result]), `reporte-${kind.toLowerCase()}.pdf`);
  } finally {
    setExporting(false);
  }
}

async function exportDossier(
  gateway: ReturnType<typeof createSupabaseReportGateway>,
  kinds: readonly ReportKind[],
  companyId: string,
  role: "management" | "administration" | "driver" | "accounting",
  filters: ReportFilters,
  fallback: ReportResult | null,
  setExporting: (value: boolean) => void,
): Promise<void> {
  if (fallback === null) return;
  setExporting(true);
  try {
    await gateway.auditExport({
      kind: role === "accounting" ? "COLLECTIONS" : "OVERVIEW",
      format: "dossier",
      filters,
    });
    const results = await gateway.runDossier({ companyId, kinds, filters });
    const { createReportPdf } = await import("./report-pdf");
    download(await createReportPdf(results), "dossier-reportes.pdf");
  } finally {
    setExporting(false);
  }
}
