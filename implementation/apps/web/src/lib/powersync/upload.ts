import { UpdateType, type CrudEntry } from "@powersync/web";

export type UploadEntry = Pick<CrudEntry, "id" | "op" | "opData" | "table">;

type RpcName =
  | "record_odometer_entry"
  | "record_fuel_entry"
  | "record_expense"
  | "report_incident"
  | "apply_driver_trip_transition"
  | "record_trip_load_state_event";

export interface ProductUploadMutation {
  readonly table:
    | "odometer_entries"
    | "fuel_entries"
    | "expenses"
    | "incidents"
    | "trip_transition_requests"
    | "trip_load_state_events";
  readonly rpc: RpcName;
  readonly args: Readonly<Record<string, string | number | boolean | null>>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function rejectUnsupportedOperation(entry: UploadEntry): void {
  if (entry.op !== UpdateType.PUT) {
    throw new Error(
      `PowerSync upload rejected: ${entry.table} is append-only and only accepts inserts.`,
    );
  }
}

function requireRecordId(value: string, field = "id"): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`PowerSync upload rejected: ${field} must be a UUID.`);
  }

  return value;
}

function validateAllowedKeys(data: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(data).find((key) => !allowed.has(key));

  if (unexpected !== undefined) {
    throw new Error(`PowerSync upload rejected: unexpected field ${unexpected}.`);
  }
}

function requiredText(data: Record<string, unknown>, key: string, maximumLength = 500): string {
  const value = data[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`PowerSync upload rejected: ${key} is required.`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maximumLength) {
    throw new Error(`PowerSync upload rejected: ${key} is too long.`);
  }

  return trimmed;
}

function optionalText(
  data: Record<string, unknown>,
  key: string,
  maximumLength = 500,
): string | null {
  const value = data[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`PowerSync upload rejected: ${key} must be text.`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maximumLength) {
    throw new Error(`PowerSync upload rejected: ${key} is too long.`);
  }

  return trimmed.length === 0 ? null : trimmed;
}

function requiredUuid(data: Record<string, unknown>, key: string): string {
  return requireRecordId(requiredText(data, key, 36), key);
}

function optionalUuid(data: Record<string, unknown>, key: string): string | null {
  const value = optionalText(data, key, 36);

  return value === null ? null : requireRecordId(value, key);
}

function positiveNumber(data: Record<string, unknown>, key: string): number {
  const value = data[key];

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`PowerSync upload rejected: ${key} must be greater than zero.`);
  }

  return value;
}

function nonNegativeNumber(data: Record<string, unknown>, key: string): number {
  const value = data[key];

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`PowerSync upload rejected: ${key} must not be negative.`);
  }

  return value;
}

function timestamp(data: Record<string, unknown>, key: string): string {
  const value = requiredText(data, key, 40);
  const parsed = new Date(value);

  if (Number.isNaN(parsed.valueOf()) || !value.includes("T")) {
    throw new Error(`PowerSync upload rejected: ${key} must be an ISO timestamp.`);
  }

  return parsed.toISOString();
}

function oneOf<const T extends string>(
  data: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = requiredText(data, key);

  if (!allowed.some((candidate) => candidate === value)) {
    throw new Error(`PowerSync upload rejected: ${key} has an unsupported value.`);
  }

  return value as T;
}

function currency(data: Record<string, unknown>): string {
  const value = optionalText(data, "currency", 3) ?? "PEN";

  if (!CURRENCY_PATTERN.test(value)) {
    throw new Error("PowerSync upload rejected: currency must use a three-letter ISO code.");
  }

  return value;
}

function baseArgs(entry: UploadEntry, data: Record<string, unknown>) {
  const id = requireRecordId(entry.id);
  const idempotencyKey = optionalUuid(data, "idempotency_key") ?? id;

  return {
    p_id: id,
    p_idempotency_key: idempotencyKey,
    p_source_device_id: optionalText(data, "source_device_id", 200),
  };
}

const COMMON_KEYS = ["idempotency_key", "source_device_id", "created_at", "updated_at"] as const;

function mapOdometer(entry: UploadEntry, data: Record<string, unknown>): ProductUploadMutation {
  validateAllowedKeys(data, [
    ...COMMON_KEYS,
    "trip_id",
    "vehicle_id",
    "reading_km",
    "reading_at",
    "reading_type",
  ]);

  return {
    table: "odometer_entries",
    rpc: "record_odometer_entry",
    args: {
      ...baseArgs(entry, data),
      p_trip_id: requiredUuid(data, "trip_id"),
      p_reading_km: nonNegativeNumber(data, "reading_km"),
      p_reading_at: timestamp(data, "reading_at"),
      p_reading_type: oneOf(data, "reading_type", ["start", "current", "arrival", "final"]),
    },
  };
}

function mapFuel(entry: UploadEntry, data: Record<string, unknown>): ProductUploadMutation {
  validateAllowedKeys(data, [
    ...COMMON_KEYS,
    "trip_id",
    "vehicle_id",
    "supplier_id",
    "fueled_at",
    "location",
    "odometer_km",
    "quantity",
    "volume_unit",
    "unit_price",
    "total_amount",
    "currency",
    "payment_method",
    "receipt_type",
    "receipt_number",
  ]);

  const quantity = positiveNumber(data, "quantity");
  const unitPrice = nonNegativeNumber(data, "unit_price");
  const totalAmount = positiveNumber(data, "total_amount");

  if (Math.abs(totalAmount - Math.round(quantity * unitPrice * 100) / 100) > 0.05) {
    throw new Error("PowerSync upload rejected: fuel total does not match quantity × unit price.");
  }

  return {
    table: "fuel_entries",
    rpc: "record_fuel_entry",
    args: {
      ...baseArgs(entry, data),
      p_trip_id: requiredUuid(data, "trip_id"),
      p_supplier_id: optionalUuid(data, "supplier_id"),
      p_fueled_at: timestamp(data, "fueled_at"),
      p_location: optionalText(data, "location"),
      p_odometer_km: nonNegativeNumber(data, "odometer_km"),
      p_quantity: quantity,
      p_volume_unit: oneOf(data, "volume_unit", ["gallon", "liter"]),
      p_unit_price: unitPrice,
      p_total_amount: totalAmount,
      p_currency: currency(data),
      p_payment_method: optionalText(data, "payment_method", 100),
      p_receipt_type: optionalText(data, "receipt_type", 100),
      p_receipt_number: optionalText(data, "receipt_number", 100),
      p_receipt_file_id: null,
    },
  };
}

function mapExpense(entry: UploadEntry, data: Record<string, unknown>): ProductUploadMutation {
  validateAllowedKeys(data, [
    ...COMMON_KEYS,
    "assignment_type",
    "trip_id",
    "vehicle_id",
    "category_id",
    "supplier_id",
    "incurred_at",
    "amount",
    "currency",
    "receipt_type",
    "receipt_number",
    "description",
    "source",
  ]);

  oneOf(data, "assignment_type", ["trip"]);
  oneOf(data, "source", ["driver_mobile"]);

  return {
    table: "expenses",
    rpc: "record_expense",
    args: {
      ...baseArgs(entry, data),
      p_trip_id: requiredUuid(data, "trip_id"),
      p_category_id: requiredUuid(data, "category_id"),
      p_supplier_id: optionalUuid(data, "supplier_id"),
      p_incurred_at: timestamp(data, "incurred_at"),
      p_amount: positiveNumber(data, "amount"),
      p_currency: currency(data),
      p_receipt_type: optionalText(data, "receipt_type", 100),
      p_receipt_number: optionalText(data, "receipt_number", 100),
      p_receipt_file_id: null,
      p_description: optionalText(data, "description", 1_000),
    },
  };
}

function mapIncident(entry: UploadEntry, data: Record<string, unknown>): ProductUploadMutation {
  validateAllowedKeys(data, [
    ...COMMON_KEYS,
    "trip_id",
    "vehicle_id",
    "occurred_at",
    "location",
    "incident_type",
    "severity",
    "description",
    "action_taken",
  ]);

  return {
    table: "incidents",
    rpc: "report_incident",
    args: {
      ...baseArgs(entry, data),
      p_trip_id: requiredUuid(data, "trip_id"),
      p_occurred_at: timestamp(data, "occurred_at"),
      p_location: optionalText(data, "location"),
      p_incident_type: requiredText(data, "incident_type", 100),
      p_severity: oneOf(data, "severity", ["low", "medium", "high", "critical"]),
      p_description: requiredText(data, "description", 2_000),
      p_action_taken: optionalText(data, "action_taken", 1_000),
      p_estimated_cost: null,
      p_file_id: null,
    },
  };
}

function mapTripTransition(
  entry: UploadEntry,
  data: Record<string, unknown>,
): ProductUploadMutation {
  validateAllowedKeys(data, [
    ...COMMON_KEYS,
    "trip_id",
    "requested_action",
    "odometer_km",
    "cargo_delivered",
    "occurred_at",
  ]);
  const action = oneOf(data, "requested_action", ["start", "arrive", "complete"]);
  const mileage =
    data.odometer_km === null || data.odometer_km === undefined
      ? null
      : nonNegativeNumber(data, "odometer_km");
  const cargoDelivered = data.cargo_delivered;
  if (typeof cargoDelivered !== "number" || ![0, 1].includes(cargoDelivered)) {
    throw new Error("PowerSync upload rejected: cargo_delivered must be a SQLite boolean.");
  }
  if (action === "arrive" && (mileage !== null || cargoDelivered !== 0)) {
    throw new Error("PowerSync upload rejected: arrival cannot close a trip.");
  }
  if (action === "start" && (mileage === null || cargoDelivered !== 0)) {
    throw new Error("PowerSync upload rejected: start requires mileage only.");
  }
  if (action === "complete" && (mileage === null || cargoDelivered !== 1)) {
    throw new Error(
      "PowerSync upload rejected: completion requires mileage and delivery confirmation.",
    );
  }

  return {
    table: "trip_transition_requests",
    rpc: "apply_driver_trip_transition",
    args: {
      p_request_id: requireRecordId(entry.id),
      p_trip_id: requiredUuid(data, "trip_id"),
      p_action: action,
      p_odometer_km: mileage,
      p_cargo_delivered: cargoDelivered === 1,
      p_occurred_at: timestamp(data, "occurred_at"),
      p_source_device_id: optionalText(data, "source_device_id", 200),
    },
  };
}

function mapTripLoadState(
  entry: UploadEntry,
  data: Record<string, unknown>,
): ProductUploadMutation {
  validateAllowedKeys(data, [
    ...COMMON_KEYS,
    "trip_id",
    "vehicle_id",
    "load_state",
    "effective_at",
    "odometer_km",
    "supersedes_event_id",
    "correction_reason",
  ]);
  const supersedesEventId = optionalUuid(data, "supersedes_event_id");
  const correctionReason = optionalText(data, "correction_reason", 1_000);
  if (supersedesEventId === null && correctionReason !== null) {
    throw new Error("PowerSync upload rejected: correction_reason requires a superseded event.");
  }
  return {
    table: "trip_load_state_events",
    rpc: "record_trip_load_state_event",
    args: {
      ...baseArgs(entry, data),
      p_trip_id: requiredUuid(data, "trip_id"),
      p_load_state: oneOf(data, "load_state", ["loaded", "empty"]),
      p_effective_at: timestamp(data, "effective_at"),
      p_odometer_km: nonNegativeNumber(data, "odometer_km"),
      p_supersedes_event_id: supersedesEventId,
      p_correction_reason: correctionReason,
    },
  };
}

export function mapProductUpload(entry: UploadEntry): ProductUploadMutation {
  rejectUnsupportedOperation(entry);
  const data = entry.opData ?? {};

  switch (entry.table) {
    case "odometer_entries":
      return mapOdometer(entry, data);
    case "fuel_entries":
      return mapFuel(entry, data);
    case "expenses":
      return mapExpense(entry, data);
    case "incidents":
      return mapIncident(entry, data);
    case "trip_transition_requests":
      return mapTripTransition(entry, data);
    case "trip_load_state_events":
      return mapTripLoadState(entry, data);
    default:
      throw new Error(`PowerSync upload rejected: unsupported table ${entry.table}.`);
  }
}
