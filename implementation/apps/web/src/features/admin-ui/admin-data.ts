import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommonPowerSyncDatabase } from "@powersync/web";
import { calculateTripDirectFinancials } from "@rt-sitram/domain";
import type { Database } from "../../lib/supabase";

export type AdminTable =
  | "profiles"
  | "clients"
  | "suppliers"
  | "expense_categories"
  | "vehicles"
  | "drivers"
  | "trips"
  | "operational_cycles"
  | "expenses"
  | "advances"
  | "settlements"
  | "maintenance_plans"
  | "work_orders"
  | "parts"
  | "work_order_parts"
  | "work_order_evidence"
  | "documents"
  | "invoices"
  | "payments"
  | "alerts"
  | "files"
  | "loads"
  | "odometer_entries"
  | "fuel_entries"
  | "incidents"
  | "trip_status_events";

const privateDocumentBucket = "private-documents";
const maximumPrivateDocumentBytes = 50 * 1024 * 1024;
const privateDocumentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const allowedPrivateDocumentMimeTypes = new Set<string>(privateDocumentMimeTypes);

export type PrivateDocumentMimeType = (typeof privateDocumentMimeTypes)[number];

export interface AdminPrivateFile {
  readonly originalName: string;
  readonly mimeType: PrivateDocumentMimeType;
  readonly sizeBytes: number;
  readonly blob: Blob;
}

export interface AdminListRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly amount: number | null;
  readonly date: string | null;
  /** A short folio/UUID kept for support and audit, never the primary title. */
  readonly technicalReference?: string | undefined;
  /** Used only by audited commands to reject a stale edit. */
  readonly updatedAt?: string | undefined;
  readonly version?: number;
  /** Opaque file reference; the UI never receives a Storage path. */
  readonly fileId?: string | undefined;
}

export interface AdminVehicleRow extends AdminListRow {
  readonly make: string | null;
  readonly model: string | null;
  readonly modelYear: number | null;
  readonly capacityTons: number | null;
  readonly currentOdometerKm: number | null;
  readonly ownershipType: string | null;
  readonly ownerName: string | null;
  readonly notes: string | null;
  readonly active: boolean;
}

export interface AdminTripRow extends AdminListRow {
  readonly version: number;
  readonly code: string;
  readonly clientId: string;
  readonly vehicleId: string | null;
  readonly driverId: string | null;
  readonly clientName: string | null;
  readonly vehiclePlate: string | null;
  readonly driverName: string | null;
  readonly origin: string;
  readonly destination: string;
  readonly operationalStatus: string;
  readonly freightAmount: number;
  readonly freightPricingMode: "total" | "per_ton";
  readonly freightRatePerTon: number | null;
}

export type OperationalCycleStatus = "planned" | "active" | "completed" | "cancelled";
export type OperationalCycleReturnStatus =
  | "unidentified"
  | "probable"
  | "confirmed"
  | "completed"
  | "empty_return";
export type OperationalCycleLegKind = "outbound" | "return" | "continuation";

export interface AdminOperationalCycleRow extends AdminListRow {
  readonly status: OperationalCycleStatus;
  readonly vehicleId: string | null;
  readonly primaryDriverId: string | null;
  readonly returnStatus: OperationalCycleReturnStatus;
  readonly notes: string | null;
  readonly version: number;
}

export interface AdminOperationalCycleTrip extends AdminListRow {
  readonly legKind: OperationalCycleLegKind | null;
  readonly sequence: number | null;
}

export interface AdminOperationalCycleDetail {
  readonly cycle: AdminOperationalCycleRow;
  readonly vehicleLabel: string;
  readonly primaryDriverLabel: string | null;
  readonly trips: readonly AdminOperationalCycleTrip[];
  readonly eligibleTrips: readonly AdminOption[];
}

export interface AdminOperationalCycleOptions {
  readonly vehicles: readonly AdminOption[];
  readonly drivers: readonly AdminOption[];
}

export type AdminWorkOrderStatus =
  | "scheduled"
  | "waiting_workshop"
  | "in_workshop"
  | "in_progress"
  | "waiting_part"
  | "finished"
  | "cancelled";

export interface AdminMaintenanceRow extends AdminListRow {
  readonly recordType: "plan" | "work_order";
  readonly vehicleId: string;
  readonly blocksOperation: boolean;
}

export interface AdminMaintenanceOptions {
  readonly vehicles: readonly AdminOption[];
  readonly suppliers: readonly AdminOption[];
  readonly parts: readonly AdminOption[];
}

export interface AdminMaintenancePartRow extends AdminListRow {
  readonly partId: string;
  readonly supplierId: string | null;
  readonly quantity: number;
  readonly unitCost: number;
  readonly installedAt: string | null;
  readonly installationOdometerKm: number | null;
  readonly notes: string | null;
}

export interface AdminMaintenanceEvidenceRow extends AdminListRow {
  readonly fileId: string;
  readonly notes: string | null;
}

export interface AdminMaintenanceDetail {
  readonly id: string;
  readonly code: string;
  readonly vehicleId: string;
  readonly vehicleLabel: string;
  readonly supplierId: string | null;
  readonly supplierLabel: string | null;
  readonly maintenanceType: string;
  readonly reportedProblem: string | null;
  readonly diagnosis: string | null;
  readonly workPerformed: string | null;
  readonly status: AdminWorkOrderStatus;
  readonly admittedAt: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly odometerKm: number | null;
  readonly laborCost: number;
  readonly partsCost: number;
  readonly notes: string | null;
  readonly blocksOperation: boolean;
  readonly createdAt: string;
  readonly parts: readonly AdminMaintenancePartRow[];
  readonly evidence: readonly AdminMaintenanceEvidenceRow[];
}

export interface AdminDriverRow extends AdminListRow {
  readonly profileId: string | null;
  readonly documentNumber: string | null;
  readonly phone: string | null;
  readonly active: boolean;
}

export interface AdminDocumentRow extends AdminListRow {
  readonly hasFile: boolean;
  readonly blocksOperation: boolean;
  readonly vehicleId: string | null;
  readonly entityType: "company" | "vehicle" | "driver" | "trip" | "client";
  readonly entityId: string | null;
  readonly entityLabel: string;
}

export interface AdminSupplierRow extends AdminListRow {
  readonly supplierType: "grifo" | "taller" | "repuestos" | "otro";
  readonly active: boolean;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly taxId: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly notes: string | null;
}

export interface AdminClientDetail {
  readonly client: AdminListRow;
  readonly legalName: string;
  readonly taxId: string | null;
  readonly tradeName: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly paymentTermsDays: number;
  readonly relationshipType: string | null;
  readonly notes: string | null;
  readonly active: boolean;
  readonly trips: readonly AdminTripRow[];
  readonly invoices: readonly AdminListRow[];
  readonly documents: readonly AdminDocumentRow[];
}

export interface AdminDriverDetail {
  readonly driver: AdminDriverRow;
  readonly documentType: string | null;
  readonly licenseNumber: string | null;
  readonly licenseExpiresOn: string | null;
  readonly contractType: string | null;
  readonly contractStartedOn: string | null;
  readonly contractEndedOn: string | null;
  readonly usualVehicleId: string | null;
  readonly usualVehiclePlate: string | null;
  readonly notes: string | null;
  readonly activeTrip: AdminTripRow | null;
  readonly recentTrips: readonly AdminTripRow[];
  readonly documents: readonly AdminDocumentRow[];
  readonly settlements: readonly AdminListRow[];
  readonly incidents: readonly AdminListRow[];
}

export interface AdminSettlementDetail {
  readonly settlement: AdminListRow;
  readonly trip: AdminTripRow | null;
  readonly driverName: string | null;
  readonly advances: readonly AdminTripDetailLine[];
  readonly expenses: readonly AdminTripDetailLine[];
  readonly balance: number;
  readonly totalAdvances: number;
  readonly totalExpenses: number;
  readonly resolutionDirection: string | null;
  readonly resolutionMethod: string | null;
  readonly resolutionReference: string | null;
  readonly resolutionNote: string | null;
  readonly resolvedAt: string | null;
  readonly canClose: boolean;
  readonly blockingExpenses: readonly AdminTripDetailLine[];
}

export interface AdminAlertRow extends AdminListRow {
  readonly entityType: string;
  readonly entityId: string;
}

export interface AdminVehicleOdometerEntry extends AdminListRow {
  readonly readingKm: number;
  readonly readingType: string;
  readonly source: string | null;
}

export type AdminVehicleDetailSection = "maintenance" | "documents" | "alerts" | "gps";

export interface AdminVehicleDetail {
  readonly source: "remote" | "local";
  readonly unavailableSections: readonly AdminVehicleDetailSection[];
  readonly vehicle: AdminVehicleRow;
  readonly activeTrip: (AdminTripRow & { readonly driverName: string | null }) | null;
  readonly recentTrips: readonly AdminTripRow[];
  readonly odometerEntries: readonly AdminVehicleOdometerEntry[];
  readonly maintenance: readonly AdminMaintenanceRow[];
  readonly documents: readonly AdminDocumentRow[];
  readonly alerts: readonly AdminAlertRow[];
}

export interface AdminTripDetailLine extends AdminListRow {
  readonly hasFile?: boolean;
}

export interface AdminTripSettlementSummary {
  readonly id: string;
  readonly status: string;
  readonly totalAdvances: number;
  readonly totalExpenses: number;
  readonly balance: number;
  readonly resolutionDirection: string | null;
  readonly resolutionMethod: string | null;
  readonly resolutionReference: string | null;
  readonly resolutionNote: string | null;
  readonly resolvedAmount: number | null;
  readonly resolvedAt: string | null;
}

export interface AdminTripDetail {
  readonly source: "remote" | "local";
  readonly unavailableSections: readonly AdminTripDetailSection[];
  readonly trip: {
    readonly id: string;
    readonly code: string;
    readonly origin: string;
    readonly destination: string;
    readonly scheduledAt: string;
    readonly startedAt: string | null;
    readonly finishedAt: string | null;
    readonly operationalStatus: string;
    readonly administrativeStatus: string;
    readonly financialStatus: string;
    readonly freightAmount: number;
    readonly freightPricingMode: "total" | "per_ton";
    readonly freightRatePerTon: number | null;
    readonly additionalAmount: number;
    readonly currency: string;
    readonly notes: string | null;
    readonly version: number;
  };
  readonly clientName: string | null;
  readonly vehicleId: string | null;
  readonly vehiclePlate: string | null;
  readonly driverName: string | null;
  readonly loads: readonly AdminTripDetailLine[];
  readonly odometerEntries: readonly AdminTripDetailLine[];
  readonly initialOdometerKm: number | null;
  readonly finalOdometerKm: number | null;
  readonly distanceKm: number | null;
  readonly fuelEntries: readonly AdminTripDetailLine[];
  readonly advances: readonly AdminTripDetailLine[];
  readonly expenses: readonly AdminTripDetailLine[];
  readonly settlement: AdminTripSettlementSummary | null;
  readonly invoices: readonly AdminTripDetailLine[];
  readonly payments: readonly AdminTripDetailLine[];
  readonly documents: readonly AdminTripDetailLine[];
  readonly incidents: readonly AdminTripDetailLine[];
  readonly events: readonly AdminTripDetailLine[];
  readonly financials: {
    readonly serviceIncome: number;
    readonly validatedFuelCost: number;
    readonly approvedExpenseCost: number;
    readonly validatedDirectCost: number;
    readonly directMargin: number;
    readonly collectedAmount: number;
    readonly pendingCostRecords: number;
  };
}

export type AdminTripDetailSection =
  | "loads"
  | "advances"
  | "invoices"
  | "payments"
  | "documents"
  | "events"
  | "financials";

export interface AdminOption {
  readonly id: string;
  readonly label: string;
  readonly status: string;
}

export interface AdminTripSetupOptions {
  readonly clients: readonly AdminOption[];
  readonly vehicles: readonly AdminOption[];
  readonly drivers: readonly AdminOption[];
  readonly registeredDrivers: number;
  readonly driversAwaitingAccess: number;
}

/**
 * Inputs required to record a trip movement from Administración. These records
 * are always confirmed by the server; they are deliberately not an offline queue.
 */
export interface AdminStaffCaptureOptions {
  readonly trips: readonly AdminOption[];
  readonly expenseCategories: readonly AdminOption[];
  readonly suppliers: readonly AdminOption[];
}

export interface AdminCreatedTrip {
  readonly id: string;
  readonly code: string;
}

export interface AdminDashboardSnapshot {
  readonly source: "remote" | "local";
  readonly unavailableMetrics: readonly ("invoices" | "alerts")[];
  readonly vehicles: readonly AdminListRow[];
  readonly trips: readonly AdminTripRow[];
  readonly settlements: readonly AdminListRow[];
  readonly invoices: readonly AdminListRow[];
  readonly alerts: readonly AdminListRow[];
}

export interface AdminProfileRow extends AdminListRow {
  readonly role: "management" | "administration" | "driver" | "accounting";
}

export type ProfileAccessAction = "suspend" | "reactivate" | "change_role" | "unlink_driver";

export interface AdminWriteContext {
  readonly companyId: string;
  readonly profileId: string;
}

export interface AdminDataGateway {
  loadDashboard(): Promise<AdminDashboardSnapshot>;
  listClients(): Promise<readonly AdminListRow[]>;
  loadClientDetail(clientId: string): Promise<AdminClientDetail>;
  listVehicles(): Promise<readonly AdminVehicleRow[]>;
  loadVehicleDetail(vehicleId: string): Promise<AdminVehicleDetail>;
  listDrivers(): Promise<readonly AdminDriverRow[]>;
  loadDriverDetail(driverId: string): Promise<AdminDriverDetail>;
  listTrips(): Promise<readonly AdminTripRow[]>;
  listOperationalCycles(): Promise<readonly AdminOperationalCycleRow[]>;
  listExpenses(): Promise<readonly AdminListRow[]>;
  listFuelEntries(): Promise<readonly AdminListRow[]>;
  listAdvances(): Promise<readonly AdminListRow[]>;
  listSettlements(): Promise<readonly AdminListRow[]>;
  loadSettlementDetail(settlementId: string): Promise<AdminSettlementDetail>;
  listMaintenance(): Promise<readonly AdminMaintenanceRow[]>;
  loadMaintenanceDetail(workOrderId: string): Promise<AdminMaintenanceDetail | null>;
  listDocuments(): Promise<readonly AdminDocumentRow[]>;
  listSuppliers(): Promise<readonly AdminSupplierRow[]>;
  listInvoices(): Promise<readonly AdminListRow[]>;
  listAlerts(): Promise<readonly AdminListRow[]>;
  listProfiles(): Promise<readonly AdminProfileRow[]>;
  loadOptions(): Promise<{
    readonly clients: readonly AdminOption[];
    readonly vehicles: readonly AdminOption[];
    readonly drivers: readonly AdminOption[];
  }>;
  loadMaintenanceOptions(): Promise<AdminMaintenanceOptions>;
  loadTripSetupOptions(): Promise<AdminTripSetupOptions>;
  loadOperationalCycleOptions(): Promise<AdminOperationalCycleOptions>;
  loadStaffCaptureOptions(): Promise<AdminStaffCaptureOptions>;
  loadTripDetail(tripId: string): Promise<AdminTripDetail>;
  loadOperationalCycleDetail(cycleId: string): Promise<AdminOperationalCycleDetail>;
  loadPrivateFile(fileId: string): Promise<AdminPrivateFile>;
  createClient(
    context: AdminWriteContext,
    input: {
      readonly legalName: string;
      readonly taxId: string | null;
      readonly paymentTermsDays: number;
    },
  ): Promise<void>;
  createVehicle(
    context: AdminWriteContext,
    input: {
      readonly plate: string;
      readonly make: string | null;
      readonly model: string | null;
      readonly modelYear: number | null;
      readonly capacityTons: number | null;
      readonly ownershipType: "owned" | "leased" | "third_party" | null;
      readonly ownerName: string | null;
      readonly notes: string | null;
    },
  ): Promise<void>;
  createDriver(
    context: AdminWriteContext,
    input: {
      readonly displayName: string;
      readonly documentNumber: string | null;
      readonly phone: string | null;
    },
  ): Promise<void>;
  createTrip(
    context: AdminWriteContext,
    input: {
      readonly clientId: string;
      readonly origin: string;
      readonly destination: string;
      readonly scheduledAt: string;
      readonly freightAmount: number;
      readonly cargoDescription: string;
      readonly cargoTons: number;
      readonly freightPricingMode: "total" | "per_ton";
      readonly freightRatePerTon: number | null;
    },
  ): Promise<AdminCreatedTrip>;
  approveTrip(input: { readonly tripId: string }): Promise<void>;
  scheduleTrip(input: {
    readonly tripId: string;
    readonly vehicleId: string;
    readonly driverId: string;
  }): Promise<void>;
  transitionTripToUnloading(input: {
    readonly tripId: string;
    readonly version: number;
  }): Promise<void>;
  startTrip(input: { readonly tripId: string; readonly odometerKm: number }): Promise<void>;
  completeTrip(input: {
    readonly tripId: string;
    readonly odometerKm: number;
    readonly cargoDelivered: true;
  }): Promise<void>;
  createOperationalCycle(input: {
    readonly id: string;
    readonly code: string;
    readonly vehicleId: string;
    readonly primaryDriverId: string | null;
    readonly returnStatus: OperationalCycleReturnStatus;
    readonly notes: string | null;
    readonly idempotencyKey: string;
  }): Promise<void>;
  updateOperationalCycle(input: {
    readonly cycleId: string;
    readonly expectedVersion: number;
    readonly status: OperationalCycleStatus;
    readonly returnStatus: OperationalCycleReturnStatus;
    readonly notes: string | null;
  }): Promise<void>;
  addTripToOperationalCycle(input: {
    readonly cycleId: string;
    readonly tripId: string;
    readonly legKind: OperationalCycleLegKind;
    readonly expectedCycleVersion: number;
  }): Promise<void>;
  removeTripFromOperationalCycle(input: {
    readonly cycleId: string;
    readonly tripId: string;
    readonly expectedCycleVersion: number;
    readonly reason: string;
  }): Promise<void>;
  reviewExpense(input: {
    readonly expenseId: string;
    readonly validationStatus: "validated" | "observed" | "rejected";
    readonly approvedAmount: number | null;
    readonly note: string | null;
  }): Promise<void>;
  recordStaffExpense(
    context: AdminWriteContext,
    input: {
      readonly recordId: string;
      readonly tripId: string;
      readonly categoryId: string;
      readonly supplierId: string | null;
      readonly incurredAt: string;
      readonly amount: number;
      readonly currency: string;
      readonly receiptType: string | null;
      readonly receiptNumber: string | null;
      readonly description: string | null;
      /** Why an administrative user records this movement for the trip. */
      readonly reason: string;
      readonly idempotencyKey: string;
      readonly receiptFile: File | null;
    },
  ): Promise<void>;
  recordStaffFuelEntry(
    context: AdminWriteContext,
    input: {
      readonly recordId: string;
      readonly tripId: string;
      readonly supplierId: string | null;
      readonly fueledAt: string;
      readonly location: string | null;
      readonly odometerKm: number;
      readonly quantity: number;
      readonly volumeUnit: "gallon" | "liter";
      readonly unitPrice: number;
      readonly totalAmount: number;
      readonly currency: string;
      readonly paymentMethod: string | null;
      readonly receiptType: string | null;
      readonly receiptNumber: string | null;
      /** Why an administrative user records this movement for the trip. */
      readonly reason: string;
      readonly idempotencyKey: string;
      readonly receiptFile: File | null;
    },
  ): Promise<void>;
  createAdvance(
    context: AdminWriteContext,
    input: {
      readonly tripId: string;
      readonly driverId: string;
      readonly deliveredAt: string;
      readonly amount: number;
      readonly deliveryMethod: string;
      readonly concept: string;
      readonly idempotencyKey: string;
    },
  ): Promise<void>;
  closeSettlement(input: {
    readonly settlementId: string;
    readonly resolutionMethod: string;
    readonly resolutionReference: string;
    readonly resolutionNote: string | null;
  }): Promise<void>;
  reopenSettlement(input: {
    readonly settlementId: string;
    readonly reason: string;
  }): Promise<void>;
  createSupplier(input: {
    readonly legalName: string;
    readonly tradeName: string | null;
    readonly taxId: string | null;
    readonly supplierType: "grifo" | "taller" | "repuestos" | "otro";
    readonly phone: string | null;
    readonly address: string | null;
    readonly notes: string | null;
  }): Promise<AdminSupplierRow>;
  updateClientMaster(input: {
    readonly id: string;
    readonly expectedUpdatedAt: string;
    readonly legalName: string;
    readonly tradeName: string | null;
    readonly taxId: string | null;
    readonly phone: string | null;
    readonly address: string | null;
    readonly paymentTermsDays: number;
    readonly relationshipType: "direct" | "intermediary" | "third_party" | null;
    readonly active: boolean;
    readonly notes: string | null;
  }): Promise<void>;
  updateVehicleMaster(input: {
    readonly id: string;
    readonly expectedUpdatedAt: string;
    readonly plate: string;
    readonly make: string | null;
    readonly model: string | null;
    readonly modelYear: number | null;
    readonly capacityTons: number | null;
    readonly ownershipType: "owned" | "leased" | "third_party" | null;
    readonly ownerName: string | null;
    readonly active: boolean;
    readonly notes: string | null;
  }): Promise<void>;
  updateDriverMaster(input: {
    readonly id: string;
    readonly expectedUpdatedAt: string;
    readonly displayName: string;
    readonly documentType: string | null;
    readonly documentNumber: string | null;
    readonly phone: string | null;
    readonly licenseNumber: string | null;
    readonly licenseExpiresOn: string | null;
    readonly contractType: string | null;
    readonly contractStartedOn: string | null;
    readonly contractEndedOn: string | null;
    readonly usualVehicleId: string | null;
    readonly active: boolean;
    readonly notes: string | null;
  }): Promise<void>;
  setDriverAvailability(input: {
    readonly id: string;
    readonly expectedUpdatedAt: string;
    readonly status: "available" | "rest" | "vacation" | "leave" | "unavailable";
    readonly reason: string | null;
  }): Promise<void>;
  updateSupplierMaster(input: {
    readonly id: string;
    readonly expectedUpdatedAt: string;
    readonly legalName: string;
    readonly tradeName: string | null;
    readonly taxId: string | null;
    readonly supplierType: "grifo" | "taller" | "repuestos" | "otro";
    readonly phone: string | null;
    readonly address: string | null;
    readonly active: boolean;
    readonly notes: string | null;
  }): Promise<void>;
  createMaintenancePlan(
    context: AdminWriteContext,
    input: {
      readonly vehicleId: string;
      readonly name: string;
      readonly maintenanceType: string;
      readonly frequencyKm: number | null;
      readonly frequencyDays: number | null;
    },
  ): Promise<void>;
  createWorkOrder(input: {
    readonly id: string;
    readonly vehicleId: string;
    readonly supplierId: string | null;
    readonly reportedProblem: string;
    readonly maintenanceType: string;
    readonly admittedAt: string | null;
    readonly blocksOperation: boolean;
    readonly notes: string | null;
    readonly idempotencyKey: string;
  }): Promise<void>;
  updateWorkOrderProgress(input: {
    readonly workOrderId: string;
    readonly supplierId: string | null;
    readonly status: Exclude<AdminWorkOrderStatus, "finished">;
    readonly admittedAt: string | null;
    readonly startedAt: string | null;
    readonly diagnosis: string | null;
    readonly workPerformed: string | null;
    readonly notes: string | null;
    readonly blocksOperation: boolean;
  }): Promise<void>;
  createMaintenancePart(
    context: AdminWriteContext,
    input: {
      readonly name: string;
      readonly internalCode: string | null;
      readonly brand: string | null;
      readonly category: string | null;
      readonly unit: string;
    },
  ): Promise<void>;
  recordWorkOrderPart(input: {
    readonly id: string;
    readonly workOrderId: string;
    readonly partId: string;
    readonly supplierId: string | null;
    readonly quantity: number;
    readonly unitCost: number;
    readonly installedAt: string | null;
    readonly installationOdometerKm: number | null;
    readonly notes: string | null;
    readonly idempotencyKey: string;
  }): Promise<void>;
  attachWorkOrderEvidence(
    context: AdminWriteContext,
    input: {
      readonly id: string;
      readonly fileId: string;
      readonly workOrderId: string;
      readonly notes: string | null;
      readonly idempotencyKey: string;
      readonly file: File;
    },
  ): Promise<void>;
  completeWorkOrder(input: {
    readonly workOrderId: string;
    readonly finalMileage: number;
    readonly labourCost: number;
    readonly partsCost: number;
  }): Promise<void>;
  createDocument(
    context: AdminWriteContext,
    input: {
      readonly entityType: "company" | "vehicle" | "driver" | "trip" | "client";
      readonly entityId: string | null;
      readonly documentType: string;
      readonly documentNumber: string | null;
      readonly issuedOn: string | null;
      readonly expiresOn: string | null;
      readonly blocksOperation: boolean;
      readonly file: File | null;
    },
  ): Promise<void>;
  attachDocumentFile(
    context: AdminWriteContext,
    input: { readonly documentId: string; readonly expectedUpdatedAt: string; readonly file: File },
  ): Promise<void>;
  createInvoice(
    context: AdminWriteContext,
    input: {
      readonly clientId: string;
      readonly tripId: string;
      readonly series: string;
      readonly number: string;
      readonly issuedOn: string;
      readonly dueOn: string | null;
      readonly subtotal: number;
      readonly tax: number;
    },
  ): Promise<void>;
  registerPayment(
    context: AdminWriteContext,
    input: {
      readonly invoiceId: string;
      readonly paidAt: string;
      readonly amount: number;
      readonly paymentMethod: string;
      readonly reference: string;
      readonly paymentId: string;
      readonly idempotencyKey: string;
    },
  ): Promise<void>;
  resolveAlert(context: AdminWriteContext, alertId: string, note: string): Promise<void>;
  inviteCompanyUser(input: {
    readonly email: string;
    readonly displayName: string;
    readonly role: AdminProfileRow["role"];
  }): Promise<void>;
  linkDriverProfile(input: {
    readonly driverId: string;
    readonly profileId: string;
  }): Promise<void>;
  manageCompanyProfileAccess(input: {
    readonly profileId: string;
    readonly action: ProfileAccessAction;
    readonly nextRole?: AdminProfileRow["role"] | undefined;
    readonly reason: string;
  }): Promise<void>;
  resendCompanyInvitation(profileId: string): Promise<void>;
}

interface QueryError {
  readonly message: string;
}

interface QueryResult {
  readonly data: unknown;
  readonly error: QueryError | null;
}

export interface AdminOfflineReadContext {
  readonly database: Pick<CommonPowerSyncDatabase, "getAll">;
  readonly companyId: string;
  readonly isOffline?: (() => boolean) | undefined;
}

interface AwaitableQuery extends PromiseLike<QueryResult> {
  select(columns: string): AwaitableQuery;
  order(column: string, options?: { readonly ascending?: boolean }): AwaitableQuery;
  limit(count: number): AwaitableQuery;
  eq(column: string, value: string): AwaitableQuery;
  single(): PromiseLike<QueryResult>;
}

interface NarrowAdminClient {
  from(table: AdminTable): {
    select(columns: string): AwaitableQuery;
    insert(values: Readonly<Record<string, unknown>>): AwaitableQuery;
    update(values: Readonly<Record<string, unknown>>): AwaitableQuery;
  };
  rpc(functionName: string, args: Readonly<Record<string, unknown>>): PromiseLike<QueryResult>;
  functions: {
    invoke(
      functionName: string,
      options: { readonly body: Readonly<Record<string, unknown>> },
    ): PromiseLike<QueryResult>;
  };
}

const selectColumns: Readonly<Record<AdminTable, string>> = {
  profiles: "id, display_name, role, active, created_at",
  clients:
    "id, legal_name, trade_name, tax_id, relationship_type, phone, address, payment_terms_days, active, notes, created_at, updated_at",
  suppliers:
    "id, legal_name, trade_name, tax_id, supplier_type, phone, address, active, notes, created_at, updated_at",
  expense_categories: "id, code, name, active",
  vehicles:
    "id, plate, make, model, model_year, capacity_tons, ownership_type, owner_name, current_status, current_odometer_km, active, notes, created_at, updated_at",
  drivers:
    "id, profile_id, display_name, document_type, document_number, phone, license_number, license_expires_on, contract_type, contract_started_on, contract_ended_on, usual_vehicle_id, current_status, active, notes, created_at, updated_at",
  trips:
    "id, code, client_id, vehicle_id, driver_id, cycle_id, cycle_leg_kind, cycle_sequence, origin, destination, scheduled_at, started_at, operational_finished_at, operational_status, administrative_status, financial_status, freight_amount, freight_pricing_mode, freight_rate_per_ton, additional_amount, currency, notes, version, updated_at",
  operational_cycles:
    "id, code, vehicle_id, primary_driver_id, status, return_status, notes, version, started_at, ended_at, created_at",
  expenses:
    "id, trip_id, incurred_at, amount, currency, description, validation_status, approved_amount, receipt_type, receipt_number, receipt_file_id",
  advances:
    "id, trip_id, driver_id, delivered_at, amount, currency, concept, status, receipt_file_id",
  settlements:
    "id, trip_id, driver_id, started_at, total_advances, total_expenses, balance, status, version, resolution_direction, resolution_method, resolution_reference, resolution_note, resolved_amount, resolved_at, resolved_by, created_at, updated_at",
  maintenance_plans:
    "id, vehicle_id, name, maintenance_type, frequency_km, frequency_days, active, updated_at",
  work_orders:
    "id, code, vehicle_id, supplier_id, maintenance_type, reported_problem, diagnosis, work_performed, status, admitted_at, started_at, finished_at, odometer_km, labor_cost, parts_cost, blocks_operation, notes, created_at, updated_at",
  parts: "id, name, internal_code, brand, category, unit, active, created_at, updated_at",
  work_order_parts:
    "id, work_order_id, part_id, supplier_id, quantity, unit_cost, installed_at, installation_odometer_km, notes, idempotency_key",
  work_order_evidence: "id, work_order_id, file_id, notes, created_by, idempotency_key, created_at",
  documents:
    "id, document_type, document_number, entity_type, vehicle_id, driver_id, trip_id, client_id, issued_on, expires_on, status, file_id, blocks_operation, created_at, updated_at",
  invoices: "id, trip_id, client_id, series, number, issued_on, due_on, total, status",
  payments: "id, invoice_id, paid_at, amount, payment_method, reference, file_id, cancelled_at",
  alerts:
    "id, alert_type, priority, entity_type, entity_id, title, message, generated_at, due_at, status",
  files: "id, original_name, mime_type, size_bytes, storage_path, uploaded_by, created_at",
  loads: "id, trip_id, description, cargo_type, tons, package_count, notes, created_at",
  odometer_entries:
    "id, trip_id, vehicle_id, reading_km, reading_at, reading_type, source, created_at",
  fuel_entries:
    "id, trip_id, fueled_at, location, odometer_km, quantity, volume_unit, unit_price, total_amount, currency, receipt_type, receipt_number, receipt_file_id, validation_status",
  incidents:
    "id, trip_id, driver_id, occurred_at, location, incident_type, severity, description, action_taken, status, estimated_cost, file_id",
  trip_status_events:
    "id, trip_id, dimension, previous_status, new_status, occurred_at, reason, notes, actor_id",
};

export function createSupabaseAdminDataGateway(
  client: SupabaseClient<Database>,
  offline?: AdminOfflineReadContext,
): AdminDataGateway {
  // Dynamic table projections are narrowed at this boundary and parsed field-by-field below;
  // generated Database types remain authoritative for the Supabase client itself.
  const dataClient = client as unknown as NarrowAdminClient;

  async function readRows(
    table: AdminTable,
    orderColumn: string,
  ): Promise<readonly Record<string, unknown>[]> {
    if (shouldPreferOffline(offline)) return readOfflineRows(offline, table);
    try {
      const result = await dataClient
        .from(table)
        .select(selectColumns[table])
        .order(orderColumn, { ascending: false })
        .limit(200);
      if (result.error !== null) throw new Error(result.error.message);
      if (!Array.isArray(result.data))
        throw new Error(`La consulta de ${table} no devolvió una lista válida.`);
      return result.data.filter(isRecord);
    } catch (error) {
      if (!canFallbackToOffline(offline, error)) throw error;
      return readOfflineRows(offline, table);
    }
  }

  async function readRowsWhere(
    table: AdminTable,
    field: string,
    value: string,
    orderColumn: string,
  ): Promise<readonly Record<string, unknown>[]> {
    if (shouldPreferOffline(offline)) return readOfflineRows(offline, table, field, value);
    try {
      const result = await dataClient
        .from(table)
        .select(selectColumns[table])
        .eq(field, value)
        .order(orderColumn, { ascending: false })
        .limit(200);
      if (result.error !== null) throw new Error(result.error.message);
      if (!Array.isArray(result.data))
        throw new Error(`La consulta de ${table} no devolvió una lista válida.`);
      return result.data.filter(isRecord);
    } catch (error) {
      if (!canFallbackToOffline(offline, error)) throw error;
      return readOfflineRows(offline, table, field, value);
    }
  }

  async function readFirstWhere(
    table: AdminTable,
    field: string,
    value: string,
    orderColumn = "id",
  ): Promise<Record<string, unknown> | null> {
    return (await readRowsWhere(table, field, value, orderColumn))[0] ?? null;
  }

  async function insertRow(
    table: AdminTable,
    values: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const result = await dataClient.from(table).insert(values).select("id").single();
    if (result.error !== null) throw new Error(result.error.message);
  }

  async function uploadPrivateDocumentFile(
    context: AdminWriteContext,
    file: File,
    stableFileId?: string,
  ): Promise<string> {
    validatePrivateDocumentFile(file);
    const fileId = stableFileId ?? crypto.randomUUID();
    if (stableFileId !== undefined) {
      const existing = await dataClient.from("files").select("id").eq("id", fileId).limit(1);
      if (existing.error !== null) throw new Error(existing.error.message);
      if (
        Array.isArray(existing.data) &&
        existing.data.some((row) => isRecord(row) && readText(row, "id") === fileId)
      )
        return fileId;
    }
    const storagePath = makePrivateDocumentStoragePath(context.companyId, fileId, file.name);
    const upload = await client.storage
      .from(privateDocumentBucket)
      .upload(storagePath, file, { contentType: file.type, upsert: stableFileId !== undefined });
    if (upload.error !== null) throw new Error(upload.error.message);
    await insertRow("files", {
      id: fileId,
      company_id: context.companyId,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
      uploaded_by: context.profileId,
    });
    return fileId;
  }

  async function rpc(
    functionName: string,
    args: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    const result = await dataClient.rpc(functionName, args);
    if (result.error !== null) throw new Error(result.error.message);
    return result.data;
  }

  async function listClients(): Promise<readonly AdminListRow[]> {
    return (await readRows("clients", "created_at")).map((row) => ({
      id: requiredId(row),
      title: readText(row, "trade_name") ?? readText(row, "legal_name") ?? "Cliente sin nombre",
      description: markOfflineDescription(
        [
          readText(row, "legal_name") === readText(row, "trade_name")
            ? null
            : readText(row, "legal_name"),
          readText(row, "tax_id"),
          readNumber(row, "payment_terms_days") === null
            ? null
            : `${readNumber(row, "payment_terms_days")} día(s) de pago`,
        ]
          .filter((value): value is string => value !== null)
          .join(" · ") || "Sin datos comerciales adicionales",
        row,
      ),
      status: readBoolean(row, "active") === false ? "Inactivo" : "Activo",
      amount: null,
      date: null,
      updatedAt: readText(row, "updated_at") ?? undefined,
    }));
  }

  async function listSuppliers(): Promise<readonly AdminSupplierRow[]> {
    return (await readRows("suppliers", "legal_name")).map(mapSupplierRow);
  }

  async function listVehicles(): Promise<readonly AdminVehicleRow[]> {
    return (await readRows("vehicles", "plate")).map(mapVehicleRow);
  }

  async function listDrivers(): Promise<readonly AdminDriverRow[]> {
    return (await readRows("drivers", "display_name")).map((row) => ({
      id: requiredId(row),
      title: readText(row, "display_name") ?? "Conductor sin nombre",
      description: markOfflineDescription(
        readText(row, "document_number") ?? readText(row, "phone") ?? "Sin documento registrado",
        row,
      ),
      status: labelStatus(readText(row, "current_status")),
      amount: null,
      date: null,
      profileId: readText(row, "profile_id"),
      documentNumber: readText(row, "document_number"),
      phone: readText(row, "phone"),
      active: readBoolean(row, "active") !== false,
      updatedAt: readText(row, "updated_at") ?? undefined,
    }));
  }

  async function listTrips(): Promise<readonly AdminTripRow[]> {
    const tripRows = await readRows("trips", "scheduled_at");
    if (tripRows.length === 0) return [];
    const [clientRows, vehicleRows, driverRows] = await Promise.all([
      readRows("clients", "created_at"),
      readRows("vehicles", "plate"),
      readRows("drivers", "display_name"),
    ]);
    return tripRows.map((row) =>
      mapTripRow(
        row,
        clientLabelsById(clientRows),
        labelsById(vehicleRows, "plate", "Unidad sin placa"),
        labelsById(driverRows, "display_name", "Conductor sin nombre"),
      ),
    );
  }

  async function listOperationalCycles(): Promise<readonly AdminOperationalCycleRow[]> {
    const [cycleRows, vehicleRows, driverRows] = await Promise.all([
      readRows("operational_cycles", "created_at"),
      readRows("vehicles", "plate"),
      readRows("drivers", "display_name"),
    ]);
    const vehicleLabels = labelsById(vehicleRows, "plate", "Unidad sin placa");
    const driverLabels = labelsById(driverRows, "display_name", "Conductor sin nombre");
    return cycleRows.map((row) => mapOperationalCycleRow(row, vehicleLabels, driverLabels));
  }

  async function loadOperationalCycleOptions(): Promise<AdminOperationalCycleOptions> {
    const [vehicleRows, driverRows] = await Promise.all([
      readRows("vehicles", "plate"),
      readRows("drivers", "display_name"),
    ]);
    return {
      vehicles: vehicleRows
        .filter((row) => readBoolean(row, "active") !== false)
        .map((row) => ({
          id: requiredId(row),
          label: readText(row, "plate") ?? "Unidad sin placa",
          status: labelStatus(readText(row, "current_status")),
        })),
      drivers: driverRows
        .filter((row) => readBoolean(row, "active") !== false)
        .map((row) => ({
          id: requiredId(row),
          label: readText(row, "display_name") ?? "Conductor sin nombre",
          status: labelStatus(readText(row, "current_status")),
        })),
    };
  }

  async function loadOperationalCycleDetail(cycleId: string): Promise<AdminOperationalCycleDetail> {
    const [cycleRow, vehicleRows, driverRows, tripRows] = await Promise.all([
      readFirstWhere("operational_cycles", "id", cycleId, "created_at"),
      readRows("vehicles", "plate"),
      readRows("drivers", "display_name"),
      readRows("trips", "scheduled_at"),
    ]);
    if (cycleRow === null)
      throw new Error("El ciclo operativo no existe o no está disponible para tu rol.");

    const vehicleLabels = labelsById(vehicleRows, "plate", "Unidad sin placa");
    const driverLabels = labelsById(driverRows, "display_name", "Conductor sin nombre");
    const cycle = mapOperationalCycleRow(cycleRow, vehicleLabels, driverLabels);
    const trips = tripRows
      .filter((row) => readText(row, "cycle_id") === cycle.id)
      .map(mapOperationalCycleTrip)
      .sort(
        (left, right) =>
          (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER),
      );
    const eligibleTrips =
      cycle.vehicleId === null
        ? []
        : tripRows
            .filter(
              (row) =>
                readText(row, "vehicle_id") === cycle.vehicleId &&
                readText(row, "cycle_id") === null,
            )
            .map((row) => ({
              id: requiredId(row),
              label: `${readText(row, "origin") ?? "Origen"} → ${readText(row, "destination") ?? "Destino"} · ${readText(row, "code") ?? "Viaje sin código"}`,
              status: labelStatus(readText(row, "operational_status")),
            }));

    return {
      cycle,
      vehicleLabel:
        cycle.vehicleId === null
          ? "Sin unidad asignada"
          : (vehicleLabels.get(cycle.vehicleId) ?? "Unidad sin referencia disponible"),
      primaryDriverLabel:
        cycle.primaryDriverId === null
          ? null
          : (driverLabels.get(cycle.primaryDriverId) ?? "Conductor sin nombre disponible"),
      trips,
      eligibleTrips,
    };
  }

  async function listExpenses(): Promise<readonly AdminListRow[]> {
    const [expenseRows, trips] = await Promise.all([
      readRows("expenses", "incurred_at"),
      listTrips(),
    ]);
    const tripsById = new Map(trips.map((trip) => [trip.id, trip] as const));
    return expenseRows.map((row) => {
      const trip = tripsById.get(readText(row, "trip_id") ?? "");
      return {
        id: requiredId(row),
        title: readText(row, "description") ?? "Gasto de viaje",
        description: markOfflineDescription(describeTripContext(trip), row),
        status: isOfflineRow(row)
          ? "Solo lectura local"
          : labelStatus(readText(row, "validation_status")),
        amount: readNumber(row, "approved_amount") ?? readNumber(row, "amount"),
        date: readText(row, "incurred_at"),
        fileId: readText(row, "receipt_file_id") ?? undefined,
      };
    });
  }

  async function listFuelEntries(): Promise<readonly AdminListRow[]> {
    const [fuelRows, trips] = await Promise.all([
      readRows("fuel_entries", "fueled_at"),
      listTrips(),
    ]);
    const tripsById = new Map(trips.map((trip) => [trip.id, trip] as const));
    return fuelRows.map((row) => {
      const tripId = readText(row, "trip_id");
      const trip = tripsById.get(tripId ?? "");
      const detail = describeFuel(row);
      return {
        id: requiredId(row),
        title:
          `${formatNumber(readNumber(row, "quantity"))} ${readText(row, "volume_unit") ?? ""}`.trim(),
        description: markOfflineDescription([describeTripContext(trip), detail].join(" · "), row),
        status: isOfflineRow(row)
          ? "Solo lectura local"
          : labelStatus(readText(row, "validation_status")),
        amount: readNumber(row, "total_amount"),
        date: readText(row, "fueled_at"),
        fileId: readText(row, "receipt_file_id") ?? undefined,
      };
    });
  }

  async function listAdvances(): Promise<readonly AdminListRow[]> {
    const [advanceRows, trips] = await Promise.all([
      readRows("advances", "delivered_at"),
      listTrips(),
    ]);
    const tripsById = new Map(trips.map((trip) => [trip.id, trip] as const));
    return advanceRows.map((row) => ({
      id: requiredId(row),
      title: readText(row, "concept") ?? "Adelanto de viaje",
      description: describeTripContext(tripsById.get(readText(row, "trip_id") ?? "")),
      status: labelStatus(readText(row, "status")),
      amount: readNumber(row, "amount"),
      date: readText(row, "delivered_at"),
      fileId: readText(row, "receipt_file_id") ?? undefined,
    }));
  }

  async function listSettlements(): Promise<readonly AdminListRow[]> {
    const settlementRows = await readRows("settlements", "started_at");
    if (settlementRows.length === 0) return [];
    const trips = await listTrips();
    const tripsById = new Map(trips.map((trip) => [trip.id, trip] as const));
    return settlementRows.map((row) => {
      const trip = tripsById.get(readText(row, "trip_id") ?? "");
      const balance = readNumber(row, "balance") ?? 0;
      const direction =
        balance > 0
          ? "El conductor devuelve"
          : balance < 0
            ? "La empresa regulariza"
            : "Saldo conciliado";
      const route = trip?.title ?? "Viaje sin ruta disponible";
      return {
        id: requiredId(row),
        title: route,
        description: [
          trip?.driverName === null || trip?.driverName === undefined
            ? null
            : `Conductor ${trip.driverName}`,
          trip?.vehiclePlate === null || trip?.vehiclePlate === undefined
            ? null
            : `Unidad ${trip.vehiclePlate}`,
          `${direction}: S/ ${formatNumber(Math.abs(balance))}`,
        ]
          .filter((value): value is string => value !== null)
          .join(" · "),
        status: labelStatus(readText(row, "status")),
        amount: balance,
        date: readText(row, "started_at"),
        technicalReference: trip?.code,
        updatedAt: readText(row, "updated_at") ?? undefined,
        version: readNumber(row, "version") ?? 1,
      };
    });
  }

  async function listMaintenance(): Promise<readonly AdminMaintenanceRow[]> {
    if (shouldPreferOffline(offline))
      throw new Error(
        "Esta vista requiere conexión porque sus datos no forman parte de la copia local.",
      );
    const [plans, orders, vehicleRows, supplierRows] = await Promise.all([
      readRows("maintenance_plans", "updated_at"),
      readRows("work_orders", "created_at"),
      readRows("vehicles", "plate"),
      readRows("suppliers", "legal_name"),
    ]);
    const vehicleLabels = labelsById(vehicleRows, "plate", "Unidad sin placa");
    const supplierLabels = labelsById(supplierRows, "legal_name", "Proveedor sin nombre");
    return [
      ...orders.map((row) => mapMaintenanceWorkOrderRow(row, vehicleLabels, supplierLabels)),
      ...plans.map((row) => ({
        id: requiredId(row),
        title: readText(row, "name") ?? "Plan de mantenimiento",
        description: `Unidad ${vehicleLabels.get(readText(row, "vehicle_id") ?? "") ?? "sin referencia disponible"}`,
        status: readBoolean(row, "active") === false ? "Inactivo" : "Activo",
        amount: null,
        date: readText(row, "updated_at"),
        recordType: "plan" as const,
        vehicleId: readText(row, "vehicle_id") ?? "",
        blocksOperation: false,
      })),
    ];
  }

  async function loadMaintenanceDetail(
    workOrderId: string,
  ): Promise<AdminMaintenanceDetail | null> {
    const [order, vehicleRows, supplierRows, partRows, partMasterRows, evidenceRows, fileRows] =
      await Promise.all([
        readFirstWhere("work_orders", "id", workOrderId, "created_at"),
        readRows("vehicles", "plate"),
        readRows("suppliers", "legal_name"),
        readRowsWhere("work_order_parts", "work_order_id", workOrderId, "installed_at"),
        readRows("parts", "name"),
        readRowsWhere("work_order_evidence", "work_order_id", workOrderId, "created_at"),
        readRows("files", "created_at"),
      ]);
    if (order === null) return null;
    const vehicleLabels = labelsById(vehicleRows, "plate", "Unidad sin placa");
    const supplierLabels = labelsById(supplierRows, "legal_name", "Proveedor sin nombre");
    const partLabels = labelsById(partMasterRows, "name", "Repuesto sin nombre");
    const partUnits = new Map(
      partMasterRows.map((row) => [requiredId(row), readText(row, "unit")] as const),
    );
    const fileLabels = labelsById(fileRows, "original_name", "Archivo privado");
    return {
      ...mapMaintenanceWorkOrderDetail(order, vehicleLabels, supplierLabels),
      parts: partRows.map((row) =>
        mapMaintenancePartRow(row, partLabels, supplierLabels, partUnits),
      ),
      evidence: evidenceRows.map((row) => mapMaintenanceEvidenceRow(row, fileLabels)),
    };
  }

  async function listDocuments(): Promise<readonly AdminDocumentRow[]> {
    if (shouldPreferOffline(offline))
      throw new Error(
        "Esta vista requiere conexión porque sus datos no forman parte de la copia local.",
      );
    const [documentRows, clientRows, vehicleRows, driverRows, tripRows] = await Promise.all([
      readRows("documents", "created_at"),
      readRows("clients", "created_at"),
      readRows("vehicles", "plate"),
      readRows("drivers", "display_name"),
      listTrips(),
    ]);
    const clientLabels = clientLabelsById(clientRows);
    const vehicleLabels = labelsById(vehicleRows, "plate", "Unidad sin placa");
    const driverLabels = labelsById(driverRows, "display_name", "Conductor sin nombre");
    const tripLabels = new Map(tripRows.map((trip) => [trip.id, trip.title] as const));
    return documentRows.map((row) => {
      const entity = documentEntityReference(
        row,
        clientLabels,
        vehicleLabels,
        driverLabels,
        tripLabels,
      );
      return {
        id: requiredId(row),
        title: readText(row, "document_type") ?? "Documento",
        description: [entity.label, readText(row, "document_number") ?? "Sin número registrado"]
          .filter(Boolean)
          .join(" · "),
        status: labelStatus(readText(row, "status")),
        amount: null,
        date: readText(row, "expires_on") ?? readText(row, "created_at"),
        technicalReference: readText(row, "document_number") ?? undefined,
        updatedAt: readText(row, "updated_at") ?? undefined,
        hasFile: readText(row, "file_id") !== null,
        blocksOperation: readBoolean(row, "blocks_operation") === true,
        vehicleId: readText(row, "vehicle_id"),
        entityType: entity.type,
        entityId: entity.id,
        entityLabel: entity.label,
        fileId: readText(row, "file_id") ?? undefined,
      };
    });
  }

  async function loadClientDetail(clientId: string): Promise<AdminClientDetail> {
    const [clientRow, clients, trips, invoiceRows, documents] = await Promise.all([
      readFirstWhere("clients", "id", clientId, "created_at"),
      listClients(),
      listTrips(),
      readRowsWhere("invoices", "client_id", clientId, "issued_on"),
      listDocuments(),
    ]);
    const client = clients.find((row) => row.id === clientId);
    if (clientRow === null || client === undefined)
      throw new Error("El cliente no existe o no está disponible para tu empresa.");
    return {
      client,
      legalName: readText(clientRow, "legal_name") ?? client.title,
      taxId: readText(clientRow, "tax_id"),
      tradeName: readText(clientRow, "trade_name"),
      phone: readText(clientRow, "phone"),
      address: readText(clientRow, "address"),
      paymentTermsDays: readNumber(clientRow, "payment_terms_days") ?? 0,
      relationshipType: readText(clientRow, "relationship_type"),
      notes: readText(clientRow, "notes"),
      active: readBoolean(clientRow, "active") !== false,
      trips: trips.filter((trip) => trip.clientId === clientId),
      invoices: invoiceRows.map((invoice) => {
        const trip = trips.find((candidate) => candidate.id === readText(invoice, "trip_id"));
        const reference = [readText(invoice, "series"), readText(invoice, "number")]
          .filter((value): value is string => value !== null)
          .join("-");
        return {
          id: requiredId(invoice),
          title: trip?.title ?? "Factura sin viaje visible",
          description: `Factura ${reference || "sin numeración registrada"}`,
          status: labelStatus(readText(invoice, "status")),
          amount: readNumber(invoice, "total"),
          date: readText(invoice, "due_on") ?? readText(invoice, "issued_on"),
          technicalReference: reference || undefined,
        };
      }),
      documents: documents.filter(
        (document) => document.entityType === "client" && document.entityId === clientId,
      ),
    };
  }

  async function loadDriverDetail(driverId: string): Promise<AdminDriverDetail> {
    const [driverRow, drivers, trips, documents, settlements, incidentRows, vehicleRows] =
      await Promise.all([
        readFirstWhere("drivers", "id", driverId, "display_name"),
        listDrivers(),
        listTrips(),
        listDocuments(),
        listSettlements(),
        readRowsWhere("incidents", "driver_id", driverId, "occurred_at"),
        readRows("vehicles", "plate"),
      ]);
    const driver = drivers.find((row) => row.id === driverId);
    if (driverRow === null || driver === undefined)
      throw new Error("El conductor no existe o no está disponible para tu empresa.");
    const incidents = incidentRows.map((row) => ({
      id: requiredId(row),
      title: readText(row, "incident_type") ?? "Incidencia",
      description:
        [readText(row, "description"), readText(row, "location")]
          .filter((value): value is string => value !== null)
          .join(" · ") || "Sin detalle registrado",
      status: labelStatus(readText(row, "status")),
      amount: readNumber(row, "estimated_cost"),
      date: readText(row, "occurred_at"),
      fileId: readText(row, "file_id") ?? undefined,
    }));
    const driverTrips = trips.filter((trip) => trip.driverId === driverId);
    const activeTrip =
      driverTrips.find((trip) =>
        ["scheduled", "loading", "in_transit", "unloading"].includes(trip.operationalStatus),
      ) ?? null;
    const usualVehicleId = readText(driverRow, "usual_vehicle_id");
    const usualVehicle =
      usualVehicleId === null
        ? undefined
        : vehicleRows.find((row) => requiredId(row) === usualVehicleId);
    const usualVehiclePlate = usualVehicle === undefined ? null : readText(usualVehicle, "plate");
    return {
      driver,
      documentType: readText(driverRow, "document_type"),
      licenseNumber: readText(driverRow, "license_number"),
      licenseExpiresOn: readText(driverRow, "license_expires_on"),
      contractType: readText(driverRow, "contract_type"),
      contractStartedOn: readText(driverRow, "contract_started_on"),
      contractEndedOn: readText(driverRow, "contract_ended_on"),
      usualVehicleId,
      usualVehiclePlate,
      notes: readText(driverRow, "notes"),
      activeTrip,
      recentTrips: driverTrips.slice(0, 8),
      documents: documents.filter(
        (document) => document.entityType === "driver" && document.entityId === driverId,
      ),
      settlements: settlements.filter((settlement) =>
        driverTrips.some((trip) => settlement.technicalReference?.includes(trip.code) === true),
      ),
      incidents,
    };
  }

  async function loadSettlementDetail(settlementId: string): Promise<AdminSettlementDetail> {
    const settlementRow = await readFirstWhere("settlements", "id", settlementId, "started_at");
    if (settlementRow === null)
      throw new Error("La rendición no existe o no está disponible para tu empresa.");
    const tripId = readText(settlementRow, "trip_id");
    const [settlements, trips, advanceRows, expenseRows, driverRows] = await Promise.all([
      listSettlements(),
      listTrips(),
      tripId === null
        ? Promise.resolve([])
        : readRowsWhere("advances", "trip_id", tripId, "delivered_at"),
      tripId === null
        ? Promise.resolve([])
        : readRowsWhere("expenses", "trip_id", tripId, "incurred_at"),
      readRows("drivers", "display_name"),
    ]);
    const settlement = settlements.find((row) => row.id === settlementId);
    if (settlement === undefined) throw new Error("La rendición no está disponible para tu rol.");
    const trip =
      tripId === null ? null : (trips.find((candidate) => candidate.id === tripId) ?? null);
    const advances = advanceRows.map((row) => ({
      id: requiredId(row),
      title: readText(row, "concept") ?? "Adelanto",
      description: `Entregado ${formatDate(readText(row, "delivered_at"))}`,
      status: labelStatus(readText(row, "status")),
      amount: readNumber(row, "amount"),
      date: readText(row, "delivered_at"),
      fileId: readText(row, "receipt_file_id") ?? undefined,
    }));
    const expenses = expenseRows.map((row) => ({
      id: requiredId(row),
      title: readText(row, "description") ?? "Gasto de viaje",
      description: `Revisión: ${labelStatus(readText(row, "validation_status"))}`,
      status: labelStatus(readText(row, "validation_status")),
      amount: readNumber(row, "approved_amount") ?? readNumber(row, "amount"),
      date: readText(row, "incurred_at"),
      fileId: readText(row, "receipt_file_id") ?? undefined,
    }));
    const blockingExpenses = expenses.filter((expense) =>
      ["pending review", "observed", "pending", "observado"].includes(
        expense.status.toLocaleLowerCase("es-PE"),
      ),
    );
    const driverId = readText(settlementRow, "driver_id");
    const driverRow =
      driverId === null ? undefined : driverRows.find((row) => requiredId(row) === driverId);
    const driverName = driverRow === undefined ? null : readText(driverRow, "display_name");
    const balance = readNumber(settlementRow, "balance") ?? 0;
    return {
      settlement,
      trip,
      driverName,
      advances,
      expenses,
      balance,
      totalAdvances: readNumber(settlementRow, "total_advances") ?? 0,
      totalExpenses: readNumber(settlementRow, "total_expenses") ?? 0,
      resolutionDirection: readText(settlementRow, "resolution_direction"),
      resolutionMethod: readText(settlementRow, "resolution_method"),
      resolutionReference: readText(settlementRow, "resolution_reference"),
      resolutionNote: readText(settlementRow, "resolution_note"),
      resolvedAt: readText(settlementRow, "resolved_at"),
      canClose:
        trip?.operationalStatus === "completed" &&
        readText(settlementRow, "status") !== "closed" &&
        blockingExpenses.length === 0,
      blockingExpenses,
    };
  }

  async function listInvoices(): Promise<readonly AdminListRow[]> {
    const [invoiceRows, trips] = await Promise.all([
      readRows("invoices", "issued_on"),
      listTrips(),
    ]);
    const tripsById = new Map(trips.map((trip) => [trip.id, trip] as const));
    return invoiceRows.map((row) => {
      const dueOn = readText(row, "due_on");
      return {
        id: requiredId(row),
        title: invoiceReference(row),
        description: [
          describeTripContext(tripsById.get(readText(row, "trip_id") ?? "")),
          dueOn === null ? null : `Vence ${formatDate(dueOn)}`,
        ]
          .filter((value): value is string => value !== null)
          .join(" · "),
        status: labelStatus(readText(row, "status")),
        amount: readNumber(row, "total"),
        date: dueOn ?? readText(row, "issued_on"),
      };
    });
  }

  async function listAlerts(): Promise<readonly AdminAlertRow[]> {
    return (await readRows("alerts", "generated_at")).map((row) => ({
      id: requiredId(row),
      title: readText(row, "title") ?? "Alerta",
      description: readText(row, "message") ?? "Sin detalle",
      status: `${labelStatus(readText(row, "priority"))} · ${labelStatus(readText(row, "status"))}`,
      amount: null,
      date: readText(row, "due_at") ?? readText(row, "generated_at"),
      entityType: readText(row, "entity_type") ?? "",
      entityId: readText(row, "entity_id") ?? "",
    }));
  }

  async function listProfiles(): Promise<readonly AdminProfileRow[]> {
    return (await readRows("profiles", "created_at")).map((row) => ({
      id: requiredId(row),
      title: readText(row, "display_name") ?? "Usuario sin nombre",
      description: markOfflineDescription("Perfil empresarial", row),
      status: readBoolean(row, "active") === false ? "Inactivo" : "Activo",
      amount: null,
      date: readText(row, "created_at"),
      role: readRole(row, "role"),
    }));
  }

  async function loadRemoteTripDetail(tripId: string): Promise<AdminTripDetail> {
    const tripRow = await readFirstWhere("trips", "id", tripId, "scheduled_at");
    if (tripRow === null) throw new Error("El viaje no existe o no está disponible para tu rol.");

    const clientId = readText(tripRow, "client_id");
    const vehicleId = readText(tripRow, "vehicle_id");
    const driverId = readText(tripRow, "driver_id");
    const [
      clientRow,
      vehicleRow,
      driverRow,
      loadRows,
      odometerRows,
      fuelRows,
      advanceRows,
      expenseRows,
      settlementRows,
      invoiceRows,
      documentRows,
      incidentRows,
      eventRows,
    ] = await Promise.all([
      clientId === null ? Promise.resolve(null) : readFirstWhere("clients", "id", clientId),
      vehicleId === null ? Promise.resolve(null) : readFirstWhere("vehicles", "id", vehicleId),
      driverId === null ? Promise.resolve(null) : readFirstWhere("drivers", "id", driverId),
      readRowsWhere("loads", "trip_id", tripId, "created_at"),
      readRowsWhere("odometer_entries", "trip_id", tripId, "reading_at"),
      readRowsWhere("fuel_entries", "trip_id", tripId, "fueled_at"),
      readRowsWhere("advances", "trip_id", tripId, "delivered_at"),
      readRowsWhere("expenses", "trip_id", tripId, "incurred_at"),
      readRowsWhere("settlements", "trip_id", tripId, "started_at"),
      readRowsWhere("invoices", "trip_id", tripId, "issued_on"),
      readRowsWhere("documents", "trip_id", tripId, "created_at"),
      readRowsWhere("incidents", "trip_id", tripId, "occurred_at"),
      readRowsWhere("trip_status_events", "trip_id", tripId, "occurred_at"),
    ]);
    const paymentRows = (
      await Promise.all(
        invoiceRows.map((invoice) =>
          readRowsWhere("payments", "invoice_id", requiredId(invoice), "paid_at"),
        ),
      )
    ).flat();

    const startReading = odometerRows.find((row) => readText(row, "reading_type") === "trip_start");
    const finishReading = odometerRows.find(
      (row) => readText(row, "reading_type") === "trip_finish",
    );
    const initialOdometerKm =
      startReading === undefined ? null : readNumber(startReading, "reading_km");
    const finalOdometerKm =
      finishReading === undefined ? null : readNumber(finishReading, "reading_km");
    const distanceKm =
      initialOdometerKm !== null && finalOdometerKm !== null && finalOdometerKm >= initialOdometerKm
        ? finalOdometerKm - initialOdometerKm
        : null;
    const validatedFuel = fuelRows
      .filter((row) => readText(row, "validation_status") === "validated")
      .map((row) => readNumber(row, "total_amount") ?? 0);
    const approvedExpenses = expenseRows
      .filter((row) => readText(row, "validation_status") === "validated")
      .map((row) => readNumber(row, "approved_amount") ?? readNumber(row, "amount") ?? 0);
    const freightAmount = readNumber(tripRow, "freight_amount") ?? 0;
    const additionalAmount = readNumber(tripRow, "additional_amount") ?? 0;
    const directFinancials = calculateTripDirectFinancials({
      freight: freightAmount,
      additionalIncome: [additionalAmount],
      fuelCosts: validatedFuel,
      approvedExpenses,
    });
    const activePaymentRows = paymentRows.filter((row) => readText(row, "cancelled_at") === null);

    return {
      source: "remote",
      unavailableSections: [],
      trip: {
        id: requiredId(tripRow),
        code: readText(tripRow, "code") ?? "Viaje sin código",
        origin: readText(tripRow, "origin") ?? "",
        destination: readText(tripRow, "destination") ?? "",
        scheduledAt: readText(tripRow, "scheduled_at") ?? "",
        startedAt: readText(tripRow, "started_at"),
        finishedAt: readText(tripRow, "operational_finished_at"),
        operationalStatus: readText(tripRow, "operational_status") ?? "draft",
        administrativeStatus: readText(tripRow, "administrative_status") ?? "not_required",
        financialStatus: readText(tripRow, "financial_status") ?? "unbilled",
        freightAmount,
        freightPricingMode: tripPricingMode(tripRow),
        freightRatePerTon:
          tripPricingMode(tripRow) === "per_ton"
            ? readNumber(tripRow, "freight_rate_per_ton")
            : null,
        additionalAmount,
        currency: readText(tripRow, "currency") ?? "PEN",
        notes: readText(tripRow, "notes"),
        version: readNumber(tripRow, "version") ?? 1,
      },
      clientName:
        clientRow === null
          ? null
          : (readText(clientRow, "trade_name") ?? readText(clientRow, "legal_name")),
      vehicleId,
      vehiclePlate: vehicleRow === null ? null : readText(vehicleRow, "plate"),
      driverName: driverRow === null ? null : readText(driverRow, "display_name"),
      loads: loadRows.map((row) => ({
        id: requiredId(row),
        title: readText(row, "description") ?? "Carga sin descripción",
        description: describeLoad(row),
        status: "Registrada",
        amount: null,
        date: readText(row, "created_at"),
      })),
      odometerEntries: odometerRows.map((row) => ({
        id: requiredId(row),
        title: `${formatNumber(readNumber(row, "reading_km"))} km`,
        description: `${labelStatus(readText(row, "reading_type"))} · ${labelStatus(readText(row, "source"))}`,
        status: "Registrado",
        amount: null,
        date: readText(row, "reading_at"),
      })),
      initialOdometerKm,
      finalOdometerKm,
      distanceKm,
      fuelEntries: fuelRows.map((row) => ({
        id: requiredId(row),
        title:
          `${formatNumber(readNumber(row, "quantity"))} ${readText(row, "volume_unit") ?? ""}`.trim(),
        description: describeFuel(row),
        status: labelStatus(readText(row, "validation_status")),
        amount: readNumber(row, "total_amount"),
        date: readText(row, "fueled_at"),
        hasFile: readText(row, "receipt_file_id") !== null,
        fileId: readText(row, "receipt_file_id") ?? undefined,
      })),
      advances: advanceRows.map((row) => ({
        id: requiredId(row),
        title: readText(row, "concept") ?? "Adelanto",
        description: `Conductor sin referencia disponible · ${readText(row, "currency") ?? "PEN"}`,
        status: labelStatus(readText(row, "status")),
        amount: readNumber(row, "amount"),
        date: readText(row, "delivered_at"),
        hasFile: readText(row, "receipt_file_id") !== null,
        fileId: readText(row, "receipt_file_id") ?? undefined,
      })),
      expenses: expenseRows.map((row) => ({
        id: requiredId(row),
        title: readText(row, "description") ?? "Gasto de viaje",
        description: describeReceipt(row),
        status: labelStatus(readText(row, "validation_status")),
        amount: readNumber(row, "approved_amount") ?? readNumber(row, "amount"),
        date: readText(row, "incurred_at"),
        hasFile: readText(row, "receipt_file_id") !== null,
        fileId: readText(row, "receipt_file_id") ?? undefined,
      })),
      settlement: mapSettlementSummary(settlementRows[0]),
      invoices: invoiceRows.map((row) => ({
        id: requiredId(row),
        title: `${readText(row, "series") ?? ""}-${readText(row, "number") ?? ""}`,
        description: `Vence ${readText(row, "due_on") ?? "sin fecha registrada"}`,
        status: labelStatus(readText(row, "status")),
        amount: readNumber(row, "total"),
        date: readText(row, "issued_on"),
      })),
      payments: paymentRows.map((row) => ({
        id: requiredId(row),
        title: readText(row, "payment_method") ?? "Pago",
        description: readText(row, "reference") ?? "Sin referencia",
        status: readText(row, "cancelled_at") === null ? "Aplicado" : "Anulado",
        amount: readNumber(row, "amount"),
        date: readText(row, "paid_at"),
        hasFile: readText(row, "file_id") !== null,
        fileId: readText(row, "file_id") ?? undefined,
      })),
      documents: documentRows.map((row) => ({
        id: requiredId(row),
        title: readText(row, "document_type") ?? "Documento",
        description: `${readText(row, "document_number") ?? "Sin número"}${readBoolean(row, "blocks_operation") === true ? " · bloqueante" : ""}`,
        status: labelStatus(readText(row, "status")),
        amount: null,
        date: readText(row, "expires_on") ?? readText(row, "created_at"),
        hasFile: readText(row, "file_id") !== null,
        fileId: readText(row, "file_id") ?? undefined,
      })),
      incidents: incidentRows.map((row) => ({
        id: requiredId(row),
        title: readText(row, "incident_type") ?? "Incidente",
        description: `${readText(row, "description") ?? "Sin detalle"}${readText(row, "location") === null ? "" : ` · ${readText(row, "location")}`}`,
        status: `${labelStatus(readText(row, "severity"))} · ${labelStatus(readText(row, "status"))}`,
        amount: readNumber(row, "estimated_cost"),
        date: readText(row, "occurred_at"),
        hasFile: readText(row, "file_id") !== null,
        fileId: readText(row, "file_id") ?? undefined,
      })),
      events: eventRows.map((row) => ({
        id: requiredId(row),
        title: `${labelStatus(readText(row, "dimension"))}: ${labelStatus(readText(row, "new_status"))}`,
        description: describeEvent(row),
        status: "Registrado",
        amount: null,
        date: readText(row, "occurred_at"),
      })),
      financials: {
        serviceIncome: directFinancials.grossIncome,
        validatedFuelCost: validatedFuel.reduce((sum, amount) => sum + amount, 0),
        approvedExpenseCost: approvedExpenses.reduce((sum, amount) => sum + amount, 0),
        validatedDirectCost: directFinancials.directCosts,
        directMargin: directFinancials.directMargin,
        collectedAmount: activePaymentRows.reduce(
          (sum, row) => sum + (readNumber(row, "amount") ?? 0),
          0,
        ),
        pendingCostRecords:
          fuelRows.filter((row) => readText(row, "validation_status") !== "validated").length +
          expenseRows.filter((row) => readText(row, "validation_status") !== "validated").length,
      },
    };
  }

  async function loadTripDetail(tripId: string): Promise<AdminTripDetail> {
    if (shouldPreferOffline(offline)) return loadOfflineTripDetail(offline, tripId);
    try {
      return await loadRemoteTripDetail(tripId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!canFallbackToOffline(offline, error) && !/requiere conexión|copia local/iu.test(message))
        throw error;
      return loadOfflineTripDetail(offline, tripId);
    }
  }

  async function loadVehicleDetail(vehicleId: string): Promise<AdminVehicleDetail> {
    const activeStatuses = new Set(["scheduled", "loading", "in_transit", "unloading"]);
    if (shouldPreferOffline(offline)) {
      const [vehicles, trips, drivers] = await Promise.all([
        listVehicles(),
        listTrips(),
        listDrivers(),
      ]);
      const vehicle = vehicles.find((row) => row.id === vehicleId);
      if (vehicle === undefined)
        throw new Error("No se encontró la unidad solicitada o no tienes acceso.");
      const vehicleTrips = trips.filter((trip) => trip.vehicleId === vehicleId);
      const odometerRows = (
        await Promise.all(
          vehicleTrips.map((trip) =>
            readRowsWhere("odometer_entries", "trip_id", trip.id, "reading_at"),
          ),
        )
      ).flat();
      const activeTrip = vehicleTrips.find((trip) => activeStatuses.has(trip.operationalStatus));
      const driver =
        activeTrip === undefined ? null : drivers.find((row) => row.id === activeTrip.driverId);
      return {
        source: "local",
        unavailableSections: ["maintenance", "documents", "alerts", "gps"],
        vehicle,
        activeTrip:
          activeTrip === undefined ? null : { ...activeTrip, driverName: driver?.title ?? null },
        recentTrips: vehicleTrips.slice(0, 6),
        odometerEntries: odometerRows.slice(0, 6).map((row) => mapVehicleOdometerEntry(row, true)),
        maintenance: [],
        documents: [],
        alerts: [],
      };
    }

    const [vehicleRow, trips, drivers, odometerRows, maintenance, documents, alerts] =
      await Promise.all([
        readFirstWhere("vehicles", "id", vehicleId, "plate"),
        listTrips(),
        listDrivers(),
        readRowsWhere("odometer_entries", "vehicle_id", vehicleId, "reading_at"),
        listMaintenance(),
        listDocuments(),
        listAlerts(),
      ]);
    if (vehicleRow === null)
      throw new Error("No se encontró la unidad solicitada o no tienes acceso.");
    const vehicleTrips = trips.filter((trip) => trip.vehicleId === vehicleId);
    const activeTrip = vehicleTrips.find((trip) => activeStatuses.has(trip.operationalStatus));
    const driver =
      activeTrip === undefined ? null : drivers.find((row) => row.id === activeTrip.driverId);
    return {
      source: "remote",
      unavailableSections: [],
      vehicle: mapVehicleRow(vehicleRow),
      activeTrip:
        activeTrip === undefined ? null : { ...activeTrip, driverName: driver?.title ?? null },
      recentTrips: vehicleTrips.slice(0, 6),
      odometerEntries: odometerRows.slice(0, 6).map((row) => mapVehicleOdometerEntry(row, false)),
      maintenance: maintenance.filter((row) => row.vehicleId === vehicleId).slice(0, 6),
      documents: documents.filter((row) => row.vehicleId === vehicleId).slice(0, 6),
      alerts: alerts
        .filter((row) => row.entityType === "vehicle" && row.entityId === vehicleId)
        .slice(0, 6),
    };
  }

  async function loadPrivateFile(fileId: string): Promise<AdminPrivateFile> {
    if (fileId.trim() === "")
      throw new Error("No se encontró el archivo solicitado o no tienes acceso.");
    // Private evidence is intentionally never served from the offline replica or by a public URL.
    if (shouldPreferOffline(offline)) throw new Error("La evidencia privada requiere conexión.");

    const metadata = await dataClient
      .from("files")
      .select(selectColumns.files)
      .eq("id", fileId)
      .limit(1);
    if (metadata.error !== null)
      throw new Error("No se pudo verificar el archivo solicitado. Vuelve a intentarlo.");
    const row = Array.isArray(metadata.data) ? metadata.data.filter(isRecord)[0] : null;
    if (row === null || row === undefined)
      throw new Error("No se encontró el archivo solicitado o no tienes acceso.");

    const originalName = readText(row, "original_name");
    const mimeType = readText(row, "mime_type");
    const sizeBytes = readNumber(row, "size_bytes");
    const storagePath = readText(row, "storage_path");
    if (
      originalName === null ||
      !isPrivateDocumentMimeType(mimeType) ||
      sizeBytes === null ||
      sizeBytes <= 0 ||
      storagePath === null
    )
      throw new Error("El archivo privado no tiene metadatos válidos para su consulta.");

    const download = await client.storage.from(privateDocumentBucket).download(storagePath);
    if (download.error !== null || download.data === null)
      throw new Error("No se pudo recuperar el archivo privado. Vuelve a intentarlo.");
    return { originalName, mimeType, sizeBytes, blob: download.data };
  }

  return {
    async loadDashboard() {
      const loadLocal = async (): Promise<AdminDashboardSnapshot> => {
        if (offline === undefined) throw new Error("El tablero requiere conexión en este entorno.");
        const localGateway = createSupabaseAdminDataGateway(client, {
          ...offline,
          isOffline: () => true,
        });
        const [vehicles, trips, settlements] = await Promise.all([
          localGateway.listVehicles(),
          localGateway.listTrips(),
          localGateway.listSettlements(),
        ]);
        return {
          source: "local",
          unavailableMetrics: ["invoices", "alerts"],
          vehicles,
          trips,
          settlements,
          invoices: [],
          alerts: [],
        };
      };
      if (shouldPreferOffline(offline)) return loadLocal();
      try {
        const [vehicles, trips, settlements, invoices, alerts] = await Promise.all([
          listVehicles(),
          listTrips(),
          listSettlements(),
          listInvoices(),
          listAlerts(),
        ]);
        return {
          source: "remote",
          unavailableMetrics: [],
          vehicles,
          trips,
          settlements,
          invoices,
          alerts,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          !canFallbackToOffline(offline, error) &&
          !/requiere conexión|copia local/iu.test(message)
        )
          throw error;
        return loadLocal();
      }
    },
    listClients,
    loadClientDetail,
    listVehicles,
    loadVehicleDetail,
    listDrivers,
    loadDriverDetail,
    listTrips,
    listOperationalCycles,
    listExpenses,
    listFuelEntries,
    listAdvances,
    listSettlements,
    loadSettlementDetail,
    listMaintenance,
    loadMaintenanceDetail,
    listDocuments,
    listSuppliers,
    listInvoices,
    listAlerts,
    listProfiles,
    loadTripDetail,
    loadOperationalCycleDetail,
    loadPrivateFile,
    async loadOptions() {
      const [clients, vehicles, drivers] = await Promise.all([
        listClients(),
        listVehicles(),
        listDrivers(),
      ]);
      return {
        clients: clients.map(toOption),
        vehicles: vehicles.map(toOption),
        drivers: drivers.map(toOption),
      };
    },
    async loadMaintenanceOptions() {
      const [vehicleRows, supplierRows, partRows] = await Promise.all([
        readRows("vehicles", "plate"),
        readRows("suppliers", "legal_name"),
        readRows("parts", "name"),
      ]);
      return {
        vehicles: vehicleRows
          .filter((row) => readBoolean(row, "active") !== false)
          .map((row) => toTripSetupOption(row, "plate", "Unidad sin placa", "Activa")),
        suppliers: supplierRows
          .filter((row) => readBoolean(row, "active") !== false)
          .map((row) => ({
            id: requiredId(row),
            label:
              readText(row, "trade_name") ?? readText(row, "legal_name") ?? "Proveedor sin nombre",
            status: readText(row, "supplier_type") ?? "Proveedor",
          })),
        parts: partRows
          .filter((row) => readBoolean(row, "active") !== false)
          .map((row) => ({
            id: requiredId(row),
            label: [
              readText(row, "internal_code"),
              readText(row, "name") ?? "Repuesto sin nombre",
              readText(row, "brand"),
            ]
              .filter((value): value is string => value !== null)
              .join(" · "),
            status: readText(row, "unit") ?? "Unidad",
          })),
      };
    },
    async loadTripSetupOptions() {
      const [clientRows, vehicleRows, driverRows, profileRows] = await Promise.all([
        readRows("clients", "created_at"),
        readRows("vehicles", "plate"),
        readRows("drivers", "display_name"),
        readRows("profiles", "created_at"),
      ]);
      const activeDriverProfileIds = new Set(
        profileRows
          .filter(
            (row) => readBoolean(row, "active") !== false && readText(row, "role") === "driver",
          )
          .map(requiredId),
      );
      const activeAvailableDrivers = driverRows.filter(
        (row) =>
          readBoolean(row, "active") !== false && readText(row, "current_status") === "available",
      );
      const drivers = activeAvailableDrivers
        .filter((row) => {
          const profileId = readText(row, "profile_id");
          return profileId !== null && activeDriverProfileIds.has(profileId);
        })
        .map((row) => toTripSetupOption(row, "display_name", "Conductor sin nombre", "Disponible"));

      return {
        clients: clientRows
          .filter((row) => readBoolean(row, "active") !== false)
          .map((row) => toTripSetupOption(row, "legal_name", "Cliente sin nombre", "Activo")),
        vehicles: vehicleRows
          .filter(
            (row) =>
              readBoolean(row, "active") !== false &&
              readText(row, "current_status") === "available",
          )
          .map((row) => toTripSetupOption(row, "plate", "Unidad sin placa", "Disponible")),
        drivers,
        registeredDrivers: driverRows.filter((row) => readBoolean(row, "active") !== false).length,
        driversAwaitingAccess: activeAvailableDrivers.length - drivers.length,
      };
    },
    loadOperationalCycleOptions,
    async loadStaffCaptureOptions() {
      const [trips, categoryRows, supplierRows] = await Promise.all([
        listTrips(),
        readRows("expense_categories", "name"),
        readRows("suppliers", "legal_name"),
      ]);
      return {
        trips: trips.map(toTripOption),
        expenseCategories: categoryRows
          .filter((row) => readBoolean(row, "active") !== false)
          .map((row) => ({
            id: requiredId(row),
            label: readText(row, "name") ?? "Categoría sin nombre",
            status: readText(row, "code") ?? "Categoría",
          })),
        suppliers: supplierRows
          .filter((row) => readBoolean(row, "active") !== false)
          .map((row) => ({
            id: requiredId(row),
            label:
              readText(row, "trade_name") ?? readText(row, "legal_name") ?? "Proveedor sin nombre",
            status: readText(row, "supplier_type") ?? "Proveedor",
          })),
      };
    },
    createClient: (context, input) =>
      insertRow("clients", {
        company_id: context.companyId,
        legal_name: input.legalName,
        tax_id: input.taxId,
        payment_terms_days: input.paymentTermsDays,
      }),
    createVehicle: (context, input) =>
      insertRow("vehicles", {
        company_id: context.companyId,
        plate: input.plate,
        make: input.make,
        model: input.model,
        model_year: input.modelYear,
        capacity_tons: input.capacityTons,
        ownership_type: input.ownershipType,
        owner_name: input.ownerName,
        notes: input.notes,
      }),
    createDriver: (context, input) =>
      insertRow("drivers", {
        company_id: context.companyId,
        display_name: input.displayName,
        document_type: input.documentNumber === null ? null : "DNI",
        document_number: input.documentNumber,
        phone: input.phone,
      }),
    createTrip: async (_context, input) => {
      const result = await rpc("create_trip_with_load", {
        client_id: input.clientId,
        origin: input.origin,
        destination: input.destination,
        scheduled_at: input.scheduledAt,
        freight_amount: input.freightAmount,
        cargo_description: input.cargoDescription,
        cargo_tons: input.cargoTons,
        freight_pricing_mode: input.freightPricingMode,
        freight_rate_per_ton: input.freightRatePerTon,
      });
      return createdTripFromCommand(result);
    },
    approveTrip: async (input) => {
      await rpc("approve_trip", { trip_id: input.tripId });
    },
    scheduleTrip: async (input) => {
      await rpc("schedule_trip", {
        trip_id: input.tripId,
        vehicle_id: input.vehicleId,
        driver_id: input.driverId,
      });
    },
    transitionTripToUnloading: async (input) => {
      await rpc("transition_trip_operational", {
        p_trip_id: input.tripId,
        p_target: "unloading",
        p_expected_version: input.version,
        p_reason: null,
      });
    },
    startTrip: async (input) => {
      await rpc("start_trip", { trip_id: input.tripId, initial_mileage: input.odometerKm });
    },
    completeTrip: async (input) => {
      await rpc("complete_trip", {
        trip_id: input.tripId,
        final_mileage: input.odometerKm,
        cargo_delivered: input.cargoDelivered,
      });
    },
    createOperationalCycle: async (input) => {
      await rpc("create_operational_cycle", {
        p_id: input.id,
        p_code: input.code,
        p_vehicle_id: input.vehicleId,
        p_primary_driver_id: input.primaryDriverId,
        p_return_status: input.returnStatus,
        p_notes: input.notes,
        p_idempotency_key: input.idempotencyKey,
      });
    },
    updateOperationalCycle: async (input) => {
      await rpc("update_operational_cycle", {
        p_cycle_id: input.cycleId,
        p_expected_version: input.expectedVersion,
        p_status: input.status,
        p_return_status: input.returnStatus,
        p_notes: input.notes,
      });
    },
    addTripToOperationalCycle: async (input) => {
      await rpc("add_trip_to_operational_cycle", {
        p_cycle_id: input.cycleId,
        p_trip_id: input.tripId,
        p_leg_kind: input.legKind,
        p_expected_cycle_version: input.expectedCycleVersion,
      });
    },
    removeTripFromOperationalCycle: async (input) => {
      await rpc("remove_trip_from_operational_cycle", {
        p_cycle_id: input.cycleId,
        p_trip_id: input.tripId,
        p_expected_cycle_version: input.expectedCycleVersion,
        p_reason: input.reason,
      });
    },
    reviewExpense: async (input) => {
      await rpc("review_expense", {
        expense_id: input.expenseId,
        validation_status: input.validationStatus,
        approved_amount: input.approvedAmount,
        note: input.note,
      });
    },
    recordStaffExpense: async (context, input) => {
      const receiptFileId =
        input.receiptFile === null
          ? null
          : await uploadPrivateDocumentFile(context, input.receiptFile, input.recordId);
      await rpc("record_staff_trip_expense", {
        p_id: input.recordId,
        p_trip_id: input.tripId,
        p_category_id: input.categoryId,
        p_supplier_id: input.supplierId,
        p_incurred_at: input.incurredAt,
        p_amount: input.amount,
        p_currency: input.currency,
        p_receipt_type: input.receiptType,
        p_receipt_number: input.receiptNumber,
        p_receipt_file_id: receiptFileId,
        p_description: input.description,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
      });
    },
    recordStaffFuelEntry: async (context, input) => {
      const receiptFileId =
        input.receiptFile === null
          ? null
          : await uploadPrivateDocumentFile(context, input.receiptFile, input.recordId);
      await rpc("record_staff_trip_fuel_entry", {
        p_id: input.recordId,
        p_trip_id: input.tripId,
        p_supplier_id: input.supplierId,
        p_fueled_at: input.fueledAt,
        p_location: input.location,
        p_odometer_km: input.odometerKm,
        p_quantity: input.quantity,
        p_volume_unit: input.volumeUnit,
        p_unit_price: input.unitPrice,
        p_total_amount: input.totalAmount,
        p_currency: input.currency,
        p_payment_method: input.paymentMethod,
        p_receipt_type: input.receiptType,
        p_receipt_number: input.receiptNumber,
        p_receipt_file_id: receiptFileId,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
      });
    },
    createAdvance: async (_context, input) => {
      await rpc("issue_trip_advance", {
        p_trip_id: input.tripId,
        p_driver_id: input.driverId,
        p_delivered_at: input.deliveredAt,
        p_amount: input.amount,
        p_delivery_method: input.deliveryMethod,
        p_concept: input.concept,
        p_idempotency_key: input.idempotencyKey,
      });
    },
    closeSettlement: async (input) => {
      await rpc("close_settlement", {
        settlement_id: input.settlementId,
        resolution_method: input.resolutionMethod,
        resolution_reference: input.resolutionReference,
        resolution_note: input.resolutionNote,
      });
    },
    reopenSettlement: async (input) => {
      await rpc("reopen_settlement", { settlement_id: input.settlementId, reason: input.reason });
    },
    createSupplier: async (input) => {
      const result = await rpc("create_supplier", {
        p_legal_name: input.legalName,
        p_trade_name: input.tradeName,
        p_tax_id: input.taxId,
        p_supplier_type: input.supplierType,
        p_phone: input.phone,
        p_address: input.address,
        p_notes: input.notes,
      });
      if (!isRecord(result)) throw new Error("El proveedor no se pudo registrar.");
      return mapSupplierRow(result);
    },
    updateClientMaster: async (input) => {
      await rpc("update_client_master", {
        p_client_id: input.id,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_legal_name: input.legalName,
        p_trade_name: input.tradeName,
        p_tax_id: input.taxId,
        p_phone: input.phone,
        p_address: input.address,
        p_payment_terms_days: input.paymentTermsDays,
        p_relationship_type: input.relationshipType,
        p_active: input.active,
        p_notes: input.notes,
      });
    },
    updateVehicleMaster: async (input) => {
      await rpc("update_vehicle_master", {
        p_vehicle_id: input.id,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_plate: input.plate,
        p_make: input.make,
        p_model: input.model,
        p_model_year: input.modelYear,
        p_capacity_tons: input.capacityTons,
        p_ownership_type: input.ownershipType,
        p_owner_name: input.ownerName,
        p_active: input.active,
        p_notes: input.notes,
      });
    },
    updateDriverMaster: async (input) => {
      await rpc("update_driver_master", {
        p_driver_id: input.id,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_display_name: input.displayName,
        p_document_type: input.documentType,
        p_document_number: input.documentNumber,
        p_phone: input.phone,
        p_license_number: input.licenseNumber,
        p_license_expires_on: input.licenseExpiresOn,
        p_contract_type: input.contractType,
        p_contract_started_on: input.contractStartedOn,
        p_contract_ended_on: input.contractEndedOn,
        p_usual_vehicle_id: input.usualVehicleId,
        p_active: input.active,
        p_notes: input.notes,
      });
    },
    setDriverAvailability: async (input) => {
      await rpc("set_driver_availability", {
        p_driver_id: input.id,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_status: input.status,
        p_reason: input.reason,
      });
    },
    updateSupplierMaster: async (input) => {
      await rpc("update_supplier_master", {
        p_supplier_id: input.id,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_legal_name: input.legalName,
        p_trade_name: input.tradeName,
        p_tax_id: input.taxId,
        p_supplier_type: input.supplierType,
        p_phone: input.phone,
        p_address: input.address,
        p_active: input.active,
        p_notes: input.notes,
      });
    },
    createMaintenancePlan: (context, input) =>
      insertRow("maintenance_plans", {
        company_id: context.companyId,
        vehicle_id: input.vehicleId,
        name: input.name,
        maintenance_type: input.maintenanceType,
        frequency_km: input.frequencyKm,
        frequency_days: input.frequencyDays,
      }),
    createWorkOrder: async (input) => {
      await rpc("create_work_order", {
        p_id: input.id,
        p_vehicle_id: input.vehicleId,
        p_supplier_id: input.supplierId,
        p_maintenance_type: input.maintenanceType,
        p_reported_problem: input.reportedProblem,
        p_admitted_at: input.admittedAt,
        p_blocks_operation: input.blocksOperation,
        p_notes: input.notes,
        p_idempotency_key: input.idempotencyKey,
      });
    },
    updateWorkOrderProgress: async (input) => {
      await rpc("update_work_order_progress", {
        p_work_order_id: input.workOrderId,
        p_supplier_id: input.supplierId,
        p_status: input.status,
        p_admitted_at: input.admittedAt,
        p_started_at: input.startedAt,
        p_diagnosis: input.diagnosis,
        p_work_performed: input.workPerformed,
        p_notes: input.notes,
        p_blocks_operation: input.blocksOperation,
      });
    },
    createMaintenancePart: (context, input) =>
      insertRow("parts", {
        company_id: context.companyId,
        name: input.name,
        internal_code: input.internalCode,
        brand: input.brand,
        category: input.category,
        unit: input.unit,
      }),
    recordWorkOrderPart: async (input) => {
      await rpc("record_work_order_part", {
        p_id: input.id,
        p_work_order_id: input.workOrderId,
        p_part_id: input.partId,
        p_supplier_id: input.supplierId,
        p_quantity: input.quantity,
        p_unit_cost: input.unitCost,
        p_installed_at: input.installedAt,
        p_installation_odometer_km: input.installationOdometerKm,
        p_notes: input.notes,
        p_idempotency_key: input.idempotencyKey,
      });
    },
    attachWorkOrderEvidence: async (context, input) => {
      const fileId = await uploadPrivateDocumentFile(context, input.file, input.fileId);
      await rpc("attach_work_order_evidence", {
        p_id: input.id,
        p_work_order_id: input.workOrderId,
        p_file_id: fileId,
        p_notes: input.notes,
        p_idempotency_key: input.idempotencyKey,
      });
    },
    completeWorkOrder: async (input) => {
      await rpc("complete_work_order", {
        work_order_id: input.workOrderId,
        final_mileage: input.finalMileage,
        labour_cost: input.labourCost,
        parts_cost: input.partsCost,
      });
    },
    createDocument: async (context, input) => {
      if (input.entityType !== "company" && input.entityId === null)
        throw new Error("Selecciona el registro al que pertenece el documento.");
      validatePrivateDocumentFile(input.file);
      let fileId: string | null = null;
      if (input.file !== null) fileId = await uploadPrivateDocumentFile(context, input.file);
      const entityColumns: Record<string, unknown> = {
        vehicle_id: null,
        driver_id: null,
        trip_id: null,
        client_id: null,
      };
      if (input.entityType !== "company" && input.entityId !== null)
        entityColumns[`${input.entityType}_id`] = input.entityId;
      await insertRow("documents", {
        company_id: context.companyId,
        document_type: input.documentType,
        document_number: input.documentNumber,
        issued_on: input.issuedOn,
        expires_on: input.expiresOn,
        blocks_operation: input.blocksOperation,
        entity_type: input.entityType,
        file_id: fileId,
        created_by: context.profileId,
        ...entityColumns,
      });
    },
    attachDocumentFile: async (context, input) => {
      const fileId = await uploadPrivateDocumentFile(context, input.file);
      await rpc("attach_document_file", {
        p_document_id: input.documentId,
        p_file_id: fileId,
        p_expected_updated_at: input.expectedUpdatedAt,
      });
    },
    createInvoice: async (_context, input) => {
      await rpc("create_trip_invoice", {
        p_trip_id: input.tripId,
        p_client_id: input.clientId,
        p_series: input.series,
        p_number: input.number,
        p_issued_on: input.issuedOn,
        p_due_on: input.dueOn,
        p_subtotal: input.subtotal,
        p_tax: input.tax,
      });
    },
    registerPayment: async (_context, input) => {
      await rpc("register_invoice_payment", {
        invoice_id: input.invoiceId,
        paid_at: input.paidAt,
        amount: input.amount,
        method: input.paymentMethod,
        reference: input.reference,
      });
    },
    resolveAlert: async (_context, alertId, note) => {
      await rpc("resolve_alert", { alert_id: alertId, note });
    },
    inviteCompanyUser: async (input) => {
      const result = await dataClient.functions.invoke("invite-company-user", {
        body: { email: input.email, display_name: input.displayName, role: input.role },
      });
      if (result.error !== null) throw new Error(result.error.message);
    },
    linkDriverProfile: async (input) => {
      await rpc("link_driver_profile", {
        driver_id: input.driverId,
        profile_id: input.profileId,
      });
    },
    manageCompanyProfileAccess: async (input) => {
      await rpc("manage_company_profile_access", {
        p_profile_id: input.profileId,
        p_action: input.action,
        p_next_role: input.nextRole ?? null,
        p_reason: input.reason,
      });
    },
    resendCompanyInvitation: async (profileId) => {
      const result = await dataClient.functions.invoke("resend-company-invitation", {
        body: { profile_id: profileId },
      });
      if (result.error !== null) throw new Error(result.error.message);
    },
  };
}

interface OfflineTableConfig {
  readonly scope: "company" | "trip";
  readonly orderBy: string;
  readonly filters: readonly string[];
}

const offlineTableConfigs: Readonly<Partial<Record<AdminTable, OfflineTableConfig>>> = {
  profiles: { scope: "company", orderBy: "created_at", filters: ["id"] },
  clients: { scope: "company", orderBy: "updated_at", filters: ["id"] },
  vehicles: { scope: "company", orderBy: "plate", filters: ["id"] },
  drivers: { scope: "company", orderBy: "display_name", filters: ["id"] },
  trips: { scope: "company", orderBy: "scheduled_at", filters: ["id"] },
  expenses: { scope: "trip", orderBy: "incurred_at", filters: ["id", "trip_id"] },
  settlements: { scope: "company", orderBy: "started_at", filters: ["id", "trip_id"] },
  odometer_entries: { scope: "trip", orderBy: "reading_at", filters: ["id", "trip_id"] },
  fuel_entries: { scope: "trip", orderBy: "fueled_at", filters: ["id", "trip_id"] },
  incidents: { scope: "trip", orderBy: "occurred_at", filters: ["id", "trip_id"] },
};

function shouldPreferOffline(context: AdminOfflineReadContext | undefined): boolean {
  if (context === undefined) return false;
  if (context.isOffline !== undefined) return context.isOffline();
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function canFallbackToOffline(
  context: AdminOfflineReadContext | undefined,
  error: unknown,
): boolean {
  if (context === undefined) return false;
  if (shouldPreferOffline(context)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|fetch failed|load failed|network(?:error| request failed)?|offline|internet disconnected/iu.test(
    message,
  );
}

async function readOfflineRows(
  context: AdminOfflineReadContext | undefined,
  table: AdminTable,
  field?: string,
  value?: string,
): Promise<readonly Record<string, unknown>[]> {
  if (context === undefined) throw new Error("La copia local no está disponible en este entorno.");
  const config = offlineTableConfigs[table];
  if (config === undefined)
    throw new Error(
      "Esta vista requiere conexión porque sus datos no forman parte de la copia local.",
    );
  if (field !== undefined && !config.filters.includes(field))
    throw new Error("Esta consulta requiere conexión porque no existe en la copia local.");

  const parameters: unknown[] = [context.companyId];
  const scopeSql =
    config.scope === "company"
      ? `r.company_id = ?`
      : `EXISTS (
          SELECT 1 FROM trips scoped_trip
          WHERE scoped_trip.id = r.trip_id AND scoped_trip.company_id = ?
        )`;
  const filterSql = field === undefined ? "" : ` AND r.${field} = ?`;
  if (field !== undefined) parameters.push(value);
  try {
    const rows = await context.database.getAll<Record<string, unknown>>(
      `SELECT r.*, 1 AS __offline_snapshot
       FROM ${table} r
       WHERE ${scopeSql}${filterSql}
       ORDER BY r.${config.orderBy} DESC
       LIMIT 200`,
      parameters,
    );
    return rows.filter(isRecord);
  } catch (error) {
    throw new Error(
      `No fue posible abrir la copia local: ${error instanceof Error ? error.message : "error desconocido"}`,
    );
  }
}

async function loadOfflineTripDetail(
  context: AdminOfflineReadContext | undefined,
  tripId: string,
): Promise<AdminTripDetail> {
  if (context === undefined) throw new Error("La copia local no está disponible en este entorno.");
  const [tripRows, odometerRows, fuelRows, expenseRows, settlementRows, incidentRows] =
    await Promise.all([
      context.database.getAll<Record<string, unknown>>(
        `SELECT
           t.*,
           c.legal_name AS client_legal_name,
           c.trade_name AS client_trade_name,
           v.plate AS vehicle_plate,
           d.display_name AS driver_display_name
         FROM trips t
         LEFT JOIN clients c ON c.id = t.client_id
         LEFT JOIN vehicles v ON v.id = t.vehicle_id
         LEFT JOIN drivers d ON d.id = t.driver_id
         WHERE t.id = ? AND t.company_id = ?
         LIMIT 1`,
        [tripId, context.companyId],
      ),
      readOfflineTripRows(context, "odometer_entries", "reading_at", tripId),
      readOfflineTripRows(context, "fuel_entries", "fueled_at", tripId),
      readOfflineTripRows(context, "expenses", "incurred_at", tripId),
      context.database.getAll<Record<string, unknown>>(
        `SELECT * FROM settlements
         WHERE trip_id = ? AND company_id = ?
         ORDER BY started_at DESC
         LIMIT 1`,
        [tripId, context.companyId],
      ),
      readOfflineTripRows(context, "incidents", "occurred_at", tripId),
    ]);
  const tripRow = tripRows[0];
  if (tripRow === undefined)
    throw new Error("No existe una copia local de este viaje para la empresa autenticada.");

  const startReading = odometerRows.find((row) => readText(row, "reading_type") === "trip_start");
  const finishReading = odometerRows.find((row) => readText(row, "reading_type") === "trip_finish");
  const initialOdometerKm =
    startReading === undefined ? null : readNumber(startReading, "reading_km");
  const finalOdometerKm =
    finishReading === undefined ? null : readNumber(finishReading, "reading_km");
  const distanceKm =
    initialOdometerKm !== null && finalOdometerKm !== null && finalOdometerKm >= initialOdometerKm
      ? finalOdometerKm - initialOdometerKm
      : null;

  return {
    source: "local",
    unavailableSections: [
      "loads",
      "advances",
      "invoices",
      "payments",
      "documents",
      "events",
      "financials",
    ],
    trip: {
      id: requiredId(tripRow),
      code: readText(tripRow, "code") ?? "Viaje sin código",
      origin: readText(tripRow, "origin") ?? "",
      destination: readText(tripRow, "destination") ?? "",
      scheduledAt: readText(tripRow, "scheduled_at") ?? "",
      startedAt: readText(tripRow, "started_at"),
      finishedAt: readText(tripRow, "operational_finished_at"),
      operationalStatus: readText(tripRow, "operational_status") ?? "draft",
      administrativeStatus: readText(tripRow, "administrative_status") ?? "not_required",
      financialStatus: readText(tripRow, "financial_status") ?? "unbilled",
      freightAmount: readNumber(tripRow, "freight_amount") ?? 0,
      freightPricingMode: tripPricingMode(tripRow),
      freightRatePerTon:
        tripPricingMode(tripRow) === "per_ton" ? readNumber(tripRow, "freight_rate_per_ton") : null,
      additionalAmount: readNumber(tripRow, "additional_amount") ?? 0,
      currency: readText(tripRow, "currency") ?? "PEN",
      notes: readText(tripRow, "notes"),
      version: readNumber(tripRow, "version") ?? 1,
    },
    clientName: readText(tripRow, "client_trade_name") ?? readText(tripRow, "client_legal_name"),
    vehicleId: readText(tripRow, "vehicle_id"),
    vehiclePlate: readText(tripRow, "vehicle_plate"),
    driverName: readText(tripRow, "driver_display_name"),
    loads: [],
    odometerEntries: odometerRows.map((row) => ({
      id: requiredId(row),
      title: `${formatNumber(readNumber(row, "reading_km"))} km`,
      description: `${labelStatus(readText(row, "reading_type"))} · Copia local`,
      status: "Sincronizado localmente",
      amount: null,
      date: readText(row, "reading_at"),
    })),
    initialOdometerKm,
    finalOdometerKm,
    distanceKm,
    fuelEntries: fuelRows.map((row) => ({
      id: requiredId(row),
      title:
        `${formatNumber(readNumber(row, "quantity"))} ${readText(row, "volume_unit") ?? ""}`.trim(),
      description: `${describeFuel(row)} · Copia local`,
      status: "Validación no disponible",
      amount: readNumber(row, "total_amount"),
      date: readText(row, "fueled_at"),
      hasFile: false,
    })),
    advances: [],
    expenses: expenseRows.map((row) => ({
      id: requiredId(row),
      title: readText(row, "description") ?? "Gasto de viaje",
      description: `${describeReceipt(row)} · Copia local`,
      status: "Validación no disponible",
      amount: readNumber(row, "amount"),
      date: readText(row, "incurred_at"),
      hasFile: false,
    })),
    settlement: mapSettlementSummary(settlementRows[0]),
    invoices: [],
    payments: [],
    documents: [],
    incidents: incidentRows.map((row) => ({
      id: requiredId(row),
      title: readText(row, "incident_type") ?? "Incidente",
      description: `${readText(row, "description") ?? "Sin detalle"} · Copia local`,
      status: `${labelStatus(readText(row, "severity"))} · Solo lectura`,
      amount: null,
      date: readText(row, "occurred_at"),
      hasFile: false,
    })),
    events: [],
    financials: {
      serviceIncome: 0,
      validatedFuelCost: 0,
      approvedExpenseCost: 0,
      validatedDirectCost: 0,
      directMargin: 0,
      collectedAmount: 0,
      pendingCostRecords: 0,
    },
  };
}

function readOfflineTripRows(
  context: AdminOfflineReadContext,
  table: "odometer_entries" | "fuel_entries" | "expenses" | "incidents",
  orderBy: "reading_at" | "fueled_at" | "incurred_at" | "occurred_at",
  tripId: string,
): Promise<Record<string, unknown>[]> {
  return context.database.getAll<Record<string, unknown>>(
    `SELECT record.*
     FROM ${table} record
     WHERE record.trip_id = ?
       AND EXISTS (
         SELECT 1 FROM trips scoped_trip
         WHERE scoped_trip.id = record.trip_id AND scoped_trip.company_id = ?
       )
     ORDER BY record.${orderBy} DESC
     LIMIT 200`,
    [tripId, context.companyId],
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredId(row: Record<string, unknown>): string {
  const id = readText(row, "id");
  if (id === null) throw new Error("La fila no contiene un identificador válido.");
  return id;
}

function readText(row: Record<string, unknown>, field: string): string | null {
  const value = row[field];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readNumber(row: Record<string, unknown>, field: string): number | null {
  const value = row[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
    return Number(value);
  return null;
}

function readBoolean(row: Record<string, unknown>, field: string): boolean | null {
  const value = row[field];
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
}

function isOfflineRow(row: Record<string, unknown>): boolean {
  return row.__offline_snapshot === 1 || row.__offline_snapshot === true;
}

function markOfflineDescription(description: string, row: Record<string, unknown>): string {
  return isOfflineRow(row) ? `${description} · Copia local` : description;
}

function readRole(row: Record<string, unknown>, field: string): AdminProfileRow["role"] {
  const value = readText(row, field);
  if (
    value === "management" ||
    value === "administration" ||
    value === "driver" ||
    value === "accounting"
  )
    return value;
  throw new Error("El perfil contiene un rol no reconocido.");
}

function labelStatus(status: string | null): string {
  if (status === null) return "Sin estado";
  const labels: Readonly<Record<string, string>> = {
    AUTO_BALANCED: "Saldo conciliado automáticamente",
    Available: "Disponible",
    Pending: "Pendiente",
    active: "Activo",
    administrative: "Gestión administrativa",
    approved: "Aprobado",
    awaiting_approval: "Pendiente de aprobación",
    available: "Disponible",
    cancelled: "Cancelado",
    closed: "Cerrado",
    completed: "Finalizado",
    draft: "Borrador",
    command: "Registro confirmado",
    financial: "Finanzas",
    in_trip: "En viaje",
    in_transit: "En tránsito",
    issued: "Emitida",
    loading: "En carga",
    observed: "Observado",
    not_required: "No requiere gestión administrativa",
    overdue: "Vencida",
    paid: "Pagada",
    partial: "Pago parcial",
    pending: "Pendiente",
    pending_review: "Pendiente de revisión",
    offline_driver_request: "Solicitud del conductor sin conexión",
    operational: "Operación",
    repair: "Reparar",
    rest: "Descanso",
    scheduled: "Programado",
    settlement_closed: "Rendición cerrada",
    settlement_observed: "Rendición observada",
    settlement_pending: "Rendición pendiente",
    settlement_review: "Rendición en revisión",
    total: "Monto total",
    under_review: "En revisión",
    unbilled: "Sin facturar",
    unloading: "En descarga",
    unavailable: "No disponible",
    validated: "Validado",
    vacation: "Vacaciones",
    valid: "Vigente",
    waiting_load: "Esperando carga",
    waiting_part: "En espera de repuesto",
    waiting_workshop: "En espera de taller",
    trip_finish: "Fin de viaje",
    trip_start: "Inicio de viaje",
  };
  const normalized = status.toLocaleLowerCase("es-PE").replace(/[\s-]+/g, "_");
  if (labels[status] !== undefined) return labels[status];
  if (labels[normalized] !== undefined) return labels[normalized];
  return status
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function labelsById(
  rows: readonly Record<string, unknown>[],
  labelField: string,
  fallbackLabel: string,
): ReadonlyMap<string, string> {
  return new Map(rows.map((row) => [requiredId(row), readText(row, labelField) ?? fallbackLabel]));
}

function clientLabelsById(rows: readonly Record<string, unknown>[]): ReadonlyMap<string, string> {
  return new Map(
    rows.map((row) => [
      requiredId(row),
      readText(row, "trade_name") ?? readText(row, "legal_name") ?? "Cliente sin nombre",
    ]),
  );
}

function operationalCycleStatus(row: Record<string, unknown>): OperationalCycleStatus {
  const value = readText(row, "status");
  if (value === "planned" || value === "active" || value === "completed" || value === "cancelled")
    return value;
  throw new Error("El ciclo operativo contiene un estado no reconocido.");
}

function operationalCycleReturnStatus(row: Record<string, unknown>): OperationalCycleReturnStatus {
  const value = readText(row, "return_status");
  if (
    value === "unidentified" ||
    value === "probable" ||
    value === "confirmed" ||
    value === "completed" ||
    value === "empty_return"
  )
    return value;
  throw new Error("El ciclo operativo contiene un estado de retorno no reconocido.");
}

function operationalCycleLegKind(row: Record<string, unknown>): OperationalCycleLegKind | null {
  const value = readText(row, "cycle_leg_kind");
  if (value === null) return null;
  if (value === "outbound" || value === "return" || value === "continuation") return value;
  throw new Error("El viaje contiene una clasificación de tramo no reconocida.");
}

function workOrderStatus(row: Record<string, unknown>): AdminWorkOrderStatus {
  const value = readText(row, "status");
  if (
    value === "scheduled" ||
    value === "waiting_workshop" ||
    value === "in_workshop" ||
    value === "in_progress" ||
    value === "waiting_part" ||
    value === "finished" ||
    value === "cancelled"
  )
    return value;
  throw new Error("La orden de trabajo contiene un estado no reconocido.");
}

function mapVehicleRow(row: Record<string, unknown>): AdminVehicleRow {
  const make = readText(row, "make");
  const model = readText(row, "model");
  const currentOdometerKm = readNumber(row, "current_odometer_km");
  return {
    id: requiredId(row),
    title: readText(row, "plate") ?? "Sin placa",
    description: markOfflineDescription(
      [make, model].filter((value): value is string => value !== null).join(" ") ||
        `Odómetro ${formatNumber(currentOdometerKm)} km`,
      row,
    ),
    status: labelStatus(readText(row, "current_status")),
    amount: null,
    date: null,
    make,
    model,
    modelYear: readNumber(row, "model_year"),
    capacityTons: readNumber(row, "capacity_tons"),
    currentOdometerKm,
    ownershipType: readText(row, "ownership_type"),
    ownerName: readText(row, "owner_name"),
    notes: readText(row, "notes"),
    active: readBoolean(row, "active") !== false,
    updatedAt: readText(row, "updated_at") ?? undefined,
  };
}

function mapSupplierRow(row: Record<string, unknown>): AdminSupplierRow {
  const rawType = readText(row, "supplier_type") ?? "otro";
  const supplierType =
    rawType === "grifo" || rawType === "taller" || rawType === "repuestos" ? rawType : "otro";
  const legalName = readText(row, "legal_name") ?? "Proveedor sin nombre";
  const tradeName = readText(row, "trade_name");
  return {
    id: requiredId(row),
    title: tradeName ?? legalName,
    description: markOfflineDescription(
      [tradeName === null ? null : legalName, readText(row, "phone"), readText(row, "tax_id")]
        .filter((value): value is string => value !== null)
        .join(" · ") || supplierTypeLabel(supplierType),
      row,
    ),
    status: readBoolean(row, "active") === false ? "Inactivo" : supplierTypeLabel(supplierType),
    amount: null,
    date: null,
    technicalReference: readText(row, "tax_id") ?? undefined,
    updatedAt: readText(row, "updated_at") ?? undefined,
    supplierType,
    active: readBoolean(row, "active") !== false,
    legalName,
    tradeName,
    taxId: readText(row, "tax_id"),
    phone: readText(row, "phone"),
    address: readText(row, "address"),
    notes: readText(row, "notes"),
  };
}

function tripPricingMode(row: Record<string, unknown>): "total" | "per_ton" {
  return readText(row, "freight_pricing_mode") === "per_ton" ? "per_ton" : "total";
}

function mapTripRow(
  row: Record<string, unknown>,
  clientLabels: ReadonlyMap<string, string>,
  vehicleLabels: ReadonlyMap<string, string>,
  driverLabels: ReadonlyMap<string, string>,
): AdminTripRow {
  const clientId = readText(row, "client_id") ?? "";
  const vehicleId = readText(row, "vehicle_id");
  const driverId = readText(row, "driver_id");
  const origin = readText(row, "origin") ?? "Origen";
  const destination = readText(row, "destination") ?? "Destino";
  const code = readText(row, "code") ?? "Viaje sin código";
  const clientName = clientId === "" ? null : (clientLabels.get(clientId) ?? "Cliente sin nombre");
  const vehiclePlate =
    vehicleId === null ? null : (vehicleLabels.get(vehicleId) ?? "Unidad sin placa");
  const driverName =
    driverId === null ? null : (driverLabels.get(driverId) ?? "Conductor sin nombre");
  const mode = tripPricingMode(row);
  const rate = readNumber(row, "freight_rate_per_ton");
  return {
    id: requiredId(row),
    title: `${origin} → ${destination}`,
    description: markOfflineDescription(
      [
        clientName,
        vehiclePlate === null ? null : `Unidad ${vehiclePlate}`,
        driverName === null ? null : `Conductor ${driverName}`,
      ]
        .filter((value): value is string => value !== null)
        .join(" · ") || "Sin recursos asignados todavía",
      row,
    ),
    status: labelStatus(readText(row, "operational_status")),
    amount: readNumber(row, "freight_amount"),
    date: readText(row, "scheduled_at"),
    technicalReference: code,
    updatedAt: readText(row, "updated_at") ?? undefined,
    version: readNumber(row, "version") ?? 1,
    code,
    clientId,
    vehicleId,
    driverId,
    clientName,
    vehiclePlate,
    driverName,
    origin,
    destination,
    operationalStatus: readText(row, "operational_status") ?? "draft",
    freightAmount: readNumber(row, "freight_amount") ?? 0,
    freightPricingMode: mode,
    freightRatePerTon: mode === "per_ton" ? rate : null,
  };
}

/** Presents a related trip as a human-readable operating context, never as an internal UUID. */
function describeTripContext(trip: AdminTripRow | undefined): string {
  if (trip === undefined) return "Viaje sin referencia disponible";
  return [
    trip.title,
    trip.clientName === null ? null : `Cliente ${trip.clientName}`,
    trip.vehiclePlate === null ? null : `Unidad ${trip.vehiclePlate}`,
  ]
    .filter((value): value is string => value !== null)
    .join(" · ");
}

function invoiceReference(row: Record<string, unknown>): string {
  const reference = [readText(row, "series"), readText(row, "number")]
    .filter((value): value is string => value !== null && value !== "")
    .join("-");
  return reference === "" ? "Factura sin numeración" : reference;
}

function supplierTypeLabel(value: AdminSupplierRow["supplierType"]): string {
  const labels: Readonly<Record<AdminSupplierRow["supplierType"], string>> = {
    grifo: "Grifo",
    taller: "Taller",
    repuestos: "Repuestos",
    otro: "Otro proveedor",
  };
  return labels[value];
}

function documentEntityReference(
  row: Record<string, unknown>,
  clientLabels: ReadonlyMap<string, string>,
  vehicleLabels: ReadonlyMap<string, string>,
  driverLabels: ReadonlyMap<string, string>,
  tripLabels: ReadonlyMap<string, string>,
): {
  readonly type: AdminDocumentRow["entityType"];
  readonly id: string | null;
  readonly label: string;
} {
  const rawType = readText(row, "entity_type");
  if (rawType === "vehicle") {
    const id = readText(row, "vehicle_id");
    return {
      type: "vehicle",
      id,
      label:
        id === null
          ? "Unidad sin asociar"
          : `Unidad ${vehicleLabels.get(id) ?? "sin referencia disponible"}`,
    };
  }
  if (rawType === "driver") {
    const id = readText(row, "driver_id");
    return {
      type: "driver",
      id,
      label:
        id === null
          ? "Conductor sin asociar"
          : `Conductor ${driverLabels.get(id) ?? "sin referencia disponible"}`,
    };
  }
  if (rawType === "trip") {
    const id = readText(row, "trip_id");
    return {
      type: "trip",
      id,
      label:
        id === null
          ? "Viaje sin asociar"
          : (tripLabels.get(id) ?? "Viaje sin referencia disponible"),
    };
  }
  if (rawType === "client") {
    const id = readText(row, "client_id");
    return {
      type: "client",
      id,
      label:
        id === null
          ? "Cliente sin asociar"
          : `Cliente ${clientLabels.get(id) ?? "sin referencia disponible"}`,
    };
  }
  return { type: "company", id: null, label: "Empresa actual" };
}

function mapVehicleOdometerEntry(
  row: Record<string, unknown>,
  fromLocalSnapshot: boolean,
): AdminVehicleOdometerEntry {
  const readingKm = readNumber(row, "reading_km") ?? 0;
  const readingType = readText(row, "reading_type") ?? "Registro";
  const source = fromLocalSnapshot ? null : readText(row, "source");
  return {
    id: requiredId(row),
    title: `${formatNumber(readingKm)} km`,
    description:
      source === null
        ? `${labelStatus(readingType)} · fuente no disponible en la copia local`
        : `${labelStatus(readingType)} · ${labelStatus(source)}`,
    status: fromLocalSnapshot ? "Copia local" : "Registrado",
    amount: null,
    date: readText(row, "reading_at") ?? readText(row, "created_at"),
    readingKm,
    readingType,
    source,
  };
}

function mapMaintenanceWorkOrderRow(
  row: Record<string, unknown>,
  vehicleLabels: ReadonlyMap<string, string>,
  supplierLabels: ReadonlyMap<string, string>,
): AdminMaintenanceRow {
  const vehicleId = readText(row, "vehicle_id") ?? "";
  const supplierId = readText(row, "supplier_id");
  const vehicleLabel = vehicleLabels.get(vehicleId) ?? "Unidad sin referencia disponible";
  const supplierLabel =
    supplierId === null ? null : (supplierLabels.get(supplierId) ?? "Proveedor");
  const status = workOrderStatus(row);
  const detail =
    readText(row, "reported_problem") ??
    readText(row, "diagnosis") ??
    readText(row, "maintenance_type") ??
    "Sin detalle";
  const context = [
    vehicleLabel,
    supplierLabel === null ? null : `Taller: ${supplierLabel}`,
    readBoolean(row, "blocks_operation") === true ? "Bloquea programación" : null,
    detail,
  ].filter((value): value is string => value !== null);
  return {
    id: requiredId(row),
    title: detail,
    description: context.join(" · "),
    status: workOrderStatusLabel(status),
    amount: null,
    date: readText(row, "updated_at") ?? readText(row, "created_at"),
    technicalReference: readText(row, "code") ?? undefined,
    recordType: "work_order",
    vehicleId,
    blocksOperation: readBoolean(row, "blocks_operation") === true,
  };
}

function workOrderStatusLabel(status: AdminWorkOrderStatus): string {
  switch (status) {
    case "scheduled":
      return "Programada";
    case "waiting_workshop":
      return "En espera de taller";
    case "in_workshop":
      return "En taller";
    case "in_progress":
      return "En proceso";
    case "waiting_part":
      return "En espera de repuesto";
    case "finished":
      return "Finalizada";
    case "cancelled":
      return "Cancelada";
  }
}

function mapMaintenancePartRow(
  row: Record<string, unknown>,
  partLabels: ReadonlyMap<string, string>,
  supplierLabels: ReadonlyMap<string, string>,
  partUnits: ReadonlyMap<string, string | null>,
): AdminMaintenancePartRow {
  const partId = readText(row, "part_id");
  if (partId === null) throw new Error("La línea de repuesto no tiene repuesto asociado.");
  const supplierId = readText(row, "supplier_id");
  const quantity = readNumber(row, "quantity") ?? 0;
  const unitCost = readNumber(row, "unit_cost") ?? 0;
  const unit = partUnits.get(partId) ?? null;
  const installationOdometerKm = readNumber(row, "installation_odometer_km");
  const supplierLabel =
    supplierId === null ? null : (supplierLabels.get(supplierId) ?? "Proveedor sin nombre");
  return {
    id: requiredId(row),
    title: partLabels.get(partId) ?? "Repuesto sin nombre",
    description: [
      `${formatNumberWithPrecision(quantity, 3)}${unit === null ? "" : ` ${unit}`}`,
      `S/ ${formatNumberWithPrecision(unitCost, 4)} c/u`,
      supplierLabel,
      installationOdometerKm === null ? null : `${formatNumber(installationOdometerKm)} km`,
      readText(row, "notes"),
    ]
      .filter((value): value is string => value !== null)
      .join(" · "),
    status: "Registrado",
    amount: roundMoney(quantity * unitCost),
    date: readText(row, "installed_at"),
    partId,
    supplierId,
    quantity,
    unitCost,
    installedAt: readText(row, "installed_at"),
    installationOdometerKm,
    notes: readText(row, "notes"),
  };
}

function mapMaintenanceEvidenceRow(
  row: Record<string, unknown>,
  fileLabels: ReadonlyMap<string, string>,
): AdminMaintenanceEvidenceRow {
  const fileId = readText(row, "file_id");
  if (fileId === null) throw new Error("La evidencia de la orden no tiene archivo asociado.");
  const notes = readText(row, "notes");
  return {
    id: requiredId(row),
    title: fileLabels.get(fileId) ?? "Archivo privado",
    description:
      notes === null
        ? "Evidencia privada para revisión humana."
        : `Evidencia privada para revisión humana · ${notes}`,
    status: "Adjunta",
    amount: null,
    date: readText(row, "created_at"),
    fileId,
    notes,
  };
}

function mapMaintenanceWorkOrderDetail(
  row: Record<string, unknown>,
  vehicleLabels: ReadonlyMap<string, string>,
  supplierLabels: ReadonlyMap<string, string>,
): AdminMaintenanceDetail {
  const vehicleId = readText(row, "vehicle_id") ?? "";
  const supplierId = readText(row, "supplier_id");
  return {
    id: requiredId(row),
    code: readText(row, "code") ?? "Orden de trabajo",
    vehicleId,
    vehicleLabel: vehicleLabels.get(vehicleId) ?? "Unidad sin referencia disponible",
    supplierId,
    supplierLabel:
      supplierId === null ? null : (supplierLabels.get(supplierId) ?? "Proveedor sin nombre"),
    maintenanceType: readText(row, "maintenance_type") ?? "Sin tipo",
    reportedProblem: readText(row, "reported_problem"),
    diagnosis: readText(row, "diagnosis"),
    workPerformed: readText(row, "work_performed"),
    status: workOrderStatus(row),
    admittedAt: readText(row, "admitted_at"),
    startedAt: readText(row, "started_at"),
    finishedAt: readText(row, "finished_at"),
    odometerKm: readNumber(row, "odometer_km"),
    laborCost: readNumber(row, "labor_cost") ?? 0,
    partsCost: readNumber(row, "parts_cost") ?? 0,
    notes: readText(row, "notes"),
    blocksOperation: readBoolean(row, "blocks_operation") === true,
    createdAt: readText(row, "created_at") ?? "",
    parts: [],
    evidence: [],
  };
}

function mapOperationalCycleRow(
  row: Record<string, unknown>,
  vehicleLabels: ReadonlyMap<string, string>,
  driverLabels: ReadonlyMap<string, string>,
): AdminOperationalCycleRow {
  const vehicleId = readText(row, "vehicle_id");
  const primaryDriverId = readText(row, "primary_driver_id");
  const vehicleLabel =
    vehicleId === null
      ? "Sin unidad asignada"
      : (vehicleLabels.get(vehicleId) ?? "Unidad sin referencia disponible");
  const driverLabel =
    primaryDriverId === null
      ? "Sin conductor principal"
      : (driverLabels.get(primaryDriverId) ?? "Conductor sin referencia disponible");
  const returnStatus = operationalCycleReturnStatus(row);
  return {
    id: requiredId(row),
    title: readText(row, "code") ?? "Ciclo sin código",
    description: `${vehicleLabel} · ${driverLabel} · ${operationalCycleReturnStatusLabel(returnStatus)}`,
    status: operationalCycleStatus(row),
    amount: null,
    date: readText(row, "started_at") ?? readText(row, "created_at"),
    vehicleId,
    primaryDriverId,
    returnStatus,
    notes: readText(row, "notes"),
    version: readNumber(row, "version") ?? 1,
  };
}

function mapOperationalCycleTrip(row: Record<string, unknown>): AdminOperationalCycleTrip {
  const legKind = operationalCycleLegKind(row);
  const sequence = readNumber(row, "cycle_sequence");
  return {
    id: requiredId(row),
    title: readText(row, "code") ?? "Viaje sin código",
    description: [
      `${readText(row, "origin") ?? "Origen"} → ${readText(row, "destination") ?? "Destino"}`,
      legKind === null ? "Sin clasificación de tramo" : operationalCycleLegKindLabel(legKind),
      sequence === null ? null : `Orden ${sequence}`,
    ]
      .filter((value): value is string => value !== null)
      .join(" · "),
    status: readText(row, "operational_status") ?? "draft",
    amount: null,
    date: readText(row, "scheduled_at"),
    legKind,
    sequence,
  };
}

function operationalCycleReturnStatusLabel(value: OperationalCycleReturnStatus): string {
  const labels: Readonly<Record<OperationalCycleReturnStatus, string>> = {
    unidentified: "Retorno sin identificar",
    probable: "Retorno probable",
    confirmed: "Retorno confirmado",
    completed: "Retorno completado",
    empty_return: "Retorno vacío",
  };
  return labels[value];
}

function operationalCycleLegKindLabel(value: OperationalCycleLegKind): string {
  const labels: Readonly<Record<OperationalCycleLegKind, string>> = {
    outbound: "Ida",
    return: "Retorno",
    continuation: "Continuación",
  };
  return labels[value];
}

function formatNumber(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null): string {
  if (value === null || value === "") return "Sin fecha registrada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatNumberWithPrecision(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits }).format(value);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toOption(row: AdminListRow): AdminOption {
  return { id: row.id, label: row.title, status: row.status };
}

function toTripOption(trip: AdminTripRow): AdminOption {
  return {
    id: trip.id,
    label: `${trip.title} · ${trip.code}`,
    status: tripOperationalStatusLabel(trip.operationalStatus),
  };
}

function tripOperationalStatusLabel(status: string): string {
  const labels: Readonly<Record<string, string>> = {
    approved: "Aprobado",
    cancelled: "Cancelado",
    completed: "Finalizado",
    draft: "Borrador",
    in_transit: "En tránsito",
    scheduled: "Programado",
    unloading: "En descarga",
  };
  return labels[status] ?? labelStatus(status);
}

function toTripSetupOption(
  row: Record<string, unknown>,
  labelField: string,
  fallbackLabel: string,
  status: string,
): AdminOption {
  return {
    id: requiredId(row),
    label: readText(row, labelField) ?? fallbackLabel,
    status,
  };
}

function createdTripFromCommand(result: unknown): AdminCreatedTrip {
  if (!isRecord(result)) throw new Error("El servidor no devolvió el viaje creado.");
  const code = readText(result, "code");
  if (code === null) throw new Error("El viaje creado no tiene un código válido.");
  return { id: requiredId(result), code };
}

export function validatePrivateDocumentFile(
  file: Pick<File, "name" | "type" | "size"> | null,
): void {
  if (file === null) return;
  if (file.name.trim() === "" || file.size <= 0)
    throw new Error("Selecciona un archivo real con contenido.");
  if (!allowedPrivateDocumentMimeTypes.has(file.type))
    throw new Error("El archivo debe ser PDF, JPEG, PNG o WebP.");
  if (file.size > maximumPrivateDocumentBytes)
    throw new Error("El archivo supera el límite de 50 MB.");
}

function isPrivateDocumentMimeType(value: string | null): value is PrivateDocumentMimeType {
  return value !== null && allowedPrivateDocumentMimeTypes.has(value);
}

export function makePrivateDocumentStoragePath(
  companyId: string,
  fileId: string,
  originalName: string,
): string {
  if (companyId.trim() === "" || companyId.includes("/") || companyId.includes("\\"))
    throw new Error("El contexto empresarial no es válido.");
  if (fileId.trim() === "" || fileId.includes("/") || fileId.includes("\\"))
    throw new Error("El identificador del archivo no es válido.");
  const safeName = originalName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `companies/${companyId}/documents/${fileId}/${safeName || "document"}`;
}

function describeLoad(row: Record<string, unknown>): string {
  const parts = [
    readText(row, "cargo_type"),
    readNumber(row, "tons") === null ? null : `${formatNumber(readNumber(row, "tons"))} t`,
    readNumber(row, "package_count") === null
      ? null
      : `${formatNumber(readNumber(row, "package_count"))} bultos`,
  ].filter((value): value is string => value !== null);
  return parts.length === 0 ? "Sin cantidad adicional registrada" : parts.join(" · ");
}

function describeFuel(row: Record<string, unknown>): string {
  const parts = [
    readText(row, "location"),
    readNumber(row, "odometer_km") === null
      ? null
      : `${formatNumber(readNumber(row, "odometer_km"))} km`,
    describeReceipt(row),
  ].filter((value): value is string => value !== null && value !== "Sin comprobante registrado");
  return parts.length === 0 ? "Sin detalle adicional" : parts.join(" · ");
}

function describeReceipt(row: Record<string, unknown>): string {
  const receiptType = readText(row, "receipt_type");
  const receiptNumber = readText(row, "receipt_number");
  if (receiptType === null && receiptNumber === null) return "Sin comprobante registrado";
  return [receiptType, receiptNumber].filter(Boolean).join(" ");
}

function describeEvent(row: Record<string, unknown>): string {
  const transition = readText(row, "previous_status");
  const reason = readText(row, "reason");
  const notes = readText(row, "notes");
  return (
    [transition === null ? null : `Desde ${labelStatus(transition)}`, reason, notes]
      .filter((value): value is string => value !== null)
      .join(" · ") || "Sin observaciones"
  );
}

function mapSettlementSummary(
  row: Record<string, unknown> | undefined,
): AdminTripSettlementSummary | null {
  if (row === undefined) return null;
  return {
    id: requiredId(row),
    status: labelStatus(readText(row, "status")),
    totalAdvances: readNumber(row, "total_advances") ?? 0,
    totalExpenses: readNumber(row, "total_expenses") ?? 0,
    balance: readNumber(row, "balance") ?? 0,
    resolutionDirection: readText(row, "resolution_direction"),
    resolutionMethod: readText(row, "resolution_method"),
    resolutionReference: readText(row, "resolution_reference"),
    resolutionNote: readText(row, "resolution_note"),
    resolvedAmount: readNumber(row, "resolved_amount"),
    resolvedAt: readText(row, "resolved_at"),
  };
}
