import type { DriverStatus } from "@rt-sitram/domain";
import {
  type ActorContext,
  type Clock,
  type IdGenerator,
  requirePermission,
  requireSameCompany,
  requireText,
  toIsoTimestamp,
} from "../shared/application";

export interface DriverModel {
  readonly id: string;
  readonly companyId: string;
  readonly profileId: string | null;
  readonly displayName: string;
  readonly documentNumber: string;
  readonly phone: string;
  readonly licenceNumber: string;
  readonly licenceExpiresAt: string;
  readonly status: DriverStatus;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface DriverOfflineStore {
  saveDriver(driver: DriverModel): Promise<void>;
  listDrivers(companyId: string): Promise<readonly DriverModel[]>;
  getDriver(driverId: string): Promise<DriverModel | null>;
}

export async function createDriver(
  dependencies: {
    readonly store: DriverOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  input: {
    readonly profileId?: string | null;
    readonly displayName: string;
    readonly documentNumber: string;
    readonly phone: string;
    readonly licenceNumber: string;
    readonly licenceExpiresAt: Date;
  },
): Promise<DriverModel> {
  requirePermission(actor, "MANAGE_MASTER_DATA");
  const driver: DriverModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    profileId: input.profileId ?? null,
    displayName: requireText(input.displayName, "El nombre"),
    documentNumber: requireText(input.documentNumber, "El documento"),
    phone: input.phone.trim(),
    licenceNumber: requireText(input.licenceNumber, "La licencia"),
    licenceExpiresAt: toIsoTimestamp(input.licenceExpiresAt),
    status: "AVAILABLE",
    active: true,
    createdAt: toIsoTimestamp(dependencies.clock.now()),
  };
  await dependencies.store.saveDriver(driver);
  return driver;
}

export async function updateDriver(
  store: DriverOfflineStore,
  actor: ActorContext,
  driver: DriverModel,
  patch: { readonly phone?: string; readonly active?: boolean; readonly status?: DriverStatus },
): Promise<DriverModel> {
  requirePermission(actor, "MANAGE_MASTER_DATA");
  requireSameCompany(actor, driver.companyId);
  const updated: DriverModel = {
    ...driver,
    phone: patch.phone?.trim() ?? driver.phone,
    active: patch.active ?? driver.active,
    status: patch.status ?? driver.status,
  };
  await store.saveDriver(updated);
  return updated;
}
