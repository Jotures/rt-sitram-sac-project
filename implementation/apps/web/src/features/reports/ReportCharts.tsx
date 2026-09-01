import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReportKind, ReportMetricState, ReportSeriesPoint } from "./reports";

type ChartMeasure = "value" | "secondaryValue";
type ChartUnit = "money" | "tons" | "hours" | "percent" | "kilometres" | "moneyPerKilometre";

const chartMeasures: Readonly<
  Record<
    ReportKind,
    Readonly<{
      primary: string;
      secondary: string;
      primaryUnit: ChartUnit;
      secondaryUnit: ChartUnit;
    }>
  >
> = {
  OVERVIEW: {
    primary: "Flete contratado",
    secondary: "Toneladas declaradas",
    primaryUnit: "money",
    secondaryUnit: "tons",
  },
  TRIPS_CARGO: {
    primary: "Flete contratado",
    secondary: "Toneladas declaradas",
    primaryUnit: "money",
    secondaryUnit: "tons",
  },
  FLEET_UTILIZATION: {
    primary: "Utilización",
    secondary: "Horas en viaje",
    primaryUnit: "percent",
    secondaryUnit: "hours",
  },
  DOWNTIME: {
    primary: "Horas detenidas",
    secondary: "Sin segundo indicador",
    primaryUnit: "hours",
    secondaryUnit: "hours",
  },
  DIRECT_MARGIN: {
    primary: "Margen directo",
    secondary: "Costo directo",
    primaryUnit: "money",
    secondaryUnit: "money",
  },
  FUEL: {
    primary: "Costo de combustible",
    secondary: "Costo por kilómetro",
    primaryUnit: "money",
    secondaryUnit: "moneyPerKilometre",
  },
  EMPTY_KILOMETRES: {
    primary: "Kilómetros vacíos",
    secondary: "Porcentaje vacío",
    primaryUnit: "kilometres",
    secondaryUnit: "percent",
  },
  MAINTENANCE: {
    primary: "Costo de mantenimiento",
    secondary: "Horas inmovilizadas",
    primaryUnit: "money",
    secondaryUnit: "hours",
  },
  COLLECTIONS: {
    primary: "Saldo por cobrar",
    secondary: "Cobrado",
    primaryUnit: "money",
    secondaryUnit: "money",
  },
};

const statePresentation: Readonly<
  Record<ReportMetricState, Readonly<{ label: string; color: string }>>
> = {
  CONFIRMED: { label: "Confirmados", color: "#2e6b62" },
  PROVISIONAL: { label: "Provisionales", color: "#98472d" },
  UNAVAILABLE: { label: "Sin dato", color: "#718086" },
};

function colorFor(state: ReportSeriesPoint["state"]): string {
  return statePresentation[state].color;
}

function formatValue(value: number | null, unit: ChartUnit, compact = false): string {
  if (value === null || !Number.isFinite(value)) return "Sin dato";
  if (unit === "money")
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
    }).format(value);
  if (unit === "moneyPerKilometre")
    return `${new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
    }).format(value)}/km`;
  const suffix =
    unit === "tons" ? " t" : unit === "hours" ? " h" : unit === "percent" ? "%" : " km";
  return `${new Intl.NumberFormat("es-PE", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value)}${suffix}`;
}

export function ReportCharts({
  data,
  kind,
  onSelect,
}: {
  readonly data: readonly ReportSeriesPoint[];
  readonly kind: ReportKind;
  readonly onSelect: (key: string) => void;
}): React.JSX.Element {
  const [measure, setMeasure] = useState<ChartMeasure>("value");
  const labels = chartMeasures[kind] ?? chartMeasures.OVERVIEW;
  const hasSecondary = data.some((item) => item.secondaryValue !== null);
  const dataKey = hasSecondary ? measure : "value";
  const metricLabel = dataKey === "value" ? labels.primary : labels.secondary;
  const metricUnit = dataKey === "value" ? labels.primaryUnit : labels.secondaryUnit;
  const chartData = data.slice(0, 12);
  const chartHeight = Math.max(300, chartData.length * 48);
  const quality = useMemo(
    () =>
      (Object.keys(statePresentation) as ReportMetricState[])
        .map((state) => ({
          state,
          label: statePresentation[state].label,
          value: chartData.filter((item) => item.state === state).length,
        }))
        .filter((item) => item.value > 0),
    [chartData],
  );

  useEffect(() => setMeasure("value"), [kind]);

  return (
    <div className="reports-chart-layout">
      <figure
        className="reports-chart"
        aria-label={`Comparación por registro: ${metricLabel}.`}
        aria-describedby="reports-chart-help"
      >
        <div className="reports-chart__head">
          <div>
            <p className="reports-chart__eyebrow">Comparación por registro</p>
            <h3>{metricLabel}</h3>
            <p>
              Las barras comparan hasta 12 registros del periodo. El eje expresa{" "}
              {metricLabel.toLocaleLowerCase("es-PE")}.
            </p>
          </div>
          {hasSecondary ? (
            <div
              aria-label="Indicador mostrado en el gráfico"
              className="reports-chart__measures"
              role="group"
            >
              <button
                aria-pressed={measure === "value"}
                className={measure === "value" ? "is-active" : ""}
                onClick={() => setMeasure("value")}
                type="button"
              >
                {labels.primary}
              </button>
              <button
                aria-pressed={measure === "secondaryValue"}
                className={measure === "secondaryValue" ? "is-active" : ""}
                onClick={() => setMeasure("secondaryValue")}
                type="button"
              >
                {labels.secondary}
              </button>
            </div>
          ) : null}
        </div>
        <ResponsiveContainer height={chartHeight} width="100%">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ top: 12, right: 18, bottom: 8, left: 0 }}
            onClick={(event) => {
              const key = (
                event as unknown as {
                  readonly activePayload?: readonly {
                    readonly payload?: { readonly key?: string };
                  }[];
                }
              ).activePayload?.[0]?.payload?.key;
              if (key !== undefined) onSelect(key);
            }}
          >
            <CartesianGrid stroke="#d7dfdc" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              axisLine={{ stroke: "#7f8988" }}
              tick={{ fill: "#58686d", fontSize: 11 }}
              tickFormatter={(value: number) => formatValue(value, metricUnit, true)}
              tickLine={{ stroke: "#7f8988" }}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="label"
              interval={0}
              tick={{ fill: "#23353a", fontSize: 11 }}
              tickLine={false}
              type="category"
              width={154}
            />
            <Tooltip
              contentStyle={{
                background: "#fffcf7",
                border: "1px solid #cdd1cc",
                borderRadius: 8,
              }}
              cursor={{ fill: "#e4efec" }}
              formatter={(value) => [formatValue(Number(value), metricUnit), metricLabel]}
              labelFormatter={(value) => `Registro: ${String(value)}`}
            />
            <Bar dataKey={dataKey} name={metricLabel} radius={[0, 5, 5, 0]}>
              {chartData.map((item) => (
                <Cell fill={colorFor(item.state)} key={item.key} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <figcaption id="reports-chart-help">
          Selecciona una barra o un registro para enfocar su detalle. Verde: confirmado; cobre:
          provisional; gris: falta información para calcularlo.
          <span
            className="reports-chart__keyboard"
            aria-label="Seleccionar un registro con teclado"
          >
            {chartData.map((item) => (
              <button key={item.key} onClick={() => onSelect(item.key)} type="button">
                {item.label}
              </button>
            ))}
          </span>
        </figcaption>
      </figure>
      <aside className="reports-quality" aria-label="Calidad de los datos del gráfico">
        <div>
          <p className="reports-chart__eyebrow">Confianza del resultado</p>
          <h3>Calidad de los datos</h3>
          <p>
            Te indica cuánto del gráfico proviene de registros confirmados y cuánto requiere
            revisión.
          </p>
        </div>
        {quality.length > 0 ? (
          <ResponsiveContainer height={162} width="100%">
            <PieChart>
              <Pie
                data={quality}
                dataKey="value"
                innerRadius={44}
                outerRadius={65}
                paddingAngle={3}
              >
                {quality.map((item) => (
                  <Cell fill={statePresentation[item.state].color} key={item.state} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${Number(value)} registro(s)`, "Cantidad"]} />
            </PieChart>
          </ResponsiveContainer>
        ) : null}
        <ul>
          {quality.map((item) => (
            <li key={item.state}>
              <span
                aria-hidden="true"
                style={{ backgroundColor: statePresentation[item.state].color }}
              />
              <strong>{item.label}</strong>
              <b>{item.value}</b>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
