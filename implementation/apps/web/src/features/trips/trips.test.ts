import { describe, expect, it, vi } from "vitest";
import type { ActorContext, Clock, IdGenerator } from "../shared/application";
import {
  approveTrip,
  completeTrip,
  createRpcTripCommandGateway,
  createTripDraft,
  recordDriverActivityOffline,
  scheduleTrip,
  startTrip,
  type TripCommandGateway,
  type TripModel,
  type TripOfflineStore,
} from "./trips";

const clock: Clock = { now: () => new Date("2026-08-13T12:00:00.000Z") };
const ids: IdGenerator = { next: () => "generated-id" };
const admin: ActorContext = {
  profileId: "admin-a",
  companyId: "company-a",
  role: "administration",
};
const driver: ActorContext = {
  profileId: "driver-profile-a",
  companyId: "company-a",
  role: "driver",
};

function createStore(): TripOfflineStore & { createdTrips: TripModel[] } {
  const createdTrips: TripModel[] = [];
  return {
    createdTrips,
    createTrip: (trip) => {
      createdTrips.push(trip);
      return Promise.resolve();
    },
    createCycle: () => Promise.resolve(),
    enqueueDriverActivity: () => Promise.resolve(),
    getTrip: () => Promise.resolve(null),
    listTrips: () => Promise.resolve(createdTrips),
  };
}

function trip(overrides: Partial<TripModel> = {}): TripModel {
  return {
    id: "trip-a",
    companyId: "company-a",
    code: "RT-2026-000001",
    clientId: "client-a",
    cycleId: null,
    vehicleId: "vehicle-a",
    driverId: "driver-a",
    driverProfileId: "driver-profile-a",
    origin: "Cusco",
    destination: "Lima",
    plannedAt: "2026-08-14T08:00:00.000Z",
    operationalStatus: "APPROVED",
    administrativeStatus: "NOT_REQUIRED",
    financialStatus: "UNBILLED",
    initialMileage: null,
    finalMileage: null,
    freight: 3200,
    additionalIncome: 0,
    createdBy: "admin-a",
    createdAt: "2026-08-13T12:00:00.000Z",
    ...overrides,
  };
}

function gateway(): TripCommandGateway {
  return {
    approveTrip: vi.fn(() => Promise.resolve()),
    scheduleTrip: vi.fn(() => Promise.resolve()),
    startTrip: vi.fn(() => Promise.resolve()),
    completeTrip: vi.fn(() => Promise.resolve()),
  };
}

describe("trip application workflows", () => {
  it("creates a local-first draft with company and actor ownership", async () => {
    const store = createStore();
    const created = await createTripDraft({ store, ids, clock }, admin, {
      clientId: "client-a",
      origin: " Cusco ",
      destination: "Lima",
      plannedAt: new Date("2026-08-14T08:00:00.000Z"),
      freight: 3200,
    });
    expect(created).toMatchObject({
      id: "generated-id",
      companyId: "company-a",
      origin: "Cusco",
      operationalStatus: "DRAFT",
      administrativeStatus: "NOT_REQUIRED",
      financialStatus: "UNBILLED",
    });
    expect(store.createdTrips).toEqual([created]);
  });

  it("does not allow a driver to create or approve trips", async () => {
    await expect(
      createTripDraft({ store: createStore(), ids, clock }, driver, {
        clientId: "client",
        origin: "Cusco",
        destination: "Lima",
        plannedAt: new Date(),
        freight: 1,
      }),
    ).rejects.toThrow("No tienes permiso");
    await expect(
      approveTrip(gateway(), driver, trip({ operationalStatus: "DRAFT" })),
    ).rejects.toThrow("No tienes permiso");
  });

  it("delegates approval to the remote authority only for own-company drafts", async () => {
    const commands = gateway();
    await approveTrip(commands, admin, trip({ operationalStatus: "DRAFT" }));
    expect(commands.approveTrip).toHaveBeenCalledWith("trip-a");
    await expect(
      approveTrip(commands, admin, trip({ companyId: "company-b", operationalStatus: "DRAFT" })),
    ).rejects.toThrow("otra empresa");
  });

  it("validates scheduling resources before invoking the remote command", async () => {
    const commands = gateway();
    const resources = {
      vehicle: {
        id: "vehicle-a",
        companyId: "company-a",
        status: "AVAILABLE" as const,
        hasActiveTrip: false,
        hasCriticalMaintenanceBlock: false,
        criticalDocumentsValid: true,
      },
      driver: {
        id: "driver-a",
        companyId: "company-a",
        status: "AVAILABLE" as const,
        hasActiveTrip: false,
        criticalDocumentsValid: true,
      },
    };
    await scheduleTrip(commands, admin, trip(), resources);
    expect(commands.scheduleTrip).toHaveBeenCalledWith({
      tripId: "trip-a",
      vehicleId: "vehicle-a",
      driverId: "driver-a",
    });
    await expect(
      scheduleTrip(commands, admin, trip(), {
        ...resources,
        vehicle: { ...resources.vehicle, hasCriticalMaintenanceBlock: true },
      }),
    ).rejects.toThrow("bloqueo crítico");
  });

  it("delegates context-sensitive start mileage to the authoritative command", async () => {
    const commands = gateway();
    await startTrip(commands, admin, trip({ operationalStatus: "SCHEDULED" }), 999);
    expect(commands.startTrip).toHaveBeenCalledWith({ tripId: "trip-a", initialMileage: 999 });

    await completeTrip(
      commands,
      admin,
      trip({ operationalStatus: "UNLOADING", initialMileage: 1001 }),
      { finalMileage: 2100, cargoDelivered: true, requiredDocumentsSatisfied: true },
    );
    expect(commands.completeTrip).toHaveBeenCalledWith({
      tripId: "trip-a",
      finalMileage: 2100,
      cargoDelivered: true,
    });
  });

  it("queues activity only for the assigned driver and an active trip", async () => {
    const enqueueDriverActivity = vi.fn(() => Promise.resolve());
    const store = { ...createStore(), enqueueDriverActivity };
    const activeTrip = trip({ operationalStatus: "IN_TRANSIT" });
    const activity = await recordDriverActivityOffline({ store, ids, clock }, driver, activeTrip, {
      type: "INCIDENT",
      description: " Pinchazo ",
      severity: "MEDIUM",
    });
    expect(activity).toMatchObject({ type: "INCIDENT", description: "Pinchazo" });
    expect(enqueueDriverActivity).toHaveBeenCalledWith(activity);
    await expect(
      recordDriverActivityOffline(
        { store, ids, clock },
        { ...driver, profileId: "other-driver" },
        activeTrip,
        { type: "ARRIVAL", mileage: 2000 },
      ),
    ).rejects.toThrow("conductor asignado");
  });
});

describe("trip RPC adapter", () => {
  it("maps commands to explicit backend operations", async () => {
    const invoke = vi.fn(() => Promise.resolve(null));
    const commands = createRpcTripCommandGateway({ invoke });
    await commands.scheduleTrip({ tripId: "trip", vehicleId: "vehicle", driverId: "driver" });
    expect(invoke).toHaveBeenCalledWith("schedule_trip", {
      trip_id: "trip",
      vehicle_id: "vehicle",
      driver_id: "driver",
    });
  });
});
