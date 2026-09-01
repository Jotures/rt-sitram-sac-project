import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommonPowerSyncDatabase } from "@powersync/web";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase";
import {
  createSupabaseAdminDataGateway,
  makePrivateDocumentStoragePath,
  validatePrivateDocumentFile,
} from "./admin-data";
import { parseDocumentAssociation } from "./AdminRoutePage";

interface RecordedCall {
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

function clientWithRpc(dataByName: Readonly<Record<string, unknown>> = {}) {
  const calls: RecordedCall[] = [];
  const client = {
    rpc: vi.fn((name: string, args: Readonly<Record<string, unknown>>) => {
      calls.push({ name, args });
      return Promise.resolve({ data: dataByName[name] ?? null, error: null });
    }),
    functions: { invoke: vi.fn(() => Promise.resolve({ data: {}, error: null })) },
    from: vi.fn(() => {
      throw new Error("No se esperaba acceso a tablas.");
    }),
  };
  return {
    client: client as unknown as SupabaseClient<Database>,
    calls,
    invoke: client.functions.invoke,
  };
}

function clientWithRows(rowsByTable: Readonly<Record<string, readonly Record<string, unknown>[]>>) {
  const client = {
    from: vi.fn((table: string) => {
      let selected = [...(rowsByTable[table] ?? [])];
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((field: string, value: string) => {
          selected = selected.filter((row) => row[field] === value);
          return builder;
        }),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        // oxlint-disable-next-line unicorn/no-thenable -- Supabase query builders are PromiseLike.
        then: (
          resolve: (value: { data: unknown; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve({ data: selected, error: null }).then(resolve, reject),
      };
      return builder;
    }),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("Supabase admin data gateway", () => {
  it("composes a vehicle centre from only associated records", async () => {
    const gateway = createSupabaseAdminDataGateway(
      clientWithRows({
        vehicles: [
          {
            id: "vehicle-a",
            plate: "RTS-101",
            current_status: "in_trip",
            current_odometer_km: 1234,
            active: true,
          },
          {
            id: "vehicle-b",
            plate: "RTS-202",
            current_status: "available",
            current_odometer_km: 30,
            active: true,
          },
        ],
        trips: [
          {
            id: "trip-a",
            code: "TR-001",
            vehicle_id: "vehicle-a",
            driver_id: "driver-a",
            origin: "Lima",
            destination: "Cusco",
            operational_status: "in_transit",
            version: 1,
            scheduled_at: "2026-08-30T09:00:00Z",
          },
          {
            id: "trip-b",
            code: "TR-002",
            vehicle_id: "vehicle-b",
            driver_id: null,
            origin: "Cusco",
            destination: "Lima",
            operational_status: "completed",
            version: 1,
            scheduled_at: "2026-08-29T09:00:00Z",
          },
        ],
        drivers: [
          { id: "driver-a", display_name: "Conductor A", current_status: "in_trip", active: true },
        ],
        odometer_entries: [
          {
            id: "odo-a",
            vehicle_id: "vehicle-a",
            trip_id: "trip-a",
            reading_km: 1234,
            reading_at: "2026-08-30T10:00:00Z",
            reading_type: "trip_start",
            source: "command",
          },
        ],
        work_orders: [
          {
            id: "work-a",
            code: "OT-001",
            vehicle_id: "vehicle-a",
            status: "scheduled",
            maintenance_type: "Preventivo",
            blocks_operation: false,
            created_at: "2026-08-20T10:00:00Z",
          },
        ],
        maintenance_plans: [],
        suppliers: [],
        documents: [
          {
            id: "doc-a",
            vehicle_id: "vehicle-a",
            document_type: "SOAT",
            entity_type: "vehicle",
            status: "valid",
            blocks_operation: false,
            created_at: "2026-08-20T10:00:00Z",
          },
        ],
        alerts: [
          {
            id: "alert-a",
            entity_type: "vehicle",
            entity_id: "vehicle-a",
            priority: "high",
            title: "Documento próximo",
            message: "Revisar",
            status: "new",
            generated_at: "2026-08-30T10:00:00Z",
          },
        ],
      }),
    );

    await expect(gateway.loadVehicleDetail("vehicle-a")).resolves.toMatchObject({
      source: "remote",
      vehicle: { title: "RTS-101" },
      activeTrip: { id: "trip-a", driverName: "Conductor A" },
      recentTrips: [{ id: "trip-a" }],
      maintenance: [{ id: "work-a" }],
      documents: [{ id: "doc-a" }],
      alerts: [{ id: "alert-a" }],
    });
  });

  it("creates a trip and its load through one atomic command", async () => {
    const { client, calls } = clientWithRpc({
      create_trip_with_load: { id: "trip-a", code: "V-0001" },
    });
    await expect(
      createSupabaseAdminDataGateway(client).createTrip(
        { companyId: "company-a", profileId: "profile-a" },
        {
          clientId: "client-a",
          origin: "Lima",
          destination: "Arequipa",
          scheduledAt: "2026-08-20T13:30:00.000Z",
          freightAmount: 3_500,
          cargoDescription: "Tubérculos embolsados",
          cargoTons: 18.5,
          freightPricingMode: "total",
          freightRatePerTon: null,
        },
      ),
    ).resolves.toEqual({ id: "trip-a", code: "V-0001" });
    expect(calls).toEqual([
      {
        name: "create_trip_with_load",
        args: {
          client_id: "client-a",
          origin: "Lima",
          destination: "Arequipa",
          scheduled_at: "2026-08-20T13:30:00.000Z",
          freight_amount: 3_500,
          cargo_description: "Tubérculos embolsados",
          cargo_tons: 18.5,
          freight_pricing_mode: "total",
          freight_rate_per_ton: null,
        },
      },
    ]);
    expect(calls[0]?.args).not.toHaveProperty("company_id");
  });

  it("only exposes operationally eligible resources for trip planning", async () => {
    const gateway = createSupabaseAdminDataGateway(
      clientWithRows({
        clients: [
          { id: "client-active", legal_name: "Cliente listo", active: true },
          { id: "client-inactive", legal_name: "Cliente bloqueado", active: false },
        ],
        vehicles: [
          { id: "vehicle-ready", plate: "ABC-123", active: true, current_status: "available" },
          { id: "vehicle-assigned", plate: "DEF-456", active: true, current_status: "assigned" },
          { id: "vehicle-inactive", plate: "GHI-789", active: false, current_status: "available" },
        ],
        drivers: [
          {
            id: "driver-ready",
            display_name: "Conductor listo",
            active: true,
            current_status: "available",
            profile_id: "profile-driver",
          },
          {
            id: "driver-unlinked",
            display_name: "Conductor sin acceso",
            active: true,
            current_status: "available",
            profile_id: null,
          },
          {
            id: "driver-busy",
            display_name: "Conductor ocupado",
            active: true,
            current_status: "assigned",
            profile_id: "profile-driver",
          },
        ],
        profiles: [
          { id: "profile-driver", role: "driver", active: true },
          { id: "profile-inactive", role: "driver", active: false },
        ],
      }),
    );

    await expect(gateway.loadTripSetupOptions()).resolves.toEqual({
      clients: [{ id: "client-active", label: "Cliente listo", status: "Activo" }],
      vehicles: [{ id: "vehicle-ready", label: "ABC-123", status: "Disponible" }],
      drivers: [{ id: "driver-ready", label: "Conductor listo", status: "Disponible" }],
      registeredDrivers: 3,
      driversAwaitingAccess: 1,
    });
  });

  it("uses the public wrapper RPC to approve a trip", async () => {
    const { client, calls } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).approveTrip({ tripId: "trip-a" });
    expect(calls).toEqual([{ name: "approve_trip", args: { trip_id: "trip-a" } }]);
  });

  it("uses the two-argument start wrapper", async () => {
    const { client, calls } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).startTrip({
      tripId: "trip-a",
      odometerKm: 1250,
    });
    expect(calls).toEqual([
      { name: "start_trip", args: { trip_id: "trip-a", initial_mileage: 1250 } },
    ]);
  });

  it("confirms cargo delivery through the public completion wrapper", async () => {
    const { client, calls } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).completeTrip({
      tripId: "trip-b",
      odometerKm: 1400,
      cargoDelivered: true,
    });
    expect(calls).toEqual([
      {
        name: "complete_trip",
        args: { trip_id: "trip-b", final_mileage: 1400, cargo_delivered: true },
      },
    ]);
  });

  it("uses only the authoritative RPC contracts for operational cycles", async () => {
    const { client, calls } = clientWithRpc();
    const gateway = createSupabaseAdminDataGateway(client);

    await gateway.createOperationalCycle({
      id: "cycle-a",
      code: "C-001",
      vehicleId: "vehicle-a",
      primaryDriverId: "driver-a",
      returnStatus: "confirmed",
      notes: "Retorno previsto con carga.",
      idempotencyKey: "cycle-idempotency-a",
    });
    await gateway.updateOperationalCycle({
      cycleId: "cycle-a",
      expectedVersion: 3,
      status: "active",
      returnStatus: "confirmed",
      notes: "Unidad en ruta.",
    });
    await gateway.addTripToOperationalCycle({
      cycleId: "cycle-a",
      tripId: "trip-a",
      legKind: "outbound",
      expectedCycleVersion: 4,
    });
    await gateway.removeTripFromOperationalCycle({
      cycleId: "cycle-a",
      tripId: "trip-a",
      expectedCycleVersion: 5,
      reason: "El cliente reprogramó el servicio.",
    });

    expect(calls).toEqual([
      {
        name: "create_operational_cycle",
        args: {
          p_id: "cycle-a",
          p_code: "C-001",
          p_vehicle_id: "vehicle-a",
          p_primary_driver_id: "driver-a",
          p_return_status: "confirmed",
          p_notes: "Retorno previsto con carga.",
          p_idempotency_key: "cycle-idempotency-a",
        },
      },
      {
        name: "update_operational_cycle",
        args: {
          p_cycle_id: "cycle-a",
          p_expected_version: 3,
          p_status: "active",
          p_return_status: "confirmed",
          p_notes: "Unidad en ruta.",
        },
      },
      {
        name: "add_trip_to_operational_cycle",
        args: {
          p_cycle_id: "cycle-a",
          p_trip_id: "trip-a",
          p_leg_kind: "outbound",
          p_expected_cycle_version: 4,
        },
      },
      {
        name: "remove_trip_from_operational_cycle",
        args: {
          p_cycle_id: "cycle-a",
          p_trip_id: "trip-a",
          p_expected_cycle_version: 5,
          p_reason: "El cliente reprogramó el servicio.",
        },
      },
    ]);
    for (const call of calls) expect(call.args).not.toHaveProperty("company_id");
  });

  it("lists cycle continuity without exposing or combining trip money", async () => {
    const gateway = createSupabaseAdminDataGateway(
      clientWithRows({
        operational_cycles: [
          {
            id: "cycle-a",
            code: "C-001",
            vehicle_id: "vehicle-a",
            primary_driver_id: "driver-a",
            status: "active",
            return_status: "confirmed",
            notes: "Continuidad Lima–Cusco.",
            version: 4,
            started_at: "2026-08-29T08:00:00Z",
            created_at: "2026-08-28T08:00:00Z",
          },
        ],
        vehicles: [
          { id: "vehicle-a", plate: "ABC-123", active: true, current_status: "available" },
          { id: "vehicle-b", plate: "DEF-456", active: true, current_status: "available" },
        ],
        drivers: [
          { id: "driver-a", display_name: "Ana Pérez", active: true, current_status: "available" },
          {
            id: "driver-b",
            display_name: "Bruno Soto",
            active: false,
            current_status: "available",
          },
        ],
        trips: [
          {
            id: "trip-member",
            code: "V-001",
            vehicle_id: "vehicle-a",
            cycle_id: "cycle-a",
            cycle_leg_kind: "outbound",
            cycle_sequence: 1,
            origin: "Lima",
            destination: "Cusco",
            operational_status: "in_transit",
            scheduled_at: "2026-08-29T08:00:00Z",
            freight_amount: 8_500,
          },
          {
            id: "trip-eligible",
            code: "V-002",
            vehicle_id: "vehicle-a",
            cycle_id: null,
            origin: "Cusco",
            destination: "Lima",
            operational_status: "scheduled",
            scheduled_at: "2026-08-30T08:00:00Z",
            freight_amount: 9_100,
          },
          {
            id: "trip-other-cycle",
            code: "V-003",
            vehicle_id: "vehicle-a",
            cycle_id: "cycle-b",
            origin: "Lima",
            destination: "Ica",
            operational_status: "scheduled",
            scheduled_at: "2026-08-31T08:00:00Z",
          },
          {
            id: "trip-other-vehicle",
            code: "V-004",
            vehicle_id: "vehicle-b",
            cycle_id: null,
            origin: "Cusco",
            destination: "Puno",
            operational_status: "scheduled",
            scheduled_at: "2026-08-31T08:00:00Z",
          },
        ],
      }),
    );

    const [cycles, options, detail] = await Promise.all([
      gateway.listOperationalCycles(),
      gateway.loadOperationalCycleOptions(),
      gateway.loadOperationalCycleDetail("cycle-a"),
    ]);

    expect(cycles).toMatchObject([
      {
        id: "cycle-a",
        title: "C-001",
        status: "active",
        amount: null,
        version: 4,
      },
    ]);
    expect(options.vehicles.map((vehicle) => vehicle.id)).toEqual(["vehicle-a", "vehicle-b"]);
    expect(options.drivers.map((driver) => driver.id)).toEqual(["driver-a"]);
    expect(detail.trips).toEqual([
      expect.objectContaining({
        id: "trip-member",
        legKind: "outbound",
        sequence: 1,
        amount: null,
      }),
    ]);
    expect(detail.eligibleTrips).toEqual([
      {
        id: "trip-eligible",
        label: "Cusco → Lima · V-002",
        status: "Programado",
      },
    ]);
  });

  it("passes scheduling errors through for document or maintenance conflicts", async () => {
    const client = {
      rpc: vi.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: "Vehicle has expired blocking documents" },
        }),
      ),
      functions: { invoke: vi.fn() },
      from: vi.fn(),
    } as unknown as SupabaseClient<Database>;
    await expect(
      createSupabaseAdminDataGateway(client).scheduleTrip({
        tripId: "trip-a",
        vehicleId: "vehicle-a",
        driverId: "driver-a",
      }),
    ).rejects.toThrow("Vehicle has expired blocking documents");
  });

  it("uses command wrappers for sensitive financial and alert writes", async () => {
    const { client, calls } = clientWithRpc();
    const gateway = createSupabaseAdminDataGateway(client);
    await gateway.createAdvance(
      { companyId: "company-a", profileId: "profile-a" },
      {
        tripId: "trip-a",
        driverId: "driver-a",
        deliveredAt: "2026-08-13T00:00:00Z",
        amount: 100,
        deliveryMethod: "cash",
        concept: "Peajes",
        idempotencyKey: "idem",
      },
    );
    await gateway.closeSettlement({
      settlementId: "settlement-a",
      resolutionMethod: "Transferencia",
      resolutionReference: "OP-90210",
      resolutionNote: "Saldo regularizado",
    });
    await gateway.createInvoice(
      { companyId: "company-a", profileId: "profile-a" },
      {
        tripId: "trip-a",
        clientId: "client-a",
        series: "F001",
        number: "1",
        issuedOn: "2026-08-13",
        dueOn: "2026-08-30",
        subtotal: 100,
        tax: 18,
      },
    );
    await gateway.registerPayment(
      { companyId: "company-a", profileId: "profile-a" },
      {
        invoiceId: "invoice-a",
        paidAt: "2026-08-14T00:00:00Z",
        amount: 118,
        paymentMethod: "transfer",
        reference: "OP-1",
        paymentId: "unused",
        idempotencyKey: "unused",
      },
    );
    await gateway.resolveAlert(
      { companyId: "company-a", profileId: "profile-a" },
      "alert-a",
      "Documento renovado",
    );
    expect(calls.map((call) => call.name)).toEqual([
      "issue_trip_advance",
      "close_settlement",
      "create_trip_invoice",
      "register_invoice_payment",
      "resolve_alert",
    ]);
    expect(calls[0]?.args).toEqual({
      p_trip_id: "trip-a",
      p_driver_id: "driver-a",
      p_delivered_at: "2026-08-13T00:00:00Z",
      p_amount: 100,
      p_delivery_method: "cash",
      p_concept: "Peajes",
      p_idempotency_key: "idem",
    });
    expect(calls[1]?.args).toEqual({
      settlement_id: "settlement-a",
      resolution_method: "Transferencia",
      resolution_reference: "OP-90210",
      resolution_note: "Saldo regularizado",
    });
    expect(calls[2]?.args).toEqual({
      p_trip_id: "trip-a",
      p_client_id: "client-a",
      p_series: "F001",
      p_number: "1",
      p_issued_on: "2026-08-13",
      p_due_on: "2026-08-30",
      p_subtotal: 100,
      p_tax: 18,
    });
    expect(calls[4]?.args).toEqual({ alert_id: "alert-a", note: "Documento renovado" });
  });

  it("uses the exact authoritative work order completion contract", async () => {
    const { client, calls } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).completeWorkOrder({
      workOrderId: "work-order-a",
      finalMileage: 145_500,
      labourCost: 250,
      partsCost: 700,
    });
    expect(calls).toEqual([
      {
        name: "complete_work_order",
        args: {
          work_order_id: "work-order-a",
          final_mileage: 145_500,
          labour_cost: 250,
          parts_cost: 700,
        },
      },
    ]);
  });

  it("uses the audited maintenance commands without supplying a company id", async () => {
    const { client, calls } = clientWithRpc();
    const gateway = createSupabaseAdminDataGateway(client);
    await gateway.createWorkOrder({
      id: "work-order-a",
      vehicleId: "vehicle-a",
      supplierId: "supplier-a",
      maintenanceType: "Correctivo",
      reportedProblem: "Ruido en suspensión",
      admittedAt: "2026-08-29T13:00:00.000Z",
      blocksOperation: true,
      notes: "Se inmoviliza la unidad.",
      idempotencyKey: "work-order-idempotency-a",
    });
    await gateway.updateWorkOrderProgress({
      workOrderId: "work-order-a",
      supplierId: "supplier-a",
      status: "in_workshop",
      admittedAt: "2026-08-29T13:00:00.000Z",
      startedAt: "2026-08-29T14:00:00.000Z",
      diagnosis: null,
      workPerformed: null,
      notes: "A la espera de diagnóstico.",
      blocksOperation: true,
    });
    await gateway.recordWorkOrderPart({
      id: "part-line-a",
      workOrderId: "work-order-a",
      partId: "part-a",
      supplierId: "supplier-a",
      quantity: 2,
      unitCost: 35.5,
      installedAt: "2026-08-29T15:00:00.000Z",
      installationOdometerKm: 145_000,
      notes: "Juego de bujes.",
      idempotencyKey: "part-line-idempotency-a",
    });
    expect(calls).toEqual([
      {
        name: "create_work_order",
        args: {
          p_id: "work-order-a",
          p_vehicle_id: "vehicle-a",
          p_supplier_id: "supplier-a",
          p_maintenance_type: "Correctivo",
          p_reported_problem: "Ruido en suspensión",
          p_admitted_at: "2026-08-29T13:00:00.000Z",
          p_blocks_operation: true,
          p_notes: "Se inmoviliza la unidad.",
          p_idempotency_key: "work-order-idempotency-a",
        },
      },
      {
        name: "update_work_order_progress",
        args: {
          p_work_order_id: "work-order-a",
          p_supplier_id: "supplier-a",
          p_status: "in_workshop",
          p_admitted_at: "2026-08-29T13:00:00.000Z",
          p_started_at: "2026-08-29T14:00:00.000Z",
          p_diagnosis: null,
          p_work_performed: null,
          p_notes: "A la espera de diagnóstico.",
          p_blocks_operation: true,
        },
      },
      {
        name: "record_work_order_part",
        args: {
          p_id: "part-line-a",
          p_work_order_id: "work-order-a",
          p_part_id: "part-a",
          p_supplier_id: "supplier-a",
          p_quantity: 2,
          p_unit_cost: 35.5,
          p_installed_at: "2026-08-29T15:00:00.000Z",
          p_installation_odometer_km: 145_000,
          p_notes: "Juego de bujes.",
          p_idempotency_key: "part-line-idempotency-a",
        },
      },
    ]);
    expect(calls.flatMap((call) => Object.keys(call.args))).not.toContain("company_id");
  });

  it("loads only active maintenance masters, including reusable parts", async () => {
    const gateway = createSupabaseAdminDataGateway(
      clientWithRows({
        vehicles: [{ id: "vehicle-a", plate: "RTS-101", active: true }],
        suppliers: [
          { id: "supplier-a", legal_name: "Taller A", trade_name: "Taller Central", active: true },
          { id: "supplier-b", legal_name: "Taller B", active: false },
        ],
        parts: [
          {
            id: "part-a",
            internal_code: "BUJ-01",
            name: "Buje de suspensión",
            brand: "Marca A",
            unit: "unidad",
            active: true,
          },
          { id: "part-b", name: "Repuesto inactivo", unit: "unidad", active: false },
        ],
      }),
    );
    await expect(gateway.loadMaintenanceOptions()).resolves.toEqual({
      vehicles: [{ id: "vehicle-a", label: "RTS-101", status: "Activa" }],
      suppliers: [{ id: "supplier-a", label: "Taller Central", status: "Proveedor" }],
      parts: [{ id: "part-a", label: "BUJ-01 · Buje de suspensión · Marca A", status: "unidad" }],
    });
  });

  it("moves an in-transit trip to unloading before completion", async () => {
    const { client, calls } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).transitionTripToUnloading({
      tripId: "trip-a",
      version: 9,
    });
    expect(calls).toEqual([
      {
        name: "transition_trip_operational",
        args: {
          p_trip_id: "trip-a",
          p_target: "unloading",
          p_expected_version: 9,
          p_reason: null,
        },
      },
    ]);
  });

  it("links a driver profile without accepting a company id", async () => {
    const { client, calls } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).linkDriverProfile({
      driverId: "driver-a",
      profileId: "profile-a",
    });
    expect(calls).toEqual([
      {
        name: "link_driver_profile",
        args: { driver_id: "driver-a", profile_id: "profile-a" },
      },
    ]);
    expect(calls[0]?.args).not.toHaveProperty("company_id");
  });

  it("records an expense review decision and its audit note through the command", async () => {
    const { client, calls } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).reviewExpense({
      expenseId: "expense-a",
      validationStatus: "observed",
      approvedAmount: null,
      note: "Falta comprobante legible",
    });
    expect(calls).toEqual([
      {
        name: "review_expense",
        args: {
          expense_id: "expense-a",
          validation_status: "observed",
          approved_amount: null,
          note: "Falta comprobante legible",
        },
      },
    ]);
  });

  it("records an administrative expense through the audited representative command", async () => {
    const { client, calls } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).recordStaffExpense(
      { companyId: "company-a", profileId: "profile-a" },
      {
        recordId: "expense-a",
        tripId: "trip-a",
        categoryId: "category-a",
        supplierId: "supplier-a",
        incurredAt: "2026-08-29T10:15:00.000Z",
        amount: 48.5,
        currency: "PEN",
        receiptType: "Factura",
        receiptNumber: "F001-912",
        description: "Peaje reportado después de la ruta",
        reason: "Regularización del comprobante enviado por el conductor.",
        idempotencyKey: "idem-expense-a",
        receiptFile: null,
      },
    );

    expect(calls).toEqual([
      {
        name: "record_staff_trip_expense",
        args: {
          p_id: "expense-a",
          p_trip_id: "trip-a",
          p_category_id: "category-a",
          p_supplier_id: "supplier-a",
          p_incurred_at: "2026-08-29T10:15:00.000Z",
          p_amount: 48.5,
          p_currency: "PEN",
          p_receipt_type: "Factura",
          p_receipt_number: "F001-912",
          p_receipt_file_id: null,
          p_description: "Peaje reportado después de la ruta",
          p_reason: "Regularización del comprobante enviado por el conductor.",
          p_idempotency_key: "idem-expense-a",
        },
      },
    ]);
    expect(calls[0]?.args).not.toHaveProperty("company_id");
    expect(calls[0]?.args).not.toHaveProperty("created_by");
  });

  it("records an administrative fuel entry through the audited representative command", async () => {
    const { client, calls } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).recordStaffFuelEntry(
      { companyId: "company-a", profileId: "profile-a" },
      {
        recordId: "fuel-a",
        tripId: "trip-a",
        supplierId: "supplier-a",
        fueledAt: "2026-08-29T12:30:00.000Z",
        location: "Nazca",
        odometerKm: 125_430.2,
        quantity: 32.5,
        volumeUnit: "gallon",
        unitPrice: 14.2,
        totalAmount: 461.5,
        currency: "PEN",
        paymentMethod: "Depósito",
        receiptType: "Factura",
        receiptNumber: "F002-115",
        reason: "Registro del abastecimiento informado por el grifo.",
        idempotencyKey: "idem-fuel-a",
        receiptFile: null,
      },
    );

    expect(calls).toEqual([
      {
        name: "record_staff_trip_fuel_entry",
        args: {
          p_id: "fuel-a",
          p_trip_id: "trip-a",
          p_supplier_id: "supplier-a",
          p_fueled_at: "2026-08-29T12:30:00.000Z",
          p_location: "Nazca",
          p_odometer_km: 125_430.2,
          p_quantity: 32.5,
          p_volume_unit: "gallon",
          p_unit_price: 14.2,
          p_total_amount: 461.5,
          p_currency: "PEN",
          p_payment_method: "Depósito",
          p_receipt_type: "Factura",
          p_receipt_number: "F002-115",
          p_receipt_file_id: null,
          p_reason: "Registro del abastecimiento informado por el grifo.",
          p_idempotency_key: "idem-fuel-a",
        },
      },
    ]);
    expect(calls[0]?.args).not.toHaveProperty("company_id");
    expect(calls[0]?.args).not.toHaveProperty("created_by");
  });

  it("loads only active capture masters and the visible trips", async () => {
    const gateway = createSupabaseAdminDataGateway(
      clientWithRows({
        trips: [
          {
            id: "trip-a",
            code: "RT-021",
            origin: "Cusco",
            destination: "Lima",
            operational_status: "in_transit",
            scheduled_at: "2026-08-29T07:00:00Z",
            freight_amount: 6_000,
            version: 1,
          },
        ],
        expense_categories: [
          { id: "category-a", name: "Peajes", code: "TOLL", active: true },
          { id: "category-b", name: "Oculta", code: "HIDE", active: false },
        ],
        suppliers: [
          {
            id: "supplier-a",
            legal_name: "Grifo Ruta Sur SAC",
            trade_name: "Grifo Ruta Sur",
            supplier_type: "fuel",
            active: true,
          },
          {
            id: "supplier-b",
            legal_name: "Inactivo SAC",
            supplier_type: "other",
            active: false,
          },
        ],
      }),
    );

    await expect(gateway.loadStaffCaptureOptions()).resolves.toEqual({
      trips: [
        {
          id: "trip-a",
          label: "Cusco → Lima · RT-021",
          status: "En tránsito",
        },
      ],
      expenseCategories: [{ id: "category-a", label: "Peajes", status: "TOLL" }],
      suppliers: [{ id: "supplier-a", label: "Grifo Ruta Sur", status: "fuel" }],
    });
  });

  it("invites without sending company_id or password", async () => {
    const { client, invoke } = clientWithRpc();
    await createSupabaseAdminDataGateway(client).inviteCompanyUser({
      email: "manager@example.com",
      displayName: "Gerencia",
      role: "management",
    });
    const expectedBody = {
      email: "manager@example.com",
      display_name: "Gerencia",
      role: "management",
    };
    expect(invoke).toHaveBeenCalledWith("invite-company-user", { body: expectedBody });
    expect(expectedBody).not.toHaveProperty("company_id");
    expect(expectedBody).not.toHaveProperty("password");
  });
});

describe("private administrative documents", () => {
  it("allows missing evidence to remain an explicit blocking record", () => {
    expect(() => validatePrivateDocumentFile(null)).not.toThrow();
  });

  it("accepts only the private bucket MIME allowlist", () => {
    expect(() =>
      validatePrivateDocumentFile({ name: "soat.pdf", type: "application/pdf", size: 2_048 }),
    ).not.toThrow();
    expect(() =>
      validatePrivateDocumentFile({ name: "script.html", type: "text/html", size: 100 }),
    ).toThrow("PDF, JPEG, PNG o WebP");
  });

  it("builds a normalized path scoped to the contextual company", () => {
    expect(makePrivateDocumentStoragePath("company-a", "file-a", "P\u00f3liza SOAT 2026.pdf")).toBe(
      "companies/company-a/documents/file-a/Poliza-SOAT-2026.pdf",
    );
    expect(() => makePrivateDocumentStoragePath("../company-b", "file-a", "file.pdf")).toThrow(
      "contexto empresarial",
    );
    expect(() => makePrivateDocumentStoragePath("company-a", "../file-b", "file.pdf")).toThrow(
      "identificador del archivo",
    );
  });

  it("resolves a selected business record without asking the user for an id", () => {
    expect(parseDocumentAssociation("company")).toEqual({
      entityType: "company",
      entityId: null,
    });
    expect(parseDocumentAssociation("vehicle:vehicle-a")).toEqual({
      entityType: "vehicle",
      entityId: "vehicle-a",
    });
    expect(() => parseDocumentAssociation("vehicle:")).toThrow("no es válido");
    expect(() => parseDocumentAssociation("supplier:supplier-a")).toThrow("no es válido");
  });

  it("uploads to private storage and links file metadata to the document", async () => {
    const inserted: { readonly table: string; readonly values: Record<string, unknown> }[] = [];
    const upload = vi.fn(() => Promise.resolve({ data: { path: "stored" }, error: null }));
    const client = {
      storage: { from: vi.fn(() => ({ upload })) },
      from: vi.fn((table: string) => ({
        insert: vi.fn((values: Record<string, unknown>) => {
          inserted.push({ table, values });
          const builder = {
            select: vi.fn(() => builder),
            single: vi.fn(() =>
              Promise.resolve({ data: { id: values.id ?? "generated" }, error: null }),
            ),
          };
          return builder;
        }),
      })),
      rpc: vi.fn(),
      functions: { invoke: vi.fn() },
    } as unknown as SupabaseClient<Database>;
    const file = new File(["evidence"], "SOAT 2026.pdf", { type: "application/pdf" });

    await createSupabaseAdminDataGateway(client).createDocument(
      { companyId: "company-a", profileId: "profile-a" },
      {
        entityType: "vehicle",
        entityId: "vehicle-a",
        documentType: "SOAT",
        documentNumber: "SOAT-2026",
        issuedOn: "2026-01-01",
        expiresOn: "2027-01-01",
        blocksOperation: true,
        file,
      },
    );

    expect(client.storage.from).toHaveBeenCalledWith("private-documents");
    expect(upload).toHaveBeenCalledOnce();
    expect(inserted.map((entry) => entry.table)).toEqual(["files", "documents"]);
    expect(inserted[0]?.values).toMatchObject({
      company_id: "company-a",
      original_name: "SOAT 2026.pdf",
      mime_type: "application/pdf",
      uploaded_by: "profile-a",
    });
    expect(inserted[1]?.values).toMatchObject({
      company_id: "company-a",
      entity_type: "vehicle",
      vehicle_id: "vehicle-a",
      file_id: inserted[0]?.values.id,
      created_by: "profile-a",
    });
  });

  it("attaches evidence later to a previously registered missing document", async () => {
    const inserts: { readonly table: string; readonly values: Record<string, unknown> }[] = [];
    const upload = vi.fn(() => Promise.resolve({ data: { path: "stored" }, error: null }));
    const client = {
      storage: { from: vi.fn(() => ({ upload })) },
      from: vi.fn((table: string) => ({
        insert: vi.fn((values: Record<string, unknown>) => {
          inserts.push({ table, values });
          const builder = {
            select: vi.fn(() => builder),
            single: vi.fn(() => Promise.resolve({ data: { id: values.id }, error: null })),
          };
          return builder;
        }),
        update: vi.fn(),
      })),
      rpc: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      functions: { invoke: vi.fn() },
    } as unknown as SupabaseClient<Database>;
    const file = new File(["evidence"], "revision.pdf", { type: "application/pdf" });

    await createSupabaseAdminDataGateway(client).attachDocumentFile(
      { companyId: "company-a", profileId: "profile-a" },
      {
        documentId: "document-a",
        expectedUpdatedAt: "2026-08-30T10:00:00.000Z",
        file,
      },
    );

    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.table).toBe("files");
    expect(client.rpc).toHaveBeenCalledWith("attach_document_file", {
      p_document_id: "document-a",
      p_file_id: inserts[0]?.values.id,
      p_expected_updated_at: "2026-08-30T10:00:00.000Z",
    });
  });

  it("downloads an allowed private file only after resolving its RLS-protected metadata", async () => {
    const download = vi.fn(() =>
      Promise.resolve({ data: new Blob(["evidence"], { type: "application/pdf" }), error: null }),
    );
    const storage = { from: vi.fn(() => ({ download })) };
    const client = privateFileClient(
      [
        {
          id: "file-a",
          original_name: "SOAT 2026.pdf",
          mime_type: "application/pdf",
          size_bytes: 2_048,
          storage_path: "companies/company-a/documents/file-a/SOAT-2026.pdf",
        },
      ],
      storage,
    );

    await expect(
      createSupabaseAdminDataGateway(client).loadPrivateFile("file-a"),
    ).resolves.toMatchObject({
      originalName: "SOAT 2026.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2_048,
    });
    expect(storage.from).toHaveBeenCalledWith("private-documents");
    expect(download).toHaveBeenCalledWith("companies/company-a/documents/file-a/SOAT-2026.pdf");
  });

  it("does not call Storage when the file metadata is not visible to the session", async () => {
    const download = vi.fn();
    const storage = { from: vi.fn(() => ({ download })) };
    const client = privateFileClient(
      [
        {
          id: "file-visible-to-another-record",
          original_name: "otro.pdf",
          mime_type: "application/pdf",
          size_bytes: 100,
          storage_path: "companies/company-a/documents/other/otro.pdf",
        },
      ],
      storage,
    );

    await expect(
      createSupabaseAdminDataGateway(client).loadPrivateFile("file-without-access"),
    ).rejects.toThrow("No se encontró el archivo solicitado o no tienes acceso.");
    expect(storage.from).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it("does not claim private evidence is available from the offline replica", async () => {
    const download = vi.fn();
    const storage = { from: vi.fn(() => ({ download })) };
    const gateway = createSupabaseAdminDataGateway(privateFileClient([], storage), {
      companyId: "company-a",
      database: { getAll: vi.fn() } as unknown as Pick<CommonPowerSyncDatabase, "getAll">,
      isOffline: () => true,
    });

    await expect(gateway.loadPrivateFile("file-a")).rejects.toThrow("requiere conexión");
    expect(storage.from).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it("returns a safe error when the authorized Storage download fails", async () => {
    const download = vi.fn(() =>
      Promise.resolve({
        data: null,
        error: { message: "companies/company-a/documents/file-a/private.pdf not found" },
      }),
    );
    const storage = { from: vi.fn(() => ({ download })) };
    const client = privateFileClient(
      [
        {
          id: "file-a",
          original_name: "private.pdf",
          mime_type: "application/pdf",
          size_bytes: 100,
          storage_path: "companies/company-a/documents/file-a/private.pdf",
        },
      ],
      storage,
    );

    await expect(createSupabaseAdminDataGateway(client).loadPrivateFile("file-a")).rejects.toThrow(
      "No se pudo recuperar el archivo privado. Vuelve a intentarlo.",
    );
    expect(download).toHaveBeenCalledOnce();
  });

  it("fails closed before download when private metadata declares an unsupported MIME type", async () => {
    const download = vi.fn();
    const storage = { from: vi.fn(() => ({ download })) };
    const client = privateFileClient(
      [
        {
          id: "file-a",
          original_name: "unexpected.html",
          mime_type: "text/html",
          size_bytes: 100,
          storage_path: "companies/company-a/documents/file-a/unexpected.html",
        },
      ],
      storage,
    );

    await expect(createSupabaseAdminDataGateway(client).loadPrivateFile("file-a")).rejects.toThrow(
      "no tiene metadatos válidos",
    );
    expect(storage.from).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it("keeps only opaque file ids in administrative evidence rows", async () => {
    const gateway = createSupabaseAdminDataGateway(
      clientWithRows({
        expenses: [
          {
            id: "expense-a",
            description: "Peaje",
            trip_id: "trip-a",
            amount: 18,
            incurred_at: "2026-08-28T10:00:00Z",
            receipt_file_id: "file-expense-a",
          },
        ],
        advances: [
          {
            id: "advance-a",
            concept: "Viáticos",
            trip_id: "trip-a",
            amount: 120,
            delivered_at: "2026-08-28T08:00:00Z",
            receipt_file_id: "file-advance-a",
          },
        ],
        documents: [
          {
            id: "document-a",
            document_type: "SOAT",
            entity_type: "vehicle",
            file_id: "file-document-a",
            blocks_operation: true,
            created_at: "2026-08-28T08:00:00Z",
          },
        ],
      }),
    );

    const [expenses, advances, documents] = await Promise.all([
      gateway.listExpenses(),
      gateway.listAdvances(),
      gateway.listDocuments(),
    ]);

    expect(expenses[0]).toMatchObject({ fileId: "file-expense-a" });
    expect(advances[0]).toMatchObject({ fileId: "file-advance-a" });
    expect(documents[0]).toMatchObject({ fileId: "file-document-a", hasFile: true });
    expect(expenses[0]).not.toHaveProperty("storagePath");
    expect(advances[0]).not.toHaveProperty("storagePath");
    expect(documents[0]).not.toHaveProperty("storagePath");
  });
});

function privateFileClient(
  files: readonly Record<string, unknown>[],
  storage: { readonly from: ReturnType<typeof vi.fn> },
): SupabaseClient<Database> {
  const client = {
    storage,
    from: vi.fn((table: string) => {
      if (table !== "files") throw new Error(`Unexpected table: ${table}`);
      let selected = [...files];
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((field: string, value: string) => {
          selected = selected.filter((row) => row[field] === value);
          return builder;
        }),
        limit: vi.fn(() => builder),
        // oxlint-disable-next-line unicorn/no-thenable -- Supabase query builders are PromiseLike.
        then: (
          resolve: (value: { readonly data: unknown; readonly error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve({ data: selected, error: null }).then(resolve, reject),
      };
      return builder;
    }),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("connected trip detail", () => {
  it("calculates and labels only the direct margin from validated costs", async () => {
    const client = clientWithRows({
      trips: [
        {
          id: "trip-a",
          code: "RT-001",
          client_id: "client-a",
          vehicle_id: "vehicle-a",
          driver_id: "driver-a",
          origin: "Lima",
          destination: "Cusco",
          scheduled_at: "2026-08-13T10:00:00Z",
          operational_status: "completed",
          administrative_status: "settlement_pending",
          financial_status: "billed",
          freight_amount: 2_000,
          additional_amount: 100,
          currency: "PEN",
          version: 5,
        },
      ],
      clients: [{ id: "client-a", legal_name: "Cliente A" }],
      vehicles: [{ id: "vehicle-a", plate: "ABC-123" }],
      drivers: [{ id: "driver-a", display_name: "Conductor A" }],
      loads: [{ id: "load-a", trip_id: "trip-a", description: "Papas", tons: 12 }],
      odometer_entries: [
        {
          id: "odo-a",
          trip_id: "trip-a",
          reading_km: 1_000,
          reading_at: "2026-08-13T10:00:00Z",
          reading_type: "trip_start",
          source: "command",
        },
        {
          id: "odo-b",
          trip_id: "trip-a",
          reading_km: 1_420,
          reading_at: "2026-08-14T10:00:00Z",
          reading_type: "trip_finish",
          source: "command",
        },
      ],
      fuel_entries: [
        {
          id: "fuel-a",
          trip_id: "trip-a",
          total_amount: 450,
          quantity: 30,
          volume_unit: "gallon",
          validation_status: "validated",
        },
        {
          id: "fuel-b",
          trip_id: "trip-a",
          total_amount: 80,
          quantity: 5,
          volume_unit: "gallon",
          validation_status: "pending_review",
        },
      ],
      expenses: [
        {
          id: "expense-a",
          trip_id: "trip-a",
          amount: 150,
          approved_amount: 140,
          validation_status: "validated",
        },
        { id: "expense-b", trip_id: "trip-a", amount: 50, validation_status: "observed" },
      ],
      advances: [],
      settlements: [
        {
          id: "settlement-a",
          trip_id: "trip-a",
          driver_id: "driver-a",
          started_at: "2026-08-14T10:00:00Z",
          total_advances: 800,
          total_expenses: 590,
          balance: 210,
          status: "closed",
          version: 2,
          resolution_direction: "DRIVER_RETURNS",
          resolution_method: "Transferencia",
          resolution_reference: "OP-90210",
          resolution_note: "Depósito verificado",
          resolved_amount: 210,
          resolved_at: "2026-08-15T12:00:00Z",
        },
      ],
      invoices: [],
      documents: [],
      incidents: [],
      trip_status_events: [],
      payments: [],
    });
    const detail = await createSupabaseAdminDataGateway(client).loadTripDetail("trip-a");
    expect(detail.clientName).toBe("Cliente A");
    expect(detail.distanceKm).toBe(420);
    expect(detail.financials).toMatchObject({
      serviceIncome: 2_100,
      validatedFuelCost: 450,
      approvedExpenseCost: 140,
      validatedDirectCost: 590,
      directMargin: 1_510,
      pendingCostRecords: 2,
    });
    expect(detail.settlement).toMatchObject({
      balance: 210,
      resolutionDirection: "DRIVER_RETURNS",
      resolutionMethod: "Transferencia",
      resolutionReference: "OP-90210",
      resolutionNote: "Depósito verificado",
      resolvedAmount: 210,
      resolvedAt: "2026-08-15T12:00:00Z",
    });
  });
});

describe("administrative offline read fallback", () => {
  function unavailableRemoteClient(): SupabaseClient<Database> {
    return {
      from: vi.fn(() => {
        throw new TypeError("Failed to fetch");
      }),
      rpc: vi.fn(),
      functions: { invoke: vi.fn() },
    } as unknown as SupabaseClient<Database>;
  }

  it("reads a company-scoped master from SQLite and marks it as a local copy", async () => {
    const getAll = vi.fn(() =>
      Promise.resolve([
        {
          id: "client-a",
          company_id: "company-a",
          legal_name: "Cliente Offline",
          active: 1,
          updated_at: "2026-08-16T10:00:00Z",
          __offline_snapshot: 1,
        },
      ]),
    );
    const gateway = createSupabaseAdminDataGateway(unavailableRemoteClient(), {
      companyId: "company-a",
      database: { getAll } as unknown as Pick<CommonPowerSyncDatabase, "getAll">,
      isOffline: () => true,
    });

    await expect(gateway.listClients()).resolves.toEqual([
      expect.objectContaining({
        id: "client-a",
        title: "Cliente Offline",
        description: expect.stringContaining("Copia local") as string,
        status: "Activo",
      }),
    ]);
    expect(getAll).toHaveBeenCalledWith(expect.stringContaining("r.company_id = ?"), ["company-a"]);
  });

  it("builds a truthful partial trip detail from synchronized operational tables", async () => {
    const getAll = vi.fn((sql: string) => {
      if (sql.includes("FROM trips t"))
        return Promise.resolve([
          {
            id: "trip-a",
            company_id: "company-a",
            code: "RT-OFFLINE",
            origin: "Lima",
            destination: "Ica",
            scheduled_at: "2026-08-16T08:00:00Z",
            operational_status: "completed",
            administrative_status: "settlement_pending",
            financial_status: "unbilled",
            version: 4,
            client_legal_name: "Cliente A",
            vehicle_plate: "ABC-123",
            driver_display_name: "Conductora A",
          },
        ]);
      if (sql.includes("FROM odometer_entries"))
        return Promise.resolve([
          {
            id: "odo-finish",
            trip_id: "trip-a",
            reading_km: 1_250,
            reading_at: "2026-08-16T18:00:00Z",
            reading_type: "trip_finish",
          },
          {
            id: "odo-start",
            trip_id: "trip-a",
            reading_km: 1_000,
            reading_at: "2026-08-16T08:00:00Z",
            reading_type: "trip_start",
          },
        ]);
      if (sql.includes("FROM fuel_entries"))
        return Promise.resolve([
          {
            id: "fuel-a",
            trip_id: "trip-a",
            quantity: 20,
            volume_unit: "gal",
            total_amount: 300,
            fueled_at: "2026-08-16T11:00:00Z",
          },
        ]);
      if (sql.includes("FROM expenses"))
        return Promise.resolve([
          {
            id: "expense-a",
            trip_id: "trip-a",
            description: "Peaje",
            amount: 18,
            incurred_at: "2026-08-16T12:00:00Z",
          },
        ]);
      if (sql.includes("FROM settlements"))
        return Promise.resolve([
          {
            id: "settlement-a",
            trip_id: "trip-a",
            total_advances: 500,
            total_expenses: 318,
            balance: 182,
            status: "pending",
            resolution_method: null,
          },
        ]);
      if (sql.includes("FROM incidents")) return Promise.resolve([]);
      throw new Error(`Unexpected local query: ${sql}`);
    });
    const gateway = createSupabaseAdminDataGateway(unavailableRemoteClient(), {
      companyId: "company-a",
      database: { getAll } as unknown as Pick<CommonPowerSyncDatabase, "getAll">,
      isOffline: () => true,
    });

    const detail = await gateway.loadTripDetail("trip-a");
    expect(detail.source).toBe("local");
    expect(detail.distanceKm).toBe(250);
    expect(detail.fuelEntries[0]?.amount).toBe(300);
    expect(detail.expenses[0]?.amount).toBe(18);
    expect(detail.settlement?.balance).toBe(182);
    expect(detail.unavailableSections).toContain("financials");
    expect(detail.unavailableSections).toContain("documents");
  });

  it("keeps the offline dashboard operational without inventing invoices or alerts", async () => {
    const getAll = vi.fn((sql: string) => {
      if (sql.includes("FROM vehicles"))
        return Promise.resolve([
          {
            id: "vehicle-a",
            company_id: "company-a",
            plate: "ABC-123",
            current_status: "available",
            active: 1,
            __offline_snapshot: 1,
          },
        ]);
      if (sql.includes("FROM trips")) return Promise.resolve([]);
      if (sql.includes("FROM settlements")) return Promise.resolve([]);
      throw new Error(`Unexpected local query: ${sql}`);
    });
    const gateway = createSupabaseAdminDataGateway(unavailableRemoteClient(), {
      companyId: "company-a",
      database: { getAll } as unknown as Pick<CommonPowerSyncDatabase, "getAll">,
      isOffline: () => true,
    });

    const dashboard = await gateway.loadDashboard();
    expect(dashboard.source).toBe("local");
    expect(dashboard.vehicles).toHaveLength(1);
    expect(dashboard.invoices).toEqual([]);
    expect(dashboard.alerts).toEqual([]);
    expect(dashboard.unavailableMetrics).toEqual(["invoices", "alerts"]);
  });

  it("keeps unsynchronized administrative modules online-only", async () => {
    const database = {
      getAll: vi.fn(),
    } as unknown as Pick<CommonPowerSyncDatabase, "getAll">;
    const gateway = createSupabaseAdminDataGateway(unavailableRemoteClient(), {
      companyId: "company-a",
      database,
      isOffline: () => true,
    });
    await expect(gateway.listDocuments()).rejects.toThrow("requiere conexión");
    expect(database.getAll).not.toHaveBeenCalled();
  });

  it("does not bypass an authorization error with cached rows", async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error("permission denied for table profiles");
      }),
      rpc: vi.fn(),
      functions: { invoke: vi.fn() },
    } as unknown as SupabaseClient<Database>;
    const database = {
      getAll: vi.fn(() =>
        Promise.resolve([
          {
            id: "profile-forbidden",
            company_id: "company-a",
            display_name: "No debe mostrarse",
            role: "management",
            active: 1,
          },
        ]),
      ),
    } as unknown as Pick<CommonPowerSyncDatabase, "getAll">;
    const gateway = createSupabaseAdminDataGateway(client, {
      companyId: "company-a",
      database,
      isOffline: () => false,
    });

    await expect(gateway.listProfiles()).rejects.toThrow("permission denied");
    expect(database.getAll).not.toHaveBeenCalled();
  });
});
