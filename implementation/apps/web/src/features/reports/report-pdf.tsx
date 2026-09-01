import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import type { ReportResult } from "./reports";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: "#18343a" },
  title: { fontSize: 16, marginBottom: 4 },
  metadata: { color: "#52666a", marginBottom: 12 },
  row: {
    display: "flex",
    flexDirection: "row",
    borderBottom: "1 solid #d7dfde",
    paddingVertical: 5,
  },
  label: { width: "40%" },
  detail: { width: "35%" },
  value: { width: "25%", textAlign: "right" },
  coverage: { marginTop: 12, color: "#52666a" },
});

function resultPage(result: ReportResult): React.JSX.Element {
  return createElement(
    Page,
    { key: result.kind, size: "A4", style: styles.page },
    createElement(Text, { style: styles.title }, titleFor(result.kind)),
    createElement(
      Text,
      { style: styles.metadata },
      `Periodo: ${result.period.from} a ${result.period.to} · Generado: ${result.generatedAt}`,
    ),
    ...result.rows.map((item) =>
      createElement(
        View,
        { key: item.id, style: styles.row },
        createElement(Text, { style: styles.label }, item.label),
        createElement(Text, { style: styles.detail }, item.detail),
        createElement(
          Text,
          { style: styles.value },
          formatValue(item.value, item.currency, item.unit),
        ),
      ),
    ),
    createElement(
      Text,
      { style: styles.coverage },
      `Cobertura: ${result.coverage.notes.join(" ")}`,
    ),
  );
}

export async function createReportPdf(results: readonly ReportResult[]): Promise<Blob> {
  return pdf(createElement(Document, null, ...results.map(resultPage))).toBlob();
}

function titleFor(kind: ReportResult["kind"]): string {
  return {
    OVERVIEW: "Resumen",
    TRIPS_CARGO: "Viajes y carga",
    FLEET_UTILIZATION: "Utilización de flota",
    DOWNTIME: "Tiempo improductivo",
    DIRECT_MARGIN: "Margen directo",
    FUEL: "Combustible",
    EMPTY_KILOMETRES: "Kilómetros vacíos",
    MAINTENANCE: "Mantenimiento",
    COLLECTIONS: "Cobranza",
  }[kind];
}

function formatValue(value: number | null, currency: string | null, unit: string): string {
  if (value === null) return "No disponible";
  if (unit === "money" && currency !== null)
    return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(value);
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value)} ${unit === "percent" ? "%" : unit === "hours" ? "h" : unit === "kilometres" ? "km" : unit === "tons" ? "t" : ""}`.trim();
}
