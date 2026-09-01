import {
  type ActorContext,
  type Clock,
  type IdGenerator,
  requireSameCompany,
  requireText,
  toIsoTimestamp,
} from "../shared/application";

export type DocumentOwnerType = "COMPANY" | "VEHICLE" | "DRIVER" | "TRIP" | "CLIENT";

export interface PendingDocumentModel {
  readonly id: string;
  readonly companyId: string;
  readonly ownerType: DocumentOwnerType;
  readonly ownerId: string;
  readonly documentType: string;
  readonly number: string | null;
  readonly issuedAt: string | null;
  readonly expiresAt: string | null;
  readonly localFileId: string;
  readonly queuedBy: string;
  readonly queuedAt: string;
  readonly syncStatus: "PENDING";
}

export interface DocumentOfflineStore {
  enqueueDocument(document: PendingDocumentModel): Promise<void>;
  listDocuments(
    ownerType: DocumentOwnerType,
    ownerId: string,
  ): Promise<readonly PendingDocumentModel[]>;
}

export async function queueDocumentOffline(
  dependencies: {
    readonly store: DocumentOfflineStore;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  },
  actor: ActorContext,
  input: {
    readonly companyId: string;
    readonly ownerType: DocumentOwnerType;
    readonly ownerId: string;
    readonly documentType: string;
    readonly number?: string | null;
    readonly issuedAt?: Date | null;
    readonly expiresAt?: Date | null;
    readonly localFileId: string;
  },
): Promise<PendingDocumentModel> {
  requireSameCompany(actor, input.companyId);
  if (actor.role === "accounting") {
    throw new Error("No tienes permiso para adjuntar documentos operativos.");
  }
  if (actor.role === "driver" && input.ownerType !== "TRIP") {
    throw new Error("El conductor solo puede adjuntar documentos a su viaje.");
  }
  if (
    input.issuedAt !== undefined &&
    input.issuedAt !== null &&
    input.expiresAt !== undefined &&
    input.expiresAt !== null &&
    input.expiresAt < input.issuedAt
  ) {
    throw new Error("El vencimiento no puede ser anterior a la emisión.");
  }
  const document: PendingDocumentModel = {
    id: dependencies.ids.next(),
    companyId: actor.companyId,
    ownerType: input.ownerType,
    ownerId: requireText(input.ownerId, "La entidad del documento"),
    documentType: requireText(input.documentType, "El tipo de documento"),
    number: input.number?.trim() || null,
    issuedAt:
      input.issuedAt === undefined || input.issuedAt === null
        ? null
        : toIsoTimestamp(input.issuedAt),
    expiresAt:
      input.expiresAt === undefined || input.expiresAt === null
        ? null
        : toIsoTimestamp(input.expiresAt),
    localFileId: requireText(input.localFileId, "El archivo"),
    queuedBy: actor.profileId,
    queuedAt: toIsoTimestamp(dependencies.clock.now()),
    syncStatus: "PENDING",
  };
  await dependencies.store.enqueueDocument(document);
  return document;
}

export function getDocumentExpiryState(
  expiresAt: string | null,
  asOf: Date,
): "NO_EXPIRY" | "VALID" | "DUE_SOON" | "EXPIRED" {
  if (expiresAt === null) return "NO_EXPIRY";
  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime()) || !Number.isFinite(asOf.getTime())) {
    throw new Error("La fecha del documento no es válida.");
  }
  const days = Math.ceil((expiry.getTime() - asOf.getTime()) / 86_400_000);
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "DUE_SOON";
  return "VALID";
}
