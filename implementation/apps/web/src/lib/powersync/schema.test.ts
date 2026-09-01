import { describe, expect, it } from "vitest";
import { POWER_SYNC_REMOTE_TABLES, POWER_SYNC_WRITABLE_TABLES, powerSyncSchema } from "./schema";

interface SerializedTable {
  readonly name: string;
  readonly local_only?: boolean;
  readonly insert_only?: boolean;
  readonly columns: readonly { readonly name: string }[];
}

const GPS_RELATIONS_EXCLUDED_FROM_POWER_SYNC = [
  "gps_provider_vehicle_links",
  "gps_positions",
  "vehicle_latest_positions",
  "gps_telemetry_retention_policies",
  "gps_sync_runs",
  "vehicle_gps_context",
] as const;

function serializedTables(): readonly SerializedTable[] {
  const value: unknown = powerSyncSchema.toJSON();

  if (typeof value !== "object" || value === null || !("tables" in value)) {
    throw new Error("PowerSync schema did not serialize its tables.");
  }

  const tables = value.tables;
  if (!Array.isArray(tables)) {
    throw new Error("PowerSync schema tables are invalid.");
  }

  return tables.map((table): SerializedTable => {
    if (
      typeof table !== "object" ||
      table === null ||
      !("name" in table) ||
      typeof table.name !== "string" ||
      !("columns" in table) ||
      !Array.isArray(table.columns)
    ) {
      throw new Error("PowerSync serialized table is invalid.");
    }

    const columns = table.columns.map((item: unknown): { readonly name: string } => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("name" in item) ||
        typeof item.name !== "string"
      ) {
        throw new Error("PowerSync serialized column is invalid.");
      }

      return { name: item.name };
    });

    return {
      name: table.name,
      columns,
      ...("local_only" in table && table.local_only ? { local_only: true } : {}),
      ...("insert_only" in table && table.insert_only ? { insert_only: true } : {}),
    };
  });
}

describe("PowerSync product schema", () => {
  it("contains the minimum offline identity and driver trip tables", () => {
    expect(POWER_SYNC_REMOTE_TABLES).toEqual(
      expect.arrayContaining([
        "companies",
        "profiles",
        "drivers",
        "vehicles",
        "trips",
        "settlements",
      ]),
    );
  });

  it("excludes GPS telemetry tables and the online-only context view", () => {
    const serializedTableNames = serializedTables().map((table) => table.name);
    const remoteTableNames: readonly string[] = POWER_SYNC_REMOTE_TABLES;

    for (const relation of GPS_RELATIONS_EXCLUDED_FROM_POWER_SYNC) {
      expect(serializedTableNames).not.toContain(relation);
      expect(remoteTableNames).not.toContain(relation);
    }
  });

  it("allows local writes only for append-only captures and transition requests", () => {
    expect(POWER_SYNC_WRITABLE_TABLES).toEqual([
      "odometer_entries",
      "fuel_entries",
      "expenses",
      "incidents",
      "trip_transition_requests",
      "trip_load_state_events",
    ]);

    const tables = new Map(serializedTables().map((table) => [table.name, table]));

    for (const tableName of POWER_SYNC_WRITABLE_TABLES) {
      expect(tables.get(tableName)?.insert_only).toBe(true);
    }
    expect(tables.get("attachment_queue")?.local_only).toBe(true);
    expect(tables.get("attachment_recovery_events")?.local_only).toBe(true);
    expect(tables.get("upload_dead_letters")?.local_only).toBe(true);
    expect(tables.has("spike_records")).toBe(false);
  });

  it("keeps terminal upload payloads in a local auditable dead-letter table", () => {
    const deadLetterTable = serializedTables().find(
      (table) => table.name === "upload_dead_letters",
    );
    const columns = deadLetterTable?.columns.map((column) => column.name) ?? [];

    expect(columns).toEqual(
      expect.arrayContaining([
        "source_table",
        "source_record_id",
        "op_data_json",
        "error_message",
        "status",
        "attempts",
        "resolution",
        "retry_record_id",
      ]),
    );
  });

  it("stores attachment metadata but no binary/blob column", () => {
    const attachmentTable = serializedTables().find((table) => table.name === "attachment_queue");
    const columnNames = attachmentTable?.columns.map((column) => column.name) ?? [];

    expect(columnNames).toContain("local_uri");
    expect(columnNames).toContain("content_hash");
    expect(columnNames).not.toContain("blob");
    expect(columnNames).not.toContain("data");
  });

  it("keeps an immutable local audit trail for manual attachment recovery", () => {
    const auditTable = serializedTables().find(
      (table) => table.name === "attachment_recovery_events",
    );
    const columnNames = auditTable?.columns.map((column) => column.name) ?? [];

    expect(columnNames).toEqual(
      expect.arrayContaining([
        "attachment_queue_id",
        "action",
        "previous_attempts",
        "previous_error",
        "reason",
        "created_at",
      ]),
    );
  });

  it("keeps cycle_id on trips rather than expense categories", () => {
    const tables = new Map(serializedTables().map((table) => [table.name, table]));
    const tripColumns = tables.get("trips")?.columns.map((column) => column.name) ?? [];
    const categoryColumns =
      tables.get("expense_categories")?.columns.map((column) => column.name) ?? [];

    expect(tripColumns).toContain("cycle_id");
    expect(tripColumns).toEqual(
      expect.arrayContaining(["capture_mode", "capture_mode_changed_at"]),
    );
    expect(tripColumns).not.toContain("return_status");
    expect(categoryColumns).not.toContain("cycle_id");
  });

  it("mirrors the authoritative settlement balance-resolution evidence", () => {
    const settlementColumns =
      serializedTables()
        .find((table) => table.name === "settlements")
        ?.columns.map((column) => column.name) ?? [];

    expect(settlementColumns).toEqual(
      expect.arrayContaining([
        "resolution_method",
        "resolution_reference",
        "resolution_note",
        "resolution_direction",
        "resolved_amount",
        "resolved_by",
        "resolved_at",
      ]),
    );
  });
});
