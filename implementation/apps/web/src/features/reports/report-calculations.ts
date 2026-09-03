import type {
  ReportCoverage,
  ReportFilters,
  ReportKind,
  ReportMetricState,
  ReportMoneyValue,
  ReportResult,
  ReportSeriesPoint,
  ReportSummaryMetric,
  ReportTableRow,
} from "./reports";

export interface ReportSnapshot {
  readonly generatedAt: string;
  readonly availableFrom: string | null;
  readonly trips: readonly Record<string, unknown>[];
  readonly fuel: readonly Record<string, unknown>[];
  readonly maintenance: readonly Record<string, unknown>[];
  readonly collections: readonly Record<string, unknown>[];
  readonly intervals: readonly Record<string, unknown>[];
  readonly segments: readonly Record<string, unknown>[];
}

const confirmed: ReportMetricState = "CONFIRMED";
const unavailable: ReportMetricState = "UNAVAILABLE";

function text(row: Record<string, unknown>, key: string, fallback = "Sin dato"): string {
  return typeof row[key] === "string" && row[key].trim().length > 0 ? row[key].trim() : fallback;
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  return typeof row[key] === "string" && row[key].trim().length > 0 ? row[key].trim() : null;
}

function number(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function bool(row: Record<string, unknown>, key: string): boolean {
  return row[key] === true || row[key] === "true";
}

function minState(a: ReportMetricState, b: ReportMetricState): ReportMetricState {
  if (a === unavailable || b === unavailable) return unavailable;
  return confirmed;
}

function valueOrZero(value: number | null): number {
  return value ?? 0;
}

function limaBoundary(date: string, endOfDay = false): number {
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-05:00`).getTime();
}

function isWithinLimaPeriod(value: string, filters: ReportFilters): boolean {
  const instant = new Date(value).getTime();
  return (
    Number.isFinite(instant) &&
    instant >= limaBoundary(filters.from) &&
    instant <= limaBoundary(filters.to, true)
  );
}

function isOnOrBeforeLimaPeriodEnd(value: string, filters: ReportFilters): boolean {
  const instant = new Date(value).getTime();
  return Number.isFinite(instant) && instant <= limaBoundary(filters.to, true);
}

function formatLimaDate(value: string): string {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => parts.find((item) => item.type === type)?.value ?? "01";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function money(
  values: readonly {
    readonly currency: string;
    readonly value: number;
    readonly state: ReportMetricState;
  }[],
): readonly ReportMoneyValue[] {
  const buckets = new Map<string, { value: number; state: ReportMetricState }>();
  for (const item of values) {
    const prior = buckets.get(item.currency) ?? { value: 0, state: confirmed };
    buckets.set(item.currency, {
      value: prior.value + item.value,
      state: minState(prior.state, item.state),
    });
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, item]) => ({ currency, value: item.value, state: item.state }));
}

function totalMoney(values: readonly ReportMoneyValue[]): number | null {
  return values.length === 1 ? (values[0]?.value ?? null) : null;
}

function metric(
  id: ReportSummaryMetric["id"],
  label: string,
  unit: ReportSummaryMetric["unit"],
  value: number | null,
  state: ReportMetricState,
  values: readonly {
    readonly currency: string;
    readonly value: number;
    readonly state: ReportMetricState;
  }[] = [],
): ReportSummaryMetric {
  const groupedMoney = money(values);
  return {
    id,
    label,
    unit,
    value: unit === "money" ? totalMoney(groupedMoney) : value,
    state,
    money: groupedMoney,
  };
}

function row(
  id: string,
  label: string,
  detail: string,
  value: number | null,
  secondaryValue: number | null,
  unit: ReportTableRow["unit"],
  state: ReportMetricState,
  options: {
    readonly currency?: string | null;
    readonly href?: string | null;
    readonly filter?: ReportTableRow["filter"];
  } = {},
): ReportTableRow {
  return {
    id,
    label,
    detail,
    value,
    secondaryValue,
    unit,
    state,
    currency: options.currency ?? null,
    href: options.href ?? null,
    filter: options.filter ?? {},
  };
}

function series(rows: readonly ReportTableRow[]): readonly ReportSeriesPoint[] {
  return rows.map((item) => ({
    key: item.id,
    label: item.label,
    value: item.value,
    secondaryValue: item.secondaryValue,
    state: item.state,
  }));
}

function tripState(item: Record<string, unknown>): ReportMetricState {
  if (
    !bool(item, "commercial_terms_complete") ||
    number(item, "direct_cost") === null ||
    bool(item, "has_currency_mismatch")
  )
    return unavailable;
  return confirmed;
}

function tripRouteLabel(trip: Record<string, unknown>): string {
  return [text(trip, "origin"), nullableText(trip, "pickup_location"), text(trip, "destination")]
    .filter((location): location is string => location !== null)
    .join(" → ");
}

function completedTripRows(snapshot: ReportSnapshot): readonly ReportTableRow[] {
  return snapshot.trips.map((trip) => {
    const currency = text(trip, "currency", "PEN");
    const state = tripState(trip);
    return row(
      text(trip, "trip_id"),
      `Servicio ${tripRouteLabel(trip)}`,
      `Unidad ${text(trip, "vehicle_plate")} · ${text(trip, "client_name")}`,
      number(trip, "contracted_revenue"),
      number(trip, "tons"),
      "money",
      state,
      {
        currency,
        href: `/viajes/${text(trip, "trip_id")}/resumen`,
        filter: {
          vehicleId: text(trip, "vehicle_id"),
          clientId: text(trip, "client_id"),
          ...(nullableText(trip, "route_id") === null
            ? {}
            : { routeId: nullableText(trip, "route_id")! }),
        },
      },
    );
  });
}

function collectionRows(
  snapshot: ReportSnapshot,
  filters: ReportFilters,
): readonly ReportTableRow[] {
  const invoices = new Map<
    string,
    { source: Record<string, unknown>; payments: number; mismatch: boolean }
  >();
  for (const fact of snapshot.collections) {
    const invoiceId = text(fact, "invoice_id");
    const current = invoices.get(invoiceId) ?? { source: fact, payments: 0, mismatch: false };
    const paidAt = nullableText(fact, "paid_at");
    const paymentCurrency = nullableText(fact, "payment_currency");
    if (
      paidAt !== null &&
      isOnOrBeforeLimaPeriodEnd(paidAt, filters) &&
      nullableText(fact, "cancelled_at") === null
    ) {
      if (paymentCurrency !== null && paymentCurrency !== text(fact, "currency", "PEN"))
        current.mismatch = true;
      else current.payments += valueOrZero(number(fact, "payment_amount"));
    }
    invoices.set(invoiceId, current);
  }
  return [...invoices.entries()]
    .filter(
      ([, invoice]) => !["draft", "cancelled"].includes(text(invoice.source, "status", "draft")),
    )
    .map(([id, invoice]) => {
      const total = valueOrZero(number(invoice.source, "total"));
      const balance = Math.max(0, total - invoice.payments);
      const state = invoice.mismatch ? unavailable : confirmed;
      return row(
        id,
        `${text(invoice.source, "series")}–${text(invoice.source, "number")}`,
        `${text(invoice.source, "client_name")} · vence ${nullableText(invoice.source, "due_on") ?? "sin fecha"}`,
        balance,
        invoice.payments,
        "money",
        state,
        {
          currency: text(invoice.source, "currency", "PEN"),
          href: `/finanzas/cobranza?q=${encodeURIComponent(id)}`,
          filter: { clientId: text(invoice.source, "client_id") },
        },
      );
    });
}

function intervalHours(interval: Record<string, unknown>, filters: ReportFilters): number | null {
  const startsAt = new Date(text(interval, "started_at", ""));
  const endsAt = nullableText(interval, "ended_at");
  const start = Math.max(startsAt.getTime(), limaBoundary(filters.from));
  const end = Math.min(
    endsAt === null ? limaBoundary(filters.to, true) : new Date(endsAt).getTime(),
    limaBoundary(filters.to, true),
  );
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? (end - start) / 3_600_000
    : null;
}

function fleetRows(snapshot: ReportSnapshot, filters: ReportFilters): readonly ReportTableRow[] {
  const byVehicle = new Map<string, { plate: string; inTrip: number; inService: number }>();
  for (const interval of snapshot.intervals) {
    const hours = intervalHours(interval, filters);
    if (hours === null) continue;
    const vehicleId = text(interval, "vehicle_id");
    const aggregate = byVehicle.get(vehicleId) ?? {
      plate: text(interval, "vehicle_plate"),
      inTrip: 0,
      inService: 0,
    };
    const status = text(interval, "status");
    if (status !== "out_of_service") aggregate.inService += hours;
    if (status === "in_trip") aggregate.inTrip += hours;
    byVehicle.set(vehicleId, aggregate);
  }
  return [...byVehicle.entries()].map(([vehicleId, item]) =>
    row(
      vehicleId,
      `Unidad ${item.plate}`,
      `${item.inTrip.toFixed(1)} h en viaje / ${item.inService.toFixed(1)} h en servicio`,
      item.inService === 0 ? null : (item.inTrip / item.inService) * 100,
      item.inTrip,
      "percent",
      item.inService === 0 ? unavailable : confirmed,
      { href: `/flota/${vehicleId}`, filter: { vehicleId } },
    ),
  );
}

function downtimeRows(snapshot: ReportSnapshot, filters: ReportFilters): readonly ReportTableRow[] {
  const byCause = new Map<
    string,
    { vehicleId: string; plate: string; status: string; reason: string; hours: number }
  >();
  for (const interval of snapshot.intervals) {
    const status = text(interval, "status");
    if (["available", "scheduled", "in_trip", "out_of_service"].includes(status)) continue;
    const hours = intervalHours(interval, filters);
    if (hours === null) continue;
    const vehicleId = text(interval, "vehicle_id");
    const reason = nullableText(interval, "reason") ?? "Sin causa declarada";
    const key = `${vehicleId}:${status}:${reason}`;
    const aggregate = byCause.get(key) ?? {
      vehicleId,
      plate: text(interval, "vehicle_plate"),
      status,
      reason,
      hours: 0,
    };
    aggregate.hours += hours;
    byCause.set(key, aggregate);
  }
  return [...byCause.entries()].map(([id, item]) =>
    row(
      id,
      `Unidad ${item.plate}`,
      `${item.status} · ${item.reason}`,
      item.hours,
      null,
      "hours",
      confirmed,
      {
        href: `/flota/${item.vehicleId}`,
        filter: { vehicleId: item.vehicleId },
      },
    ),
  );
}

function directMarginRows(snapshot: ReportSnapshot): readonly ReportTableRow[] {
  return snapshot.trips.map((trip) => {
    const revenue = number(trip, "contracted_revenue");
    const cost = number(trip, "direct_cost");
    const state = tripState(trip);
    return row(
      text(trip, "trip_id"),
      `Servicio ${tripRouteLabel(trip)}`,
      `${text(trip, "client_name")} · Unidad ${text(trip, "vehicle_plate")}`,
      state === unavailable || cost === null || revenue === null ? null : revenue - cost,
      cost,
      "money",
      state,
      {
        currency: text(trip, "currency", "PEN"),
        href: `/viajes/${text(trip, "trip_id")}/dinero`,
        filter: { vehicleId: text(trip, "vehicle_id"), clientId: text(trip, "client_id") },
      },
    );
  });
}

function fuelRows(snapshot: ReportSnapshot): readonly ReportTableRow[] {
  return snapshot.fuel.map((fact) => {
    const distance = number(fact, "completed_distance_km");
    const cost = number(fact, "total_amount");
    return row(
      text(fact, "fuel_entry_id"),
      `Unidad ${text(fact, "vehicle_plate")}`,
      `${formatLimaDate(text(fact, "fueled_at"))} · ${number(fact, "quantity") ?? 0} ${text(fact, "volume_unit")}`,
      cost,
      distance !== null && distance > 0 && cost !== null ? cost / distance : null,
      "money",
      confirmed,
      {
        currency: text(fact, "currency", "PEN"),
        href: "/finanzas/combustible",
        filter: { vehicleId: text(fact, "vehicle_id") },
      },
    );
  });
}

function emptyKilometreRows(snapshot: ReportSnapshot): readonly ReportTableRow[] {
  const byVehicle = new Map<
    string,
    { plate: string; loaded: number; empty: number; excluded: number }
  >();
  for (const segment of snapshot.segments) {
    const vehicleId = text(segment, "vehicle_id");
    const current = byVehicle.get(vehicleId) ?? {
      plate: text(segment, "vehicle_plate"),
      loaded: 0,
      empty: 0,
      excluded: 0,
    };
    const kilometres = number(segment, "kilometres");
    if (kilometres === null || nullableText(segment, "coverage_gap") !== null)
      current.excluded += 1;
    else if (text(segment, "load_state") === "loaded") current.loaded += kilometres;
    else current.empty += kilometres;
    byVehicle.set(vehicleId, current);
  }
  return [...byVehicle.entries()].map(([vehicleId, item]) => {
    const total = item.loaded + item.empty;
    return row(
      vehicleId,
      `Unidad ${item.plate}`,
      `${item.loaded.toFixed(1)} km cargado · ${item.empty.toFixed(1)} km vacío`,
      item.empty,
      total === 0 ? null : (item.empty / total) * 100,
      "kilometres",
      confirmed,
      { href: `/flota/${vehicleId}`, filter: { vehicleId } },
    );
  });
}

function maintenanceRows(snapshot: ReportSnapshot): readonly ReportTableRow[] {
  return snapshot.maintenance.map((fact) => {
    return row(
      text(fact, "work_order_id"),
      `Mantenimiento de ${text(fact, "vehicle_plate")}`,
      `${text(fact, "maintenance_type")} · ${text(fact, "status")}`,
      number(fact, "cost"),
      number(fact, "immobilized_hours"),
      "money",
      confirmed,
      {
        currency: text(fact, "currency", "PEN"),
        href: `/mantenimiento/${text(fact, "work_order_id")}`,
        filter: { vehicleId: text(fact, "vehicle_id") },
      },
    );
  });
}

function overviewSummary(
  snapshot: ReportSnapshot,
  filters: ReportFilters,
): readonly ReportSummaryMetric[] {
  const trips = snapshot.trips;
  const commerciallyCompleteTrips = trips.filter(
    (trip) =>
      bool(trip, "commercial_terms_complete") &&
      number(trip, "contracted_revenue") !== null &&
      number(trip, "tons") !== null,
  );
  const revenue = money(
    commerciallyCompleteTrips.map((trip) => ({
      currency: text(trip, "currency", "PEN"),
      value: valueOrZero(number(trip, "contracted_revenue")),
      state: confirmed,
    })),
  );
  const costs = money(
    trips
      .filter((trip) => number(trip, "direct_cost") !== null)
      .map((trip) => ({
        currency: text(trip, "currency", "PEN"),
        value: valueOrZero(number(trip, "direct_cost")),
        state: tripState(trip),
      })),
  );
  const margins = money(
    trips
      .filter(
        (trip) =>
          bool(trip, "commercial_terms_complete") &&
          number(trip, "contracted_revenue") !== null &&
          number(trip, "direct_cost") !== null,
      )
      .map((trip) => ({
        currency: text(trip, "currency", "PEN"),
        value:
          valueOrZero(number(trip, "contracted_revenue")) -
          valueOrZero(number(trip, "direct_cost")),
        state: tripState(trip),
      })),
  );
  const collections = collectionRows(snapshot, filters);
  const invoiceFacts = new Map<string, Record<string, unknown>>();
  snapshot.collections.forEach((item) => invoiceFacts.set(text(item, "invoice_id"), item));
  const invoiced = money(
    [...invoiceFacts.values()]
      .filter(
        (item) =>
          !["draft", "cancelled"].includes(text(item, "status", "draft")) &&
          text(item, "issued_on") >= filters.from &&
          text(item, "issued_on") <= filters.to,
      )
      .map((item) => ({
        currency: text(item, "currency", "PEN"),
        value: valueOrZero(number(item, "total")),
        state: confirmed,
      })),
  );
  const paymentIds = new Set<string>();
  const collected = money(
    snapshot.collections.flatMap((item) => {
      const paymentId = nullableText(item, "payment_id");
      const paidAt = nullableText(item, "paid_at");
      if (
        paymentId === null ||
        paidAt === null ||
        paymentIds.has(paymentId) ||
        nullableText(item, "cancelled_at") !== null ||
        !isWithinLimaPeriod(paidAt, filters)
      )
        return [];
      paymentIds.add(paymentId);
      const matchingCurrency =
        nullableText(item, "payment_currency") === text(item, "currency", "PEN");
      return [
        {
          currency: text(item, "currency", "PEN"),
          value: valueOrZero(number(item, "payment_amount")),
          state: matchingCurrency ? confirmed : unavailable,
        },
      ];
    }),
  );
  const receivable = money(
    collections
      .filter((item) => valueOrZero(item.value) > 0)
      .map((item) => ({
        currency: item.currency ?? "PEN",
        value: valueOrZero(item.value),
        state: item.state,
      })),
  );
  const fleet = fleetRows(snapshot, filters);
  const utilization =
    fleet.length === 0
      ? null
      : fleet.reduce((sum, item) => sum + valueOrZero(item.value), 0) / fleet.length;
  const empty = emptyKilometreRows(snapshot).reduce(
    (sum, item) => sum + valueOrZero(item.value),
    0,
  );
  const directState = margins.reduce<ReportMetricState>(
    (state, item) => minState(state, item.state),
    confirmed,
  );
  return [
    metric("trips", "Viajes finalizados", "count", trips.length, confirmed),
    metric(
      "tons",
      "Toneladas",
      "tons",
      commerciallyCompleteTrips.reduce((sum, item) => sum + valueOrZero(number(item, "tons")), 0),
      confirmed,
    ),
    metric(
      "contractedRevenue",
      `Flete confirmado (${commerciallyCompleteTrips.length} de ${trips.length} viajes)`,
      "money",
      null,
      confirmed,
      revenue,
    ),
    metric("invoiced", "Facturado", "money", null, confirmed, invoiced),
    metric("collected", "Cobrado", "money", null, confirmed, collected),
    metric("directCosts", "Costos directos", "money", null, directState, costs),
    metric("directMargin", "Margen directo", "money", null, directState, margins),
    metric(
      "utilization",
      "Utilización",
      "percent",
      utilization,
      fleet.length === 0 ? unavailable : confirmed,
    ),
    metric(
      "emptyKilometres",
      "Kilómetros vacíos",
      "kilometres",
      empty,
      snapshot.segments.length === 0 ? unavailable : confirmed,
    ),
    metric("receivables", "Saldo por cobrar", "money", null, confirmed, receivable),
  ];
}

function coverage(
  snapshot: ReportSnapshot,
  rows: readonly ReportTableRow[],
  notes: readonly string[],
): ReportCoverage {
  const unavailableCount = rows.filter((item) => item.state === unavailable).length;
  return {
    availableFrom: snapshot.availableFrom,
    eligibleRecords: rows.length - unavailableCount,
    excludedRecords: unavailableCount,
    notes: [
      snapshot.availableFrom === null
        ? "Aún no existe una línea base de cobertura."
        : `Datos disponibles desde ${formatLimaDate(snapshot.availableFrom)}.`,
      ...notes,
    ],
  };
}

export function buildReport(
  companyId: string,
  kind: ReportKind,
  filters: ReportFilters,
  snapshot: ReportSnapshot,
): ReportResult {
  const rows = (() => {
    switch (kind) {
      case "OVERVIEW":
        return completedTripRows(snapshot);
      case "TRIPS_CARGO":
        return completedTripRows(snapshot);
      case "FLEET_UTILIZATION":
        return fleetRows(snapshot, filters);
      case "DOWNTIME":
        return downtimeRows(snapshot, filters);
      case "DIRECT_MARGIN":
        return directMarginRows(snapshot);
      case "FUEL":
        return fuelRows(snapshot);
      case "EMPTY_KILOMETRES":
        return emptyKilometreRows(snapshot);
      case "MAINTENANCE":
        return maintenanceRows(snapshot);
      case "COLLECTIONS":
        return collectionRows(snapshot, filters);
    }
  })();
  const incompleteCommercialTrips = snapshot.trips.filter(
    (trip) => !bool(trip, "commercial_terms_complete"),
  ).length;
  const commercialCoverageNote =
    incompleteCommercialTrips === 0
      ? []
      : [
          `${incompleteCommercialTrips} viaje(s) quedaron fuera de los agregados de peso, flete y margen porque su información comercial está incompleta.`,
        ];
  const notes: readonly string[] = [
    ...commercialCoverageNote,
    ...(kind === "EMPTY_KILOMETRES"
      ? ["Los tramos sin odómetro final o con eventos inconsistentes se excluyen del cálculo."]
      : kind === "DIRECT_MARGIN"
        ? [
            "El margen directo no incluye remuneraciones, depreciación ni gastos generales; no es utilidad neta.",
          ]
        : kind === "DOWNTIME"
          ? ["Las detenciones se informan por tiempo y causa; no se les asigna un costo estimado."]
          : []),
  ];
  return {
    companyId,
    kind,
    period: { from: filters.from, to: filters.to },
    generatedAt: snapshot.generatedAt,
    coverage: coverage(snapshot, rows, notes),
    summary: kind === "OVERVIEW" ? overviewSummary(snapshot, filters) : [],
    series: series(rows),
    rows,
  };
}
