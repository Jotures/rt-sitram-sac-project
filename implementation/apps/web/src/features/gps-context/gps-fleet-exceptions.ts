import type { GpsFleetContextSource } from "./gps-context-data";

export interface GpsFleetVehicle {
  readonly id: string;
  readonly label: string;
}

export type GpsFleetExceptionKind = "NO_LINK" | "NO_SIGNAL";

/**
 * A dashboard exception identifies work to review, never a signal freshness
 * state. A source that cannot be read produces no exception, because it
 * cannot honestly confirm which units need attention.
 */
export interface GpsFleetException {
  readonly kind: GpsFleetExceptionKind;
  readonly vehicleId: string;
  readonly vehicleLabel: string;
}

export function deriveGpsFleetExceptions(
  vehicles: readonly GpsFleetVehicle[],
  source: GpsFleetContextSource,
): readonly GpsFleetException[] {
  if (source.kind !== "READY") return [];

  // A blank projection means GPS is intentionally inactive for the fleet.
  // Do not reinterpret suspended sources as units that require a new GPS link.
  if (source.linkedVehicles.length === 0) return [];

  const linkedVehicles = new Map(
    source.linkedVehicles.map((vehicle) => [vehicle.vehicleId, vehicle]),
  );
  const exceptions: GpsFleetException[] = [];
  for (const vehicle of vehicles) {
    const linkedVehicle = linkedVehicles.get(vehicle.id);
    if (linkedVehicle === undefined) {
      exceptions.push({ kind: "NO_LINK", vehicleId: vehicle.id, vehicleLabel: vehicle.label });
      continue;
    }
    if (!linkedVehicle.hasSignal) {
      exceptions.push({ kind: "NO_SIGNAL", vehicleId: vehicle.id, vehicleLabel: vehicle.label });
    }
  }
  return exceptions;
}
