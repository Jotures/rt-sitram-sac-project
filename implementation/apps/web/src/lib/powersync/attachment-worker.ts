import type { CommonPowerSyncDatabase } from "@powersync/web";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase";

const PRIVATE_BUCKET = "private-documents";
export const MAX_AUTOMATIC_ATTACHMENT_ATTEMPTS = 5;

export interface PendingAttachmentRow {
  readonly id: string;
  readonly entity_type: "fuel_entry" | "expense" | "incident";
  readonly entity_id: string;
  readonly local_uri: string;
  readonly original_name: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly content_hash: string | null;
  readonly remote_file_id: string | null;
  readonly storage_path: string | null;
  readonly attempts: number;
}

export interface AttachmentBlobSource {
  read(localUri: string): Promise<Blob>;
  remove?(localUri: string): Promise<void>;
}

export interface AttachmentRemoteGateway {
  upload(path: string, content: Blob, contentType: string): Promise<void>;
  createFileMetadata(input: {
    readonly id: string;
    readonly companyId: string;
    readonly profileId: string;
    readonly originalName: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly storagePath: string;
    readonly contentHash: string | null;
  }): Promise<void>;
  linkToEntity(input: {
    readonly entityType: PendingAttachmentRow["entity_type"];
    readonly entityId: string;
    readonly fileId: string;
  }): Promise<void>;
}

interface StorageUploadResult {
  readonly error: { readonly message: string } | null;
}
interface MetadataWriteResult {
  readonly error: { readonly code?: string; readonly message: string } | null;
}
interface AttachmentSupabaseClient {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        content: Blob,
        options: { contentType: string; upsert: boolean },
      ): PromiseLike<StorageUploadResult>;
    };
  };
  from(table: "files"): { insert(row: Record<string, unknown>): PromiseLike<MetadataWriteResult> };
  rpc(
    name: "attach_trip_file",
    args: { p_entity_type: string; p_entity_id: string; p_file_id: string },
  ): PromiseLike<MetadataWriteResult>;
}

function safePathSegment(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 120) || "evidence";
}

export function createAttachmentStoragePath(input: {
  readonly companyId: string;
  readonly entityType: PendingAttachmentRow["entity_type"];
  readonly entityId: string;
  readonly fileId: string;
  readonly originalName: string;
}): string {
  return `companies/${input.companyId}/trip-activity/${input.entityType}/${input.entityId}/${input.fileId}-${safePathSegment(input.originalName)}`;
}

export class OpfsAttachmentBlobSource implements AttachmentBlobSource {
  async read(localUri: string): Promise<Blob> {
    const prefix = "opfs://rt-sitram-evidence/";
    if (!localUri.startsWith(prefix) || navigator.storage.getDirectory === undefined) {
      throw new Error("La evidencia local no está disponible en este dispositivo.");
    }

    const fileName = localUri.slice(prefix.length);
    if (!/^[0-9a-f-]{36}$/i.test(fileName))
      throw new Error("La URI local de evidencia no es válida.");
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle("rt-sitram-evidence");
    return (await directory.getFileHandle(fileName)).getFile();
  }

  async remove(localUri: string): Promise<void> {
    const prefix = "opfs://rt-sitram-evidence/";
    if (!localUri.startsWith(prefix) || navigator.storage.getDirectory === undefined) return;
    const fileName = localUri.slice(prefix.length);
    if (!/^[0-9a-f-]{36}$/i.test(fileName)) return;
    try {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle("rt-sitram-evidence");
      await directory.removeEntry(fileName);
    } catch (cause: unknown) {
      if (
        typeof cause === "object" &&
        cause !== null &&
        "name" in cause &&
        cause.name === "NotFoundError"
      ) {
        return;
      }
      throw cause;
    }
  }
}

export function createSupabaseAttachmentGateway(
  client: SupabaseClient<Database>,
): AttachmentRemoteGateway {
  const remote = client as unknown as AttachmentSupabaseClient;
  return {
    async upload(path, content, contentType) {
      const { error } = await remote.storage
        .from(PRIVATE_BUCKET)
        .upload(path, content, { contentType, upsert: true });
      if (error !== null) throw new Error(`No se pudo subir la evidencia: ${error.message}`);
    },
    async createFileMetadata(input) {
      const { error } = await remote.from("files").insert({
        id: input.id,
        company_id: input.companyId,
        original_name: input.originalName,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        storage_path: input.storagePath,
        content_hash: input.contentHash,
        uploaded_by: input.profileId,
      });
      if (error !== null && error.code !== "23505")
        throw new Error(`No se pudo registrar la evidencia: ${error.message}`);
    },
    async linkToEntity(input) {
      const { error } = await remote.rpc("attach_trip_file", {
        p_entity_type: input.entityType,
        p_entity_id: input.entityId,
        p_file_id: input.fileId,
      });
      if (error !== null) throw new Error(`No se pudo vincular la evidencia: ${error.message}`);
    },
  };
}

export async function processNextAttachment(input: {
  readonly database: CommonPowerSyncDatabase;
  readonly blobs: AttachmentBlobSource;
  readonly remote: AttachmentRemoteGateway;
  readonly companyId: string;
  readonly profileId: string;
  readonly now?: Date;
}): Promise<"IDLE" | "UPLOADED" | "FAILED"> {
  const rows = await input.database.getAll<PendingAttachmentRow>(
    `SELECT id, entity_type, entity_id, local_uri, original_name, mime_type, size_bytes,
      content_hash, remote_file_id, storage_path, attempts
     FROM attachment_queue
     WHERE status IN ('pending', 'failed', 'uploading')
       AND attempts < ${MAX_AUTOMATIC_ATTACHMENT_ATTEMPTS}
     ORDER BY created_at LIMIT 1`,
  );
  const row = rows[0];
  if (row === undefined) return "IDLE";

  const fileId = row.remote_file_id ?? crypto.randomUUID();
  const storagePath =
    row.storage_path ??
    createAttachmentStoragePath({
      companyId: input.companyId,
      entityType: row.entity_type,
      entityId: row.entity_id,
      fileId,
      originalName: row.original_name,
    });
  const now = (input.now ?? new Date()).toISOString();
  await input.database.execute(
    "UPDATE attachment_queue SET status = 'uploading', attempts = attempts + 1, remote_file_id = ?, storage_path = ?, last_error = NULL, updated_at = ? WHERE id = ?",
    [fileId, storagePath, now, row.id],
  );

  try {
    const blob = await input.blobs.read(row.local_uri);
    if (blob.size !== row.size_bytes)
      throw new Error("La evidencia local cambió desde que fue registrada.");
    await input.remote.upload(storagePath, blob, row.mime_type);
    await input.remote.createFileMetadata({
      id: fileId,
      companyId: input.companyId,
      profileId: input.profileId,
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      storagePath,
      contentHash: row.content_hash,
    });
    await input.remote.linkToEntity({
      entityType: row.entity_type,
      entityId: row.entity_id,
      fileId,
    });
    await input.database.execute(
      "UPDATE attachment_queue SET status = 'uploaded', last_error = NULL, updated_at = ? WHERE id = ?",
      [now, row.id],
    );
    await input.blobs.remove?.(row.local_uri);
    return "UPLOADED";
  } catch (cause: unknown) {
    const message = cause instanceof Error ? cause.message : "No se pudo subir la evidencia.";
    await input.database.execute(
      "UPDATE attachment_queue SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?",
      [message.slice(0, 500), now, row.id],
    );
    return "FAILED";
  }
}
