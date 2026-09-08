import type { AdminOperationalCycleDetail, AdminTripDetail } from "../admin-ui/admin-data";
import type { Snapshot } from "../operation-mode/CycleRendition";

export type ReportCell = string | number | null;
export interface CycleReportSection {
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly ReportCell[])[];
}
export interface CycleReport {
  readonly code: string;
  readonly generatedAt: string;
  readonly title: string;
  readonly sections: readonly CycleReportSection[];
  readonly notes: readonly string[];
}
export function reportDate(value: string | null | undefined): string {
  if (!value) return "Pendiente";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}
export function reportStatus(value: string): string {
  return (
    (
      {
        active: "En recorrido",
        delivered: "Entregado",
        scheduled: "Programado",
        loading: "En carga",
        unloading: "En descarga",
        in_transit: "En tránsito",
        planned: "Programada",
        completed: "Operación finalizada",
        cancelled: "Anulado",
        validated: "Reconocido",
        pending: "Pendiente de revisión",
        rejected: "Rechazado",
        observed: "Observado",
        closed: "Cerrada",
        draft: "Borrador",
        submitted: "Presentada",
        approved: "Aprobada",
      } as Record<string, string>
    )[value] ?? value
  );
}
export function buildCycleReport(
  detail: AdminOperationalCycleDetail,
  snapshot: Snapshot,
  trips: readonly AdminTripDetail[],
  generatedAt = new Date().toISOString(),
): CycleReport {
  if (snapshot.cycle.id !== detail.cycle.id)
    throw new Error("La cuenta no corresponde a esta salida.");
  if (snapshot.cycle.status === "cancelled" || snapshot.cycle.is_test)
    throw new Error("Esta salida está anulada o identificada como prueba.");
  if (trips.some((trip) => trip.source !== "remote" || trip.unavailableSections.length > 0))
    throw new Error("Los servicios deben consultarse completos con conexión antes de exportar.");
  const categories = new Map(snapshot.categories.map((row) => [row.id, row.name]));
  const amount = (value: number): number => {
    const result = Number(value);
    if (!Number.isFinite(result)) throw new Error("La cuenta contiene un importe no válido.");
    return result;
  };
  const sections: CycleReportSection[] = [
    {
      title: "Resumen",
      columns: ["Dato", "Valor"],
      rows: [
        ["Salida", snapshot.cycle.code],
        ["Unidad", detail.vehicleLabel],
        ["Conductor", detail.primaryDriverLabel ?? "Sin conductor"],
        ["Partida de Cusco", reportDate(snapshot.cycle.started_at)],
        ["Regreso a Cusco", reportDate(snapshot.cycle.returned_at)],
        ["Estado operativo", reportStatus(snapshot.cycle.status)],
        ["Recorrido / notas", snapshot.cycle.notes ?? "Sin descripción"],
        ["Generado (hora Perú)", reportDate(generatedAt)],
      ],
    },
    {
      title: "Cuenta del conductor",
      columns: ["Concepto", "Importe (S/)"],
      rows: [
        ["Total entregado", amount(snapshot.total_advances)],
        ["Gastos reconocidos, incluido adicional de hoja", amount(snapshot.expense_total)],
        ["Combustible reconocido con fondo del conductor", amount(snapshot.driver_fuel)],
        ["Diferencia antes de devoluciones / reembolsos", amount(snapshot.balance)],
        [
          "Devoluciones menos reembolsos aplicados",
          Math.round((amount(snapshot.balance) - amount(snapshot.remaining)) * 100) / 100,
        ],
        [
          snapshot.remaining > 0
            ? "Pendiente: el conductor devuelve"
            : snapshot.remaining < 0
              ? "Pendiente: la empresa reembolsa"
              : "Sin diferencia pendiente",
          Math.abs(amount(snapshot.remaining)),
        ],
        [
          "Combustible reconocido pagado por empresa (fuera del saldo)",
          amount(snapshot.company_fuel),
        ],
      ],
    },
    {
      title: "Entregas",
      columns: ["Fecha (Perú)", "Importe (S/)", "Estado", "Referencia"],
      rows: snapshot.advances_list.map((row) => [
        reportDate(row.delivered_at),
        amount(row.amount),
        reportStatus(row.status),
        row.id,
      ]),
    },
    {
      title: "Gastos",
      columns: [
        "Fecha (Perú)",
        "Concepto",
        "Categoría",
        "Declarado (S/)",
        "Reconocido (S/)",
        "Estado",
      ],
      rows: snapshot.expenses.map((row) => [
        reportDate(row.incurred_at),
        row.description ?? "Gasto",
        categories.get(row.category_id ?? "") ?? "Categoría no disponible",
        amount(row.amount ?? 0),
        row.validation_status === "validated"
          ? amount(row.approved_amount ?? row.amount ?? 0)
          : null,
        reportStatus(row.validation_status),
      ]),
    },
    {
      title: "Combustible",
      columns: ["Fecha (Perú)", "Origen del pago", "Declarado (S/)", "Reconocido (S/)", "Estado"],
      rows: snapshot.fuel.map((row) => [
        reportDate(row.fueled_at),
        row.payment_source === "company" ? "Empresa" : "Fondo del conductor",
        amount(row.total_amount ?? 0),
        row.validation_status === "validated"
          ? amount(row.approved_amount ?? row.total_amount ?? 0)
          : null,
        reportStatus(row.validation_status),
      ]),
    },
    {
      title: "Hoja de rendición",
      columns: ["Categoría", "Descripción", "Declarado (S/)", "Reconocido (S/)", "Estado de hoja"],
      rows: (snapshot.summary?.lines ?? []).map((row) => [
        categories.get(row.category_id) ?? "Categoría no disponible",
        row.description,
        amount(row.declared),
        amount(row.recognized),
        reportStatus(snapshot.summary?.status ?? "draft"),
      ]),
    },
    {
      title: "Devoluciones y reembolsos",
      columns: ["Fecha (Perú)", "Movimiento", "Importe (S/)", "Estado"],
      rows: snapshot.payments.map((row) => [
        reportDate(row.occurred_at),
        row.direction === "DRIVER_RETURNS" ? "Conductor devuelve" : "Empresa reembolsa",
        amount(row.amount),
        row.cancelled_at ? "Anulado" : "Aplicado",
      ]),
    },
    {
      title: "Servicios",
      columns: ["Servicio", "Cliente", "Recorrido", "Moneda", "Flete confirmado", "Cobrado"],
      rows: trips
        .filter((row) => row.trip.operationalStatus !== "cancelled")
        .map((row) => [
          row.trip.code,
          row.clientName ?? "Pendiente",
          `${row.trip.origin} → ${row.trip.destination}`,
          row.trip.currency,
          row.financials.serviceIncome,
          row.financials.collectedAmount,
        ]),
    },
    {
      title: "Facturas",
      columns: ["Servicio", "Documento", "Detalle", "Moneda", "Importe", "Estado"],
      rows: trips.flatMap((trip) =>
        trip.invoices.map((row) => [
          trip.trip.code,
          row.title,
          row.description,
          trip.trip.currency,
          row.amount ?? null,
          row.status,
        ]),
      ),
    },
    {
      title: "Cobros de clientes",
      columns: ["Servicio", "Fecha (Perú)", "Detalle", "Moneda", "Importe", "Estado"],
      rows: trips.flatMap((trip) =>
        trip.payments.map((row) => [
          trip.trip.code,
          reportDate(row.date),
          row.title,
          trip.trip.currency,
          row.amount ?? null,
          row.status,
        ]),
      ),
    },
  ];
  return {
    code: snapshot.cycle.code,
    generatedAt,
    title:
      snapshot.settlement?.status === "closed"
        ? "Rendición cerrada"
        : "Preliquidación - cuenta en revisión",
    sections,
    notes: [
      "Copia de los datos consultados al generar el resumen. Los registros locales pendientes de confirmación no están incluidos.",
      "Los cobros de clientes no son entregas al conductor. El combustible pagado por empresa no se descuenta de su fondo.",
      "La hoja se muestra para revisión: no debe sumarse nuevamente a los gastos. La cuenta usa el cálculo del servidor y solo incorpora sus adicionales reconocidos.",
      "Importes vacíos: pendientes o no reconocidos; no equivalen a cero. Los anulados se conservan como historial y no afectan la cuenta.",
      "No se calcula rentabilidad por servicio: los gastos comunes no se distribuyen y la cobertura de costos puede estar incompleta.",
      `${snapshot.evidence.length} hojas adjuntas en la rendición; consulta los originales privados desde Rendir gastos.`,
    ],
  };
}
