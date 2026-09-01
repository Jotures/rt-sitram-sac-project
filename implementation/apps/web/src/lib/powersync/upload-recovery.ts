import { UpdateType, type CommonPowerSyncDatabase, type CrudEntry } from "@powersync/web";
import { mapProductUpload } from "./upload";

export type UploadFailureKind = "retryable" | "terminal";
export type UploadDeadLetterStatus = "pending_review" | "retry_queued" | "discarded";

export interface UploadFailureClassification {
  readonly kind: UploadFailureKind;
  readonly code: string | null;
  readonly message: string;
}

export interface UploadDeadLetterRow {
  readonly id: string;
  readonly source_table: string;
  readonly source_record_id: string;
  readonly operation: string;
  readonly op_data_json: string;
  readonly error_code: string | null;
  readonly error_message: string;
  readonly status: UploadDeadLetterStatus;
  readonly attempts: number;
  readonly first_failed_at: string;
  readonly last_failed_at: string;
  readonly resolved_at: string | null;
  readonly resolution: string | null;
  readonly resolution_note: string | null;
  readonly retry_record_id: string | null;
}

interface ErrorShape {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly status?: unknown;
}

interface RecoveryDatabase {
  execute(sql: string, parameters?: unknown[]): Promise<unknown>;
  getAll<T>(sql: string, parameters?: unknown[]): Promise<T[]>;
  writeTransaction<T>(callback: (transaction: RecoveryTransaction) => Promise<T>): Promise<T>;
}

interface RecoveryTransaction {
  execute(sql: string, parameters?: unknown[]): Promise<unknown>;
}

const TERMINAL_POSTGRES_CODES = /^(22|23)[0-9A-Z]{3}$|^42501$|^P0001$/u;
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429]);
const NETWORK_MESSAGE =
  /network|failed to fetch|fetch failed|timeout|timed out|connection|offline/iu;

const RETRY_COLUMNS = {
  odometer_entries: [
    "trip_id",
    "vehicle_id",
    "reading_km",
    "reading_at",
    "reading_type",
    "source_device_id",
    "idempotency_key",
    "created_at",
  ],
  fuel_entries: [
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
    "source_device_id",
    "idempotency_key",
    "created_at",
    "updated_at",
  ],
  expenses: [
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
    "source_device_id",
    "idempotency_key",
    "created_at",
    "updated_at",
  ],
  incidents: [
    "trip_id",
    "vehicle_id",
    "occurred_at",
    "location",
    "incident_type",
    "severity",
    "description",
    "action_taken",
    "source_device_id",
    "idempotency_key",
    "created_at",
    "updated_at",
  ],
  trip_transition_requests: [
    "trip_id",
    "requested_action",
    "odometer_km",
    "cargo_delivered",
    "occurred_at",
    "source_device_id",
    "created_at",
  ],
  trip_load_state_events: [
    "trip_id",
    "vehicle_id",
    "load_state",
    "effective_at",
    "odometer_km",
    "source_device_id",
    "idempotency_key",
    "supersedes_event_id",
    "correction_reason",
    "created_at",
  ],
} as const;

type RetryTable = keyof typeof RETRY_COLUMNS;

interface PreparedRetryPayload {
  readonly legacyEntityId: string | null;
  readonly payload: Record<string, unknown>;
  readonly repairedLegacyShift: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const FUEL_UNITS = new Set(["gallon", "liter"]);
const INCIDENT_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

function errorShape(error: unknown): ErrorShape {
  return typeof error === "object" && error !== null ? error : {};
}

function errorMessage(error: unknown): string {
  const shape = errorShape(error);
  return typeof shape.message === "string" && shape.message.trim().length > 0
    ? shape.message.trim()
    : "La mutación falló sin un mensaje técnico.";
}

export function classifyUploadFailure(error: unknown): UploadFailureClassification {
  const shape = errorShape(error);
  const message = errorMessage(error);
  const code = typeof shape.code === "string" ? shape.code : null;
  const status = typeof shape.status === "number" ? shape.status : null;

  if (
    NETWORK_MESSAGE.test(message) ||
    (status !== null && (status >= 500 || RETRYABLE_HTTP_STATUS.has(status)))
  ) {
    return { kind: "retryable", code, message };
  }

  if (
    message.startsWith("PowerSync upload rejected:") ||
    (code !== null && TERMINAL_POSTGRES_CODES.test(code)) ||
    (status !== null && status >= 400 && status < 500)
  ) {
    return { kind: "terminal", code, message };
  }

  // Unknown failures stay in PowerSync's queue. Only errors proven permanent
  // may move to manual review, so an infrastructure fault is never discarded.
  return { kind: "retryable", code, message };
}

function deadLetterId(entry: Pick<CrudEntry, "id" | "table">): string {
  return `${entry.table}:${entry.id}`;
}

export async function recordUploadDeadLetter(
  database: Pick<CommonPowerSyncDatabase, "execute">,
  entry: Pick<CrudEntry, "id" | "op" | "opData" | "table">,
  failure: UploadFailureClassification,
  now = new Date(),
): Promise<void> {
  if (failure.kind !== "terminal") {
    throw new Error("Solo una falla terminal puede pasar a revisión manual.");
  }

  const failedAt = now.toISOString();
  // PowerSync presents application tables as SQLite views. SQLite supports
  // INSERT and UPDATE through those views, but rejects `INSERT ... ON
  // CONFLICT` ("cannot UPSERT a view"). Update first, then insert only when
  // no recovery row exists; the local database is single-writer for this
  // mutation and this preserves the same attempt-count semantics.
  await database.execute(
    `UPDATE upload_dead_letters
     SET error_code = ?,
         error_message = ?,
         attempts = attempts + 1,
         last_failed_at = ?
     WHERE id = ?`,
    [failure.code, failure.message.slice(0, 2_000), failedAt, deadLetterId(entry)],
  );
  await database.execute(
    `INSERT INTO upload_dead_letters (
      id, source_table, source_record_id, operation, op_data_json,
      error_code, error_message, status, attempts, first_failed_at,
      last_failed_at, resolved_at, resolution, resolution_note, retry_record_id
    ) SELECT ?, ?, ?, ?, ?, ?, ?, 'pending_review', 1, ?, ?, NULL, NULL, NULL, NULL
      WHERE NOT EXISTS (SELECT 1 FROM upload_dead_letters WHERE id = ?)`,
    [
      deadLetterId(entry),
      entry.table,
      entry.id,
      String(entry.op),
      JSON.stringify(entry.opData ?? {}),
      failure.code,
      failure.message.slice(0, 2_000),
      failedAt,
      failedAt,
      deadLetterId(entry),
    ],
  );
}

function isRetryTable(value: string): value is RetryTable {
  return Object.hasOwn(RETRY_COLUMNS, value);
}

function parsePayload(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("El payload guardado para recuperación no es válido.");
  }

  return { ...parsed };
}

function nullable(value: unknown): unknown {
  return value === undefined ? null : value;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function repairLegacyShiftedPayload(
  table: RetryTable,
  sourceRecordId: string,
  payload: Record<string, unknown>,
): PreparedRetryPayload {
  if (
    table === "fuel_entries" &&
    FUEL_UNITS.has(String(payload.quantity)) &&
    typeof payload.odometer_km === "number" &&
    isUuid(payload.source_device_id)
  ) {
    return {
      repairedLegacyShift: true,
      legacyEntityId: payload.source_device_id,
      payload: {
        trip_id: sourceRecordId,
        vehicle_id: nullable(payload.trip_id),
        supplier_id: nullable(payload.vehicle_id),
        fueled_at: nullable(payload.supplier_id),
        location: nullable(payload.fueled_at),
        odometer_km: nullable(payload.location),
        quantity: payload.odometer_km,
        volume_unit: payload.quantity,
        unit_price: nullable(payload.volume_unit),
        total_amount: nullable(payload.unit_price),
        currency: nullable(payload.total_amount),
        payment_method: nullable(payload.currency),
        receipt_type: nullable(payload.payment_method),
        receipt_number: nullable(payload.receipt_type),
        source_device_id: nullable(payload.receipt_number),
        idempotency_key: payload.source_device_id,
        created_at: nullable(payload.idempotency_key),
        updated_at: nullable(payload.created_at),
      },
    };
  }

  if (
    table === "expenses" &&
    sourceRecordId === "trip" &&
    isUuid(payload.assignment_type) &&
    payload.description === "driver_mobile" &&
    isUuid(payload.source_device_id)
  ) {
    return {
      repairedLegacyShift: true,
      legacyEntityId: payload.source_device_id,
      payload: {
        assignment_type: "trip",
        trip_id: payload.assignment_type,
        vehicle_id: nullable(payload.trip_id),
        category_id: nullable(payload.vehicle_id),
        supplier_id: nullable(payload.category_id),
        incurred_at: nullable(payload.supplier_id),
        amount: nullable(payload.incurred_at),
        currency: nullable(payload.amount),
        receipt_type: nullable(payload.currency),
        receipt_number: nullable(payload.receipt_type),
        description: nullable(payload.receipt_number),
        source: payload.description,
        source_device_id: nullable(payload.source),
        idempotency_key: payload.source_device_id,
        created_at: nullable(payload.idempotency_key),
        updated_at: nullable(payload.created_at),
      },
    };
  }

  if (
    table === "incidents" &&
    isUuid(sourceRecordId) &&
    INCIDENT_SEVERITIES.has(String(payload.incident_type)) &&
    isUuid(payload.source_device_id)
  ) {
    return {
      repairedLegacyShift: true,
      legacyEntityId: payload.source_device_id,
      payload: {
        trip_id: sourceRecordId,
        vehicle_id: nullable(payload.trip_id),
        occurred_at: nullable(payload.vehicle_id),
        location: nullable(payload.occurred_at),
        incident_type: nullable(payload.location),
        severity: payload.incident_type,
        description: nullable(payload.severity),
        action_taken: nullable(payload.description),
        source_device_id: nullable(payload.action_taken),
        idempotency_key: payload.source_device_id,
        created_at: nullable(payload.idempotency_key),
        updated_at: nullable(payload.created_at),
      },
    };
  }

  return { repairedLegacyShift: false, legacyEntityId: null, payload };
}

export function isRepairableLegacyUpload(
  row: Pick<UploadDeadLetterRow, "op_data_json" | "source_record_id" | "source_table">,
): boolean {
  if (!isRetryTable(row.source_table)) return false;
  try {
    return repairLegacyShiftedPayload(
      row.source_table,
      row.source_record_id,
      parsePayload(row.op_data_json),
    ).repairedLegacyShift;
  } catch {
    return false;
  }
}

export function uploadFailureMessage(
  row: Pick<
    UploadDeadLetterRow,
    "error_message" | "op_data_json" | "source_record_id" | "source_table"
  >,
): string {
  if (isRepairableLegacyUpload(row)) {
    return "Este registro se guardó con los campos desalineados por una versión anterior. Reintentar creará una copia corregida.";
  }
  if (/outside the writable authenticated scope|no longer assigned/iu.test(row.error_message)) {
    return "El viaje ya no está disponible para registrar esta actividad. Revisa la asignación antes de decidir.";
  }
  if (/odometer cannot decrease/iu.test(row.error_message)) {
    return "El kilometraje es menor que la última lectura confirmada. Verifica el valor antes de reintentar.";
  }
  return "El servidor rechazó este registro. Conserva el dato y revisa su contenido antes de reintentar o descartarlo.";
}

function checkedColumns(table: RetryTable, payload: Record<string, unknown>): string[] {
  const allowed = new Set<string>(RETRY_COLUMNS[table]);
  const columns = Object.keys(payload);
  const unexpected = columns.find((column) => !allowed.has(column));
  if (unexpected !== undefined) {
    throw new Error(`La mutación contiene un campo no recuperable: ${unexpected}.`);
  }

  return columns;
}

async function pendingDeadLetter(
  database: Pick<RecoveryDatabase, "getAll">,
  id: string,
): Promise<UploadDeadLetterRow> {
  const rows = await database.getAll<UploadDeadLetterRow>(
    "SELECT * FROM upload_dead_letters WHERE id = ? LIMIT 1",
    [id],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("La mutación pendiente ya no existe en este dispositivo.");
  }
  if (row.status !== "pending_review") {
    throw new Error("La mutación ya fue resuelta.");
  }
  return row;
}

export async function retryUploadDeadLetter(
  database: RecoveryDatabase,
  id: string,
  confirmed: boolean,
  now = new Date(),
): Promise<string> {
  if (!confirmed) {
    throw new Error("Confirma el reintento de la mutación antes de continuar.");
  }

  const row = await pendingDeadLetter(database, id);
  if (!isRetryTable(row.source_table) || row.operation !== String(UpdateType.PUT)) {
    throw new Error("Este tipo de mutación no puede reintentarse automáticamente.");
  }

  const prepared = repairLegacyShiftedPayload(
    row.source_table,
    row.source_record_id,
    parsePayload(row.op_data_json),
  );
  const payload = prepared.payload;
  const retryRecordId = crypto.randomUUID();
  if ("idempotency_key" in payload) {
    payload.idempotency_key = retryRecordId;
  }
  const columns = checkedColumns(row.source_table, payload);

  // Re-run the exact same allowlist used by the upload connector before
  // putting anything back into PowerSync's tracked CRUD queue.
  mapProductUpload({
    id: retryRecordId,
    op: UpdateType.PUT,
    opData: payload,
    table: row.source_table,
  });

  const placeholders = ["?", ...columns.map(() => "?")].join(", ");
  const identifiers = ["id", ...columns].map((column) => `"${column}"`).join(", ");
  const resolvedAt = now.toISOString();
  const attachmentEntityTypes: Partial<Record<RetryTable, string>> = {
    fuel_entries: "fuel_entry",
    expenses: "expense",
    incidents: "incident",
  };
  const attachmentEntityType = attachmentEntityTypes[row.source_table];

  await database.writeTransaction(async (transaction) => {
    await transaction.execute(
      `INSERT INTO ${row.source_table} (${identifiers}) VALUES (${placeholders})`,
      [retryRecordId, ...columns.map((column) => payload[column] ?? null)],
    );
    if (attachmentEntityType !== undefined) {
      await transaction.execute(
        `UPDATE attachment_queue
         SET entity_id = ?, status = 'pending', attempts = 0,
           last_error = NULL, updated_at = ?
         WHERE entity_type = ?
           AND entity_id IN (?, ?)
           AND status IN ('pending', 'uploading', 'failed')`,
        [
          retryRecordId,
          resolvedAt,
          attachmentEntityType,
          row.source_record_id,
          prepared.legacyEntityId ?? row.source_record_id,
        ],
      );
    }
    await transaction.execute(
      `UPDATE upload_dead_letters
       SET status = 'retry_queued', resolved_at = ?, resolution = 'retry',
         resolution_note = ?, retry_record_id = ?
       WHERE id = ? AND status = 'pending_review'`,
      [
        resolvedAt,
        prepared.repairedLegacyShift
          ? "Copia corregida y reintento confirmado por el usuario."
          : "Reintento confirmado por el usuario.",
        retryRecordId,
        id,
      ],
    );
  });

  return retryRecordId;
}

export async function discardUploadDeadLetter(
  database: Pick<RecoveryDatabase, "execute" | "getAll">,
  id: string,
  confirmed: boolean,
  note: string,
  now = new Date(),
): Promise<void> {
  if (!confirmed) {
    throw new Error("Confirma el descarte definitivo de la mutación antes de continuar.");
  }

  await pendingDeadLetter(database, id);
  const trimmedNote = note.trim();
  if (trimmedNote.length < 3) {
    throw new Error("Indica brevemente por qué descartas el registro.");
  }
  if (trimmedNote.length > 500) {
    throw new Error("El motivo de descarte es demasiado largo.");
  }

  await database.execute(
    `UPDATE upload_dead_letters
     SET status = 'discarded', resolved_at = ?, resolution = 'discard',
       resolution_note = ?, retry_record_id = NULL
     WHERE id = ? AND status = 'pending_review'`,
    [now.toISOString(), trimmedNote, id],
  );
}
