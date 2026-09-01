import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";
import { buildReport, type ReportSnapshot } from "./report-calculations";
import type { ReportFilters, ReportKind, ReportReadGateway, ReportResult } from "./reports";

interface RpcResult {
  readonly data: unknown;
  readonly error: { readonly message: string } | null;
}

interface ReportsRpcClient {
  rpc(name: string, args: Readonly<Record<string, unknown>>): PromiseLike<RpcResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function snapshot(value: unknown): ReportSnapshot {
  if (!isRecord(value)) throw new Error("El servidor no devolvió un snapshot de reportes válido.");
  return {
    generatedAt:
      typeof value.generatedAt === "string" ? value.generatedAt : new Date().toISOString(),
    availableFrom: typeof value.availableFrom === "string" ? value.availableFrom : null,
    trips: records(value.trips),
    fuel: records(value.fuel),
    maintenance: records(value.maintenance),
    collections: records(value.collections),
    intervals: records(value.intervals),
    segments: records(value.segments),
  };
}

function args(kind: ReportKind, filters: ReportFilters): Readonly<Record<string, unknown>> {
  return {
    p_kind: kind,
    p_from: filters.from,
    p_to: filters.to,
    p_vehicle_id: filters.vehicleId ?? null,
    p_route_id: filters.routeId ?? null,
    p_client_id: filters.clientId ?? null,
    p_driver_id: filters.driverId ?? null,
  };
}

export interface ReportExportGateway {
  auditExport(input: {
    readonly kind: ReportKind;
    readonly format: "csv" | "pdf" | "dossier";
    readonly filters: ReportFilters;
  }): Promise<void>;
}

export interface ReportFilterOption {
  readonly id: string;
  readonly label: string;
}

export interface ReportFilterOptions {
  readonly vehicles: readonly ReportFilterOption[];
  readonly routes: readonly ReportFilterOption[];
  readonly clients: readonly ReportFilterOption[];
  readonly drivers: readonly ReportFilterOption[];
}

function options(value: unknown): readonly ReportFilterOption[] {
  return records(value)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      label: typeof item.label === "string" ? item.label : "",
    }))
    .filter((item) => item.id.length > 0 && item.label.length > 0);
}

export function createSupabaseReportGateway(client: SupabaseClient<Database>): ReportReadGateway &
  ReportExportGateway & {
    loadFilterOptions(): Promise<ReportFilterOptions>;
    runDossier(input: {
      readonly companyId: string;
      readonly kinds: readonly ReportKind[];
      readonly filters: ReportFilters;
    }): Promise<readonly ReportResult[]>;
  } {
  const rpc = client as unknown as ReportsRpcClient;
  return {
    async runReport({ companyId, kind, filters }): Promise<ReportResult> {
      const result = await rpc.rpc("get_report_snapshot", args(kind, filters));
      if (result.error !== null) throw new Error(result.error.message);
      return buildReport(companyId, kind, filters, snapshot(result.data));
    },
    async auditExport({ kind, format, filters }): Promise<void> {
      const result = await rpc.rpc("record_report_export", {
        p_kind: kind,
        p_format: format,
        p_filters: {
          from: filters.from,
          to: filters.to,
          vehicleId: filters.vehicleId ?? null,
          routeId: filters.routeId ?? null,
          clientId: filters.clientId ?? null,
          driverId: filters.driverId ?? null,
        },
      });
      if (result.error !== null)
        throw new Error("No se pudo registrar la exportación; el archivo no fue generado.");
    },
    async loadFilterOptions(): Promise<ReportFilterOptions> {
      const result = await rpc.rpc("get_report_filter_options", {});
      if (result.error !== null) throw new Error(result.error.message);
      if (!isRecord(result.data)) return { vehicles: [], routes: [], clients: [], drivers: [] };
      return {
        vehicles: options(result.data.vehicles),
        routes: options(result.data.routes),
        clients: options(result.data.clients),
        drivers: options(result.data.drivers),
      };
    },
    async runDossier({ companyId, kinds, filters }): Promise<readonly ReportResult[]> {
      const result = await rpc.rpc("get_report_dossier_snapshot", {
        p_kinds: [...kinds],
        p_from: filters.from,
        p_to: filters.to,
        p_vehicle_id: filters.vehicleId ?? null,
        p_route_id: filters.routeId ?? null,
        p_client_id: filters.clientId ?? null,
        p_driver_id: filters.driverId ?? null,
      });
      if (result.error !== null) throw new Error(result.error.message);
      const dossierData = result.data;
      if (!isRecord(dossierData))
        throw new Error("El servidor no devolvió el dossier de reportes válido.");
      return kinds.map((kind) =>
        buildReport(companyId, kind, filters, snapshot(dossierData[kind])),
      );
    },
  };
}
