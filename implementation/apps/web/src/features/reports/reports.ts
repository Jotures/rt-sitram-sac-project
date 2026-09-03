import { type ActorContext, requirePermission } from "../shared/application";

export const REPORT_KINDS = [
  "OVERVIEW",
  "TRIPS_CARGO",
  "FLEET_UTILIZATION",
  "DOWNTIME",
  "DIRECT_MARGIN",
  "FUEL",
  "EMPTY_KILOMETRES",
  "MAINTENANCE",
  "COLLECTIONS",
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];
export type ReportMetricState = "CONFIRMED" | "UNAVAILABLE";

export interface ReportPeriod {
  readonly from: string;
  readonly to: string;
}

export interface ReportComparison {
  readonly from: string;
  readonly to: string;
}

export interface ReportFilters extends ReportPeriod {
  readonly vehicleId?: string;
  readonly routeId?: string;
  readonly clientId?: string;
  readonly driverId?: string;
  readonly comparison?: ReportComparison;
}

export interface ReportCoverage {
  readonly availableFrom: string | null;
  readonly eligibleRecords: number;
  readonly excludedRecords: number;
  readonly notes: readonly string[];
}

export interface ReportMoneyValue {
  readonly currency: string;
  readonly value: number;
  readonly state: ReportMetricState;
}

export interface ReportSummaryMetric {
  readonly id:
    | "trips"
    | "tons"
    | "contractedRevenue"
    | "invoiced"
    | "collected"
    | "directCosts"
    | "directMargin"
    | "utilization"
    | "emptyKilometres"
    | "receivables";
  readonly label: string;
  readonly value: number | null;
  readonly unit: "count" | "tons" | "kilometres" | "percent" | "money";
  readonly state: ReportMetricState;
  readonly money: readonly ReportMoneyValue[];
}

export interface ReportSeriesPoint {
  readonly key: string;
  readonly label: string;
  readonly value: number | null;
  readonly secondaryValue: number | null;
  readonly state: ReportMetricState;
}

export interface ReportTableRow {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly value: number | null;
  readonly secondaryValue: number | null;
  readonly unit: "count" | "tons" | "kilometres" | "hours" | "percent" | "money";
  readonly currency: string | null;
  readonly state: ReportMetricState;
  readonly href: string | null;
  readonly filter: Readonly<{
    readonly vehicleId?: string;
    readonly clientId?: string;
    readonly routeId?: string;
  }>;
}

interface ReportResultBase {
  readonly companyId: string;
  readonly period: ReportPeriod;
  readonly generatedAt: string;
  readonly coverage: ReportCoverage;
  readonly summary: readonly ReportSummaryMetric[];
  readonly series: readonly ReportSeriesPoint[];
  readonly rows: readonly ReportTableRow[];
}

export type ReportResult = { readonly kind: ReportKind } & ReportResultBase;

export interface ReportReadGateway {
  runReport(input: {
    readonly companyId: string;
    readonly kind: ReportKind;
    readonly filters: ReportFilters;
  }): Promise<ReportResult>;
}

export function reportPermission(
  kind: ReportKind,
): "VIEW_FULL_DASHBOARD" | "VIEW_FINANCIAL_DOCUMENTS" | "VIEW_PROFITABILITY" {
  if (kind === "DIRECT_MARGIN") return "VIEW_PROFITABILITY";
  if (kind === "COLLECTIONS") return "VIEW_FINANCIAL_DOCUMENTS";
  return "VIEW_FULL_DASHBOARD";
}

export async function runReport(
  gateway: ReportReadGateway,
  actor: ActorContext,
  kind: ReportKind,
  filters: ReportFilters,
): Promise<ReportResult> {
  requirePermission(actor, reportPermission(kind));
  const from = new Date(`${filters.from}T00:00:00.000Z`);
  const to = new Date(`${filters.to}T00:00:00.000Z`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to < from) {
    throw new Error("El periodo del reporte no es válido.");
  }
  const result = await gateway.runReport({ companyId: actor.companyId, kind, filters });
  if (result.companyId !== actor.companyId || result.kind !== kind) {
    throw new Error("El reporte devolvió un alcance diferente al solicitado.");
  }
  return result;
}
