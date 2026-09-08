import type {
  AdminTripDetail,
  AdminTripDetailLine,
  AdminSettlementDetail,
} from "../admin-ui/admin-data";
import {
  reportDate,
  reportStatus,
  type CycleReport,
  type CycleReportSection,
} from "./cycle-report";

function movementSection(title: string, rows: readonly AdminTripDetailLine[]): CycleReportSection {
  return {
    title,
    columns: ["Fecha (Perú)", "Concepto", "Detalle", "Importe", "Estado"],
    rows: rows.map((row) => [
      reportDate(row.date),
      row.title,
      row.description,
      row.amount ?? null,
      row.status,
    ]),
  };
}
export function buildTripReport(
  detail: AdminTripDetail,
  generatedAt = new Date().toISOString(),
): CycleReport {
  if (detail.source !== "remote" || detail.unavailableSections.length)
    throw new Error("Conéctate para consultar el expediente completo del viaje.");
  if (detail.trip.operationalStatus === "cancelled")
    throw new Error("El viaje está anulado y no pertenece al circuito operativo.");
  return {
    code: detail.trip.code,
    title: "Resumen del servicio",
    generatedAt,
    sections: [
      {
        title: "Resumen",
        columns: ["Dato", "Valor"],
        rows: [
          ["Servicio", detail.trip.code],
          ["Cliente", detail.clientName ?? "Pendiente"],
          ["Unidad", detail.vehiclePlate ?? "Pendiente"],
          ["Conductor", detail.driverName ?? "Pendiente"],
          ["Recorrido", `${detail.trip.origin} → ${detail.trip.destination}`],
          ["Partida", reportDate(detail.trip.startedAt)],
          ["Finalización", reportDate(detail.trip.finishedAt)],
          ["Estado", reportStatus(detail.trip.operationalStatus)],
          ["Moneda de importes", detail.trip.currency],
          ["Generado (Perú)", reportDate(generatedAt)],
        ],
      },
      {
        title: "Cuenta comercial",
        columns: ["Concepto", `Importe (${detail.trip.currency})`],
        rows: [
          ["Ingreso del servicio confirmado", detail.financials.serviceIncome],
          ["Cobros aplicados", detail.financials.collectedAmount],
        ],
      },
      {
        title: "Cargas",
        columns: ["Concepto", "Detalle", "Toneladas", "Estado"],
        rows: detail.loads.map((row) => [row.title, row.description, row.tons, row.status]),
      },
      movementSection("Facturas", detail.invoices),
      movementSection("Cobros", detail.payments),
      movementSection("Gastos vinculados", detail.expenses),
      movementSection("Combustible vinculado", detail.fuelEntries),
    ],
    notes: [
      "Copia consultada al generar. Los registros pendientes de sincronizar no están incluidos.",
      "Los gastos aquí mostrados están vinculados al servicio. La cuenta completa del conductor se consulta y descarga desde su salida o rendición Cusco-Cusco.",
      "Los importes vacíos están pendientes. Los anulados se muestran como historial. No se calcula saldo de cobranza restando cobros del flete sin considerar facturas.",
      "La cobertura de costos por servicio puede estar incompleta; no se reparten gastos comunes ni se presenta un margen definitivo.",
    ],
  };
}
export function buildLegacySettlementReport(
  detail: AdminSettlementDetail,
  generatedAt = new Date().toISOString(),
): CycleReport {
  if (detail.cycle) throw new Error("Esta rendición debe consultarse por salida.");
  return {
    code: `rendicion-${detail.trip?.code ?? detail.settlement.id}`,
    title: `Rendición histórica por servicio · ${detail.settlement.status}`,
    generatedAt,
    sections: [
      {
        title: "Resumen",
        columns: ["Dato", "Valor"],
        rows: [
          ["Rendición", detail.settlement.title],
          ["Servicio", detail.trip?.code ?? "No disponible"],
          ["Conductor", detail.driverName ?? "No disponible"],
          ["Generado (Perú)", reportDate(generatedAt)],
          ["Estado", detail.settlement.status],
        ],
      },
      {
        title: "Cuenta del conductor",
        columns: ["Concepto", "Importe"],
        rows: [
          ["Total entregado", detail.totalAdvances],
          ["Total gastos", detail.totalExpenses],
          ["Diferencia según contrato histórico", detail.balance],
        ],
      },
      movementSection("Entregas", detail.advances),
      movementSection("Gastos", detail.expenses),
      movementSection("Combustible", detail.fuelEntries),
    ],
    notes: [
      "Rendición histórica: conserva el contrato original por servicio. No se agrupa con otras salidas.",
      `Resolución: ${detail.resolutionDirection ?? "Pendiente"}. Fecha: ${reportDate(detail.resolvedAt)}.`,
      "La diferencia histórica no representa necesariamente un importe por pagar hoy. Consulta el estado y su resolución.",
      "Importes según la moneda registrada en cada movimiento. No se suman monedas diferentes.",
    ],
  };
}
