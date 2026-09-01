import type { CommonPowerSyncDatabase } from "@powersync/web";

export interface OfflineIdentityRow {
  readonly profile_id: string;
  readonly company_id: string;
  readonly display_name: string;
  readonly role: string;
  readonly profile_active: number;
  readonly legal_name: string;
  readonly trade_name: string | null;
  readonly company_active: number;
}

export interface OfflineDriverTripRow {
  readonly id: string;
  readonly code: string;
  readonly origin: string;
  readonly destination: string;
  readonly operational_status: string;
  readonly scheduled_at: string;
  readonly started_at: string | null;
  readonly vehicle_id: string | null;
  readonly plate: string | null;
  readonly driver_id: string;
  readonly driver_name: string;
}

export async function getOfflineIdentity(
  database: CommonPowerSyncDatabase,
  authenticatedUserId: string,
): Promise<OfflineIdentityRow | null> {
  const rows = await database.getAll<OfflineIdentityRow>(
    `SELECT
      p.id AS profile_id,
      p.company_id,
      p.display_name,
      p.role,
      p.active AS profile_active,
      c.legal_name,
      c.trade_name,
      c.active AS company_active
    FROM profiles p
    JOIN companies c ON c.id = p.company_id
    WHERE p.id = ?
    LIMIT 1`,
    [authenticatedUserId],
  );

  return rows[0] ?? null;
}

export function listOfflineDriverTrips(
  database: CommonPowerSyncDatabase,
  authenticatedUserId: string,
): Promise<OfflineDriverTripRow[]> {
  return database.getAll<OfflineDriverTripRow>(
    `SELECT
      t.id,
      t.code,
      t.origin,
      t.destination,
      t.operational_status,
      t.scheduled_at,
      t.started_at,
      t.vehicle_id,
      v.plate,
      d.id AS driver_id,
      d.display_name AS driver_name
    FROM trips t
    JOIN drivers d ON d.id = t.driver_id AND d.profile_id = ?
    LEFT JOIN vehicles v ON v.id = t.vehicle_id
    ORDER BY
      CASE WHEN t.operational_status IN ('loading', 'in_transit', 'unloading')
        THEN 0 ELSE 1 END,
      t.scheduled_at DESC`,
    [authenticatedUserId],
  );
}
