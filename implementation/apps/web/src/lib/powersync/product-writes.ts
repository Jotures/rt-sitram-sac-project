import { UpdateType, type CommonPowerSyncDatabase } from "@powersync/web";
import { mapProductUpload } from "./upload";

export interface OfflineWriteContext {
  readonly sourceDeviceId: string;
  readonly now?: Date;
}

export interface AttachmentMetadata {
  readonly localUri: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentHash?: string | null;
}

export interface OdometerEntryInput {
  readonly tripId: string;
  readonly vehicleId: string;
  readonly readingKm: number;
  readonly readingAt: string;
  readonly readingType: "start" | "current" | "arrival" | "final";
}

export interface FuelEntryInput {
  readonly tripId: string;
  readonly vehicleId: string;
  readonly supplierId?: string | null;
  readonly fueledAt: string;
  readonly location?: string | null;
  readonly odometerKm: number;
  readonly quantity: number;
  readonly volumeUnit: "gallon" | "liter";
  readonly unitPrice: number;
  readonly totalAmount: number;
  readonly currency?: string;
  readonly paymentMethod?: string | null;
  readonly receiptType?: string | null;
  readonly receiptNumber?: string | null;
  readonly attachment?: AttachmentMetadata;
}

export interface ExpenseInput {
  readonly tripId: string;
  readonly vehicleId?: string | null;
  readonly categoryId: string;
  readonly supplierId?: string | null;
  readonly incurredAt: string;
  readonly amount: number;
  readonly currency?: string;
  readonly receiptType?: string | null;
  readonly receiptNumber?: string | null;
  readonly description?: string | null;
  readonly attachment?: AttachmentMetadata;
}

export interface IncidentInput {
  readonly tripId: string;
  readonly vehicleId: string;
  readonly occurredAt: string;
  readonly location?: string | null;
  readonly incidentType: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly description: string;
  readonly actionTaken?: string | null;
  readonly attachment?: AttachmentMetadata;
}

export interface TripTransitionInput {
  readonly tripId: string;
  readonly action: "start" | "arrive" | "complete";
  readonly odometerKm?: number | null;
  readonly cargoDelivered?: boolean;
}

export interface TripLoadStateInput {
  readonly tripId: string;
  readonly vehicleId: string;
  readonly loadState: "loaded" | "empty";
  readonly odometerKm: number;
  readonly effectiveAt?: string;
}

interface SqlExecutor {
  execute(sql: string, parameters?: unknown[]): Promise<unknown>;
}

async function executeCheckedInsert(
  database: SqlExecutor,
  sql: string,
  parameters: readonly unknown[],
): Promise<void> {
  const placeholderCount = sql.match(/\?/g)?.length ?? 0;
  if (placeholderCount !== parameters.length) {
    throw new Error(
      `La escritura local no es segura: se esperaban ${placeholderCount} valores y se recibieron ${parameters.length}.`,
    );
  }
  await database.execute(sql, [...parameters]);
}

function timestamp(context: OfflineWriteContext): string {
  return (context.now ?? new Date()).toISOString();
}

function validateBeforeInsert(
  table: "odometer_entries" | "fuel_entries" | "expenses" | "incidents" | "trip_load_state_events",
  id: string,
  data: Record<string, string | number | null>,
): void {
  mapProductUpload({ id, op: UpdateType.PUT, opData: data, table });
}

async function enqueueAttachment(
  database: SqlExecutor,
  entityType: "fuel_entry" | "expense" | "incident",
  entityId: string,
  attachment: AttachmentMetadata | undefined,
  createdAt: string,
): Promise<void> {
  if (attachment === undefined) {
    return;
  }

  if (
    attachment.localUri.trim().length === 0 ||
    attachment.originalName.trim().length === 0 ||
    attachment.mimeType.trim().length === 0 ||
    !Number.isSafeInteger(attachment.sizeBytes) ||
    attachment.sizeBytes < 0
  ) {
    throw new Error("Los metadatos del adjunto no son válidos.");
  }

  await database.execute(
    `INSERT INTO attachment_queue (
      id, entity_type, entity_id, local_uri, original_name, mime_type,
      size_bytes, content_hash, remote_file_id, storage_path,
      status, attempts, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'pending', 0, NULL, ?, ?)`,
    [
      crypto.randomUUID(),
      entityType,
      entityId,
      attachment.localUri,
      attachment.originalName,
      attachment.mimeType,
      attachment.sizeBytes,
      attachment.contentHash ?? null,
      createdAt,
      createdAt,
    ],
  );
}

async function writeEntryWithAttachment(
  database: CommonPowerSyncDatabase,
  sql: string,
  values: unknown[],
  entityType: "fuel_entry" | "expense" | "incident",
  entityId: string,
  attachment: AttachmentMetadata | undefined,
  createdAt: string,
): Promise<void> {
  if (attachment === undefined) {
    await executeCheckedInsert(database, sql, values);
    return;
  }

  await database.writeTransaction(async (transaction) => {
    await executeCheckedInsert(transaction, sql, values);
    await enqueueAttachment(transaction, entityType, entityId, attachment, createdAt);
  });
}

export async function recordOdometerOffline(
  database: CommonPowerSyncDatabase,
  input: OdometerEntryInput,
  context: OfflineWriteContext,
): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = timestamp(context);
  const data = {
    trip_id: input.tripId,
    vehicle_id: input.vehicleId,
    reading_km: input.readingKm,
    reading_at: input.readingAt,
    reading_type: input.readingType,
    source_device_id: context.sourceDeviceId,
    idempotency_key: id,
    created_at: createdAt,
  };
  validateBeforeInsert("odometer_entries", id, data);
  await executeCheckedInsert(
    database,
    `INSERT INTO odometer_entries (
      id, trip_id, vehicle_id, reading_km, reading_at, reading_type,
      source_device_id, idempotency_key, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.trip_id,
      data.vehicle_id,
      data.reading_km,
      data.reading_at,
      data.reading_type,
      data.source_device_id,
      data.idempotency_key,
      data.created_at,
    ],
  );

  return id;
}

export async function recordFuelOffline(
  database: CommonPowerSyncDatabase,
  input: FuelEntryInput,
  context: OfflineWriteContext,
): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = timestamp(context);
  const data = {
    trip_id: input.tripId,
    vehicle_id: input.vehicleId,
    supplier_id: input.supplierId ?? null,
    fueled_at: input.fueledAt,
    location: input.location ?? null,
    odometer_km: input.odometerKm,
    quantity: input.quantity,
    volume_unit: input.volumeUnit,
    unit_price: input.unitPrice,
    total_amount: input.totalAmount,
    currency: input.currency ?? "PEN",
    payment_method: input.paymentMethod ?? null,
    receipt_type: input.receiptType ?? null,
    receipt_number: input.receiptNumber ?? null,
    source_device_id: context.sourceDeviceId,
    idempotency_key: id,
    created_at: createdAt,
    updated_at: createdAt,
  };
  validateBeforeInsert("fuel_entries", id, data);
  await writeEntryWithAttachment(
    database,
    `INSERT INTO fuel_entries (
      id, trip_id, vehicle_id, supplier_id, fueled_at, location, odometer_km,
      quantity, volume_unit, unit_price, total_amount, currency, payment_method,
      receipt_type, receipt_number, source_device_id, idempotency_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.trip_id,
      data.vehicle_id,
      data.supplier_id,
      data.fueled_at,
      data.location,
      data.odometer_km,
      data.quantity,
      data.volume_unit,
      data.unit_price,
      data.total_amount,
      data.currency,
      data.payment_method,
      data.receipt_type,
      data.receipt_number,
      data.source_device_id,
      data.idempotency_key,
      data.created_at,
      data.updated_at,
    ],
    "fuel_entry",
    id,
    input.attachment,
    createdAt,
  );

  return id;
}

export async function recordExpenseOffline(
  database: CommonPowerSyncDatabase,
  input: ExpenseInput,
  context: OfflineWriteContext,
): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = timestamp(context);
  const data = {
    assignment_type: "trip",
    trip_id: input.tripId,
    vehicle_id: input.vehicleId ?? null,
    category_id: input.categoryId,
    supplier_id: input.supplierId ?? null,
    incurred_at: input.incurredAt,
    amount: input.amount,
    currency: input.currency ?? "PEN",
    receipt_type: input.receiptType ?? null,
    receipt_number: input.receiptNumber ?? null,
    description: input.description ?? null,
    source: "driver_mobile",
    source_device_id: context.sourceDeviceId,
    idempotency_key: id,
    created_at: createdAt,
    updated_at: createdAt,
  };
  validateBeforeInsert("expenses", id, data);
  await writeEntryWithAttachment(
    database,
    `INSERT INTO expenses (
      id, assignment_type, trip_id, vehicle_id, category_id, supplier_id,
      incurred_at, amount, currency, receipt_type, receipt_number, description,
      source, source_device_id, idempotency_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.assignment_type,
      data.trip_id,
      data.vehicle_id,
      data.category_id,
      data.supplier_id,
      data.incurred_at,
      data.amount,
      data.currency,
      data.receipt_type,
      data.receipt_number,
      data.description,
      data.source,
      data.source_device_id,
      data.idempotency_key,
      data.created_at,
      data.updated_at,
    ],
    "expense",
    id,
    input.attachment,
    createdAt,
  );

  return id;
}

export async function reportIncidentOffline(
  database: CommonPowerSyncDatabase,
  input: IncidentInput,
  context: OfflineWriteContext,
): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = timestamp(context);
  const data = {
    trip_id: input.tripId,
    vehicle_id: input.vehicleId,
    occurred_at: input.occurredAt,
    location: input.location ?? null,
    incident_type: input.incidentType,
    severity: input.severity,
    description: input.description,
    action_taken: input.actionTaken ?? null,
    source_device_id: context.sourceDeviceId,
    idempotency_key: id,
    created_at: createdAt,
    updated_at: createdAt,
  };
  validateBeforeInsert("incidents", id, data);
  await writeEntryWithAttachment(
    database,
    `INSERT INTO incidents (
      id, trip_id, vehicle_id, occurred_at, location, incident_type, severity,
      description, action_taken, source_device_id, idempotency_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.trip_id,
      data.vehicle_id,
      data.occurred_at,
      data.location,
      data.incident_type,
      data.severity,
      data.description,
      data.action_taken,
      data.source_device_id,
      data.idempotency_key,
      data.created_at,
      data.updated_at,
    ],
    "incident",
    id,
    input.attachment,
    createdAt,
  );

  return id;
}

export async function enqueueTripTransition(
  database: CommonPowerSyncDatabase,
  input: TripTransitionInput,
  context: OfflineWriteContext,
): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = timestamp(context);
  const data = {
    trip_id: input.tripId,
    requested_action: input.action,
    odometer_km: input.odometerKm ?? null,
    cargo_delivered: input.cargoDelivered === true ? 1 : 0,
    occurred_at: createdAt,
    source_device_id: context.sourceDeviceId,
    created_at: createdAt,
  };
  mapProductUpload({ id, op: UpdateType.PUT, opData: data, table: "trip_transition_requests" });
  await executeCheckedInsert(
    database,
    `INSERT INTO trip_transition_requests (
      id, trip_id, requested_action, odometer_km, cargo_delivered,
      occurred_at, source_device_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.trip_id,
      data.requested_action,
      data.odometer_km,
      data.cargo_delivered,
      data.occurred_at,
      data.source_device_id,
      data.created_at,
    ],
  );
  return id;
}

function loadStateData(
  id: string,
  input: TripLoadStateInput,
  context: OfflineWriteContext,
  createdAt: string,
): Record<string, string | number | null> {
  return {
    trip_id: input.tripId,
    vehicle_id: input.vehicleId,
    load_state: input.loadState,
    effective_at: input.effectiveAt ?? createdAt,
    odometer_km: input.odometerKm,
    source_device_id: context.sourceDeviceId,
    idempotency_key: id,
    supersedes_event_id: null,
    correction_reason: null,
    created_at: createdAt,
  };
}

async function insertLoadStateEvent(
  database: SqlExecutor,
  id: string,
  data: Record<string, string | number | null>,
): Promise<void> {
  await executeCheckedInsert(
    database,
    `INSERT INTO trip_load_state_events (
      id, trip_id, vehicle_id, load_state, effective_at, odometer_km,
      source_device_id, idempotency_key, supersedes_event_id, correction_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.trip_id,
      data.vehicle_id,
      data.load_state,
      data.effective_at,
      data.odometer_km,
      data.source_device_id,
      data.idempotency_key,
      data.supersedes_event_id,
      data.correction_reason,
      data.created_at,
    ],
  );
}

export async function recordTripLoadStateOffline(
  database: CommonPowerSyncDatabase,
  input: TripLoadStateInput,
  context: OfflineWriteContext,
): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = timestamp(context);
  const data = loadStateData(id, input, context, createdAt);
  validateBeforeInsert("trip_load_state_events", id, data);
  await insertLoadStateEvent(database, id, data);
  return id;
}

export async function enqueueTripStartWithLoadState(
  database: CommonPowerSyncDatabase,
  input: TripTransitionInput & Pick<TripLoadStateInput, "vehicleId" | "loadState">,
  context: OfflineWriteContext,
): Promise<{ readonly transitionId: string; readonly loadStateEventId: string }> {
  if (input.action !== "start" || input.odometerKm === null || input.odometerKm === undefined) {
    throw new Error("El inicio de viaje requiere kilometraje y condición de carga.");
  }
  const transitionId = crypto.randomUUID();
  const loadStateEventId = crypto.randomUUID();
  const createdAt = timestamp(context);
  const transitionData = {
    trip_id: input.tripId,
    requested_action: "start",
    odometer_km: input.odometerKm,
    cargo_delivered: 0,
    occurred_at: createdAt,
    source_device_id: context.sourceDeviceId,
    created_at: createdAt,
  };
  const stateData = loadStateData(
    loadStateEventId,
    {
      tripId: input.tripId,
      vehicleId: input.vehicleId,
      loadState: input.loadState,
      odometerKm: input.odometerKm,
      effectiveAt: createdAt,
    },
    context,
    createdAt,
  );
  mapProductUpload({
    id: transitionId,
    op: UpdateType.PUT,
    opData: transitionData,
    table: "trip_transition_requests",
  });
  validateBeforeInsert("trip_load_state_events", loadStateEventId, stateData);
  await database.writeTransaction(async (transaction) => {
    await executeCheckedInsert(
      transaction,
      `INSERT INTO trip_transition_requests (
        id, trip_id, requested_action, odometer_km, cargo_delivered,
        occurred_at, source_device_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transitionId,
        input.tripId,
        "start",
        input.odometerKm,
        0,
        createdAt,
        context.sourceDeviceId,
        createdAt,
      ],
    );
    await insertLoadStateEvent(transaction, loadStateEventId, stateData);
  });
  return { transitionId, loadStateEventId };
}
