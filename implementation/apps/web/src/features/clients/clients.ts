import {
  type ActorContext,
  type Clock,
  type IdGenerator,
  requireFiniteNonNegative,
  requirePermission,
  requireSameCompany,
  requireText,
  toIsoTimestamp,
} from "../shared/application";

export type ClientRelationship = "DIRECT" | "INTERMEDIARY" | "THIRD_PARTY";

export interface ClientModel {
  readonly id: string;
  readonly companyId: string;
  readonly legalName: string;
  readonly taxId: string | null;
  readonly relationship: ClientRelationship;
  readonly paymentTermsDays: number;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface ClientOfflineStore {
  saveClient(client: ClientModel): Promise<void>;
  getClient(clientId: string): Promise<ClientModel | null>;
  listClients(companyId: string): Promise<readonly ClientModel[]>;
}

export async function createClient(
  dependencies: {
    readonly store: ClientOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  input: {
    readonly legalName: string;
    readonly taxId?: string | null;
    readonly relationship: ClientRelationship;
    readonly paymentTermsDays: number;
  },
): Promise<ClientModel> {
  requirePermission(actor, "MANAGE_MASTER_DATA");
  requireFiniteNonNegative(input.paymentTermsDays, "Los días de pago");
  if (!Number.isInteger(input.paymentTermsDays)) {
    throw new Error("Los días de pago deben ser enteros.");
  }
  const client: ClientModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    legalName: requireText(input.legalName, "El cliente"),
    taxId: input.taxId?.trim() || null,
    relationship: input.relationship,
    paymentTermsDays: input.paymentTermsDays,
    active: true,
    createdAt: toIsoTimestamp(dependencies.clock.now()),
  };
  await dependencies.store.saveClient(client);
  return client;
}

export async function updateClient(
  store: ClientOfflineStore,
  actor: ActorContext,
  client: ClientModel,
  patch: {
    readonly legalName?: string;
    readonly paymentTermsDays?: number;
    readonly active?: boolean;
  },
): Promise<ClientModel> {
  requirePermission(actor, "MANAGE_MASTER_DATA");
  requireSameCompany(actor, client.companyId);
  if (patch.paymentTermsDays !== undefined) {
    requireFiniteNonNegative(patch.paymentTermsDays, "Los días de pago");
    if (!Number.isInteger(patch.paymentTermsDays)) {
      throw new Error("Los días de pago deben ser enteros.");
    }
  }
  const updated: ClientModel = {
    ...client,
    legalName:
      patch.legalName === undefined ? client.legalName : requireText(patch.legalName, "El cliente"),
    paymentTermsDays: patch.paymentTermsDays ?? client.paymentTermsDays,
    active: patch.active ?? client.active,
  };
  await store.saveClient(updated);
  return updated;
}
