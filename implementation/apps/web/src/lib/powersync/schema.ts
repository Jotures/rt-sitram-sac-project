import { column, Schema, Table } from "@powersync/web";

const companies = new Table({
  legal_name: column.text,
  trade_name: column.text,
  active: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

const profiles = new Table({
  company_id: column.text,
  display_name: column.text,
  role: column.text,
  active: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

const drivers = new Table(
  {
    company_id: column.text,
    profile_id: column.text,
    display_name: column.text,
    document_type: column.text,
    document_number: column.text,
    phone: column.text,
    license_number: column.text,
    license_expires_on: column.text,
    contract_type: column.text,
    contract_started_on: column.text,
    contract_ended_on: column.text,
    usual_vehicle_id: column.text,
    current_status: column.text,
    active: column.integer,
    notes: column.text,
    updated_at: column.text,
  },
  { indexes: { profile: ["profile_id"], company: ["company_id"] } },
);

const vehicles = new Table(
  {
    company_id: column.text,
    plate: column.text,
    make: column.text,
    model: column.text,
    model_year: column.integer,
    capacity_tons: column.real,
    ownership_type: column.text,
    owner_name: column.text,
    current_status: column.text,
    current_odometer_km: column.real,
    active: column.integer,
    notes: column.text,
    updated_at: column.text,
  },
  { indexes: { company: ["company_id"], plate: ["plate"] } },
);

const clients = new Table(
  {
    company_id: column.text,
    legal_name: column.text,
    trade_name: column.text,
    tax_id: column.text,
    relationship_type: column.text,
    phone: column.text,
    address: column.text,
    payment_terms_days: column.integer,
    active: column.integer,
    notes: column.text,
    updated_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

const expenseCategories = new Table(
  {
    company_id: column.text,
    code: column.text,
    name: column.text,
    active: column.integer,
    updated_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

const suppliers = new Table(
  {
    company_id: column.text,
    legal_name: column.text,
    trade_name: column.text,
    supplier_type: column.text,
    active: column.integer,
    updated_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

const trips = new Table(
  {
    company_id: column.text,
    is_test: column.integer,
    code: column.text,
    cycle_id: column.text,
    client_id: column.text,
    vehicle_id: column.text,
    driver_id: column.text,
    route_id: column.text,
    origin: column.text,
    pickup_location: column.text,
    destination: column.text,
    scheduled_at: column.text,
    started_at: column.text,
    operational_finished_at: column.text,
    capture_mode: column.text,
    capture_mode_changed_at: column.text,
    operational_status: column.text,
    administrative_status: column.text,
    financial_status: column.text,
    freight_amount: column.real,
    freight_pricing_mode: column.text,
    freight_rate_per_ton: column.real,
    additional_amount: column.real,
    currency: column.text,
    notes: column.text,
    version: column.integer,
    updated_at: column.text,
  },
  {
    indexes: {
      companyStatus: ["company_id", "operational_status"],
      driverStatus: ["driver_id", "operational_status"],
    },
  },
);

const operationalCycles = Table.createInsertOnly(
  {
    company_id: column.text,
    code: column.text,
    vehicle_id: column.text,
    primary_driver_id: column.text,
    status: column.text,
    return_status: column.text,
    started_at: column.text,
    ended_at: column.text,
    notes: column.text,
    capture_channel: column.text,
    scheduled_at: column.text,
    returned_at: column.text,
    version: column.integer,
    idempotency_key: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { companyStatus: ["company_id", "status"], driver: ["primary_driver_id"] } },
);

const advances = Table.createInsertOnly(
  {
    company_id: column.text,
    is_test: column.integer,
    status: column.text,
    cycle_id: column.text,
    trip_id: column.text,
    driver_id: column.text,
    delivered_at: column.text,
    amount: column.real,
    currency: column.text,
    delivery_method: column.text,
    concept: column.text,
    source_device_id: column.text,
    idempotency_key: column.text,
    created_at: column.text,
  },
  { indexes: { cycle: ["cycle_id", "delivered_at"], trip: ["trip_id", "delivered_at"] } },
);

const odometerEntries = Table.createInsertOnly(
  {
    trip_id: column.text,
    vehicle_id: column.text,
    reading_km: column.real,
    reading_at: column.text,
    reading_type: column.text,
    source_device_id: column.text,
    idempotency_key: column.text,
    created_at: column.text,
  },
  { indexes: { trip: ["trip_id", "reading_at"], vehicle: ["vehicle_id", "reading_at"] } },
);

const fuelEntries = Table.createInsertOnly(
  {
    company_id: column.text,
    validation_status: column.text,
    approved_amount: column.real,
    trip_id: column.text,
    cycle_id: column.text,
    vehicle_id: column.text,
    driver_id: column.text,
    supplier_id: column.text,
    fueled_at: column.text,
    location: column.text,
    odometer_km: column.real,
    quantity: column.real,
    volume_unit: column.text,
    unit_price: column.real,
    total_amount: column.real,
    currency: column.text,
    payment_source: column.text,
    payment_method: column.text,
    receipt_type: column.text,
    receipt_number: column.text,
    source_device_id: column.text,
    idempotency_key: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      trip: ["trip_id", "fueled_at"],
      cycle: ["cycle_id", "fueled_at"],
      vehicle: ["vehicle_id", "fueled_at"],
    },
  },
);

const expenses = Table.createInsertOnly(
  {
    company_id: column.text,
    validation_status: column.text,
    approved_amount: column.real,
    assignment_type: column.text,
    trip_id: column.text,
    cycle_id: column.text,
    vehicle_id: column.text,
    driver_id: column.text,
    category_id: column.text,
    supplier_id: column.text,
    incurred_at: column.text,
    amount: column.real,
    currency: column.text,
    receipt_type: column.text,
    receipt_number: column.text,
    description: column.text,
    source: column.text,
    source_device_id: column.text,
    idempotency_key: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { trip: ["trip_id", "incurred_at"], cycle: ["cycle_id", "incurred_at"] } },
);

const incidents = Table.createInsertOnly(
  {
    trip_id: column.text,
    vehicle_id: column.text,
    occurred_at: column.text,
    location: column.text,
    incident_type: column.text,
    severity: column.text,
    description: column.text,
    action_taken: column.text,
    source_device_id: column.text,
    idempotency_key: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { trip: ["trip_id", "occurred_at"], vehicle: ["vehicle_id", "occurred_at"] } },
);

const tripTransitionRequests = Table.createInsertOnly(
  {
    trip_id: column.text,
    requested_action: column.text,
    odometer_km: column.real,
    cargo_delivered: column.integer,
    occurred_at: column.text,
    source_device_id: column.text,
    created_at: column.text,
  },
  { indexes: { trip: ["trip_id", "created_at"] } },
);

const tripLoadStateEvents = Table.createInsertOnly(
  {
    trip_id: column.text,
    vehicle_id: column.text,
    load_state: column.text,
    effective_at: column.text,
    odometer_km: column.real,
    source_device_id: column.text,
    idempotency_key: column.text,
    supersedes_event_id: column.text,
    correction_reason: column.text,
    created_at: column.text,
  },
  { indexes: { trip: ["trip_id", "odometer_km"], vehicle: ["vehicle_id", "effective_at"] } },
);

const settlements = new Table(
  {
    company_id: column.text,
    trip_id: column.text,
    cycle_id: column.text,
    driver_id: column.text,
    started_at: column.text,
    submitted_at: column.text,
    approved_at: column.text,
    closed_at: column.text,
    total_advances: column.real,
    total_expenses: column.real,
    balance: column.real,
    status: column.text,
    notes: column.text,
    approved_by: column.text,
    version: column.integer,
    resolution_method: column.text,
    resolution_reference: column.text,
    resolution_note: column.text,
    resolution_direction: column.text,
    resolved_amount: column.real,
    resolved_by: column.text,
    resolved_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { companyStatus: ["company_id", "status"], trip: ["trip_id"], cycle: ["cycle_id"] } },
);

// Binary evidence is never stored in SQLite. This local-only table tracks a URI
// and upload metadata so the attachment worker can upload after its parent row.
const attachmentQueue = Table.createLocalOnly(
  {
    entity_type: column.text,
    entity_id: column.text,
    local_uri: column.text,
    original_name: column.text,
    mime_type: column.text,
    size_bytes: column.integer,
    content_hash: column.text,
    remote_file_id: column.text,
    storage_path: column.text,
    status: column.text,
    attempts: column.integer,
    last_error: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { status: ["status", "created_at"], entity: ["entity_type", "entity_id"] } },
);

const attachmentRecoveryEvents = Table.createLocalOnly(
  {
    attachment_queue_id: column.text,
    action: column.text,
    previous_attempts: column.integer,
    previous_error: column.text,
    reason: column.text,
    created_at: column.text,
  },
  { indexes: { attachment: ["attachment_queue_id", "created_at"] } },
);

// Terminal upload failures are removed from PowerSync's global CRUD queue only
// after their complete payload has been copied here. The user must explicitly
// retry or discard each record, leaving a local audit trail either way.
const uploadDeadLetters = Table.createLocalOnly(
  {
    source_table: column.text,
    source_record_id: column.text,
    operation: column.text,
    op_data_json: column.text,
    error_code: column.text,
    error_message: column.text,
    status: column.text,
    attempts: column.integer,
    first_failed_at: column.text,
    last_failed_at: column.text,
    resolved_at: column.text,
    resolution: column.text,
    resolution_note: column.text,
    retry_record_id: column.text,
  },
  {
    indexes: {
      status: ["status", "last_failed_at"],
      source: ["source_table", "source_record_id"],
    },
  },
);

const operationCommands = Table.createInsertOnly(
  {
    company_id: column.text,
    actor_id: column.text,
    kind: column.text,
    payload: column.text,
    contract_version: column.integer,
    dependency_id: column.text,
    source_device_id: column.text,
    status: column.text,
    result_id: column.text,
    created_at: column.text,
    confirmed_at: column.text,
  },
  { indexes: { company: ["company_id", "created_at"], dependency: ["dependency_id"] } },
);

// Insert-only writes enter the upload queue without becoming readable rows.
// Keep the immutable local envelope until its authoritative confirmation arrives.
const operationCommandJournal = Table.createLocalOnly({
  company_id: column.text,
  actor_id: column.text,
  kind: column.text,
  payload: column.text,
  contract_version: column.integer,
  dependency_id: column.text,
  source_device_id: column.text,
  status: column.text,
  created_at: column.text,
});

const cycleRenditionSummaries = new Table({
  company_id: column.text,
  cycle_id: column.text,
  lines: column.text,
  baseline: column.text,
  status: column.text,
  version: column.integer,
  updated_by: column.text,
  updated_at: column.text,
});
const cycleBalancePayments = new Table({
  company_id: column.text,
  settlement_id: column.text,
  direction: column.text,
  amount: column.real,
  method: column.text,
  reference: column.text,
  occurred_at: column.text,
  actor_id: column.text,
  cancelled_at: column.text,
  cancellation_reason: column.text,
  created_at: column.text,
});
const settlementEvidence = new Table({
  company_id: column.text,
  settlement_id: column.text,
  file_id: column.text,
  evidence_kind: column.text,
  caption: column.text,
  captured_at: column.text,
  uploaded_by: column.text,
  created_at: column.text,
});

export const powerSyncSchema = new Schema({
  cycle_rendition_summaries: cycleRenditionSummaries,
  cycle_balance_payments: cycleBalancePayments,
  settlement_evidence: settlementEvidence,
  operation_commands: operationCommands,
  operation_command_journal: operationCommandJournal,
  companies,
  profiles,
  drivers,
  vehicles,
  clients,
  expense_categories: expenseCategories,
  suppliers,
  trips,
  operational_cycles: operationalCycles,
  advances,
  odometer_entries: odometerEntries,
  fuel_entries: fuelEntries,
  expenses,
  incidents,
  trip_transition_requests: tripTransitionRequests,
  trip_load_state_events: tripLoadStateEvents,
  settlements,
  attachment_queue: attachmentQueue,
  attachment_recovery_events: attachmentRecoveryEvents,
  upload_dead_letters: uploadDeadLetters,
});

export const POWER_SYNC_REMOTE_TABLES = [
  "cycle_rendition_summaries",
  "cycle_balance_payments",
  "settlement_evidence",
  "operation_commands",
  "companies",
  "profiles",
  "drivers",
  "vehicles",
  "clients",
  "expense_categories",
  "suppliers",
  "trips",
  "operational_cycles",
  "advances",
  "odometer_entries",
  "fuel_entries",
  "expenses",
  "incidents",
  "trip_transition_requests",
  "trip_load_state_events",
  "settlements",
] as const;

export const POWER_SYNC_WRITABLE_TABLES = [
  "operation_commands",
  "operational_cycles",
  "advances",
  "odometer_entries",
  "fuel_entries",
  "expenses",
  "incidents",
  "trip_transition_requests",
  "trip_load_state_events",
] as const;

export type PowerSyncSchema = (typeof powerSyncSchema)["types"];
export type LocalCompany = PowerSyncSchema["companies"];
export type LocalProfile = PowerSyncSchema["profiles"];
export type LocalDriver = PowerSyncSchema["drivers"];
export type LocalTrip = PowerSyncSchema["trips"];
