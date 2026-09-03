import { useQuery } from "@powersync/react";
import { useAuth } from "../auth/AuthProvider";

export interface DriverTripRow {
  readonly id: string;
  readonly code: string;
  readonly origin: string;
  readonly pickup_location: string | null;
  readonly destination: string;
  readonly operational_status: string;
  readonly server_operational_status: string;
  readonly capture_mode: "driver_app" | "staff_assisted";
  readonly capture_mode_changed_at: string | null;
  readonly scheduled_at: string;
  readonly started_at: string | null;
  readonly operational_finished_at: string | null;
  readonly vehicle_id: string | null;
  readonly plate: string | null;
  readonly current_odometer_km: number | null;
  readonly driver_name: string;
  readonly version: number;
}

export interface DriverReferenceRow {
  readonly id: string;
  readonly name: string;
}

export interface DriverActivityRow {
  readonly id: string;
  readonly kind: "expense" | "fuel" | "incident" | "odometer";
  readonly occurred_at: string;
  readonly summary: string;
  readonly detail: string | null;
}

const WRITABLE_TRIP_STATUSES = new Set(["loading", "in_transit", "unloading"]);

export function isTripWritable(status: string): boolean {
  return WRITABLE_TRIP_STATUSES.has(status);
}

export function isDriverTripCaptureWritable(
  trip: Pick<DriverTripRow, "operational_status" | "capture_mode">,
): boolean {
  return isTripWritable(trip.operational_status) && trip.capture_mode === "driver_app";
}

export function useDriverTrips(): {
  readonly activeTrip: DriverTripRow | null;
  readonly data: readonly DriverTripRow[];
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly nextTrip: DriverTripRow | null;
} {
  const { state } = useAuth();
  const userId = state.session?.user.id ?? "";
  const result = useQuery<DriverTripRow>(
    `SELECT
      t.id, t.code, t.origin, t.pickup_location, t.destination,
      CASE
        WHEN t.operational_status IN ('completed', 'cancelled') THEN t.operational_status
        WHEN EXISTS (
          SELECT 1 FROM trip_transition_requests r
          WHERE r.trip_id = t.id AND r.requested_action = 'complete'
            AND NOT EXISTS (
              SELECT 1 FROM upload_dead_letters d
              WHERE d.source_table = 'trip_transition_requests' AND d.source_record_id = r.id
            )
        ) THEN 'completed'
        WHEN EXISTS (
          SELECT 1 FROM trip_transition_requests r
          WHERE r.trip_id = t.id AND r.requested_action = 'arrive'
            AND NOT EXISTS (
              SELECT 1 FROM upload_dead_letters d
              WHERE d.source_table = 'trip_transition_requests' AND d.source_record_id = r.id
            )
        ) THEN 'unloading'
        WHEN EXISTS (
          SELECT 1 FROM trip_transition_requests r
          WHERE r.trip_id = t.id AND r.requested_action = 'start'
            AND NOT EXISTS (
              SELECT 1 FROM upload_dead_letters d
              WHERE d.source_table = 'trip_transition_requests' AND d.source_record_id = r.id
            )
        ) THEN 'in_transit'
        ELSE t.operational_status
      END AS operational_status,
      t.operational_status AS server_operational_status,
      t.scheduled_at, t.started_at, t.operational_finished_at,
      t.capture_mode, t.capture_mode_changed_at,
      t.vehicle_id, v.plate, v.current_odometer_km, d.display_name AS driver_name,
      t.version
    FROM trips t
    JOIN drivers d ON d.id = t.driver_id AND d.profile_id = ?
    LEFT JOIN vehicles v ON v.id = t.vehicle_id
    ORDER BY
      CASE WHEN t.operational_status IN ('loading', 'in_transit', 'unloading')
        THEN 0 WHEN t.operational_status = 'scheduled' THEN 1 ELSE 2 END,
      t.scheduled_at DESC`,
    [userId],
  );
  const activeTrip = result.data.find((trip) => isTripWritable(trip.operational_status)) ?? null;
  const nextTrip = result.data.find((trip) => trip.operational_status === "scheduled") ?? null;

  return {
    activeTrip,
    data: result.data,
    error: result.error ?? null,
    isLoading: result.isLoading,
    nextTrip,
  };
}

export function useExpenseCategories() {
  return useQuery<DriverReferenceRow>(
    "SELECT id, name FROM expense_categories WHERE active = 1 ORDER BY name",
  );
}

export function useSuppliers() {
  return useQuery<DriverReferenceRow>(
    `SELECT id, COALESCE(NULLIF(trade_name, ''), legal_name) AS name
     FROM suppliers WHERE active = 1 ORDER BY name`,
  );
}

export function useDriverActivityHistory(): ReturnType<typeof useQuery<DriverActivityRow>> {
  const { state } = useAuth();
  const userId = state.session?.user.id ?? "";

  return useQuery<DriverActivityRow>(
    `SELECT e.id, 'expense' AS kind, e.incurred_at AS occurred_at,
      'Gasto · S/ ' || printf('%.2f', e.amount) AS summary,
      COALESCE(e.description, c.name) AS detail
    FROM expenses e
    JOIN trips t ON t.id = e.trip_id
    JOIN drivers d ON d.id = t.driver_id AND d.profile_id = ?
    LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE NOT EXISTS (
      SELECT 1 FROM upload_dead_letters dead
      WHERE dead.source_table = 'expenses' AND dead.source_record_id = e.id
    )
    UNION ALL
    SELECT f.id, 'fuel' AS kind, f.fueled_at AS occurred_at,
      'Combustible · S/ ' || printf('%.2f', f.total_amount) AS summary,
      printf('%.3f %s · %.0f km', f.quantity, f.volume_unit, f.odometer_km) AS detail
    FROM fuel_entries f
    JOIN trips t ON t.id = f.trip_id
    JOIN drivers d ON d.id = t.driver_id AND d.profile_id = ?
    WHERE NOT EXISTS (
      SELECT 1 FROM upload_dead_letters dead
      WHERE dead.source_table = 'fuel_entries' AND dead.source_record_id = f.id
    )
    UNION ALL
    SELECT i.id, 'incident' AS kind, i.occurred_at,
      'Incidencia · ' || i.incident_type AS summary, i.description AS detail
    FROM incidents i
    JOIN trips t ON t.id = i.trip_id
    JOIN drivers d ON d.id = t.driver_id AND d.profile_id = ?
    WHERE NOT EXISTS (
      SELECT 1 FROM upload_dead_letters dead
      WHERE dead.source_table = 'incidents' AND dead.source_record_id = i.id
    )
    UNION ALL
    SELECT o.id, 'odometer' AS kind, o.reading_at AS occurred_at,
      'Kilometraje · ' || printf('%.0f km', o.reading_km) AS summary,
      o.reading_type AS detail
    FROM odometer_entries o
    JOIN trips t ON t.id = o.trip_id
    JOIN drivers d ON d.id = t.driver_id AND d.profile_id = ?
    WHERE NOT EXISTS (
      SELECT 1 FROM upload_dead_letters dead
      WHERE dead.source_table = 'odometer_entries' AND dead.source_record_id = o.id
    )
    ORDER BY occurred_at DESC`,
    [userId, userId, userId, userId],
  );
}
