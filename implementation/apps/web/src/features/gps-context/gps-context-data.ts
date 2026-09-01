import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "../identity/identity-model";
import type { Database } from "../../lib/supabase";
import type { GpsContextSource } from "./gps-context";

const goldcarProviderKind = "GOLDCAR_PORTAL_RPA";

type GpsContextRow = Pick<
  Database["public"]["Views"]["vehicle_gps_context"]["Row"],
  "vehicle_id" | "recorded_at" | "received_at" | "speed_kmh" | "ignition" | "odometer_km"
>;

export interface GpsContextGateway {
  load(vehicleId: string): Promise<GpsContextSource>;
}

export interface GpsFleetContextGateway {
  loadFleetContext(): Promise<GpsFleetContextSource>;
}

/**
 * A deliberately small fleet projection for the dashboard. Vehicle labels are
 * resolved from the operational dashboard data; this gateway never receives
 * a provider name, external asset id, coordinates, or history.
 */
export interface GpsFleetLinkedVehicle {
  readonly vehicleId: string;
  readonly hasSignal: boolean;
}

export type GpsFleetContextSource =
  | { readonly kind: "UNAVAILABLE"; readonly reason: "OFFLINE" | "REMOTE" }
  | {
      readonly kind: "READY";
      readonly linkedVehicles: readonly GpsFleetLinkedVehicle[];
    };

/** GPS evidence is visible only to the staff roles permitted by RLS. */
export function canViewGpsTelemetry(role: AppRole): boolean {
  return role === "management" || role === "administration";
}

/**
 * Reads a narrow server-side view rather than the history or raw provider
 * tables. The view only contains an active approved link and matching latest
 * evidence, so retired provider assets cannot be displayed as current.
 */
export function createSupabaseGpsContextGateway(
  client: SupabaseClient<Database>,
): GpsContextGateway & GpsFleetContextGateway {
  return {
    async load(vehicleId: string): Promise<GpsContextSource> {
      const { data, error } = await client
        .from("vehicle_gps_context")
        .select("vehicle_id, recorded_at, received_at, speed_kmh, ignition, odometer_km")
        .eq("vehicle_id", vehicleId)
        .eq("provider_kind", goldcarProviderKind)
        .maybeSingle();

      if (error !== null) return { kind: "UNAVAILABLE", reason: "REMOTE" };
      if (data === null) return { kind: "NO_LINK" };
      if (data.vehicle_id !== vehicleId) return { kind: "UNAVAILABLE", reason: "REMOTE" };
      if (data.recorded_at === null && data.received_at === null) return { kind: "NO_SIGNAL" };
      if (!isCompleteSignal(data)) return { kind: "UNAVAILABLE", reason: "REMOTE" };

      return {
        kind: "SIGNAL",
        signal: {
          recordedAt: data.recorded_at,
          speedKmh: data.speed_kmh,
          ignition: data.ignition,
          odometerKm: data.odometer_km,
        },
      };
    },
    async loadFleetContext(): Promise<GpsFleetContextSource> {
      const { data, error } = await client
        .from("vehicle_gps_context")
        .select("vehicle_id, recorded_at, received_at")
        .eq("provider_kind", goldcarProviderKind);

      if (error !== null || data === null) return { kind: "UNAVAILABLE", reason: "REMOTE" };

      const linkedVehicleIds = new Set<string>();
      const linkedVehicles: GpsFleetLinkedVehicle[] = [];
      for (const row of data) {
        if (typeof row.vehicle_id !== "string" || linkedVehicleIds.has(row.vehicle_id)) {
          return { kind: "UNAVAILABLE", reason: "REMOTE" };
        }
        linkedVehicleIds.add(row.vehicle_id);

        const hasSignal = row.recorded_at !== null || row.received_at !== null;
        if (hasSignal && !hasValidSignalTimes(row))
          return { kind: "UNAVAILABLE", reason: "REMOTE" };
        linkedVehicles.push({ vehicleId: row.vehicle_id, hasSignal });
      }

      return {
        kind: "READY",
        linkedVehicles,
      };
    },
  };
}

function isCompleteSignal(value: GpsContextRow): value is GpsContextRow & {
  readonly vehicle_id: string;
  readonly recorded_at: string;
  readonly received_at: string;
} {
  return (
    typeof value.vehicle_id === "string" &&
    typeof value.recorded_at === "string" &&
    Number.isFinite(Date.parse(value.recorded_at)) &&
    typeof value.received_at === "string" &&
    Number.isFinite(Date.parse(value.received_at)) &&
    isOptionalNonNegativeNumber(value.speed_kmh) &&
    isOptionalBoolean(value.ignition) &&
    isOptionalNonNegativeNumber(value.odometer_km)
  );
}

function hasValidSignalTimes(
  value: Pick<GpsContextRow, "recorded_at" | "received_at">,
): value is { readonly recorded_at: string; readonly received_at: string } {
  return (
    typeof value.recorded_at === "string" &&
    Number.isFinite(Date.parse(value.recorded_at)) &&
    typeof value.received_at === "string" &&
    Number.isFinite(Date.parse(value.received_at))
  );
}

function isOptionalNonNegativeNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isOptionalBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}
